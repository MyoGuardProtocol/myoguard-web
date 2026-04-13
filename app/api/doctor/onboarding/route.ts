export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/src/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
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

    // Save application to database (upsert in case physician resubmits)
    let applicationId = "";
    try {
      const saved = await prisma.physicianApplication.upsert({
        where: { email },
        update: {
          name:      fullName,
          country,
          specialty,
          license:   licenseNumber ?? null,
          npi:       npiNumber ?? null,
          status:    "PENDING",
        },
        create: {
          name:      fullName,
          email,
          country,
          specialty,
          license:   licenseNumber ?? null,
          npi:       npiNumber ?? null,
          status:    "PENDING",
        },
      });
      applicationId = saved.id;
    } catch (dbError: unknown) {
      console.error("[onboarding] DB save failed — applicationId will be empty:", dbError);
      // Continue — email fallback is still valuable but buttons will be broken
    }

    const approveUrl = `https://myoguard.health/api/admin/physician-quick-action?id=${applicationId}&action=APPROVE&token=${process.env.ADMIN_ACTION_TOKEN}`;
    const rejectUrl  = `https://myoguard.health/api/admin/physician-quick-action?id=${applicationId}&action=REJECT&token=${process.env.ADMIN_ACTION_TOKEN}`;

    console.log("[onboarding] application.id:", applicationId);
    console.log("[onboarding] approve URL:", approveUrl);
    console.log("[onboarding] token:", process.env.ADMIN_ACTION_TOKEN?.slice(0, 8) + "...");
    console.log("[onboarding] form data:", { name: fullName, email, country, specialty });

    // Admin notification email
    await resend.emails.send({
      from:    "MyoGuard Protocol <noreply@myoguard.health>",
      to:      "admin@myoguard.health",
      replyTo: email,
      subject: `New Physician Registration — ${fullName}`,
      html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #0f172a; padding: 20px; border-radius: 8px 8px 0 0;">
    <h2 style="color: #2dd4bf; margin: 0;">MyoGuard Protocol</h2>
    <p style="color: #94a3b8; margin: 4px 0 0;">New Physician Registration</p>
  </div>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; border-radius: 0 0 8px 8px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Name</td><td style="padding: 8px 0; font-weight: 600; font-size: 13px;">${fullName}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Email</td><td style="padding: 8px 0; font-size: 13px;">${email}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Country</td><td style="padding: 8px 0; font-size: 13px;">${country}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Specialty</td><td style="padding: 8px 0; font-size: 13px;">${specialty}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">NPI</td><td style="padding: 8px 0; font-size: 13px;">${npiNumber ?? "Not provided"}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Licence</td><td style="padding: 8px 0; font-size: 13px;">${licenseNumber ?? "Not provided"}</td></tr>
    </table>
    <div style="margin-top: 20px; padding: 12px; background: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>Action required:</strong> Review credentials and activate or reject this physician account within 6–24 hours.
      </p>
    </div>
    <div style="display: flex; gap: 12px; margin-top: 24px;">
      <a href="${approveUrl}"
         style="flex: 1; display: block; text-align: center; background: #0d9488; color: #ffffff; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none;">
        ✓ Approve &amp; Activate
      </a>
      <a href="${rejectUrl}"
         style="flex: 1; display: block; text-align: center; background: #ffffff; color: #dc2626; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; border: 2px solid #dc2626;">
        ✕ Reject
      </a>
    </div>
  </div>
  <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 16px;">
    MyoGuard Protocol · admin@myoguard.health
  </p>
</div>
      `,
    });

    // Physician confirmation email
    try {
      const physicianEmailResult = await resend.emails.send({
        from:    "MyoGuard Protocol <noreply@myoguard.health>",
        to:      email,
        subject: "Your MyoGuard Physician Application — Received",
        html: `
<div style="font-family: -apple-system, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
      <span style="color: #ffffff;">Myo</span><span style="color: #2dd4bf;">Guard</span>
      <span style="color: #94a3b8; font-size: 14px; font-weight: 400; display: block; margin-top: 4px;">Protocol Platform</span>
    </h1>
  </div>
  <div style="padding: 32px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #0f172a;">Application received, Dr. ${fullName.replace(/^Dr\.?\s*/i, '')}</h2>
    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
      Thank you for applying for credentialed access to the MyoGuard Protocol platform.
      Our clinical team reviews all physician credentials individually.
    </p>
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 600;">
        Expected review time: 6–24 hours
      </p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #15803d;">
        You will receive a separate email once your account is activated.
      </p>
    </div>
    <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Application Summary</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #64748b; width: 40%;">Full name</td><td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${fullName}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Country</td><td style="padding: 6px 0; color: #0f172a;">${country}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Specialty</td><td style="padding: 6px 0; color: #0f172a;">${specialty}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Licence</td><td style="padding: 6px 0; color: #0f172a;">${licenseNumber ?? "Not provided"}</td></tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
      Questions? Reply to this email or contact us at
      <a href="mailto:admin@myoguard.health" style="color: #0d9488;">admin@myoguard.health</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 16px;">
    © 2026 MyoGuard Protocol · Meridian Health Holding · myoguard.health
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
