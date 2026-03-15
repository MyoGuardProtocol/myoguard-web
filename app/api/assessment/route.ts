import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import { calculateProtocol } from '@/src/lib/protocolEngine';
import { AssessmentInputSchema } from '@/src/schemas/assessment';

/**
 * POST /api/assessment
 * Auth required. Saves a scored assessment + MuscleScore record to DB.
 *
 * GET /api/assessment
 * Auth required. Returns the user's last 10 assessments (for dashboard).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AssessmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Resolve internal user ID from Clerk ID
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found — complete onboarding first' }, { status: 404 });
  }

  const input = parsed.data;
  const protocol = calculateProtocol(input);

  // Map activityLevel string to Prisma enum
  const activityMap: Record<string, string> = {
    sedentary: 'SEDENTARY',
    moderate:  'MODERATELY_ACTIVE',
    active:    'VERY_ACTIVE',
  };

  // Map riskBand to Prisma enum (already matches)
  const riskBandMap: Record<string, 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'> = {
    LOW:      'LOW',
    MODERATE: 'MODERATE',
    HIGH:     'HIGH',
    CRITICAL: 'CRITICAL',
  };

  try {
    // Create assessment + muscle score in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const assessment = await tx.assessment.create({
        data: {
          userId:         user.id,
          weightKg:       protocol.weightKg,
          proteinGrams:   protocol.proteinStandard,
          exerciseDaysWk: input.activityLevel === 'active' ? 5 : input.activityLevel === 'moderate' ? 3 : 1,
          hydrationLitres: protocol.hydration,
          symptoms:       input.symptoms,
          fatigue:        input.symptoms.includes('Fatigue') ? 1 : 0,
          nausea:         input.symptoms.includes('Nausea') ? 1 : 0,
          muscleWeakness: input.symptoms.includes('Muscle weakness') ? 1 : 0,
          score:          protocol.myoguardScore,
          riskBand:       riskBandMap[protocol.riskBand],
        },
      });

      const muscleScore = await tx.muscleScore.create({
        data: {
          userId:         user.id,
          assessmentId:   assessment.id,
          score:          protocol.myoguardScore,
          riskBand:       riskBandMap[protocol.riskBand],
          leanLossEstPct: protocol.leanLossEstPct,
          proteinTargetG: protocol.proteinAggressive,
          explanation:    protocol.explanation,
        },
      });

      return { assessment, muscleScore };
    });

    return NextResponse.json({
      assessmentId: result.assessment.id,
      score:        protocol.myoguardScore,
      riskBand:     protocol.riskBand,
    });
  } catch (err) {
    console.error('[POST /api/assessment]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ assessments: [] });
  }

  try {
    const assessments = await prisma.assessment.findMany({
      where: { userId: user.id },
      orderBy: { assessmentDate: 'desc' },
      take: 10,
      include: { muscleScore: { select: { score: true, riskBand: true, explanation: true } } },
    });

    return NextResponse.json({ assessments });
  } catch (err) {
    console.error('[GET /api/assessment]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
