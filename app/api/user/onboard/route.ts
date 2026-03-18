export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

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

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const body = await req.json()

    // Resolve physician link if a code was provided
    const physicianId = body.physicianCode
      ? await resolvePhysicianId(body.physicianCode)
      : null;

    const user = await prisma.user.upsert({
      where: { clerkId },
      update: {
        fullName: body.fullName,
        researchConsent: body.researchConsent,
        ...(physicianId ? { physicianId } : {}),
      },
      create: {
        clerkId,
        email: body.email || "",
        fullName: body.fullName,
        researchConsent: body.researchConsent,
        ...(physicianId ? { physicianId } : {}),
      },
    })

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        age: body.age, sex: body.sex, heightCm: body.heightCm, weightKg: body.weightKg,
        goalWeightKg: body.goalWeightKg || null, activityLevel: body.activityLevel,
        glp1Medication: body.glp1Medication, glp1DoseMg: body.glp1DoseMg || 0,
        glp1Stage: body.glp1Stage, treatmentStart: body.treatmentStart ? new Date(body.treatmentStart) : new Date(),
        baselineProtein: body.baselineProtein || null,
      },
      create: {
        age: body.age, sex: body.sex, heightCm: body.heightCm,
        weightKg: body.weightKg, goalWeightKg: body.goalWeightKg || null, activityLevel: body.activityLevel,
        glp1Medication: body.glp1Medication, glp1DoseMg: body.glp1DoseMg || 0,
        glp1Stage: body.glp1Stage, treatmentStart: body.treatmentStart ? new Date(body.treatmentStart) : new Date(),
        baselineProtein: body.baselineProtein || null,
        user: { connect: { id: user.id } },
      },
    })

    // Send welcome email (fire and forget — never blocks the response)
    fetch(`${APP_URL}/api/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, firstName: body.fullName.split(" ")[0] }),
    }).catch(() => {})

    return NextResponse.json({ success: true, userId: user.id, physicianLinked: !!physicianId })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
