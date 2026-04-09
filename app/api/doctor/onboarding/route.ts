export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, country, specialty, licenseNumber } = body as {
      fullName: string;
      country: string;
      specialty: string;
      licenseNumber?: string;
    };

    if (!fullName || fullName.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: "Full name required" },
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
          // userId is required — use a placeholder; full upsert requires auth
          userId: "pending",
        },
      });

      await prisma.$disconnect();
      dbSaved = true;
    } catch (dbError: unknown) {
      console.log("DB save skipped, using email fallback:", dbError);
    }

    // Always send notification email via Resend API
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
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
              <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Country</td>
              <td style="padding: 10px 16px; color: #475569;">${country}</td>
            </tr>
            <tr style="background: #F1F5F9;">
              <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Specialty</td>
              <td style="padding: 10px 16px; color: #475569;">${specialty}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Licence Number</td>
              <td style="padding: 10px 16px; color: #475569;">${licenseNumber ?? "Not provided"}</td>
            </tr>
            <tr style="background: #F1F5F9;">
              <td style="padding: 10px 16px; font-weight: bold; color: #0F172A;">Submitted</td>
              <td style="padding: 10px 16px; color: #475569;">${new Date().toISOString()}</td>
            </tr>
            <tr>
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
      }).catch((e: unknown) => console.error("Resend error:", e));
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
