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

    // ── Upsert User ──────────────────────────────────────────────────────────
    const user = await prisma.user.upsert({
      where:  { clerkId },
      update: {
        fullName:        body.fullName,
        researchConsent: body.researchConsent,
        ...(physicianId ? { physicianId } : {}),
      },
      create: {
        clerkId,
        email,                          // Clerk-verified, never from request body
        fullName:        body.fullName,
        researchConsent: body.researchConsent,
        ...(physicianId ? { physicianId } : {}),
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

    // ── Welcome email (fire-and-forget — never blocks the response) ──────────
    sendWelcomeEmail({ email, firstName: body.fullName.split(" ")[0] }).catch(() => {})

    return NextResponse.json({ success: true, userId: user.id, physicianLinked: !!physicianId })

  } catch (e: unknown) {
    console.error('[onboard] Unexpected error', e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
