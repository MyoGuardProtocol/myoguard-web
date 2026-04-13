import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { userId } = await auth();

  if (userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action, note } = await req.json() as {
    id:     string;
    action: "APPROVE" | "REJECT";
    note?:  string;
  };

  const application = await prisma.physicianApplication.update({
    where: { id },
    data: {
      status:     action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
      reviewNote: note || null,
    },
  });

  if (action === "APPROVE") {
    await resend.emails.send({
      from:    "MyoGuard Protocol <noreply@myoguard.health>",
      to:      application.email,
      subject: "Your MyoGuard Physician Account is Now Active",
      html: `
<div style="font-family: -apple-system, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
      <span style="color: #ffffff;">Myo</span><span style="color: #2dd4bf;">Guard</span>
      <span style="color: #94a3b8; font-size: 14px; font-weight: 400; display: block; margin-top: 4px;">Protocol Platform</span>
    </h1>
  </div>
  <div style="padding: 32px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 16px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0; font-size: 16px; font-weight: 700; color: #166534;">
        ✓ Account Approved &amp; Active
      </p>
    </div>
    <h2 style="margin: 0 0 8px; font-size: 18px; color: #0f172a;">
      Welcome to MyoGuard Protocol, Dr. ${application.name.replace(/^Dr\.?\s*/i, "")}
    </h2>
    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
      Your physician credentials have been verified. Your clinical account
      is now fully active on the MyoGuard Protocol platform.
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://myoguard.health/sign-in"
         style="display: inline-block; background: #0d9488; color: #ffffff;
                padding: 14px 32px; border-radius: 10px; font-size: 14px;
                font-weight: 600; text-decoration: none;">
        Access Your Clinical Dashboard →
      </a>
    </div>
    <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
        What you can do now
      </p>
      <ul style="margin: 0; padding-left: 16px; font-size: 13px; color: #475569; line-height: 2;">
        <li>Access the Clinical Command Center</li>
        <li>Monitor patient sarcopenia risk scores</li>
        <li>Generate QR referral codes for patients</li>
        <li>Review triage alerts and protocol adherence</li>
        <li>Document MDM interventions for CPT 99470</li>
      </ul>
    </div>
    <p style="font-size: 13px; color: #64748b;">
      Questions? Contact us at
      <a href="mailto:admin@myoguard.health" style="color: #0d9488;">admin@myoguard.health</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 16px;">
    © 2026 MyoGuard Protocol · Meridian Health Holding · myoguard.health
  </p>
</div>
      `,
    });
  }

  if (action === "REJECT") {
    await resend.emails.send({
      from:    "MyoGuard Protocol <noreply@myoguard.health>",
      to:      application.email,
      subject: "MyoGuard Physician Application — Update",
      html: `
<div style="font-family: -apple-system, sans-serif; max-width: 580px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
      <span style="color: #ffffff;">Myo</span><span style="color: #2dd4bf;">Guard</span>
    </h1>
  </div>
  <div style="padding: 32px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">
      Application update — ${application.name}
    </h2>
    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      After reviewing your application, we are unable to activate your
      physician account at this time.
    </p>
    ${note ? `
    <div style="background: #fef9ec; border: 1px solid #fcd34d; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>Review note:</strong> ${note}
      </p>
    </div>` : ""}
    <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
      If you believe this is an error or would like to reapply with
      additional credential documentation, please contact us at
      <a href="mailto:admin@myoguard.health" style="color: #0d9488;">admin@myoguard.health</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 16px;">
    © 2026 MyoGuard Protocol · Meridian Health Holding
  </p>
</div>
      `,
    });
  }

  return NextResponse.json({ status: application.status });
}
