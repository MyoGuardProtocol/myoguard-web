import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';

/**
 * GET /api/protocol/latest
 * Auth required.
 *
 * Returns the user's most recent assessment together with its persisted
 * ProtocolPlan. This is the canonical read path for the results page and
 * any future "current protocol" surface (dashboard widget, PDF export, etc.).
 *
 * Response shape:
 * {
 *   assessmentId:    string
 *   assessmentDate:  string (ISO)
 *   score:           number
 *   riskBand:        'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
 *   proteinTargetG:  number   (aggressive upper-bound target)
 *   explanation:     string
 *   protocolPlan: {
 *     proteinTargetG:   number
 *     proteinSources:   string[]
 *     supplementation:  string[]
 *     trainingPlan:     string
 *     hydrationTarget:  number
 *     electrolyteNotes: string
 *     giGuidance:       string
 *   } | null
 *   previous: {
 *     assessmentId:   string
 *     assessmentDate: string (ISO)
 *     score:          number
 *     riskBand:       string
 *     proteinTargetG: number
 *   } | null
 * }
 *
 * Returns 404 when the user has no assessments yet.
 *
 * SRI Containment C1 (K1): leanLossEstPct is not selected and not returned.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    // Fetch the two most recent assessments in one query.
    // - Index [0] is "latest"   — the one we display in full
    // - Index [1] is "previous" — used only for the delta comparison block
    const assessments = await prisma.assessment.findMany({
      where:   { userId: user.id },
      orderBy: { assessmentDate: 'desc' },
      take:    2,
      include: {
        muscleScore: {
          select: {
            score:          true,
            riskBand:       true,
            proteinTargetG: true,
            explanation:    true,
          },
        },
        protocolPlan: {
          select: {
            proteinTargetG:   true,
            proteinSources:   true,
            supplementation:  true,
            trainingPlan:     true,
            hydrationTarget:  true,
            electrolyteNotes: true,
            giGuidance:       true,
          },
        },
      },
    });

    if (assessments.length === 0) {
      return NextResponse.json({ error: 'No assessments found' }, { status: 404 });
    }

    const latest   = assessments[0];
    const previous = assessments[1] ?? null;

    // Guard: every assessment should have a muscleScore written in the same
    // transaction. If somehow it's missing (legacy record), return 404 rather
    // than crashing with a null-dereference.
    if (!latest.muscleScore) {
      return NextResponse.json({ error: 'Assessment data incomplete' }, { status: 404 });
    }

    return NextResponse.json({
      assessmentId:   latest.id,
      assessmentDate: latest.assessmentDate.toISOString(),
      score:          latest.muscleScore.score,
      riskBand:       latest.muscleScore.riskBand,
      proteinTargetG: latest.muscleScore.proteinTargetG,
      explanation:    latest.muscleScore.explanation,
      protocolPlan:   latest.protocolPlan ?? null,

      // Delta comparison — null if this is the user's first assessment
      previous: previous?.muscleScore
        ? {
            assessmentId:   previous.id,
            assessmentDate: previous.assessmentDate.toISOString(),
            score:          previous.muscleScore.score,
            riskBand:       previous.muscleScore.riskBand,
            proteinTargetG: previous.muscleScore.proteinTargetG,
          }
        : null,
    });
  } catch (err) {
    console.error('[GET /api/protocol/latest]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
