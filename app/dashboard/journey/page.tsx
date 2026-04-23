import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import { generateWeeklyDigest } from '@/src/lib/weeklyDigest';

// ─── Band config ───────────────────────────────────────────────────────────────
type Band = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

const BAND_META: Record<Band, {
  label:      string;
  threshold:  number;
  next:       Band | null;
  nextThr:    number | null;
  colour:     string;
  dimColour:  string;
  dot:        string;
  ring:       string;
  bg:         string;
  border:     string;
}> = {
  CRITICAL: { label: 'Critical Risk', threshold: 0,  next: 'HIGH',     nextThr: 40,  colour: 'text-red-400',     dimColour: 'text-red-500/70',    dot: 'bg-red-500',     ring: 'ring-red-500',     bg: 'bg-red-950',     border: 'border-red-800'     },
  HIGH:     { label: 'High Risk',     threshold: 40, next: 'MODERATE', nextThr: 60,  colour: 'text-orange-400',  dimColour: 'text-orange-500/70', dot: 'bg-orange-500',  ring: 'ring-orange-500',  bg: 'bg-orange-950',  border: 'border-orange-800'  },
  MODERATE: { label: 'Moderate Risk', threshold: 60, next: 'LOW',      nextThr: 80,  colour: 'text-amber-400',   dimColour: 'text-amber-500/70',  dot: 'bg-amber-500',   ring: 'ring-amber-500',   bg: 'bg-amber-950',   border: 'border-amber-800'   },
  LOW:      { label: 'Low Risk',      threshold: 80, next: null,       nextThr: null, colour: 'text-emerald-400', dimColour: 'text-emerald-500/70', dot: 'bg-emerald-500', ring: 'ring-emerald-500', bg: 'bg-emerald-950', border: 'border-emerald-800' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Trend display config ──────────────────────────────────────────────────────
type TrendStatus = 'improving' | 'stable' | 'declining' | 'insufficient';

const TREND_CONFIG: Record<TrendStatus, {
  arrow:    string;
  label:    string;
  badgeCls: string;
  ringCls:  string;
  barCls:   string;
}> = {
  improving:   { arrow: '↑', label: 'Improving', badgeCls: 'bg-emerald-900/70 text-emerald-300 border-emerald-700', ringCls: 'ring-emerald-500', barCls: 'bg-emerald-500' },
  stable:      { arrow: '→', label: 'Stable',    badgeCls: 'bg-slate-700     text-slate-300    border-slate-600',   ringCls: 'ring-slate-400',   barCls: 'bg-slate-400'   },
  declining:   { arrow: '↓', label: 'Declining', badgeCls: 'bg-red-900/70    text-red-300      border-red-700',     ringCls: 'ring-red-500',     barCls: 'bg-red-500'     },
  insufficient:{ arrow: '→', label: 'Building…', badgeCls: 'bg-slate-700     text-slate-400    border-slate-600',   ringCls: 'ring-slate-400',   barCls: 'bg-slate-400'   },
};

// ─── Smart next action (rich UI — icon / subtitle / CTA label) ─────────────────
// The digest provides nextAction text + type + href.
// This function maps those to the richer UI shape the card needs.
type ActionType = 'urgent' | 'recommended' | 'maintenance';
type NextAction = {
  icon:     string;
  title:    string;
  subtitle: string;
  cta:      string;
  ctaHref:  string;
  type:     ActionType;
};

function getSmartNextAction(
  band:             Band,
  proteinTargetG:   number | null,
  latestCheckin:    { weekStart: Date; avgProteinG: number | null; totalWorkouts: number | null } | null,
  trajectoryStatus: TrendStatus,
  now:              Date,
): NextAction {
  const daysSinceCheckin = latestCheckin
    ? Math.floor((now.getTime() - latestCheckin.weekStart.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (trajectoryStatus === 'declining') {
    return {
      icon:     '⚠️',
      title:    'Review your MyoGuard protocol today',
      subtitle: 'Your trend shows a declining score. Protein adherence and resistance training are the two fastest levers to reverse this.',
      cta:      'Run new assessment →',
      ctaHref:  '/dashboard/assessment',
      type:     'urgent',
    };
  }

  if (daysSinceCheckin === null || daysSinceCheckin >= 7) {
    return {
      icon:     '📋',
      title:    'Complete your weekly check-in',
      subtitle: "It's been over a week since your last log. Consistent tracking gives MyoGuard more signal to keep your protocol accurate.",
      cta:      'Log this week →',
      ctaHref:  '/checkin',
      type:     'recommended',
    };
  }

  if (proteinTargetG != null && latestCheckin?.avgProteinG != null) {
    const gap = proteinTargetG - latestCheckin.avgProteinG;
    if (gap > 20) {
      return {
        icon:     '🥩',
        title:    `Add ${Math.round(gap)}g protein today to stay on track`,
        subtitle: `Your recent average is ${Math.round(latestCheckin.avgProteinG)}g vs your ${Math.round(proteinTargetG)}g daily target. Closing this gap is the fastest route to a higher score.`,
        cta:      'Log this week →',
        ctaHref:  '/checkin',
        type:     'recommended',
      };
    }
  }

  if (
    latestCheckin?.totalWorkouts != null &&
    latestCheckin.totalWorkouts < 2 &&
    (band === 'HIGH' || band === 'CRITICAL')
  ) {
    return {
      icon:     '🏋️',
      title:    'Add 2 resistance sessions this week',
      subtitle: 'Your recent log shows fewer than 2 workouts. Resistance training is the single highest-impact change at your current risk level.',
      cta:      'View protocol →',
      ctaHref:  '/dashboard/assessment',
      type:     'recommended',
    };
  }

  if (band === 'LOW') {
    return {
      icon:     '✅',
      title:    'Reassess before your next dose escalation',
      subtitle: "You're in the optimal zone. Each dose step-up is a muscle-risk window — a fresh assessment keeps your protocol ahead of it.",
      cta:      'New assessment →',
      ctaHref:  '/dashboard/assessment',
      type:     'maintenance',
    };
  }

  if (band === 'MODERATE') {
    return {
      icon:     '🥩',
      title:    'Hit your daily protein target consistently',
      subtitle: 'Sustained protein adherence over 4–6 weeks is the most reliable path out of the Moderate Risk zone.',
      cta:      'Log this week →',
      ctaHref:  '/checkin',
      type:     'recommended',
    };
  }

  return {
    icon:     '🏋️',
    title:    'Add resistance training 2–3 sessions this week',
    subtitle: 'Resistance training carries the largest single score gain at your current risk level. Bodyweight exercises count — no gym needed.',
    cta:      'View protocol →',
    ctaHref:  '/',
    type:     'urgent',
  };
}

const ACTION_STYLE: Record<ActionType, {
  border:  string;
  bg:      string;
  badge:   string;
  label:   string;
  ctaCls:  string;
}> = {
  urgent:      { border: 'border-orange-800', bg: 'bg-orange-950', badge: 'bg-orange-900  text-orange-300  border-orange-800', label: 'Highest impact', ctaCls: 'bg-orange-600 hover:bg-orange-500' },
  recommended: { border: 'border-teal-800',   bg: 'bg-teal-950',   badge: 'bg-teal-900    text-teal-300    border-teal-800',   label: 'Recommended',   ctaCls: 'bg-green-600  hover:bg-green-700'  },
  maintenance: { border: 'border-slate-700',  bg: 'bg-slate-800',  badge: 'bg-slate-700   text-slate-300   border-slate-600',  label: 'Maintenance',   ctaCls: 'bg-slate-600  hover:bg-slate-500'  },
};

// ─── Streak message ─────────────────────────────────────────────────────────────
function getStreakMessage(current: number, total: number): string {
  if (current === 0 && total === 0) return 'Start your first weekly check-in to begin building your consistency record.';
  if (current === 0) return 'Time to restart your streak. Every week back on track compounds your results.';
  if (current === 1) return 'First check-in logged this week. One week at a time.';
  if (current === 2) return 'Two weeks in a row. Consistency at this level already separates you from most patients.';
  if (current === 3) return `Three-week streak. The habit is forming — this is where outcomes start to diverge.`;
  if (current < 8)   return `${current}-week streak. Sustained adherence is the single most predictive factor in GLP-1 muscle outcomes.`;
  if (current < 13)  return `${current}-week streak. Over two months of consistent tracking — this is clinical-grade dedication.`;
  return `${current}-week streak. Exceptional. You are in the top tier of protocol adherence on this platform.`;
}

// ─── Recent wins ───────────────────────────────────────────────────────────────
type Win = {
  icon:    string;
  iconCls: string;
  text:    string;
  date:    string;
};

function buildRecentWins(
  checkins: Array<{
    weekStart:     Date;
    avgProteinG:   number | null;
    totalWorkouts: number | null;
    avgHydration:  number | null;
  }>,
  scored:         Array<{ assessmentDate: Date; muscleScore: { score: number } | null }>,
  proteinTargetG: number | null,
): Win[] {
  const wins: Win[] = [];

  // Score improvement win (most recent pair)
  if (scored.length >= 2) {
    const latest = scored[scored.length - 1];
    const prev   = scored[scored.length - 2];
    const gain   = (latest.muscleScore?.score ?? 0) - (prev.muscleScore?.score ?? 0);
    if (gain > 0) {
      wins.push({
        icon:    '↑',
        iconCls: 'text-emerald-400 bg-emerald-900/40 border-emerald-800',
        text:    `Score improved +${Math.round(gain)} points`,
        date:    shortDate(latest.assessmentDate),
      });
    }
  }

  // Check-in level wins (scan most recent 3)
  for (const ci of checkins.slice(0, 3)) {
    if (wins.length >= 3) break;

    // Protein target hit (≥ 90% of target)
    if (proteinTargetG != null && ci.avgProteinG != null && ci.avgProteinG >= proteinTargetG * 0.90) {
      wins.push({
        icon:    '✓',
        iconCls: 'text-teal-400 bg-teal-900/40 border-teal-800',
        text:    `Protein target achieved — ${Math.round(ci.avgProteinG)}g/day`,
        date:    shortDate(ci.weekStart),
      });
      continue;
    }

    // Strong workout week
    if (ci.totalWorkouts != null && ci.totalWorkouts >= 3) {
      wins.push({
        icon:    '✓',
        iconCls: 'text-teal-400 bg-teal-900/40 border-teal-800',
        text:    `${ci.totalWorkouts} resistance sessions logged`,
        date:    shortDate(ci.weekStart),
      });
      continue;
    }

    // General check-in completion
    if (ci.avgProteinG != null || ci.totalWorkouts != null || ci.avgHydration != null) {
      wins.push({
        icon:    '✓',
        iconCls: 'text-slate-400 bg-slate-700/40 border-slate-600',
        text:    'Weekly check-in logged',
        date:    shortDate(ci.weekStart),
      });
    }
  }

  return wins.slice(0, 3);
}

// ─── Progress message ──────────────────────────────────────────────────────────
function getProgressMessage(delta: number | null, band: Band, count: number): string {
  if (count === 1) {
    const m: Record<Band, string> = {
      LOW:      'Strong start — you\'re already in the low-risk zone. The goal now is to maintain this through every dose escalation.',
      MODERATE: 'Your journey begins here. Most patients who follow their protocol move out of moderate risk within 4–6 weeks.',
      HIGH:     'This is your baseline. Consistent protein intake and resistance training are the two changes that move this number fastest.',
      CRITICAL: 'This is where it begins. Every step you take from here is progress. Your protocol is designed to change this trajectory.',
    };
    return m[band];
  }
  if (delta === null) return 'Keep tracking to see your progress story unfold.';
  if (delta > 15) return 'Exceptional progress. Your commitment to the protocol is measurably protecting your muscle mass.';
  if (delta > 8)  return 'Solid upward trend. The data shows your interventions are working — keep the consistency going.';
  if (delta > 0)  return 'Moving in the right direction. Small, consistent gains compound into significant muscle protection over time.';
  if (delta === 0) return 'Score is holding steady. Review your next best step below to identify your highest-impact move.';
  return 'A small dip — not uncommon during dose escalations. Your targets remain unchanged; refocus on protein adherence first.';
}

// ─── Score bar colour ──────────────────────────────────────────────────────────
function barColour(b: Band) {
  if (b === 'LOW')      return 'bg-emerald-500';
  if (b === 'MODERATE') return 'bg-amber-500';
  if (b === 'HIGH')     return 'bg-orange-500';
  return 'bg-red-500';
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function JourneyPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  // ── Display-only query: user name + raw assessment/check-in data for chart/rows
  const userData = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id:       true,
      fullName: true,
      assessments: {
        orderBy: { assessmentDate: 'asc' },
        include: {
          muscleScore: {
            select: { score: true, riskBand: true },
          },
        },
      },
      weeklyCheckins: {
        orderBy: { weekStart: 'desc' },
        take: 52,
        select: {
          id:            true,
          weekStart:     true,
          avgProteinG:   true,
          totalWorkouts: true,
          avgHydration:  true,
        },
      },
    },
  });

  if (!userData) redirect('/dashboard');

  const scored   = userData.assessments.filter(a => a.muscleScore?.score != null);
  const checkins = userData.weeklyCheckins;

  // ── Empty state (no scored assessments yet) ───────────────────────────────────
  if (scored.length === 0) {
    return (
      <main className="min-h-screen bg-slate-900 font-sans flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl mx-auto mb-5">
            📊
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            Your journey hasn&apos;t started yet
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Complete your first assessment to generate your MyoGuard Score and
            begin tracking your muscle-protection progress over time.
          </p>
          <Link
            href="/dashboard/assessment"
            className="bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors inline-block"
          >
            Start Your Assessment →
          </Link>
        </div>
      </main>
    );
  }

  // ── Smart data via digest engine ──────────────────────────────────────────────
  // generateWeeklyDigest accepts the internal DB User.id (NOT Clerk userId)
  const digest = await generateWeeklyDigest(userData.id);

  // digest is null only when there are no scored assessments — already handled above
  if (!digest) redirect('/dashboard');

  // ── Derived display variables ─────────────────────────────────────────────────
  const now        = new Date();
  const current    = digest.score;
  const band       = digest.riskBand as Band;
  const meta       = BAND_META[band];
  const trendCfg   = TREND_CONFIG[digest.trendStatus];

  // Point change for projection card label
  const pointChange = digest.projectedScore != null ? digest.projectedScore - current : 0;

  // Basis text depends on how many assessments drove the projection
  const basisText = scored.length >= 3
    ? 'Based on your last 3 assessments and recent check-in data.'
    : 'Based on your last 2 assessments and recent check-in data.';

  const first      = scored[0];
  const latest     = scored[scored.length - 1];
  const delta: number | null = scored.length > 1
    ? Math.round(scored[scored.length - 1].muscleScore!.score - first.muscleScore!.score)
    : null;
  const pointsToLow  = current < 80 ? 80 - current : null;
  const firstName    = userData.fullName?.split(' ')[0] ?? null;

  // Rich next-action UI (icon, subtitle, CTA label) — fed by digest fields
  const latestCI    = checkins[0] ?? null;
  const nextAction  = getSmartNextAction(band, digest.proteinTargetG, latestCI, digest.trendStatus, now);
  const actionStyle = ACTION_STYLE[nextAction.type];

  // Streak display — numbers come from digest; 8-week window is display-only
  const streakMessage = getStreakMessage(digest.streakWeeks, digest.totalCheckins);

  const msInDay  = 86_400_000;
  const msInWeek = 7 * msInDay;
  const streakWindow: boolean[] = [];
  for (let i = 7; i >= 0; i--) {
    const slotStart = now.getTime() - (i + 1) * msInWeek;
    const slotEnd   = now.getTime() - i * msInWeek;
    const hit = checkins.some(ci => {
      const t = ci.weekStart.getTime();
      return t >= slotStart - 3 * msInDay && t <= slotEnd + 3 * msInDay;
    });
    streakWindow.push(hit);
  }

  const recentCI   = checkins.slice(0, 3);
  const recentWins = buildRecentWins(recentCI, scored, digest.proteinTargetG);
  const message    = getProgressMessage(delta, band, scored.length);

  return (
    <main className="min-h-screen bg-slate-900 font-sans">

      {/* ── Sticky header ── */}
      <nav style={{
        background: "#060D1E",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        position: "sticky", top: 0, zIndex: 50,
        padding: "0 20px",
        marginBottom: "0"
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", height: "56px" }}>
          <a href="/dashboard" style={{ textDecoration: "none",
            fontSize: "18px", fontWeight: "900",
            letterSpacing: "-0.03em", color: "#F8FAFC" }}>
            Myo<span style={{ color: "#2DD4BF" }}>Guard</span>
          </a>
          <a href="/dashboard" style={{ fontSize: "13px",
            color: "#94A3B8", textDecoration: "none" }}>
            ← Dashboard
          </a>
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-8 pb-16 space-y-8">

        {/* ── Section label + title ── */}
        <div>
          <p className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.2em] mb-1">
            Your MyoGuard Journey
          </p>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            {firstName ? `${firstName}'s Progress` : 'Your Progress'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {scored.length === 1
              ? `First assessment · ${shortDate(latest.assessmentDate)}`
              : `${scored.length} assessments · started ${shortDate(first.assessmentDate)}`}
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── SCORE HERO CARD ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700">

          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Current Score
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-7xl font-black text-white tabular-nums leading-none">
                  {current}
                </span>
                <span className="text-2xl text-slate-600 font-light leading-none">/100</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 mt-1 flex-shrink-0">
              {/* Risk badge — fades in from above on load */}
              <span className={`myg-badge-in inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.border} ${meta.colour}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              {delta !== null && (
                /* Delta badge — slightly later fade-in */
                <span className={`myg-badge-in-late inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${
                  delta > 0 ? 'bg-emerald-900/70 text-emerald-400 border border-emerald-700'
                  : delta < 0 ? 'bg-red-900/70 text-red-400 border border-red-700'
                  : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}>
                  {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {Math.abs(delta)} pts
                </span>
              )}
            </div>
          </div>

          {/* Progress track */}
          <div className="mb-5">
            <div className="relative mb-1">
              {/* Track reveals left→right; overflow-hidden clips the clip-path animation cleanly */}
              <div className="myg-track-reveal h-4 rounded-full overflow-hidden flex gap-px">
                <div className="h-full bg-red-900/60"     style={{ width: '40%' }} />
                <div className="h-full bg-orange-900/60"  style={{ width: '20%' }} />
                <div className="h-full bg-amber-900/60"   style={{ width: '20%' }} />
                <div className="h-full bg-emerald-900/60" style={{ width: '20%' }} />
              </div>
              {band !== 'LOW' && (
                <div className="absolute top-0 h-full w-0.5 bg-emerald-500/40" style={{ left: '80%' }} />
              )}
              {/* Thumb pops in after the track reveal finishes (0.5 s delay) */}
              <div
                className={`myg-thumb-pop absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-xl ring-2 ${meta.ring}`}
                style={{ left: `${Math.min(97, Math.max(3, current))}%` }}
              />
            </div>
            <div className="relative h-4 mt-2">
              <span className="absolute left-0 text-[9px] font-medium text-slate-600">0</span>
              {band !== 'LOW' && (
                <span className="absolute text-[9px] font-medium text-emerald-600/70 -translate-x-1/2" style={{ left: '80%' }}>80</span>
              )}
              <span className="absolute right-0 text-[9px] font-medium text-slate-600">100</span>
            </div>
          </div>

          {pointsToLow !== null ? (
            <div className="flex items-center gap-2 bg-slate-700/50 rounded-xl px-4 py-3">
              <span className="text-lg">🎯</span>
              <p className="text-sm text-slate-200 leading-snug">
                <span className="text-white font-bold">{pointsToLow} point{pointsToLow === 1 ? '' : 's'}</span>
                {' '}away from the{' '}
                <span className="text-emerald-400 font-semibold">Low Risk zone</span>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-950 border border-emerald-800 rounded-xl px-4 py-3">
              <span className="text-lg">✅</span>
              <p className="text-sm text-emerald-300 font-semibold leading-snug">
                You are in the optimal Low Risk zone
              </p>
            </div>
          )}

          {/* ── Protein target row ── */}
          <div className="mt-3 flex items-center justify-between bg-slate-700/30 rounded-xl px-4 py-3 border border-slate-700/50">
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">🥩</span>
              <p className="text-xs text-slate-400 font-medium">
                Daily protein target
              </p>
            </div>
            {digest.proteinTargetG != null ? (
              <span className="text-sm font-extrabold text-white tabular-nums">
                {Math.round(digest.proteinTargetG)}
                <span className="text-xs font-semibold text-slate-400 ml-0.5">g/day</span>
              </span>
            ) : (
              <Link
                href="/dashboard/assessment"
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
              >
                Set your target →
              </Link>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── 30-DAY SCORE PROJECTION CARD ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">

          <div className="px-5 pt-5 pb-4 border-b border-slate-700/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">
                  Projected Score · 30 Days
                </p>
                <p className="text-xs text-slate-500 leading-snug">
                  Estimated trajectory based on your assessment history
                </p>
              </div>
              <span className="text-xl">📈</span>
            </div>
          </div>

          {digest.trendStatus === 'insufficient' ? (
            <div className="px-5 py-7 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-700/60 flex items-center justify-center text-2xl mx-auto mb-3">📊</div>
              <p className="text-sm font-semibold text-slate-200 mb-1">Building your trajectory…</p>
              <p className="text-xs text-slate-500 leading-relaxed mb-5 max-w-xs mx-auto">
                Complete your next assessment after your next dose escalation to activate score projection.
              </p>
              <Link href="/dashboard/assessment" className="inline-block bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors">
                New assessment →
              </Link>
            </div>
          ) : (
            <div className="px-5 py-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border mb-3 ${trendCfg.badgeCls}`}>
                    <span className="text-sm font-black leading-none">{trendCfg.arrow}</span>
                    {trendCfg.label}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-black text-white tabular-nums leading-none">{digest.projectedScore}</span>
                    <span className="text-xl text-slate-600 font-light leading-none">/100</span>
                  </div>
                  <p className={`text-xs font-semibold mt-1.5 ${
                    digest.trendStatus === 'improving' ? 'text-emerald-400' :
                    digest.trendStatus === 'declining' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {pointChange > 0 ? `+${pointChange} points projected`
                    : pointChange < 0 ? `${pointChange} points projected`
                    : 'Score holding steady'}
                  </p>
                </div>
                <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border flex-shrink-0 ${
                  digest.trendStatus === 'improving' ? 'bg-emerald-900/40 border-emerald-800' :
                  digest.trendStatus === 'declining' ? 'bg-red-900/40 border-red-800' :
                  'bg-slate-700/40 border-slate-600'
                }`}>
                  <span className={`text-3xl font-black leading-none ${
                    digest.trendStatus === 'improving' ? 'text-emerald-400' :
                    digest.trendStatus === 'declining' ? 'text-red-400' : 'text-slate-400'
                  }`}>{trendCfg.arrow}</span>
                  <span className="text-[9px] font-medium text-slate-500 mt-0.5">30 days</span>
                </div>
              </div>

              <div className="space-y-2.5 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 w-12 flex-shrink-0 font-medium">Now</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                    {/* scaleX from left; parent overflow-hidden clips the animation */}
                    <div className="myg-bar-grow h-full rounded-full bg-slate-400" style={{ width: `${current}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 w-7 text-right tabular-nums font-semibold">{current}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 w-12 flex-shrink-0 font-medium">Projected</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                    {/* Projected bar animates slightly later than the Now bar */}
                    <div className={`myg-bar-grow-late h-full rounded-full ${trendCfg.barCls}`} style={{ width: `${digest.projectedScore}%` }} />
                  </div>
                  <span className={`text-[10px] w-7 text-right tabular-nums font-bold ${
                    digest.trendStatus === 'improving' ? 'text-emerald-400' :
                    digest.trendStatus === 'declining' ? 'text-red-400' : 'text-slate-400'
                  }`}>{digest.projectedScore}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">{basisText}</p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── PROGRESS MESSAGE ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/60 rounded-2xl px-5 py-4 border border-slate-700/50">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">
              {delta !== null && delta > 0 ? '🚀' : delta !== null && delta < 0 ? '💪' : '🎯'}
            </span>
            <p className="text-sm text-slate-200 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── YOUR NEXT MUSCLE PROTECTION STEP ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className={`rounded-2xl border overflow-hidden ${actionStyle.border} ${actionStyle.bg}`}>
          <div className={`px-5 pt-4 pb-3 border-b ${actionStyle.border}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.15em]">
                Your Next Muscle Protection Step
              </p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${actionStyle.badge}`}>
                {actionStyle.label}
              </span>
            </div>
          </div>
          <div className="px-5 py-5">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-2xl flex-shrink-0">
                {nextAction.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white mb-1.5 leading-snug">{nextAction.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{nextAction.subtitle}</p>
              </div>
            </div>
            <Link href={nextAction.ctaHref} className={`block w-full text-center text-white font-bold text-sm py-3 rounded-xl transition-colors ${actionStyle.ctaCls}`}>
              {nextAction.cta}
            </Link>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── CONSISTENCY STREAK + WINS ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">

          {/* ── Header ── */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-700/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">
                  Consistency
                </p>
                <p className="text-sm font-semibold text-slate-200 leading-snug">
                  {streakMessage}
                </p>
              </div>
              {/* Streak flame indicator */}
              {digest.streakWeeks >= 2 && (
                <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex flex-col items-center justify-center border ml-3 ${
                  digest.streakWeeks >= 8  ? 'bg-emerald-900/50 border-emerald-700' :
                  digest.streakWeeks >= 4  ? 'bg-teal-900/50    border-teal-700'    :
                                             'bg-slate-700/50   border-slate-600'
                }`}>
                  <span className={`text-lg font-black tabular-nums leading-none ${
                    digest.streakWeeks >= 8 ? 'text-emerald-400' :
                    digest.streakWeeks >= 4 ? 'text-teal-400'    : 'text-slate-300'
                  }`}>{digest.streakWeeks}</span>
                  <span className="text-[8px] font-medium text-slate-500 mt-0.5">wks</span>
                </div>
              )}
            </div>
          </div>

          {/* ── 8-week activity window ── */}
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              {streakWindow.map((active, i) => (
                /* Each bar animates in with a 60 ms stagger — left→right reveal */
                <div
                  key={i}
                  title={active ? 'Check-in logged' : 'No check-in'}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={`myg-streak-bar flex-1 h-2 rounded-full ${
                    active ? 'bg-teal-500' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-slate-600">8 weeks ago</span>
              <span className="text-[9px] text-slate-600">This week</span>
            </div>
          </div>

          {/* ── Stat trio ── */}
          <div className="grid grid-cols-3 divide-x divide-slate-700/60 border-t border-slate-700/60">
            {[
              { value: digest.streakWeeks,   label: 'Current streak',  unit: 'wks' },
              { value: digest.bestStreak,    label: 'Best streak',     unit: 'wks' },
              { value: digest.totalCheckins, label: 'Total check-ins', unit: '' },
            ].map(({ value, label, unit }) => (
              <div key={label} className="px-4 py-4 text-center">
                <div className="flex items-baseline justify-center gap-0.5 mb-1">
                  <span className="text-2xl font-black text-white tabular-nums leading-none">{value}</span>
                  {unit && <span className="text-xs text-slate-500 font-medium">{unit}</span>}
                </div>
                <p className="text-[9px] font-medium text-slate-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Recent wins ── */}
          {recentWins.length > 0 && (
            <div className="border-t border-slate-700/60">
              <div className="px-5 pt-3.5 pb-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                  Recent wins
                </p>
              </div>
              <div className="divide-y divide-slate-700/30 pb-1">
                {recentWins.map((win, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 border ${win.iconCls}`}>
                      {win.icon}
                    </span>
                    <p className="flex-1 text-xs text-slate-300 font-medium leading-snug min-w-0">
                      {win.text}
                    </p>
                    <span className="text-[10px] text-slate-600 flex-shrink-0 tabular-nums">
                      {win.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No wins yet — prompt */}
          {recentWins.length === 0 && (
            <div className="border-t border-slate-700/60 px-5 py-5 text-center">
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                Complete a weekly check-in to start building your wins record.
              </p>
              <Link
                href="/checkin"
                className="inline-block bg-teal-700/60 hover:bg-teal-700 text-teal-300 font-semibold text-xs px-4 py-2 rounded-xl transition-colors border border-teal-700"
              >
                Log this week →
              </Link>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── RECENT CHECK-INS ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">

          <div className="px-5 pt-4 pb-3 border-b border-slate-700/70 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.15em]">
              Recent check-ins
            </p>
            <Link href="/checkin" className="text-xs text-teal-400 hover:text-teal-300 font-semibold transition-colors">
              + Log this week
            </Link>
          </div>

          {recentCI.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-700/60 flex items-center justify-center text-2xl mx-auto mb-3">📋</div>
              <p className="text-sm font-semibold text-slate-200 mb-1">No check-ins logged yet</p>
              <p className="text-xs text-slate-500 leading-relaxed mb-5 max-w-xs mx-auto">
                Weekly check-ins track protein adherence, workouts, and hydration between
                assessments — building a richer picture of your progress.
              </p>
              <Link href="/checkin" className="inline-block bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors">
                Log this week →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/40">
              {recentCI.map((c, i) => {
                const isLatest = i === 0;
                return (
                  <div key={c.id} className={`px-5 py-4 ${isLatest ? 'bg-slate-800/50' : ''}`}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <p className="text-xs font-semibold text-slate-200">
                        {isLatest ? 'Most recent · ' : ''}Week of {weekLabel(c.weekStart)}
                      </p>
                      {isLatest && (
                        <span className="text-[9px] font-bold text-teal-400 bg-teal-900/50 border border-teal-800 rounded-full px-2 py-0.5">Latest</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.avgProteinG != null && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1.5">
                          🥩 <span className="font-semibold">{Math.round(c.avgProteinG)}g</span>
                          <span className="text-slate-500">protein/day</span>
                        </span>
                      )}
                      {c.totalWorkouts != null && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1.5">
                          🏋️ <span className="font-semibold">{c.totalWorkouts}</span>
                          <span className="text-slate-500">workout{c.totalWorkouts === 1 ? '' : 's'}</span>
                        </span>
                      )}
                      {c.avgHydration != null && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1.5">
                          💧 <span className="font-semibold">{c.avgHydration}L</span>
                          <span className="text-slate-500">/day</span>
                        </span>
                      )}
                      {c.avgProteinG == null && c.totalWorkouts == null && c.avgHydration == null && (
                        <span className="text-xs text-slate-500">No metrics logged this week</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── PROGRESS TREND ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">

          <div className="px-5 pt-4 pb-3 border-b border-slate-700/70 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.15em]">Progress trend</p>
            {scored.length > 1 && (
              <span className="text-[10px] text-slate-500 font-medium">{scored.length} assessments</span>
            )}
          </div>

          {scored.length < 2 ? (
            <div className="px-5 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-700/60 flex items-center justify-center text-2xl mx-auto mb-3">📈</div>
              <p className="text-sm font-semibold text-slate-200 mb-1">Trend builds with each assessment</p>
              <p className="text-xs text-slate-500 leading-relaxed mb-5 max-w-xs mx-auto">
                Run a new assessment after your next dose escalation to start tracking how your score changes over time.
              </p>
              <Link href="/dashboard/assessment" className="inline-block bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors">
                New assessment →
              </Link>
            </div>
          ) : (
            <div className="px-5 pt-5 pb-5">
              <div className="flex items-end gap-1.5 mb-2" style={{ height: '80px' }}>
                {scored.map((a, i) => {
                  const s      = Math.round(a.muscleScore!.score);
                  const b      = (a.muscleScore!.riskBand as Band) ?? 'HIGH';
                  const isLast = i === scored.length - 1;
                  const height = Math.max(8, (s / 100) * 72);
                  return (
                    <div key={a.id} className="flex-1 flex flex-col items-center justify-end min-w-0 gap-1">
                      {isLast && <span className="text-[9px] font-bold text-teal-400">NOW</span>}
                      <div className={`w-full rounded-t-sm ${isLast ? barColour(b) : 'bg-slate-600'}`} style={{ height: `${height}px` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5 mb-0.5">
                {scored.map((a) => (
                  <div key={a.id} className="flex-1 text-center min-w-0">
                    <span className="text-[9px] text-slate-500 tabular-nums">{Math.round(a.muscleScore!.score)}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mb-4">
                {scored.map((a) => (
                  <div key={a.id} className="flex-1 text-center min-w-0">
                    <span className="text-[8px] text-slate-600 truncate block">{shortDate(a.assessmentDate)}</span>
                  </div>
                ))}
              </div>
              {delta !== null && (
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 ${
                  delta > 0 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                  : delta < 0 ? 'bg-red-900/50 text-red-400 border border-red-800'
                  : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}>
                  {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {Math.abs(delta)} points overall since first assessment
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CTA pair ── */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Link href="/checkin" className="bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm py-3.5 rounded-2xl text-center transition-colors">
            Log this week →
          </Link>
          <Link href="/dashboard/assessment" className="bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm py-3.5 rounded-2xl text-center transition-colors">
            New assessment
          </Link>
        </div>

        <p className="text-center text-[10px] text-slate-600 pt-1 leading-relaxed">
          Score history reflects completed assessments. Weekly check-ins track
          adherence but do not recalculate your MyoGuard Score.
        </p>

      </div>
    </main>
  );
}
