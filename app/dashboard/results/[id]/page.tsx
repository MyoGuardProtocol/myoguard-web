import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import UserDropdown from '@/src/components/ui/UserDropdown';

// ─── Band config ───────────────────────────────────────────────────────────────
type Band = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

const BAND_META: Record<Band, {
  label:      string;
  colour:     string;
  dot:        string;
  ring:       string;
  bg:         string;
  border:     string;
  trackCls:   string;
}> = {
  CRITICAL: {
    label: 'Critical Risk',  colour: 'text-red-400',
    dot: 'bg-red-500',       ring: 'ring-red-500',
    bg: 'bg-red-950',        border: 'border-red-800',
    trackCls: 'bg-red-900/40',
  },
  HIGH: {
    label: 'High Risk',      colour: 'text-orange-400',
    dot: 'bg-orange-500',    ring: 'ring-orange-500',
    bg: 'bg-orange-950',     border: 'border-orange-800',
    trackCls: 'bg-orange-900/40',
  },
  MODERATE: {
    label: 'Moderate Risk',  colour: 'text-amber-400',
    dot: 'bg-amber-500',     ring: 'ring-amber-500',
    bg: 'bg-amber-950',      border: 'border-amber-800',
    trackCls: 'bg-amber-900/40',
  },
  LOW: {
    label: 'Low Risk',       colour: 'text-emerald-400',
    dot: 'bg-emerald-500',   ring: 'ring-emerald-500',
    bg: 'bg-emerald-950',    border: 'border-emerald-800',
    trackCls: 'bg-emerald-900/40',
  },
};

const LEAN_LOSS_MSG: Record<Band, string> = {
  LOW:      'Minimal lean mass risk at your current inputs. Maintaining this level of protein and activity keeps you well-protected.',
  MODERATE: 'Moderate lean mass risk. Improving protein adherence and adding resistance training sessions are the two fastest ways to shift this.',
  HIGH:     'Elevated lean mass risk. GLP-1 drugs accelerate muscle catabolism — your protocol targets are set to counteract this directly.',
  CRITICAL: 'High lean mass risk. Immediate protocol adherence is essential. Every gram of protein and every resistance session counts at this stage.',
};

function longDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, fullName: true },
  });
  if (!user) redirect('/dashboard');

  // Fetch the specific assessment — scoped to this user to prevent ID enumeration
  const assessment = await prisma.assessment.findFirst({
    where:   { id, userId: user.id },
    include: {
      muscleScore: {
        select: {
          score:          true,
          riskBand:       true,
          leanLossEstPct: true,
          proteinTargetG: true,
          explanation:    true,
        },
      },
    },
  });

  if (!assessment || !assessment.muscleScore) notFound();

  const ms          = assessment.muscleScore;
  const score       = Math.round(ms.score);
  const band        = ms.riskBand as Band;
  const meta        = BAND_META[band];
  const pointsToLow = score < 80 ? 80 - score : null;
  const firstName   = user.fullName?.split(' ')[0] ?? null;

  return (
    <main className="min-h-screen bg-slate-900 font-sans">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-white tracking-tight">
            Myo<span className="text-teal-400">Guard</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs text-slate-400 hover:text-white transition-colors font-medium"
            >
              ← Dashboard
            </Link>
            {/* Client component — handles its own auth guard (returns null when signed out) */}
            <UserDropdown />
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 pt-7 pb-16 space-y-4">

        {/* ── Title ── */}
        <div>
          <p className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.2em] mb-1">
            Assessment Results
          </p>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            {firstName ? `${firstName}'s Score` : 'Your Score'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {longDate(assessment.assessmentDate)}
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── SCORE HERO ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700">

          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                MyoGuard Score
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-7xl font-black text-white tabular-nums leading-none">
                  {score}
                </span>
                <span className="text-2xl text-slate-600 font-light leading-none">/100</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 mt-1 flex-shrink-0">
              <span className={`myg-badge-in inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.border} ${meta.colour}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                {ms.leanLossEstPct}% lean loss risk
              </span>
            </div>
          </div>

          {/* Score track — same animation classes as journey page */}
          <div className="mb-5">
            <div className="relative mb-1">
              <div className="myg-track-reveal h-4 rounded-full overflow-hidden flex gap-px">
                <div className="h-full bg-red-900/60"     style={{ width: '40%' }} />
                <div className="h-full bg-orange-900/60"  style={{ width: '20%' }} />
                <div className="h-full bg-amber-900/60"   style={{ width: '20%' }} />
                <div className="h-full bg-emerald-900/60" style={{ width: '20%' }} />
              </div>
              {band !== 'LOW' && (
                <div className="absolute top-0 h-full w-0.5 bg-emerald-500/40" style={{ left: '80%' }} />
              )}
              <div
                className={`myg-thumb-pop absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-xl ring-2 ${meta.ring}`}
                style={{ left: `${Math.min(97, Math.max(3, score))}%` }}
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

          {/* Distance to Low Risk / already there */}
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
        {/* ── PROTEIN TARGET ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-slate-700/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">
                  Daily Protein Target
                </p>
                <p className="text-xs text-slate-500 leading-snug">
                  Activity-adjusted · {assessment.weightKg}kg body weight
                </p>
              </div>
              <span className="text-xl">🥩</span>
            </div>
          </div>
          <div className="px-5 py-5">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-black text-white tabular-nums leading-none">
                {Math.round(ms.proteinTargetG)}
              </span>
              <span className="text-xl text-slate-500 font-light">g/day</span>
            </div>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden mb-3">
              <div
                className="myg-bar-grow h-full rounded-full bg-teal-500"
                style={{ width: `${Math.min(100, (ms.proteinTargetG / 250) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This is your aggressive target — the upper bound that maximises lean-mass
              preservation. Reaching even 80–90% of this figure meaningfully reduces
              muscle-loss risk at your current GLP-1 dose.
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── LEAN MASS RISK ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className={`rounded-2xl border px-5 py-5 ${meta.bg} ${meta.border}`}>
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${meta.trackCls} border ${meta.border}`}>
              💪
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold mb-1.5 ${meta.colour}`}>
                {ms.leanLossEstPct}% estimated lean mass loss risk
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {LEAN_LOSS_MSG[band]}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── CLINICAL EXPLANATION ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-slate-700/70">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
              Clinical Summary
            </p>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {ms.explanation}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── ASSESSMENT INPUTS ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-slate-700/70">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
              Assessment Inputs
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-700/40">
            {[
              { label: 'Body weight',    value: `${assessment.weightKg} kg`             },
              { label: 'Protein intake', value: `${Math.round(assessment.proteinGrams)} g/day` },
              { label: 'Training days',  value: `${assessment.exerciseDaysWk} days/wk`  },
              { label: 'Hydration',      value: `${assessment.hydrationLitres} L/day`   },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800 px-4 py-3">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-white tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          {assessment.symptoms.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-700/40">
              <p className="text-[10px] font-medium text-slate-500 mb-2">Reported symptoms</p>
              <div className="flex flex-wrap gap-2">
                {assessment.symptoms.map(s => (
                  <span key={s} className="text-xs bg-slate-700/70 text-slate-300 border border-slate-600/50 rounded-full px-2.5 py-1">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── CTAs ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-3 pt-1">
          <Link
            href="/dashboard/journey"
            className="flex items-center justify-between bg-teal-600 hover:bg-teal-500 text-white rounded-2xl px-5 py-4 transition-colors"
          >
            <div>
              <p className="text-sm font-bold leading-snug">View your MyoGuard Journey</p>
              <p className="text-xs text-teal-200 mt-0.5">Score trajectory, streak, and next steps</p>
            </div>
            <span className="text-lg flex-shrink-0 ml-3">→</span>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/checkin"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-sm py-3.5 rounded-2xl text-center transition-colors"
            >
              Log this week →
            </Link>
            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-sm py-3.5 rounded-2xl text-center transition-colors"
            >
              New assessment
            </Link>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-600 pt-1 leading-relaxed">
          MyoGuard Protocol provides clinical decision support and educational guidance.
          It does not replace the advice of your treating physician. Share these results
          with your doctor at your next consultation.
        </p>

      </div>
    </main>
  );
}
