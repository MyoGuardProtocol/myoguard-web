/**
 * POST /api/doctor/register
 *
 * Fully custom physician registration — no Clerk-hosted UI.
 * Creates the Clerk user programmatically, writes DB rows, and sends the
 * HMAC-secured admin review email.  No verification email is sent to the
 * physician here; they receive exactly one email: the activation link after
 * admin approval (sent by /api/admin/verify-physician).
 *
 * Required environment variables:
 *   CLERK_SECRET_KEY    — Clerk backend API key (sk_live_... or sk_test_...)
 *   ADMIN_TOKEN_SECRET  — HMAC secret for one-click admin action tokens
 *   RESEND_API_KEY      — Resend email API key
 */

export const dynamic = "force-dynamic";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/src/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// Clerk user creation
// ---------------------------------------------------------------------------

interface ClerkErrorResponse {
  errors?: Array<{ code: string; message: string; long_message?: string }>;
}

interface ClerkUser {
  id: string;
}

async function createClerkUser(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ clerkUserId: string } | { error: string; status: number }> {
  const res = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      first_name:            params.firstName,
      last_name:             params.lastName,
      email_address:         [params.email],
      password:              params.password,
      skip_password_checks:  false,
      public_metadata:       { role: "PHYSICIAN_PENDING" },
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as ClerkErrorResponse;
    const code  = body.errors?.[0]?.code ?? "";
    const isdup = code === "form_identifier_exists" ||
                  code === "form_param_format_invalid" ||
                  res.status === 422;

    if (isdup && code === "form_identifier_exists") {
      return { error: "An account with this email already exists.", status: 409 };
    }

    const msg = body.errors?.[0]?.long_message ?? body.errors?.[0]?.message ?? "Account creation failed.";
    return { error: msg, status: res.status };
  }

  const user = (await res.json()) as ClerkUser;
  return { clerkUserId: user.id };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      fullName:       string;
      email:          string;
      password:       string;
      country:        string;
      specialty:      string;
      npiNumber?:     string;
      licenseNumber?: string;
      inviteToken?:   string;
    };

    const { fullName, email, password, country, specialty, npiNumber, licenseNumber, inviteToken } = body;

    // ── Basic validation ────────────────────────────────────────────────────
    if (!fullName || fullName.trim().length < 2)
      return NextResponse.json({ ok: false, error: "Full name is required." }, { status: 422 });
    if (!email || !email.includes("@"))
      return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 422 });
    if (!password || password.length < 8)
      return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 422 });
    if (!country)
      return NextResponse.json({ ok: false, error: "Country is required." }, { status: 422 });
    if (!specialty)
      return NextResponse.json({ ok: false, error: "Specialty is required." }, { status: 422 });

    // ── Split name for Clerk ────────────────────────────────────────────────
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName  = nameParts.slice(1).join(" ") || "-";

    // ── Create Clerk user ────────────────────────────────────────────────────
    let clerkResult: Awaited<ReturnType<typeof createClerkUser>>;
    try {
      clerkResult = await createClerkUser({ firstName, lastName, email, password });
    } catch (e: unknown) {
      console.error("[register] CLERK FAILED:", e);
      return NextResponse.json({ ok: false, error: "Clerk user creation failed", detail: String(e) }, { status: 500 });
    }
    if ("error" in clerkResult) {
      return NextResponse.json({ ok: false, error: clerkResult.error }, { status: clerkResult.status });
    }
    const { clerkUserId } = clerkResult;

    // ── Upsert User row in DB ────────────────────────────────────────────────
    let physicianUserId: string | null = null;
    try {
      const upsertedUser = await prisma.user.upsert({
        where:  { clerkId: clerkUserId },
        create: {
          clerkId:            clerkUserId,
          email,
          fullName,
          role:               "PHYSICIAN_PENDING",
          subscriptionStatus: "FREE",
        },
        update: { role: "PHYSICIAN_PENDING" },
      });
      physicianUserId = upsertedUser.id;
    } catch (e: unknown) {
      console.error("[register] USER UPSERT FAILED:", e);
      return NextResponse.json({ ok: false, error: "User DB upsert failed", detail: String(e) }, { status: 500 });
    }

    // ── Generate HMAC admin token (valid 48 h) ───────────────────────────────
    const tokenSecret = process.env.ADMIN_TOKEN_SECRET;
    if (!tokenSecret) {
      console.error("[register] ADMIN_TOKEN_SECRET is not set — cannot generate admin token");
      return NextResponse.json({ ok: false, error: "Server configuration error" }, { status: 500 });
    }
    const timestamp        = Date.now();
    const adminToken       = createHmac("sha256", tokenSecret)
      .update(`${email}:${timestamp}`)
      .digest("hex");
    const adminTokenExpiry = new Date(timestamp + 48 * 60 * 60 * 1000);

    // ── Create PhysicianApplication row ─────────────────────────────────────
    let application: Awaited<ReturnType<typeof prisma.physicianApplication.upsert>>;
    try {
      application = await prisma.physicianApplication.upsert({
        where:  { email },
        create: {
          name:            fullName,
          email,
          country,
          specialty,
          npi:             npiNumber     ?? null,
          license:         licenseNumber ?? null,
          clerkUserId,
          status:          "PENDING",
          adminToken,
          adminTokenExpiry,
        },
        update: {
          name:            fullName,
          country,
          specialty,
          npi:             npiNumber     ?? null,
          license:         licenseNumber ?? null,
          clerkUserId,
          status:          "PENDING",
          adminToken,
          adminTokenExpiry,
        },
      });
    } catch (e: unknown) {
      console.error("[register] APPLICATION UPSERT FAILED:", e);
      return NextResponse.json({ ok: false, error: "Application DB upsert failed", detail: String(e) }, { status: 500 });
    }

    if (!application) {
      console.error("[register] PhysicianApplication upsert returned null");
      return NextResponse.json({ ok: false, error: "Failed to save application." }, { status: 500 });
    }

    // ── Persist pending patient invitation (non-fatal) ───────────────────────
    // When a new physician registers after following a patient report link,
    // store a PhysicianPatientInvitation so that /doctor/sign-in can detect it
    // after admin approval and route the physician to /doctor/accept-patient
    // instead of the empty CCC.
    if (inviteToken && physicianUserId) {
      try {
        const shareCard = await prisma.shareCard.findUnique({
          where:  { shareToken: inviteToken },
          select: { userId: true },
        });
        if (shareCard) {
          const existingInvite = await prisma.physicianPatientInvitation.findFirst({
            where:  { shareToken: inviteToken, claimedByUserId: physicianUserId },
            select: { id: true },
          });
          if (!existingInvite) {
            await prisma.physicianPatientInvitation.create({
              data: {
                shareToken:      inviteToken,
                patientUserId:   shareCard.userId,
                status:          "PENDING",
                claimedByUserId: physicianUserId,
                expiresAt:       new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            });
          }
        }
      } catch (e: unknown) {
        console.warn("[register] invite store failed (non-fatal):", e);
        // Non-fatal — physician can still accept via the report link after sign-in
      }
    }

    // ── Build one-click admin URLs ───────────────────────────────────────────
    const approveUrl = `https://myoguard.health/api/admin/verify-physician?token=${adminToken}&action=approve`;
    const flagUrl    = `https://myoguard.health/api/admin/verify-physician?token=${adminToken}&action=flag`;

    console.log("[register] application.id:", application.id);
    console.log("[register] clerkUserId:", clerkUserId);
    console.log("[register] token (first 8):", adminToken.slice(0, 8) + "…");

    // ── Admin notification email ─────────────────────────────────────────────
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
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0f172a;">${fullName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;background:#fafafa;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Email</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${email}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Country</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${country}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;background:#fafafa;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Specialty</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${specialty}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">NPI</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${npiNumber ?? "Not provided"}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Licence</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;">${licenseNumber ?? "Not provided"}</td>
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
                ✓ Authorise Access
              </a>
            </td>
            <td width="4%"></td>
            <td width="48%" align="center">
              <a href="${flagUrl}"
                 style="display:block;background:#475569;color:#ffffff;padding:15px 20px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;text-align:center;">
                ⚑ Flag for Review
              </a>
            </td>
          </tr>
        </table>

      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
          Meridian Wellness Systems LLC · HIPAA-aligned credential review · myoguard.health
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>
      `,
    });
    } catch (e: unknown) {
      console.error("[register] EMAIL FAILED:", e);
      return NextResponse.json({ ok: false, error: "Admin email failed", detail: String(e) }, { status: 500 });
    }

    // ── Physician acknowledgement email (non-fatal) ──────────────────────────
    // Confirm receipt of the application so the physician is not left in silence
    // between registration and the activation email that arrives after approval.
    try {
      await resend.emails.send({
        from:    "MyoGuard Clinical <admin@myoguard.health>",
        to:      email,
        subject: "Your MyoGuard Physician Application — Received",
        html: `
<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
      <span style="color:#ffffff;">Myo</span><span style="color:#2dd4bf;">Guard</span>
      <span style="color:#94a3b8;font-size:14px;font-weight:400;display:block;margin-top:4px;">Protocol Platform</span>
    </h1>
  </div>
  <div style="padding:32px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Application received, Dr. ${fullName.replace(/^Dr\.?\s*/i, '')}</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Thank you for applying for credentialed access to the MyoGuard Protocol platform.
      Our clinical team reviews all physician credentials individually.
    </p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">Expected review time: 6–24 hours</p>
      <p style="margin:4px 0 0;font-size:13px;color:#15803d;">You will receive a separate email once your account is activated.</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Application Summary</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:6px 0;color:#64748b;width:40%;">Full name</td><td style="padding:6px 0;font-weight:600;color:#0f172a;">${fullName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Country</td><td style="padding:6px 0;color:#0f172a;">${country}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Specialty</td><td style="padding:6px 0;color:#0f172a;">${specialty}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Licence / NPI</td><td style="padding:6px 0;color:#0f172a;">${licenseNumber ?? npiNumber ?? "Not provided"}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#64748b;line-height:1.6;">
      Questions? Contact us at
      <a href="mailto:admin@myoguard.health" style="color:#0d9488;">admin@myoguard.health</a>
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;">
    © 2026 Meridian Wellness Systems LLC · myoguard.health
  </p>
</div>
        `,
      });
      console.log("[register] physician acknowledgement email sent to", email);
    } catch (ackErr: unknown) {
      // Non-fatal — admin notification already delivered; registration proceeds
      console.error("[register] physician acknowledgement email failed (non-fatal):", ackErr);
    }

    return NextResponse.json({ ok: true });

  } catch (error: unknown) {
    console.error("[register] error:", error);
    return NextResponse.json({ ok: false, error: "Server error. Please try again." }, { status: 500 });
  }
}
