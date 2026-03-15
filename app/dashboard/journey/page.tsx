import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';

// ─── Band config ──────────────────────────────────────────────────────────────
type Band = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

const BAND_ORDER: Band[] = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];

const BAND_META: Record<Band, {
  label: string;
  threshold: number;   // score at which this band starts
  next: Band | null;
  nextThreshold: number | null;
  colour: string;
  bg: string;
  border: string;
}> = {
  CRITICAL: { label: 'Critical Risk', threshold: 0,  next: 'HIGH',     nextThreshold: 40,  colour: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'     },
  HIGH:     { label: 'High Risk',     threshold: 40, next: 'MODERATE', nextThreshold: 60,  colour: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200'  },
  MODERATE: { label: 'Moderate Risk', threshold: 60, next: 'LOW',      nextThreshold: 80,  colour: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
  LOW:      { label: 'Low Risk',      threshold: 80, next: null,       nextThreshold: null, colour: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

// ─── Progress message ─────────────────────────────────────────────────────────
function getProgressMessage(
  delta: number | null,
  band: Band,
  assessmentCount: number,
): string {
  if (assessmentCount === 1) {
    const starters: Record<Band, string> = {
      LOW:      'Strong start. You\'re already in the low-risk zone — the goal now is to stay here through every dose escalation.',
      MODERATE: 'Your journey begins here. Most patients who act on their protocol move out of moderate risk within 4–6 weeks.',
      HIGH:     'This is your baseline. The path forward is clear — consistent protein and resistance training will move this number.',
      CRITICAL: 'This is where it begins. Every step you take from here is progress. Your protocol is designed to change this trajectory.',
    };
    return starters[band];
  }

  if (delta === null) return 'Keep tracking to see your progress story unfold.';

  if (delta > 15) return 'Exceptional progress. Your commitment to the protocol is measurably protecting your muscle mass.';
  if (delta > 8)  return 'Solid upward trend. The data shows your interventions are working — keep the consistency going.';
  if (delta > 0)  return 'Moving in the right direction. Small consistent gains compound into significant protection over time.';
  if (delta === 0) return 'Score is holding steady. Review the projection card to identify your highest-impact next move.';
  return 'A small setback — not uncommon during dose escalations. Your protocol targets remain the same; refocus on protein adherence.';
}

// ─── Next step recommendation ─────────────────────────────────────────────────
function getNextStep(band: Band, hasCheckins: boolean): { icon: string; action: string; detail: string } {
  if (band === 'CRITICAL' || band === 'HIGH') {
    return {
      icon: '🏋️',
      action: 'Start resistance training 2–3× per week',
      detail: 'This single change carries the largest point-gain in your scoring model. Even bodyweight exercises qualify.',
    };
  }
  if (band === 'MODERATE') {
    return {
      icon: '🥩',
      action: 'Hit your daily protein target consistently',
      detail: 'Consistent protein adherence at the standard target removes the protein-deficit deduction from your score.',
    };
  }
  // LOW
  if (!hasCheckins) {
    return {
      icon: '📊',
      action: 'Start logging weekly check-ins',
      detail: 'You\'re in the low-risk zone. Weekly check-ins will catch any drift before your next dose escalation.',
    };
  }
  return {
    icon: '📅',
    action: 'Reassess at your next dose escalation',
    detail: 'Dose escalations are the highest-risk period for lean-mass loss. Run a new assessment before each step-up.',
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function JourneyPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      fullName: true,
      assessments: {
        orderBy: { assessmentDate: 'asc' },
        include: { muscleScore: { select: { score: true, riskBand: true } } },
      },
      weeklyCheckins: { select: { id: true }, take: 1 },
    },
  });

  if (!user) redirect('/dashboard');

  const scored = user.assessments.filter(a => a.muscleScore?.score != null);

  if (scored.length === 0) {
    return (
      <main className="min-h-screen bg-slate-900 font-sans flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p className="text-3xl mb-4">📊</p>
          <h1 className="text-xl font-bold text-white mb-2">Your journey hasn&apos;t started yet</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Complete your first assessment to generate your MyoGuard Score and begin tracking your muscle-protection journey.
          </p>
          <Link href="/" className="bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors inline-block">
            Start Assessment →
          </Link>
        </div>
      </main>
    );
  }

  const first   = scored[0].muscleScore!;
  const latest  = scored[scored.length - 1].muscleScore!;
  const current = latest.score;
  const band    = (latest.riskBand as Band) ?? 'HIGH';
  const meta    = BAND_META[band];

  const delta: number | null = scored.length > 1 ? current - first.score : null;
  const hasCheckins = user.weeklyCheckins.length > 0;

  const nextStep = getNextStep(band, hasCheckins);
  const message  = getProgressMessage(delta, band, scored.length);

  // Points to next band
  const pointsToNext = meta.nextThreshold != null ? meta.nextThreshold - current : null;

  // Band progress within current band (0–100%)
  const bandWidth  = (meta.next ? (meta.nextThreshold! - meta.threshold) : 20);
  const bandProgress = Math.min(100, Math.max(0, ((current - meta.threshold) / bandWidth) * 100));

  const firstName = user.fullName?.split(' ')[0] ?? null;

  return (
    <main className="min-h-screen bg-slate-900 font-sans">

      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white tracking-tight">
            Myo<span className="text-teal-400">Guard</span>
          </Link>
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-5">

        {/* ── Page title ── */}
        <div>
          <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-1">
            Your MyoGuard Journey
          </p>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            {firstName ? `${firstName}'s Progress Story` : 'Your Progress Story'}
          </h1>
        </div>

        {/* ── Current score — hero card ── */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Current Score
          </p>

          <div className="flex items-end gap-4 flex-wrap mb-4">
            {/* Big score */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-6xl font-black text-white tabular-nums leading-none">{current}</span>
              <span className="text-2xl text-slate-500 font-normal">/ 100</span>
            </div>

            {/* Risk badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${meta.bg} ${meta.border} ${meta.colour}`}>
              <span className={`w-2 h-2 rounded-full ${
                band === 'LOW' ? 'bg-emerald-500' : band === 'MODERATE' ? 'bg-amber-500' : band === 'HIGH' ? 'bg-orange-500' : 'bg-red-500'
              }`} />
              {meta.label}
            </span>

            {/* Delta badge */}
            {delta !== null && (
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
                delta > 0  ? 'bg-emerald-900 text-emerald-400 border border-emerald-700' :
                delta < 0  ? 'bg-red-900 text-red-400 border border-red-700' :
                             'bg-slate-700 text-slate-400 border border-slate-600'
              }`}>
                {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}
                {' '}{Math.abs(delta)} pts from first assessment
              </span>
            )}
          </div>

          {/* Band progress bar */}
          <div className="mb-1">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1.5 font-medium">
              <span>{meta.label}</span>
              {meta.next && <span>Next: {BAND_META[meta.next].label}</span>}
            </div>
            <div className="h-2.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  band === 'LOW' ? 'bg-emerald-500' : band === 'MODERATE' ? 'bg-amber-500' : band === 'HIGH' ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${bandProgress}%` }}
              />
            </div>
          </div>

          {/* Points to next band */}
          {pointsToNext !== null && pointsToNext > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              <span className="text-white font-semibold">{pointsToNext} points</span> away from {BAND_META[meta.next!].label}
            </p>
          )}
          {pointsToNext !== null && pointsToNext <= 0 && meta.next && (
            <p className="text-xs text-emerald-400 font-semibold mt-2">
              ✓ You&apos;ve reached {BAND_META[meta.next].label} territory
            </p>
          )}
          {band === 'LOW' && (
            <p className="text-xs text-emerald-400 font-semibold mt-2">
              ✓ You are in the optimal Low Risk zone
            </p>
          )}
        </div>

        {/* ── Progress message ── */}
        <div className="bg-slate-800 rounded-2xl px-5 py-4 border border-slate-700">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">
              {delta !== null && delta > 0 ? '🚀' : delta !== null && delta < 0 ? '💪' : '🎯'}
            </span>
            <p className="text-sm text-slate-200 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* ── Most effective next step ── */}
        <div className="bg-teal-900 rounded-2xl px-5 py-4 border border-teal-700">
          <p className="text-xs font-semibold text-teal-300 uppercase tracking-widest mb-3">
            Your most effective next step
          </p>
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{nextStep.icon}</span>
            <div>
              <p className="text-sm font-bold text-white mb-1">{nextStep.action}</p>
              <p className="text-xs text-teal-300 leading-relaxed">{nextStep.detail}</p>
            </div>
          </div>
        </div>

        {/* ── Assessment history strip ── */}
        {scored.length > 1 && (
          <div className="bg-slate-800 rounded-2xl px-5 py-4 border border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Score history ({scored.length} assessments)
            </p>
            <div className="flex items-end gap-2 h-12">
              {scored.map((a, i) => {
                const s = a.muscleScore!.score;
                const isLatest = i === scored.length - 1;
                return (
                  <div key={a.id} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-sm transition-all ${
                        isLatest ? 'bg-teal-400' : 'bg-slate-600'
                      }`}
                      style={{ height: `${Math.max(8, (s / 100) * 40)}px` }}
                    />
                    <span className="text-[9px] text-slate-500 tabular-nums">{s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CTAs ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/checkin"
            className="bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm py-3 rounded-xl text-center transition-colors"
          >
            Log this week →
          </Link>
          <Link
            href="/"
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm py-3 rounded-xl text-center transition-colors"
          >
            New assessment
          </Link>
        </div>

      </div>
    </main>
  );
}
