export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const body = await req.json()
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { fullName: body.fullName, researchConsent: body.researchConsent },
      create: { clerkId, email: body.email || "", fullName: body.fullName, researchConsent: body.researchConsent },
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
    return NextResponse.json({ success: true, userId: user.id })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
