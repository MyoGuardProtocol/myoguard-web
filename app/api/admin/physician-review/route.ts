import { NextResponse }  from "next/server";
import { requireAdmin } from "@/src/lib/requireAdmin";
import { prisma }       from "@/src/lib/prisma";
import { sendServiceEmail } from "@/src/lib/communications/serviceEmail";

/** Template identities recorded on CommunicationEvent — never rendered output. */
const TEMPLATE_ID_APPROVED = "service.physician_approved.v1";
const TEMPLATE_ID_REJECTED = "service.physician_rejected.v1";

/**
 * Both outcome emails are ESSENTIAL_SERVICE and both are sent AFTER the
 * application state transition has been committed.
 *
 * Existing behaviour is preserved deliberately: a provider failure previously
 * threw out of this handler and surfaced as a 500, so a failure still returns
 * 500 — the admin needs to know the applicant was not told. What it does NOT
 * do is roll back the decision; the status change stands either way.
 *
 * A governed suppression is different from a failure and does not 500. The
 * decision was applied and the refusal to send is a recorded, legitimate
 * outcome rather than an error.
 */

export async function POST(req: Request) {
  const { user: adminUser, error } = await requireAdmin();
  if (error === 'UNAUTHENTICATED') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error === 'FORBIDDEN') {
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
    // Step 1 — promote User.role to PHYSICIAN
    if (application.clerkUserId) {
      await prisma.user.update({
        where: { clerkId: application.clerkUserId },
        data:  { role: "PHYSICIAN", isVerified: true },
      }).catch((e: unknown) => {
        console.error("[physician-review] User role update failed:", e);
      });
    } else {
      await prisma.user.updateMany({
        where: { email: application.email },
        data:  { role: "PHYSICIAN", isVerified: true },
      }).catch((e: unknown) => {
        console.error("[physician-review] fallback email role update failed:", e);
      });
    }

    // Step 2 — generate referral slug and create PhysicianProfile
    const nameParts = application.name
      .replace(/^Dr\.?\s*/i, "")
      .trim()
      .split(/\s+/)
    const lastName = nameParts[nameParts.length - 1] ?? "physician"
    const randomSuffix = Math.floor(100 + Math.random() * 900)
    const referralSlug = `dr-${lastName.toLowerCase()}-${randomSuffix}`
    const referralCode = `DR-${lastName.toUpperCase()}-${randomSuffix}`

    if (application.clerkUserId) {
      await prisma.user.update({
        where: { clerkId: application.clerkUserId },
        data:  { referralSlug },
      }).catch((e: unknown) => {
        console.error("[physician-review] referralSlug update failed:", e)
      })
    }

    await prisma.physicianProfile.create({
      data: {
        slug:        referralSlug,
        displayName: application.name,
        specialty:   application.specialty ?? undefined,
        referralCode,
        isActive:    true,
      },
    }).catch((e: unknown) => {
      console.error("[physician-review] PhysicianProfile create failed:", e)
    })

    // Step 3 — sync Clerk publicMetadata
    if (application.clerkUserId) {
      await fetch(
        `https://api.clerk.com/v1/users/${application.clerkUserId}/metadata`,
        {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ public_metadata: { role: "PHYSICIAN" } }),
        }
      ).catch((e: unknown) => {
        console.error("[physician-review] Clerk metadata update failed:", e);
      });
    }

    // Write AuditLog so the Founder Dashboard approval date populates.
    // Look up User.id (DB primary key) via clerkUserId or email fallback.
    try {
      const approvedUser = await prisma.user.findFirst({
        where:  application.clerkUserId
          ? { clerkId: application.clerkUserId }
          : { email:   application.email },
        select: { id: true },
      });
      if (approvedUser) {
        await prisma.auditLog.create({
          data: {
            actorId:    adminUser?.clerkId ?? 'system',
            action:     'UPGRADE_PHYSICIAN',
            targetType: 'User',
            targetId:   approvedUser.id,
            metadata:   { previousRole: 'PHYSICIAN_PENDING', via: 'physician-review-admin-panel' },
          },
        });
      }
    } catch (e: unknown) {
      console.error("[physician-review] AuditLog create failed:", e);
    }

    const approved = await sendServiceEmail({
      to:         application.email,
      subject:    "Your MyoGuard Physician Account is Now Active",
      from:       "MyoGuard Protocol <noreply@myoguard.health>",
      templateId: TEMPLATE_ID_APPROVED,
      context:    "physician:approved",
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
      <a href="https://myoguard.health/doctor/sign-in"
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
        <li>Monitor patient SRI results</li>
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
    © 2026 Meridian Wellness Systems LLC · myoguard.health
  </p>
</div>
      `,
    });

    // Approval stands regardless; only the notification outcome is reported.
    if (approved.outcome === 'failed' || approved.outcome === 'unavailable') {
      return NextResponse.json(
        { status: application.status, notified: false, error: 'Approval applied; notification not sent.' },
        { status: 500 },
      );
    }
  }

  if (action === "REJECT") {
    const rejected = await sendServiceEmail({
      to:         application.email,
      subject:    "MyoGuard Physician Application — Update",
      from:       "MyoGuard Protocol <noreply@myoguard.health>",
      templateId: TEMPLATE_ID_REJECTED,
      context:    "physician:rejected",
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
    © 2026 Meridian Wellness Systems LLC · myoguard.health
  </p>
</div>
      `,
    });

    // Rejection stands regardless; only the notification outcome is reported.
    if (rejected.outcome === 'failed' || rejected.outcome === 'unavailable') {
      return NextResponse.json(
        { status: application.status, notified: false, error: 'Decision applied; notification not sent.' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ status: application.status });
}
