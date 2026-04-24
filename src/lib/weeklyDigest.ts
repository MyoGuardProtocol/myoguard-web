/**
 * weeklyDigest.ts
 *
 * Generates a structured weekly summary payload for a single MyoGuard user.
 * Designed to be called from a scheduled task, API route, or webhook handler.
 *
 * The payload is transport-agnostic — suitable as the body of an email
 * template, push-notification payload, or any notification API call without
 * further transformation.
 *
 * Accepts the internal DB userId (User.id, NOT User.clerkId).
 * Returns null when the user has no scored assessments — nothing to surface.
 *
 * No new dependencies.  Computation is a single Prisma query + pure functions.
 */

import { prisma } from '@/src/lib/prisma';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Band        = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
type TrendStatus = 'improving' | 'stable' | 'declining' | 'insufficient';
type ActionType  = 'urgent' | 'recommended' | 'maintenance';

export type WeeklyDigestPayload = {
  /** Internal DB User.id of the recipient */
  userId:          string;
  /** ISO 8601 timestamp of when this payload was generated */
  generatedAt:     string;

  // ── Score ──────────────────────────────────────────────────────────────────
  /** Latest MyoGuard Score (0–100, rounded) */
  score:           number;
  /** Risk band of the latest assessment */
  riskBand:        Band;
  /** 30-day projected score; null when fewer than 2 assessments exist */
  projectedScore:  number | null;
  /** Direction of the 30-day trajectory */
  trendStatus:     TrendStatus;

  // ── Consistency ────────────────────────────────────────────────────────────
  /** Current consecutive-week check-in streak (0 if broken or never started) */
  streakWeeks:     number;
  /** Longest streak ever achieved */
  bestStreak:      number;
  /** Total number of check-ins on record */
  totalCheckins:   number;

  // ── Guidance ───────────────────────────────────────────────────────────────
  /** Human-readable single next action (ready for email/notification body) */
  nextAction:      string;
  /** Priority level — drives subject-line tone and CTA styling in templates */
  nextActionType:  ActionType;
  /** Relative app URL for the primary CTA button in email/push */
  nextActionHref:  string;

  // ── Context ────────────────────────────────────────────────────────────────
  /** Personalised protein target from the latest assessment (g/day) */
  proteinTargetG:  number | null;
};

// ─── Pure computation helpers ─────────────────────────────────────────────────
// These mirror the logic in app/dashboard/journey/page.tsx using the same
// thresholds (10-day streak gap, 0.06 pt/day check-in signal, etc.) so the
// digest always reflects exactly what the dashboard shows.

type ScoredPoint = {
  assessmentDate: Date;
  score:          number;
};

type CheckinSignal = {
  weekStart:     Date;
  avgProteinG:   number | null;
  totalWorkouts: number | null;
};

function computeTrajectory(
  scored:   ScoredPoint[],
  checkins: CheckinSignal[],
): { status: TrendStatus; projected: number } {
  if (scored.length < 2) return { status: 'insufficient', projected: 0 };

  const recent   = scored.slice(-3);
  const first    = recent[0];
  const last     = recent[recent.length - 1];
  const daysDiff = Math.max(
    (last.assessmentDate.getTime() - first.assessmentDate.getTime()) / 86_400_000,
    7,
  );

  let ratePerDay = (last.score - first.score) / daysDiff;
  ratePerDay = Math.max(-0.5, Math.min(0.5, ratePerDay));

  if (checkins[0]) {
    const ci = checkins[0];
    if (ci.totalWorkouts != null && ci.totalWorkouts >= 3) ratePerDay += 0.06;
    if (ci.avgProteinG   != null && ci.avgProteinG   <  60) ratePerDay -= 0.06;
  }

  const projected   = Math.round(Math.min(100, Math.max(0, last.score + ratePerDay * 30)));
  const pointChange = projected - Math.round(last.score);

  const status: TrendStatus =
    pointChange >  2 ? 'improving' :
    pointChange < -2 ? 'declining' : 'stable';

  return { status, projected };
}

function computeStreaks(
  checkins: Array<{ weekStart: Date }>,
  now: Date,
): { current: number; best: number } {
  if (checkins.length === 0) return { current: 0, best: 0 };

  // Sort chronologically
  const sorted = [...checkins].sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime(),
  );

  // Best streak
  let best = 1;
  let run  = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].weekStart.getTime() - sorted[i - 1].weekStart.getTime()) / 86_400_000;
    if (gap <= 10) { run++; if (run > best) best = run; }
    else run = 1;
  }

  // Current streak (reset if last check-in > 14 days ago)
  const daysSinceLast =
    (now.getTime() - sorted[sorted.length - 1].weekStart.getTime()) / 86_400_000;
  if (daysSinceLast > 14) return { current: 0, best };

  let current = 1;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const gap = (sorted[i + 1].weekStart.getTime() - sorted[i].weekStart.getTime()) / 86_400_000;
    if (gap <= 10) current++;
    else break;
  }

  return { current, best: Math.max(best, current) };
}

function resolveNextAction(
  band:           Band,
  proteinTargetG: number | null,
  latestCI:       CheckinSignal | null,
  trendStatus:    TrendStatus,
  now:            Date,
): { text: string; type: ActionType; href: string } {
  const daysSince = latestCI
    ? Math.floor((now.getTime() - latestCI.weekStart.getTime()) / 86_400_000)
    : null;

  // P1: declining trend → urgent protocol review
  if (trendStatus === 'declining') {
    return {
      text: 'Review your MyoGuard protocol — your score trend is declining',
      type: 'urgent',
      href: '/',
    };
  }

  // P2: overdue check-in
  if (daysSince === null || daysSince >= 7) {
    return {
      text: 'Complete your weekly check-in',
      type: 'recommended',
      href: '/checkin',
    };
  }

  // P3: protein gap > 20 g/day
  if (proteinTargetG != null && latestCI?.avgProteinG != null) {
    const gap = proteinTargetG - latestCI.avgProteinG;
    if (gap > 20) {
      return {
        text: `Add ${Math.round(gap)}g protein per day to reach your ${Math.round(proteinTargetG)}g target`,
        type: 'recommended',
        href: '/checkin',
      };
    }
  }

  // P4: low workout frequency in high/critical band
  if (
    latestCI?.totalWorkouts != null &&
    latestCI.totalWorkouts < 2 &&
    (band === 'HIGH' || band === 'CRITICAL')
  ) {
    return {
      text: 'Add 2 resistance training sessions this week',
      type: 'recommended',
      href: '/',
    };
  }

  // P5: low risk — maintenance
  if (band === 'LOW') {
    return {
      text: 'Reassess before your next GLP-1 dose escalation',
      type: 'maintenance',
      href: '/',
    };
  }

  // Band-based fallbacks
  if (band === 'MODERATE') {
    return {
      text: 'Hit your daily protein target consistently this week',
      type: 'recommended',
      href: '/checkin',
    };
  }

  return {
    text: 'Add resistance training 2–3 sessions this week',
    type: 'urgent',
    href: '/',
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates a weekly digest payload for the given user.
 *
 * @param userId - The internal DB User.id (not Clerk userId).
 * @returns WeeklyDigestPayload, or null if the user has no scored assessments.
 *
 * @example
 * // In a scheduled task or API route:
 * const digest = await generateWeeklyDigest(user.id);
 * if (digest) await sendWeeklyEmail(user.email, digest);
 */
export async function generateWeeklyDigest(
  userId: string,
): Promise<WeeklyDigestPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      assessments: {
        orderBy: { assessmentDate: 'asc' },
        include: {
          muscleScore: {
            select: { score: true, riskBand: true, proteinTargetG: true },
          },
        },
      },
      weeklyCheckins: {
        orderBy: { weekStart: 'desc' },
        take: 52,
        select: {
          weekStart:     true,
          avgProteinG:   true,
          totalWorkouts: true,
        },
      },
    },
  });

  if (!user) return null;

  // Only include assessments that have a completed MuscleScore
  const scored = user.assessments
    .filter(a => a.muscleScore?.score != null)
    .map(a => ({
      assessmentDate: a.assessmentDate,
      score:          a.muscleScore!.score,
      riskBand:       a.muscleScore!.riskBand as Band,
      proteinTargetG: a.muscleScore!.proteinTargetG,
    }));

  if (scored.length === 0) return null;

  const now      = new Date();
  const latest   = scored[scored.length - 1];
  const checkins = user.weeklyCheckins;
  const latestCI = checkins[0] ?? null;

  const trajectory = computeTrajectory(scored, checkins);
  const streaks    = computeStreaks(checkins, now);
  const action     = resolveNextAction(
    latest.riskBand,
    latest.proteinTargetG,
    latestCI,
    trajectory.status,
    now,
  );

  return {
    userId,
    generatedAt:     now.toISOString(),
    score:           Math.round(latest.score),
    riskBand:        latest.riskBand,
    projectedScore:  trajectory.status !== 'insufficient' ? trajectory.projected : null,
    trendStatus:     trajectory.status,
    streakWeeks:     streaks.current,
    bestStreak:      streaks.best,
    totalCheckins:   checkins.length,
    nextAction:      action.text,
    nextActionType:  action.type,
    nextActionHref:  action.href,
    proteinTargetG:  latest.proteinTargetG,
  };
}
