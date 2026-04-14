/**
 * GET /api/admin/verify-physician
 *
 * One-click credential verification endpoint linked from admin notification emails.
 *
 * Required environment variables:
 *   ADMIN_TOKEN_SECRET  — secret used to generate HMAC tokens in the onboarding route
 *   CLERK_SECRET_KEY    — Clerk backend API key (sk_live_... or sk_test_...)
 *   RESEND_API_KEY      — Resend email API key
 *
 * Query params:
 *   token   — HMAC token stored on PhysicianApplication.adminToken
 *   action  — "approve" | "flag"
 *
 * Actions:
 *   approve → sets PhysicianApplication.status = APPROVED
 *             updates User.role = PHYSICIAN
 *             sets Clerk publicMetadata.role = "PHYSICIAN"
 *             sends activation email to physician
 *             redirects to /admin/physician-approved
 *
 *   flag    → sets PhysicianApplication.status = FLAGGED
 *             redirects to /admin/physician-flagged
 *
 * Token invalid / expired → redirects to /admin/token-expired
 */

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token  = searchParams.get("token");
  const action = searchParams.get("action");

  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, req.url));

  if (!token || !action) return redirect("/admin/token-expired");
  if (action !== "approve" && action !== "flag") return redirect("/admin/token-expired");

  // Look up application by token
  const application = await prisma.physicianApplication.findUnique({
    where: { adminToken: token },
  });

  if (!application) return redirect("/admin/token-expired");

  // Timing-safe token comparison to prevent timing attacks
  const storedToken = application.adminToken ?? "";
  let tokensMatch = false;
  try {
    const a = Buffer.from(storedToken, "hex");
    const b = Buffer.from(token,        "hex");
    tokensMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    tokensMatch = false;
  }
  if (!tokensMatch) return redirect("/admin/token-expired");

  // Check expiry
  if (!application.adminTokenExpiry || application.adminTokenExpiry < new Date()) {
    return redirect("/admin/token-expired");
  }

  if (action === "flag") {
    await prisma.physicianApplication.update({
      where: { id: application.id },
      data: {
        status:     "FLAGGED",
        reviewedAt: new Date(),
      },
    });
    return redirect("/admin/physician-flagged");
  }

  // action === "approve"
  await prisma.physicianApplication.update({
    where: { id: application.id },
    data: {
      status:     "APPROVED",
      reviewedAt: new Date(),
    },
  });

  // Update User role in DB
  if (application.clerkUserId) {
    await prisma.user.update({
      where: { clerkId: application.clerkUserId },
      data:  { role: "PHYSICIAN" },
    }).catch((e: unknown) => {
      console.error("[verify-physician] DB role update failed:", e);
    });

    // Update Clerk publicMetadata
    const clerkRes = await fetch(
      `https://api.clerk.com/v1/users/${application.clerkUserId}/metadata`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          public_metadata: { role: "PHYSICIAN" },
        }),
      }
    );
    if (!clerkRes.ok) {
      console.error("[verify-physician] Clerk metadata update failed:", await clerkRes.text());
    }
  } else {
    // No clerkUserId stored — try to find User by email
    await prisma.user.updateMany({
      where: { email: application.email },
      data:  { role: "PHYSICIAN" },
    }).catch((e: unknown) => {
      console.error("[verify-physician] fallback email role update failed:", e);
    });
  }

  // Send activation email to physician
  const firstName = application.name.replace(/^Dr\.?\s*/i, "").split(" ")[0];
  try {
    await resend.emails.send({
      from:    "MyoGuard Clinical <admin@myoguard.health>",
      to:      application.email,
      subject: "Your MyoGuard Clinical Account is Active",
      html: `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

      <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="margin:0;font-size:24px;font-weight:700;">
          <span style="color:#ffffff;">Myo</span><span style="color:#2dd4bf;">Guard</span>
        </h1>
        <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;">Clinical Platform</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:36px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin-bottom:24px;text-align:center;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#166534;">✓ Account Approved &amp; Active</p>
        </div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Welcome, Dr. ${firstName}</h2>
        <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 28px;">
          Your physician credentials have been verified. You now have full access
          to the MyoGuard Clinical Command Center.
        </p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="https://myoguard.health/doctor/dashboard"
             style="display:inline-block;background:#059669;color:#ffffff;padding:15px 36px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">
            Access Clinical Dashboard →
          </a>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">What you can do now</p>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:2.2;">
            <li>Monitor patient sarcopenia risk scores</li>
            <li>Generate QR referral codes for patients</li>
            <li>Review triage alerts and protocol adherence</li>
            <li>Document MDM interventions for CPT 99470</li>
          </ul>
        </div>
      </td></tr>

      <tr><td style="padding:20px 0;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">
          © 2026 MyoGuard Protocol · Meridian Health Holding · myoguard.health
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>
      `,
    });
  } catch (emailErr) {
    console.error("[verify-physician] activation email failed:", emailErr);
  }

  return redirect("/admin/physician-approved");
}
