export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { Resend } from "resend";

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

    // Try DB first (best-effort — primary path is email notification)
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      await prisma.physicianOnboarding.create({
        data: {
          country,
          specialty,
          licenseNumber: licenseNumber ?? null,
          userId: "pending",
        },
      });

      await prisma.$disconnect();
    } catch (dbError: unknown) {
      console.log("[onboarding] DB save skipped, using email fallback:", dbError);
    }

    // Admin notification email
    await resend.emails.send({
      from: "MyoGuard Protocol <noreply@myoguard.health>",
      to: "admin@myoguard.health",
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
  </div>
  <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 16px;">
    MyoGuard Protocol · admin@myoguard.health
  </p>
</div>
      `,
    });

    // Confirmation email to the physician
    await resend.emails.send({
      from: "MyoGuard Protocol <noreply@myoguard.health>",
      to: email,
      subject: "MyoGuard Protocol — Application Received",
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #0F172A; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <span style="font-size: 24px; font-weight: bold; color: white;">Myo</span>
    <span style="font-size: 24px; font-weight: bold; color: #14B8A6;">Guard</span>
    <span style="font-size: 14px; color: #94A3B8; display: block; margin-top: 4px;">Protocol Platform</span>
  </div>
  <div style="padding: 32px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #0F172A; margin-top: 0;">Application received, ${fullName}</h2>
    <p style="color: #475569;">
      Thank you for registering with MyoGuard Protocol.
      Your physician credentials have been submitted for review by our clinical team.
    </p>
    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="color: #166534; margin: 0; font-weight: bold;">What happens next</p>
      <p style="color: #15803D; margin: 8px 0 0;">
        Our clinical team will review your credentials within 24 hours.
        You will receive a second email at this address with your activation link once approved.
      </p>
    </div>
    <p style="color: #64748B; font-size: 14px;">
      Your registration details:<br/>
      <strong>Name:</strong> ${fullName}<br/>
      <strong>Country:</strong> ${country}<br/>
      <strong>Specialty:</strong> ${specialty}
    </p>
    <p style="color: #94A3B8; font-size: 12px; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 16px;">
      MyoGuard Protocol · Meridian Health Holding<br/>
      Questions? Reply to this email or contact admin@myoguard.health
    </p>
  </div>
</div>
      `,
    });

    return NextResponse.json({ ok: true });

  } catch (error: unknown) {
    console.error("[onboarding] error:", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
