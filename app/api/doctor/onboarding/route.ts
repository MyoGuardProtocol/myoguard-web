export const dynamic = 'force-dynamic';

import { createHmac } from 'node:crypto';
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { prisma } from "@/src/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    // Promote the Clerk user to PHYSICIAN_PENDING as soon as they submit
    // credentials. This is safer than relying on the webhook, which fires
    // before unsafeMetadata is available server-side.
    const { userId } = await auth();
    if (userId) {
      await prisma.user.update({
        where: { clerkId: userId },
        data:  { role: 'PHYSICIAN_PENDING' },
      }).catch((e: unknown) => {
        console.warn('[onboarding] role update skipped (no DB row yet?):', e);
      });
    }

    const body = await req.json();
    const { fullName, email, country, specialty, npiNumber, licenseNumber } = body as {
      fullName: string;
      email: string;
      country: string;
      specialty: string;
      npiNumber?: string;
      licenseNumber?: string;
    };

    if (!fullName || fullName.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: "Full name required" },
        { status: 422 }
      );
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Valid email required" },
        { status: 422 }
      );
    }
    if (!country) {
      return NextResponse.json(
        { ok: false, error: "Country required" },
        { status: 422 }
      );
    }
    if (!specialty) {
      return NextResponse.json(
        { ok: false, error: "Specialty required" },
        { status: 422 }
      );
    }

    // Generate signed HMAC token valid for 48 hours
    const tokenSecret = process.env.ADMIN_TOKEN_SECRET ?? 'fallback-insecure-secret';
    const timestamp = Date.now();
    const adminToken = createHmac('sha256', tokenSecret)
      .update(`${email}:${timestamp}`)
      .digest('hex');
    const adminTokenExpiry = new Date(timestamp + 48 * 60 * 60 * 1000);

    // Save application to database (upsert in case physician resubmits)
    let applicationId = "";
    try {
      const saved = await prisma.physicianApplication.upsert({
        where: { email },
        update: {
          name:             fullName,
          country,
          specialty,
          license:          licenseNumber ?? null,
          npi:              npiNumber ?? null,
          status:           "PENDING",
          adminToken,
          adminTokenExpiry,
          clerkUserId:      userId ?? null,
        },
        create: {
          name:             fullName,
          email,
          country,
          specialty,
          license:          licenseNumber ?? null,
          npi:              npiNumber ?? null,
          status:           "PENDING",
          adminToken,
          adminTokenExpiry,
          clerkUserId:      userId ?? null,
        },
      });
      applicationId = saved.id;
    } catch (dbError: unknown) {
      console.error("[onboarding] DB save failed:", dbError);
    }

    if (!applicationId) {
      console.error("[onboarding] applicationId is empty — aborting");
      return NextResponse.json(
        { ok: false, error: "Failed to save application" },
        { status: 500 }
      );
    }

    const approveUrl = `https://myoguard.health/api/admin/verify-physician?token=${adminToken}&action=approve`;
    const flagUrl    = `https://myoguard.health/api/admin/verify-physician?token=${adminToken}&action=flag`;

    console.log("[onboarding] application.id:", applicationId);
    console.log("[onboarding] token (first 8):", adminToken.slice(0, 8) + "...");
    console.log("[onboarding] form data:", { name: fullName, email, country, specialty });

    // Admin notification email — dark header, HMAC-secured action buttons
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

    // Physician confirmation email
    try {
      const physicianEmailResult = await resend.emails.send({
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
      console.log("[onboarding] physician email result:", physicianEmailResult);
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
