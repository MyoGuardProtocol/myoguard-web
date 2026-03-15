import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';

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
  CRITICAL: { label: 'Critical Risk', threshold: 0,  next: 'HIGH',     nextThr: 40,  colour: 'text-red-400',     dimColour: 'text-red-500/70',  dot: 'bg-red-500',     ring: 'ring-red-500',     bg: 'bg-red-950',     border: 'border-red-800'     },
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

// ─── Next best step ────────────────────────────────────────────────────────────
function getNextStep(
  band: Band,
  hasCheckins: boolean,
  proteinTargetG: number | null,
): { icon: string; action: string; detail: string; urgency: 'high' | 'medium' | 'low' } {
  if (band === 'CRITICAL' || band === 'HIGH') {
    return {
      icon:    '🏋️',
      action:  'Add resistance training 2–3 sessions this week',
      detail:  'This single change carries the largest score gain in your model. Squats, push-ups, and rows all qualify — no gym required.',
      urgency: 'high',
    };
  }
  if (band === 'MODERATE') {
    return {
      icon:    '🥩',
      action:  proteinTargetG
        ? `Reach ${Math.round(proteinTargetG)}g protein every day`
        : 'Hit your daily protein target consistently',
      detail:  'Consistent protein adherence removes the protein-deficit deduction from your score — the most immediate win available.',
      urgency: 'medium',
    };
  }
  if (!hasCheckins) {
    return {
      icon:    '📋',
      action:  'Log your first weekly check-in',
      detail:  'You\'re in the low-risk zone. Weekly check-ins will catch any drift early — before your next dose escalation.',
      urgency: 'low',
    };
  }
  return {
    icon:    '📅',
    action:  'Reassess before your next dose escalation',
    detail:  'Dose escalations are the highest-risk window for lean-mass loss. Running an assessment before each step-up keeps you ahead of the curve.',
    urgency: 'low',
  };
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
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      fullName: true,
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
        take: 3,
        select: {
          id: true,
          weekStart: true,
          avgProteinG: true,
          totalWorkouts: true,
          avgHydration: true,
        },
      },
    },
  });

  if (!user) redirect('/dashboard');

  const scored   = user.assessments.filter(a => a.muscleScore?.score != null);
  const checkins = user.weeklyCheckins;

  // ── Empty state ──────────────────────────────────────────────────────────────
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
            href="/"
            className="bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors inline-block"
          >
            Start Your Assessment →
          </Link>
        </div>
      </main>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const latest        = scored[scored.length - 1];
  const first         = scored[0];
  const ms            = latest.muscleScore!;
  const current       = Math.round(ms.score);
  const band          = (ms.riskBand as Band) ?? 'HIGH';
  const meta          = BAND_META[band];

  const delta: number | null = scored.length > 1
    ? Math.round(ms.score - first.muscleScore!.score)
    : null;
  const hasCheckins      = checkins.length > 0;
  const pointsToLow      = current < 80 ? 80 - current : null;
  const proteinTarget    = ms.proteinTargetG ?? null;

  const nextStep = getNextStep(band, hasCheckins, proteinTarget);
  const message  = getProgressMessage(delta, band, scored.length);
  const firstName = user.fullName?.split(' ')[0] ?? null;

  const urgencyBorder = {
    high:   'border-orange-800  bg-orange-950',
    medium: 'border-teal-800    bg-teal-950',
    low:    'border-slate-700   bg-slate-800',
  }[nextStep.urgency];

  const urgencyLabel = {
    high:   { text: 'Highest impact',  cls: 'bg-orange-900 text-orange-300 border-orange-800' },
    medium: { text: 'Recommended',     cls: 'bg-teal-900   text-teal-300   border-teal-800'   },
    low:    { text: 'Maintenance',     cls: 'bg-slate-700  text-slate-300  border-slate-600'  },
  }[nextStep.urgency];

  return (
    <main className="min-h-screen bg-slate-900 font-sans">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-white tracking-tight">
            Myo<span className="text-teal-400">Guard</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs text-slate-400 hover:text-white transition-colors font-medium"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 pt-7 pb-16 space-y-4">

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

          {/* Top row: big score + badges */}
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
              {/* Risk band badge */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.border} ${meta.colour}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>

              {/* Delta badge */}
              {delta !== null && (
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${
                  delta > 0
                    ? 'bg-emerald-900/70 text-emerald-400 border border-emerald-700'
                    : delta < 0
                    ? 'bg-red-900/70 text-red-400 border border-red-700'
                    : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}>
                  {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}
                  {' '}{Math.abs(delta)} pts
                </span>
              )}
            </div>
          </div>

          {/* ── Progress track (full 0–100 range) ── */}
          <div className="mb-5">
            <div className="relative mb-1">
              {/* Segmented colour track */}
              <div className="h-4 rounded-full overflow-hidden flex gap-px">
                {/* CRITICAL 0–40 = 40% */}
                <div className="h-full bg-red-900/60"     style={{ width: '40%' }} />
                {/* HIGH 40–60 = 20% */}
                <div className="h-full bg-orange-900/60"  style={{ width: '20%' }} />
                {/* MODERATE 60–80 = 20% */}
                <div className="h-full bg-amber-900/60"   style={{ width: '20%' }} />
                {/* LOW 80–100 = 20% */}
                <div className="h-full bg-emerald-900/60" style={{ width: '20%' }} />
              </div>

              {/* Low Risk threshold line */}
              {band !== 'LOW' && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-emerald-500/40"
                  style={{ left: '80%' }}
                />
              )}

              {/* Score thumb */}
              <div
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-xl ring-2 ${meta.ring}`}
                style={{ left: `${Math.min(97, Math.max(3, current))}%` }}
              />
            </div>

            {/* Track labels */}
            <div className="relative h-4 mt-2">
              <span className="absolute left-0 text-[9px] font-medium text-slate-600">0</span>
              {band !== 'LOW' && (
                <span
                  className="absolute text-[9px] font-medium text-emerald-600/70 -translate-x-1/2"
                  style={{ left: '80%' }}
                >
                  80
                </span>
              )}
              <span className="absolute right-0 text-[9px] font-medium text-slate-600">100</span>
            </div>
          </div>

          {/* Distance / status line */}
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
        {/* ── YOUR NEXT BEST STEP ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className={`rounded-2xl px-5 py-5 border ${urgencyBorder}`}>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.15em]">
              Your next best step
            </p>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${urgencyLabel.cls}`}>
              {urgencyLabel.text}
            </span>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-2xl flex-shrink-0">
              {nextStep.icon}
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1.5 leading-snug">
                {nextStep.action}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {nextStep.detail}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── RECENT CHECK-INS ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">

          {/* Header row */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-700/70 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.15em]">
              Recent check-ins
            </p>
            <Link
              href="/checkin"
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold transition-colors"
            >
              + Log this week
            </Link>
          </div>

          {checkins.length === 0 ? (
            /* Empty state */
            <div className="px-5 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-700/60 flex items-center justify-center text-2xl mx-auto mb-3">
                📋
              </div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                No check-ins logged yet
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mb-5 max-w-xs mx-auto">
                Weekly check-ins track protein adherence, workouts, and hydration between
                assessments — building a richer picture of your progress.
              </p>
              <Link
                href="/checkin"
                className="inline-block bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors"
              >
                Log this week →
              </Link>
            </div>
          ) : (
            /* Check-in rows */
            <div className="divide-y divide-slate-700/40">
              {checkins.map((c, i) => {
                const isLatest = i === 0;
                return (
                  <div key={c.id} className={`px-5 py-4 ${isLatest ? 'bg-slate-800/50' : ''}`}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <p className="text-xs font-semibold text-slate-200">
                        {isLatest ? 'Most recent · ' : ''}Week of {weekLabel(c.weekStart)}
                      </p>
                      {isLatest && (
                        <span className="text-[9px] font-bold text-teal-400 bg-teal-900/50 border border-teal-800 rounded-full px-2 py-0.5">
                          Latest
                        </span>
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
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.15em]">
              Progress trend
            </p>
            {scored.length > 1 && (
              <span className="text-[10px] text-slate-500 font-medium">
                {scored.length} assessments
              </span>
            )}
          </div>

          {scored.length < 2 ? (
            /* Empty state */
            <div className="px-5 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-700/60 flex items-center justify-center text-2xl mx-auto mb-3">
                📈
              </div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                Trend builds with each assessment
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mb-5 max-w-xs mx-auto">
                Run a new assessment after your next dose escalation to start tracking
                how your score changes over time.
              </p>
              <Link
                href="/"
                className="inline-block bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors"
              >
                New assessment →
              </Link>
            </div>
          ) : (
            <div className="px-5 pt-5 pb-5">
              {/* Bar chart */}
              <div className="flex items-end gap-1.5 mb-2" style={{ height: '80px' }}>
                {scored.map((a, i) => {
                  const s     = Math.round(a.muscleScore!.score);
                  const b     = (a.muscleScore!.riskBand as Band) ?? 'HIGH';
                  const isLast = i === scored.length - 1;
                  const height = Math.max(8, (s / 100) * 72);

                  return (
                    <div key={a.id} className="flex-1 flex flex-col items-center justify-end min-w-0 gap-1">
                      {isLast && (
                        <span className="text-[9px] font-bold text-teal-400">NOW</span>
                      )}
                      <div
                        className={`w-full rounded-t-sm ${isLast ? barColour(b) : 'bg-slate-600'}`}
                        style={{ height: `${height}px` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Score labels */}
              <div className="flex gap-1.5 mb-0.5">
                {scored.map((a, i) => (
                  <div key={a.id} className="flex-1 text-center min-w-0">
                    <span className="text-[9px] text-slate-500 tabular-nums">
                      {Math.round(a.muscleScore!.score)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Date labels */}
              <div className="flex gap-1.5 mb-4">
                {scored.map((a, i) => (
                  <div key={a.id} className="flex-1 text-center min-w-0">
                    <span className="text-[8px] text-slate-600 truncate block">
                      {shortDate(a.assessmentDate)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Overall delta summary */}
              {delta !== null && (
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 ${
                  delta > 0
                    ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                    : delta < 0
                    ? 'bg-red-900/50 text-red-400 border border-red-800'
                    : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}>
                  {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}
                  {' '}{Math.abs(delta)} points overall since first assessment
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CTA pair ── */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Link
            href="/checkin"
            className="bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm py-3.5 rounded-2xl text-center transition-colors"
          >
            Log this week →
          </Link>
          <Link
            href="/"
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm py-3.5 rounded-2xl text-center transition-colors"
          >
            New assessment
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-slate-600 pt-1 leading-relaxed">
          Score history reflects completed assessments. Weekly check-ins track
          adherence but do not recalculate your MyoGuard Score.
        </p>

      </div>
    </main>
  );
}
