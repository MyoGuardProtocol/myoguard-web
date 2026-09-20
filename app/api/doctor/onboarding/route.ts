export const dynamic = 'force-dynamic';

import { createHmac } from 'node:crypto';
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { prisma } from "@/src/lib/prisma";
import { resolveActiveShareCard } from "@/src/lib/share/shareAccess";
import { escapeHtml } from "@/src/lib/email/templates/BaseEmail";
import { consumeRecipientBudget } from "@/src/lib/emailThrottle";
import {
  OnboardingSchema,
  resolveVerifiedPrimaryEmail,
  verifiedEmailMatchesBody,
  decideRoleTransition,
  decideApplicationOwnership,
  decideApplicationStatus,
  shouldRefreshAdminToken,
} from "@/src/lib/onboardingIdentity";
import { sendServiceEmail } from "@/src/lib/communications/serviceEmail";

/**
 * Retained for the admin review notification only — a fixed send to the
 * literal admin@myoguard.health, classified OPERATIONAL_INTERNAL and
 * deliberately outside Phase 1D-C3E recipient-preference governance.
 */
const resend = new Resend(process.env.RESEND_API_KEY);

/** Template identity recorded on CommunicationEvent — never the rendered output. */
const TEMPLATE_ID_PHYSICIAN = "service.physician_onboarding_received.v1";

/**
 * POST /api/doctor/onboarding
 *
 * Physician onboarding for a caller who ALREADY holds a Clerk session.
 * (Unauthenticated physician sign-up goes through /api/doctor/register,
 * which creates the Clerk account first.)
 *
 * AUTHORIZATION — Phase 1D-S3B containment
 *   The route previously called auth() without enforcing the result and
 *   treated the request-body email as the identity. Both are now closed:
 *
 *     1. a valid Clerk session is required — no session, no side effect
 *     2. identity is the Clerk-verified PRIMARY email, resolved server-side
 *     3. a body email that disagrees with it is refused, not preferred
 *     4. an application owned by a different Clerk identity is never overwritten
 *     5. an admin's decision (APPROVED / FLAGGED) survives resubmission
 *     6. recipient throttling and HTML escaping now apply here too
 *
 * The request shape is unchanged so neither existing caller needs editing.
 */
export async function POST(req: Request) {
  try {
    // ── 1. Authentication — no session, no side effect ───────────────────────
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    // ── 2. Request contract ──────────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = OnboardingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const { fullName, email: bodyEmail, country, specialty, npiNumber, licenseNumber, inviteToken } =
      parsed.data;

    // ── 3. Server-side identity — Clerk-verified PRIMARY email ───────────────
    // Never emailAddresses[0]: that array includes unverified addresses and
    // its order is not a contract.
    const clerkUser = await currentUser();
    const primary   = resolveVerifiedPrimaryEmail(clerkUser);

    if (!primary.ok) {
      console.error(`[onboarding] primary email unusable (${primary.reason}) for ${userId}`);
      return NextResponse.json(
        { ok: false, error: "A verified primary email address is required on your account." },
        { status: 403 },
      );
    }
    const verifiedEmail = primary.email;

    // The body email is accepted for contract compatibility but is not the
    // identity. Disagreement means the caller is asserting an address that is
    // not theirs — refuse rather than silently preferring either side.
    if (!verifiedEmailMatchesBody(bodyEmail, verifiedEmail)) {
      console.warn('[onboarding] body email did not match verified primary — refused');
      return NextResponse.json(
        { ok: false, error: "Submitted email does not match your verified account email." },
        { status: 403 },
      );
    }

    // ── 4. Ownership — never overwrite another identity's application ────────
    const existingApplication = await prisma.physicianApplication.findUnique({
      where:  { email: verifiedEmail },
      select: { clerkUserId: true, status: true },
    });

    const ownership = decideApplicationOwnership({
      existing:      existingApplication,
      callerClerkId: userId,
    });

    if (!ownership.allowed) {
      console.warn('[onboarding] refused — application belongs to another Clerk identity');
      return NextResponse.json(
        { ok: false, error: "An application already exists for this email address." },
        { status: 409 },
      );
    }

    // ── 5. Admin review token (only when a review is genuinely outstanding) ──
    const tokenSecret = process.env.ADMIN_TOKEN_SECRET;
    if (!tokenSecret) {
      console.error('[onboarding] ADMIN_TOKEN_SECRET is not set — cannot generate admin token');
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
    }

    const existingStatus = existingApplication?.status ?? null;
    const nextStatus     = decideApplicationStatus(existingStatus);
    const refreshToken   = shouldRefreshAdminToken(existingStatus);

    const timestamp        = Date.now();
    const adminToken       = createHmac('sha256', tokenSecret)
      .update(`${verifiedEmail}:${timestamp}`)
      .digest('hex');
    const adminTokenExpiry = new Date(timestamp + 48 * 60 * 60 * 1000);

    // ── 6. User row — own row only, role never downgraded ────────────────────
    const existingUser = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true },
    });
    const nextRole = decideRoleTransition(existingUser?.role ?? null);

    try {
      await prisma.user.upsert({
        where:  { clerkId: userId },
        create: {
          clerkId:            userId,
          email:              verifiedEmail,
          fullName,
          role:               nextRole,
          subscriptionStatus: 'FREE',
        },
        update: {
          role:  nextRole,
          fullName,
          email: verifiedEmail,
        },
      });
    } catch (e: unknown) {
      // The only realistic cause is another User row already holding this
      // email under a different clerkId. Rebinding that row is deliberately
      // NOT done here — identity rebinding is finding A-4 and is out of scope.
      console.error('[onboarding] user upsert failed:', e);
      return NextResponse.json(
        { ok: false, error: "This email is already associated with another account." },
        { status: 409 },
      );
    }

    // ── 7. Application row — status preserved, ownership stamped ─────────────
    let applicationId = "";
    try {
      const saved = await prisma.physicianApplication.upsert({
        where: { email: verifiedEmail },
        update: {
          name:        fullName,
          country,
          specialty,
          license:     licenseNumber ?? null,
          npi:         npiNumber ?? null,
          status:      nextStatus,
          clerkUserId: userId,
          ...(refreshToken ? { adminToken, adminTokenExpiry } : {}),
        },
        create: {
          name:        fullName,
          email:       verifiedEmail,
          country,
          specialty,
          license:     licenseNumber ?? null,
          npi:         npiNumber ?? null,
          status:      nextStatus,
          clerkUserId: userId,
          adminToken,
          adminTokenExpiry,
        },
      });
      applicationId = saved.id;
    } catch (dbError: unknown) {
      console.error("[onboarding] DB save failed:", dbError);
    }

    // No email may announce a submission the database did not record.
    if (!applicationId) {
      console.error("[onboarding] applicationId is empty — aborting before any email");
      return NextResponse.json(
        { ok: false, error: "Failed to save application" },
        { status: 500 },
      );
    }

    // ── 8. Pending patient invitation (physician arrived from a shared report) ─
    if (inviteToken) {
      try {
        // Same rule as registration: no pending invitation from a lapsed link.
        const access = await resolveActiveShareCard(inviteToken);
        if (access.ok) {
          const physicianRow = await prisma.user.findUnique({
            where:  { clerkId: userId },
            select: { id: true },
          });
          if (physicianRow) {
            const existing = await prisma.physicianPatientInvitation.findFirst({
              where:  { shareToken: inviteToken, claimedByUserId: physicianRow.id },
              select: { id: true },
            });
            if (!existing) {
              await prisma.physicianPatientInvitation.create({
                data: {
                  shareToken:      inviteToken,
                  patientUserId:   access.card.userId,
                  status:          "PENDING",
                  claimedByUserId: physicianRow.id,
                  expiresAt:       new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              });
            }
          }
        }
      } catch (e: unknown) {
        console.warn("[onboarding] invite store failed:", e);
      }
    }

    // ── 9. Recipient throttle — last gate before any provider call ───────────
    // Shared budget with the other public email routes, keyed on the verified
    // recipient. Reached only by an authenticated, schema-valid, ownership-
    // checked request, so malformed and anonymous traffic never consumes it.
    const throttle = await consumeRecipientBudget(verifiedEmail);

    if (throttle.outcome === 'throttled') {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
    if (throttle.outcome === 'unavailable') {
      return NextResponse.json(
        { ok: false, error: "Temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }

    // ── 10. Email bodies — every interpolated value encoded ──────────────────
    // All of these are caller-controlled or database-derived. The admin
    // notification matters most: it carries the approve / flag action links.
    const eName      = escapeHtml(fullName);
    const eEmail     = escapeHtml(verifiedEmail);
    const eCountry   = escapeHtml(country);
    const eSpecialty = escapeHtml(specialty);
    const eNpi       = escapeHtml(npiNumber ?? "Not provided");
    const eLicence   = escapeHtml(licenseNumber ?? "Not provided");
    const eCredential = escapeHtml(licenseNumber ?? npiNumber ?? "Not provided");
    const eGreeting  = escapeHtml(fullName.replace(/^Dr\.?\s*/i, ''));

    const approveUrl = `https://myoguard.health/api/admin/verify-physician?token=${adminToken}&action=approve`;
    const flagUrl    = `https://myoguard.health/api/admin/verify-physician?token=${adminToken}&action=flag`;

    console.log("[onboarding] application.id:", applicationId, "status:", nextStatus);

    // Admin notification — dark header, HMAC-secured action buttons
    try {
      await resend.emails.send({
        from:    "MyoGuard Clinical <admin@myoguard.health>",
        to:      "admin@myoguard.health",
        replyTo: "admin@myoguard.health",
        subject: `Physician Credential Review — ${fullName}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="background:#1a1a1a;padding:28px 32px;border-radius:12px 12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Myo</span><span style="font-size:22px;font-weight:700;color:#2dd4bf;">Guard</span>
              <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;letter-spacing:0.05em;text-transform:uppercase;">Clinical Platform</span>
            </td>
            <td align="right">
              <span style="display:inline-block;background:#1f2937;color:#9ca3af;font-size:11px;padding:4px 10px;border-radius:20px;border:1px solid #374151;">Credential Review</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:36px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

        <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0f172a;font-family:Georgia,serif;">Physician Credential Review</h1>
        <p style="margin:0 0 28px;font-size:13px;color:#64748b;">A new physician has submitted credentials for review. Verify and take action below.</p>

        <!-- Details table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:28px;">
          <tr style="background:#f8fafc;">
            <td colspan="2" style="padding:12px 16px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e2e8f0;">Applicant Details</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;width:35%;">Full name</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;">${eName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;background:#fafafa;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Email</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${eEmail}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Country</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${eCountry}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;background:#fafafa;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Specialty</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${eSpecialty}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">NPI</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${eNpi}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Licence</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${eLicence}</td>
          </tr>
        </table>

        <!-- Notice -->
        <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin-bottom:28px;">
          <p style="margin:0;font-size:13px;color:#92400e;"><strong>Action required within 48 hours.</strong> This link expires after that.</p>
        </div>

        <!-- Action buttons -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="48%" align="center">
              <a href="${approveUrl}"
                 style="display:block;background:#059669;color:#ffffff;padding:15px 20px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;text-align:center;">
                &#10003; Authorise Access
              </a>
            </td>
            <td width="4%"></td>
            <td width="48%" align="center">
              <a href="${flagUrl}"
                 style="display:block;background:#475569;color:#ffffff;padding:15px 20px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;text-align:center;">
                &#9873; Flag for Review
              </a>
            </td>
          </tr>
        </table>

      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
          Meridian Wellness Systems LLC &middot; HIPAA-aligned credential review &middot; myoguard.health
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>
      `,
      });
    } catch (err) {
      // The application is already saved; a mail failure must not present as a
      // failed submission or invite a retry that burns throttle budget.
      console.error("[onboarding] admin notification failed:", err);
    }

    // Physician confirmation
    try {
      // Phase 1D-C3E: governed. ESSENTIAL_SERVICE, sent to `verifiedEmail` —
      // the Clerk-verified primary address the S3 identity layer already
      // resolved. No second resolver is introduced here; the authoritative
      // value is reused as-is.
      //
      // Still after the save and still non-fatal: the application is persisted
      // before this runs, and a suppressed or failed confirmation does not
      // undo it.
      await sendServiceEmail({
        to:         verifiedEmail,
        subject:    "Your MyoGuard Physician Application — Received",
        from:       "MyoGuard Clinical <admin@myoguard.health>",
        templateId: TEMPLATE_ID_PHYSICIAN,
        context:    "physician:onboarding-received",
        html: `
<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
      <span style="color:#ffffff;">Myo</span><span style="color:#2dd4bf;">Guard</span>
      <span style="color:#94a3b8;font-size:14px;font-weight:400;display:block;margin-top:4px;">Protocol Platform</span>
    </h1>
  </div>
  <div style="padding:32px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Application received, Dr. ${eGreeting}</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Thank you for applying for credentialed access to the MyoGuard Protocol platform.
      Our clinical team reviews all physician credentials individually.
    </p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">Expected review time: 6&ndash;24 hours</p>
      <p style="margin:4px 0 0;font-size:13px;color:#15803d;">You will receive a separate email once your account is activated.</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Application Summary</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:6px 0;color:#64748b;width:40%;">Full name</td><td style="padding:6px 0;font-weight:600;color:#0f172a;">${eName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Country</td><td style="padding:6px 0;color:#0f172a;">${eCountry}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Specialty</td><td style="padding:6px 0;color:#0f172a;">${eSpecialty}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Licence / NPI</td><td style="padding:6px 0;color:#0f172a;">${eCredential}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#64748b;line-height:1.6;">
      Questions? Contact us at
      <a href="mailto:admin@myoguard.health" style="color:#0d9488;">admin@myoguard.health</a>
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;">
    &copy; 2026 Meridian Wellness Systems LLC &middot; myoguard.health
  </p>
</div>
        `,
      });
    } catch (err) {
      console.error("[onboarding] physician email failed:", err);
    }

    return NextResponse.json({ ok: true });

  } catch (error: unknown) {
    console.error("[onboarding] error:", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
