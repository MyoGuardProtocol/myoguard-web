export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

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

    // Try DB first
    let dbSaved = false;
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
      dbSaved = true;
    } catch (dbError: unknown) {
      console.log("DB save skipped, using email fallback:", dbError);
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      // 1. Notification email to the MyoGuard clinical team
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "MyoGuard Protocol <onboarding@resend.dev>",
          to: "onyeka.okpala@myoguard.health",
          subject: "New Physician Registration — MyoGuard Protocol",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #0F172A;">New Physician Registration</h2>
              <p style="color: #475569;">A new physician has submitted for clinical review.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                <tr style="background: #F1F5F9;">
                  <td style="padding: 10px 16px; font-weight: bold; color: #0F172A; width: 40%;">Full Name</td>
                  <td style="padding: 10px 16px; color: #475569;">${fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Email</td>
                  <td style="padding: 10px 16px; color: #475569;">${email}</td>
                </tr>
                <tr style="background: #F1F5F9;">
                  <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Country</td>
                  <td style="padding: 10px 16px; color: #475569;">${country}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Specialty</td>
                  <td style="padding: 10px 16px; color: #475569;">${specialty}</td>
                </tr>
                <tr style="background: #F1F5F9;">
                  <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">NPI Number</td>
                  <td style="padding: 10px 16px; color: #475569;">${npiNumber ?? "Not provided"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Licence Number</td>
                  <td style="padding: 10px 16px; color: #475569;">${licenseNumber ?? "Not provided"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Submitted</td>
                  <td style="padding: 10px 16px; color: #475569;">${new Date().toISOString()}</td>
                </tr>
                <tr style="background: #F1F5F9;">
                  <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">DB Saved</td>
                  <td style="padding: 10px 16px; color: #475569;">${dbSaved ? "Yes" : "No — review manually"}</td>
                </tr>
              </table>
              <p style="color: #94A3B8; font-size: 12px; margin-top: 24px;">
                MyoGuard Protocol · Meridian Health Holding
              </p>
            </div>
          `,
        }),
      }).catch((e: unknown) => console.error("Resend admin notification error:", e));

      // 2. Confirmation email to the physician
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "MyoGuard Protocol <onboarding@resend.dev>",
          to: email,
          subject: "MyoGuard Protocol — Application Received",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: #0F172A; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <span style="font-size: 24px; font-weight: bold; color: white;">Myo</span>
                <span style="font-size: 24px; font-weight: bold; color: #14B8A6;">Guard</span>
                <span style="font-size: 14px; color: #94A3B8; display: block; margin-top: 4px;">
                  Protocol Platform
                </span>
              </div>
              <div style="padding: 32px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
                <h2 style="color: #0F172A; margin-top: 0;">
                  Application received, ${fullName}
                </h2>
                <p style="color: #475569;">
                  Thank you for registering with MyoGuard Protocol.
                  Your physician credentials have been submitted for review by our clinical team.
                </p>
                <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin: 24px 0;">
                  <p style="color: #166534; margin: 0; font-weight: bold;">
                    What happens next
                  </p>
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
                  Questions? Reply to this email or contact docb@myoguard.health
                </p>
              </div>
            </div>
          `,
        }),
      }).catch((e: unknown) => console.error("Resend physician confirmation error:", e));
    }

    return NextResponse.json({ ok: true });

  } catch (error: unknown) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
