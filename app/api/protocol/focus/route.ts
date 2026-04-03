import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';
import { generateWeeklyFocus, type CheckinWindow, type ProtocolTargets } from '@/src/lib/adaptiveProtocol';

/**
 * GET /api/protocol/focus
 * Auth required.
 *
 * Returns the adaptive "This Week's Protocol Focus" derived from the user's
 * last 4 weekly check-ins and their current protocol targets.
 *
 * The focus is computed deterministically on every request — no caching layer
 * is needed until traffic warrants it, because the computation is pure in-
 * memory work (single DB read + O(n) rules evaluation on n ≤ 4 rows).
 *
 * Response shape:
 * {
 *   focus: WeeklyProtocolFocus   (see src/lib/adaptiveProtocol.ts)
 *   hasData: boolean             (false → prompt user to submit first check-in)
 *   daysSinceLastCheckin: number | null
 * }
 *
 * Returns 404 when the user has no scored assessment (targets unavailable).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: {
      id: true,
      // Last 4 check-ins — enough for trend analysis
      weeklyCheckins: {
        orderBy: { weekStart: 'desc' },
        take:    4,
        select: {
          weekStart:     true,
          avgProteinG:   true,
          totalWorkouts: true,
          avgHydration:  true,
          avgWeightKg:   true,
          energyLevel:   true,
          nauseaLevel:   true,
        },
      },
      // Latest assessment with its protocol plan and muscle score
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take:    1,
        include: {
          muscleScore: {
            select: { riskBand: true, proteinTargetG: true },
          },
          protocolPlan: {
            select: { proteinTargetG: true, hydrationTarget: true },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const latestAssmt = user.assessments[0] ?? null;
  if (!latestAssmt?.muscleScore) {
    // No scored assessment yet — can't compute targets
    return NextResponse.json({ error: 'No assessment found' }, { status: 404 });
  }

  // Build protocol targets — prefer ProtocolPlan values; fall back to MuscleScore
  const targets: ProtocolTargets = {
    proteinTargetG:  latestAssmt.protocolPlan?.proteinTargetG  ?? latestAssmt.muscleScore.proteinTargetG,
    hydrationTarget: latestAssmt.protocolPlan?.hydrationTarget ?? 2.5,
    riskBand:        latestAssmt.muscleScore.riskBand          as ProtocolTargets['riskBand'],
  };

  const checkins: CheckinWindow[] = user.weeklyCheckins.map(c => ({
    weekStart:     c.weekStart,
    avgProteinG:   c.avgProteinG   ?? null,
    totalWorkouts: c.totalWorkouts ?? null,
    avgHydration:  c.avgHydration  ?? null,
    avgWeightKg:   c.avgWeightKg   ?? null,
    energyLevel:   c.energyLevel   ?? null,
    nauseaLevel:   c.nauseaLevel   ?? null,
  }));

  const focus = generateWeeklyFocus(checkins, targets);

  // Days since last check-in — drives the "overdue" prompt in the UI
  const daysSinceLastCheckin = user.weeklyCheckins[0]
    ? Math.floor(
        (Date.now() - user.weeklyCheckins[0].weekStart.getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  return NextResponse.json({
    focus,
    hasData:              focus.snapshot.weeksAnalysed > 0,
    daysSinceLastCheckin,
  });
}
