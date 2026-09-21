export const dynamic = "force-dynamic"

import { auth, currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/app/lib/prisma"
import { sendWelcomeEmail } from "@/src/lib/email"

// ─── Request body schema ──────────────────────────────────────────────────────
// Validates shape and types before any DB write.
// body.email is intentionally excluded — we use the Clerk-verified email instead.

const OnboardSchema = z.object({
  fullName:        z.string().min(1).max(200).trim(),
  age:             z.number().int().min(13).max(120),
  sex:             z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
  heightCm:        z.number().min(50).max(300),
  weightKg:        z.number().min(10).max(500),
  goalWeightKg:    z.number().min(10).max(500).nullable().optional(),
  activityLevel:   z.enum(["SEDENTARY", "LIGHTLY_ACTIVE", "MODERATELY_ACTIVE", "VERY_ACTIVE"]),
  glp1Medication:  z.string().min(1).max(200).trim(),
  glp1DoseMg:      z.number().min(0).max(1000).optional().default(0),
  glp1Stage:       z.enum(["INITIATION", "DOSE_ESCALATION", "MAINTENANCE", "DISCONTINUING"]),
  treatmentStart:  z.string().optional(),   // ISO date string — converted to Date below
  baselineProtein: z.number().min(0).max(1000).nullable().optional(),
  researchConsent: z.boolean().optional().default(false),
  physicianCode:   z.string().max(30).trim().optional(),
})

type OnboardBody = z.infer<typeof OnboardSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves a physician's DB User.id from a PhysicianProfile referral code.
 * Returns null if the code is not found or the physician user doesn't exist.
 */
async function resolvePhysicianId(rawCode: string): Promise<string | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  const profile = await prisma.physicianProfile.findFirst({
    where:  { referralCode: code, isActive: true },
    select: { slug: true },
  });
  if (!profile) return null;

  const physician = await prisma.user.findFirst({
    where:  { referralSlug: profile.slug, role: 'PHYSICIAN' },
    select: { id: true },
  });
  return physician?.id ?? null;
}

// ─── POST /api/user/onboard ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    // ── Parse + validate body ────────────────────────────────────────────────
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = OnboardSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      )
    }

    const body: OnboardBody = parsed.data

    // ── Clerk-verified email (never trust body.email) ────────────────────────
    // currentUser() returns the server-side Clerk user with verified email addresses.
    // This prevents a client from injecting an arbitrary or empty email into the DB.
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? ''

    if (!email) {
      console.error('[onboard] No verified email on Clerk user', clerkId)
      return NextResponse.json({ error: "No verified email on account" }, { status: 422 })
    }

    // ── Resolve physician link ───────────────────────────────────────────────
    const physicianId = body.physicianCode
      ? await resolvePhysicianId(body.physicianCode)
      : null;

    // ── Onboarding may ESTABLISH a physician relationship, never REPLACE one ──
    //
    // This route used to spread `physicianId` into both branches of the upsert
    // unconditionally, so re-running onboarding with a second physician's code
    // silently reassigned the patient — no check, no refusal, no record. That
    // made a referral code behave as authorization for transfer of care, which
    // it is not. Transfer of care is a separate workflow that does not exist
    // yet, and it must not be defined by accident here.
    //
    // A code is applied only when the patient holds no link. An existing link
    // is preserved in every other case, including when the same physician's
    // code is presented again (nothing to write) and when the code is absent,
    // unknown or inactive (`resolvePhysicianId` already returns null, so those
    // cases were never the defect).
    //
    // Reading before the upsert is what makes the current link knowable; a new
    // account has no row and therefore no link to protect.
    const existing = await prisma.user.findUnique({
      where:  { clerkId },
      select: { physicianId: true },
    })
    const currentLink = existing?.physicianId ?? null;

    const linkToApply      = physicianId && !currentLink ? physicianId : null;
    const overwriteRefused = !!physicianId && !!currentLink && currentLink !== physicianId;

    // ── Upsert User ──────────────────────────────────────────────────────────
    // Only `linkToApply` reaches the write. When it is null the field is absent
    // from the payload entirely, so an existing relationship is untouched
    // rather than overwritten with the same or a different value.
    const user = await prisma.user.upsert({
      where:  { clerkId },
      update: {
        fullName:        body.fullName,
        researchConsent: body.researchConsent,
        ...(linkToApply ? { physicianId: linkToApply } : {}),
      },
      create: {
        clerkId,
        email,                          // Clerk-verified, never from request body
        fullName:        body.fullName,
        researchConsent: body.researchConsent,
        ...(linkToApply ? { physicianId: linkToApply } : {}),
      },
    })

    // ── Upsert UserProfile ───────────────────────────────────────────────────
    const treatmentStart = body.treatmentStart
      ? new Date(body.treatmentStart)
      : new Date()

    await prisma.userProfile.upsert({
      where:  { userId: user.id },
      update: {
        age:             body.age,
        sex:             body.sex,
        heightCm:        body.heightCm,
        weightKg:        body.weightKg,
        goalWeightKg:    body.goalWeightKg ?? null,
        activityLevel:   body.activityLevel,
        glp1Medication:  body.glp1Medication,
        glp1DoseMg:      body.glp1DoseMg ?? 0,
        glp1Stage:       body.glp1Stage,
        treatmentStart,
        baselineProtein: body.baselineProtein ?? null,
      },
      create: {
        age:             body.age,
        sex:             body.sex,
        heightCm:        body.heightCm,
        weightKg:        body.weightKg,
        goalWeightKg:    body.goalWeightKg ?? null,
        activityLevel:   body.activityLevel,
        glp1Medication:  body.glp1Medication,
        glp1DoseMg:      body.glp1DoseMg ?? 0,
        glp1Stage:       body.glp1Stage,
        treatmentStart,
        baselineProtein: body.baselineProtein ?? null,
        user:            { connect: { id: user.id } },
      },
    })

    // ── Physician attribution event (fire-and-forget) ────────────────────────
    // Fires on `linkToApply`, not on the resolved code: attributing a patient
    // to a physician who was never linked would record an event that did not
    // happen, and a refused overwrite would look like a successful referral.
    if (linkToApply) {
      prisma.analyticsEvent.create({
        data: {
          userId:    user.id,
          eventType: 'PHYSICIAN_ATTRIBUTED',
          metadata:  { physicianId: linkToApply },
        },
      }).catch((err) => console.error('[analytics] PHYSICIAN_ATTRIBUTED failed', err));
    }

    // ── Refused overwrite, recorded as governance evidence ───────────────────
    // A refusal to change a care relationship belongs in AuditLog, alongside
    // the other account-level governance events, rather than in product
    // analytics. Uses the existing route-level pattern — no new subsystem.
    //
    // Fire-and-forget: onboarding is clinical setup, and a failed evidence
    // write must not deny a patient their profile. Internal User ids only —
    // never a Clerk id, never an address, never clinical content.
    if (overwriteRefused) {
      prisma.auditLog.create({
        data: {
          actorId:    user.id,
          action:     'PHYSICIAN_LINK_OVERWRITE_REFUSED',
          targetType: 'User',
          targetId:   user.id,
          metadata:   { retainedPhysicianId: currentLink, refusedPhysicianId: physicianId },
        },
      }).catch((err) => console.error('[onboard] overwrite-refusal not recorded', err));
    }

    // ── Welcome email (fire-and-forget — never blocks the response) ──────────
    // userId added in Phase 1D-C3E so the governed CommunicationEvent is tied
    // to the account. Still fire-and-forget: governance may suppress the send,
    // and that must not affect a completed onboarding.
    sendWelcomeEmail({ email, firstName: body.fullName.split(" ")[0], userId: user.id }).catch(() => {})

    // If the patient arrived via a preloaded Start Sheet QR, direct them to
    // /dashboard so PreloadSync can fire and inject the physician's pre-filled
    // assessment data. Otherwise send them to the manual assessment form.
    // The mgPreloadId cookie is httpOnly and not readable in client JS — we
    // detect it here, server-side, and encode the destination in the response.
    const hasPreload = !!req.cookies.get('mgPreloadId')?.value;
    // `physicianLinked` reports whether the patient IS linked, not whether this
    // request did the linking. It previously read `!!physicianId`, which called
    // an already-linked patient unlinked whenever they onboarded without a code
    // — and, worse, would have reported a refused overwrite as a fresh link.
    return NextResponse.json({
      success:        true,
      userId:         user.id,
      physicianLinked: !!(linkToApply ?? currentLink),
      redirect:       hasPreload ? '/dashboard' : '/dashboard/assessment',
    })

  } catch (e: unknown) {
    console.error('[onboard] Unexpected error', e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
