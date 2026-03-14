import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"

function calculateScore(input: any) {
  let score = 100
  const proteinPerKg = input.proteinGrams / input.currentWeightKg
  let leanLossPct = 0.30
  if (input.age > 65) leanLossPct += 0.10
  else if (input.age > 50) leanLossPct += 0.05
  if (proteinPerKg < 0.8) leanLossPct += 0.05
  if (input.exerciseDaysPerWeek < 2) leanLossPct += 0.05
  leanLossPct = Math.min(leanLossPct, 0.60)
  if (leanLossPct > 0.35) score -= 20
  else if (leanLossPct >= 0.30) score -= 10
  const proteinTarget = input.currentWeightKg * 1.4
  if (input.proteinGrams < proteinTarget) score -= 15
  if (input.exerciseDaysPerWeek < 2) score -= 15
  if (input.age > 65) score -= 10
  if (input.glp1Stage === "INITIATION") score -= 5
  if (input.fatigueLevel > 3) score -= 5
  if (input.nauseaLevel > 3) score -= 5
  score = Math.max(0, Math.min(100, Math.round(score)))
  let riskBand = "LOW"
  if (score < 40) riskBand = "CRITICAL"
  else if (score < 60) riskBand = "HIGH"
  else if (score < 80) riskBand = "MODERATE"
  const proteinTargetG = Math.round(input.currentWeightKg * 1.4)
  const explanation = score >= 80
    ? "Your nutrition and exercise habits are providing good protection for your muscle mass."
    : score >= 60
    ? "You have moderate risk of lean muscle loss. Targeted improvements to protein intake and exercise can significantly improve your score."
    : score >= 40
    ? "You have a high risk of lean muscle loss. Immediate improvements to protein intake and resistance training are strongly recommended."
    : "Critical risk of lean muscle loss. Urgent protocol adherence is required."
  return { score, riskBand, leanLossEstimatePct: Math.round(leanLossPct * 100), proteinTargetG, explanation }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { clerkId }, include: { profile: true } })
    if (!user || !user.profile) return NextResponse.json({ error: "Please complete onboarding first." }, { status: 404 })
    const body = await req.json()
    const profile = user.profile
    const result = calculateScore({
      age: profile.age,
      currentWeightKg: body.weightKg,
      proteinGrams: body.proteinGrams,
      exerciseDaysPerWeek: body.exerciseDaysWk,
      glp1Stage: profile.glp1Stage,
      fatigueLevel: body.fatigue,
      nauseaLevel: body.nausea,
    })
    const assessment = await prisma.assessment.create({
      data: {
        userId: user.id,
        weightKg: body.weightKg,
        proteinGrams: body.proteinGrams,
        exerciseDaysWk: body.exerciseDaysWk,
        hydrationLitres: body.hydrationLitres,
        symptoms: body.symptoms,
        fatigue: body.fatigue,
        nausea: body.nausea,
        muscleWeakness: body.muscleWeakness,
        score: result.score,
        riskBand: result.riskBand as any,
      }
    })
    await prisma.muscleScore.create({
      data: {
        userId: user.id,
        assessmentId: assessment.id,
        score: result.score,
        riskBand: result.riskBand as any,
        leanLossEstPct: result.leanLossEstimatePct,
        proteinTargetG: result.proteinTargetG,
        explanation: result.explanation,
      }
    })
    return NextResponse.json({ success: true, assessmentId: assessment.id, ...result })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const assessment = await prisma.assessment.findFirst({
      where: { userId: user.id },
      orderBy: { assessmentDate: "desc" },
      include: { muscleScore: true },
    })
    return NextResponse.json({ assessment })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
