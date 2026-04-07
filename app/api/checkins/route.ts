import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';
import { CheckinSchema } from '@/src/schemas/assessment';

/**
 * POST /api/checkins
 * Auth required. Creates a WeeklyCheckin for the current calendar week (Mon–Sun).
 * Saves all form fields including energyLevel and nauseaLevel.
 * Computes and persists proteinAdherence and exerciseAdherence against the
 * user's most recent assessment targets — so the DB record is self-contained
 * for analysis and email digest without re-fetching assessment data later.
 *
 * GET /api/checkins
 * Auth required. Returns the user's last 12 check-ins ordered by most recent.
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

  const parsed = CheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Resolve internal user + their latest assessment targets in one query.
  // The proteinAdherence and exerciseAdherence ratios are computed at write-time
  // so every check-in record is self-contained for analysis and digest rendering.
  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: {
      id: true,
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take:    1,
        include: {
          muscleScore:  { select: { proteinTargetG: true } },
          protocolPlan: { select: { proteinTargetG: true } },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // ── Week boundaries: Mon 00:00:00 → Sun 23:59:59 (local UTC) ───────────────
  const now       = new Date();
  const day       = now.getDay(); // 0 = Sun
  const diff      = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const data           = parsed.data;
  const latestAssmt    = user.assessments[0] ?? null;

  // ── proteinAdherence ────────────────────────────────────────────────────────
  // Prefer the ProtocolPlan aggressive target; fall back to MuscleScore target.
  // Stored as a ratio (0.0–1.0+). Null when either value is missing.
  const proteinTargetG =
    latestAssmt?.protocolPlan?.proteinTargetG ??
    latestAssmt?.muscleScore?.proteinTargetG  ??
    null;

  const proteinAdherence =
    data.avgProteinG != null && proteinTargetG != null && proteinTargetG > 0
      ? Math.round((data.avgProteinG / proteinTargetG) * 1000) / 1000  // 3 dp
      : null;

  // ── exerciseAdherence ───────────────────────────────────────────────────────
  // Target is derived from the assessment's exerciseDaysWk (set at assessment time).
  // Stored as a ratio (0.0–1.0+). Null when either value is missing.
  const exerciseDaysTarget = latestAssmt?.exerciseDaysWk ?? null;

  const exerciseAdherence =
    data.totalWorkouts != null && exerciseDaysTarget != null && exerciseDaysTarget > 0
      ? Math.round((data.totalWorkouts / exerciseDaysTarget) * 1000) / 1000
      : null;

  try {
    // Derive recovery status for the check-in week from sleep fields.
    // Mirrors the engine logic so the persisted value is consistent with assessments.
    const checkinRecoveryStatus = (() => {
      if (data.sleepHours === undefined && data.sleepQuality === undefined) return null;
      const hoursImpaired   = data.sleepHours   !== undefined && data.sleepHours   < 6.5;
      const qualityImpaired = data.sleepQuality  !== undefined && data.sleepQuality < 3;
      const severeSleep     = data.sleepHours   !== undefined && data.sleepHours   < 5.5;
      // For the check-in week we don't have proteinTarget, so use avgProteinG < 80g as proxy
      const lowProtein      = data.avgProteinG !== undefined && data.avgProteinG < 80;
      if (severeSleep && lowProtein) return 'critical';
      if (hoursImpaired || qualityImpaired) return 'impaired';
      return 'optimal';
    })();

    const checkin = await prisma.weeklyCheckin.create({
      data: {
        userId:            user.id,
        weekStart,
        weekEnd,
        avgWeightKg:       data.avgWeightKg,
        avgProteinG:       data.avgProteinG,
        totalWorkouts:     data.totalWorkouts,
        avgHydration:      data.avgHydration,
        energyLevel:       data.energyLevel,
        nauseaLevel:       data.nauseaLevel,
        sleepHours:        data.sleepHours      ?? null,
        sleepQuality:      data.sleepQuality    ?? null,
        recoveryStatus:    checkinRecoveryStatus,
        proteinAdherence,
        exerciseAdherence,
        highlights:        [],
        recommendations:   [],
        completedAt:       new Date(),
      },
    });

    return NextResponse.json({ checkinId: checkin.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/checkins]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    return NextResponse.json({ checkins: [] });
  }

  try {
    const checkins = await prisma.weeklyCheckin.findMany({
      where:   { userId: user.id },
      orderBy: { weekStart: 'desc' },
      take:    12,
    });

    return NextResponse.json({ checkins });
  } catch (err) {
    console.error('[GET /api/checkins]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
