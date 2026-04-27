import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import DashboardHeader from '@/src/components/ui/DashboardHeader';
import ScoreGauge from '@/src/components/ui/ScoreGauge';
import ClinicalAlert from '@/src/components/ui/ClinicalAlert';
import RecoverySignalCard from '@/src/components/ui/RecoverySignalCard';
import SupplementCTA from '@/src/components/ui/SupplementCTA';

// ─── Band config ───────────────────────────────────────────────────────────────
type Band = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

const BAND_META: Record<Band, {
  label:    string;
  colour:   string;
  dot:      string;
  ring:     string;
  bg:       string;
  border:   string;
  trackCls: string;
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

// Band-level lean mass risk messages
const LEAN_LOSS_MSG: Record<Band, string> = {
  LOW:      'Minimal lean mass risk at your current inputs. Maintaining this level of protein and activity keeps you well-protected.',
  MODERATE: 'Moderate lean mass risk. Improving protein adherence and adding resistance training sessions are the two fastest ways to shift this.',
  HIGH:     'Elevated lean mass risk. GLP-1 drugs accelerate muscle catabolism — your protocol targets are set to counteract this directly.',
  CRITICAL: 'High lean mass risk. Immediate protocol adherence is essential. Every gram of protein and every resistance session counts at this stage.',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function longDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Signed delta helper — returns "+12", "−5", or "±0"
function signedDelta(current: number, previous: number): string {
  const d = Math.round(current - previous);
  if (d > 0) return `+${d}`;
  if (d < 0) return `−${Math.abs(d)}`;
  return '±0';
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
    where:  { clerkId },
    select: { id: true, fullName: true },
  });
  if (!user) redirect('/dashboard');

  // ── Fetch current assessment (scoped to user to prevent ID enumeration) ────
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

  if (!assessment || !assessment.muscleScore) notFound();

  // ── Fetch the immediately-preceding assessment for delta comparison ─────────
  const previousAssessment = await prisma.assessment.findFirst({
    where: {
      userId:         user.id,
      assessmentDate: { lt: assessment.assessmentDate },
    },
    orderBy: { assessmentDate: 'desc' },
    include: {
      muscleScore: {
        select: {
          score:          true,
          riskBand:       true,
          leanLossEstPct: true,
          proteinTargetG: true,
        },
      },
    },
  });

  const ms          = assessment.muscleScore;
  const plan        = assessment.protocolPlan ?? null;
  const prev        = previousAssessment?.muscleScore ?? null;

  const score       = Math.round(ms.score);
  const band        = ms.riskBand as Band;
  const meta        = BAND_META[band];
  const pointsToLow = score < 80 ? 80 - score : null;
  const HONORIFICS  = ['Dr', 'Dr.', 'Prof', 'Prof.', 'Mr', 'Mrs', 'Ms', 'Miss'];
  const nameParts   = (user.fullName ?? '').split(' ').filter(Boolean);
  const firstName   = nameParts.find(p => !HONORIFICS.includes(p)) ?? nameParts[0] ?? null;

  // Delta values — only rendered when a previous assessment exists
  const scoreDelta      = prev ? signedDelta(ms.score,          prev.score)          : null;
  const proteinDelta    = prev ? signedDelta(ms.proteinTargetG, prev.proteinTargetG) : null;
  const leanLossDelta   = prev ? signedDelta(ms.leanLossEstPct, prev.leanLossEstPct) : null;
  const prevBand        = prev ? (prev.riskBand as Band)                              : null;
  const bandImproved    = prev ? (score > Math.round(prev.score))                     : null;

  const lowProtein    = assessment.proteinGrams && ms.proteinTargetG
    ? assessment.proteinGrams < ms.proteinTargetG * 0.85
    : false;
  const hasGISymptoms = assessment.symptoms.some((s: string) =>
    ['nausea', 'vomiting', 'constipation', 'gastroparesis', 'bloating', 'reduced appetite']
      .includes(s.toLowerCase())
  );
  const lowRecovery   = assessment.sleepHours != null
    ? assessment.sleepHours < 6.5
    : false;

  return (
    <main className="min-h-screen font-sans" style={{ background: '#080C14' }}>

      {/* ── Sticky header ── */}
      <DashboardHeader />

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-8 pb-16 space-y-8">

        {/* ── Title ── */}
        <div>
          <p className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.2em] mb-1">
            MyoGuard Protocol
          </p>
          <h1
            className="text-2xl font-extrabold text-white leading-tight"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Clinical Decision Support Report
          </h1>
          {firstName && (
            <p className="text-xs text-slate-400 mt-1">Generated for: {firstName}</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date(assessment.assessmentDate).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── SCORE HERO ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl p-8" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>

          {/* Label + band badge */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              MyoGuard Score
            </p>
            <span className={`myg-badge-in inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.border} ${meta.colour}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>

          {/* Radial gauge */}
          <div className="max-w-[220px] mx-auto mb-5">
            <ScoreGauge score={score} band={band} leanLossPct={ms.leanLossEstPct} />
          </div>

          {/* Distance to Low Risk / already there */}
          {pointsToLow !== null ? (
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(26,39,68,0.5)' }}>
              <p className="text-sm text-slate-200 leading-snug">
                <span className="font-mono font-bold text-white tabular-nums">{pointsToLow}</span>
                {' '}
                <span className="font-light">{pointsToLow === 1 ? 'point' : 'points'}</span>
                {' from the '}
                <span className="text-emerald-400 font-semibold">Low Risk zone</span>
              </p>
            </div>
          ) : (
            <div className="bg-emerald-950 border border-emerald-800 rounded-xl px-4 py-3">
              <p className="text-sm text-emerald-300 font-semibold leading-snug">
                In the optimal Low Risk zone
              </p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── PREVIOUS vs CURRENT COMPARISON ── only when a prior result exists */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {prev && previousAssessment && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>
            <div
              className="px-5 pt-4 pb-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(26,39,68,0.7)' }}
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                Since Last Assessment
              </p>
              <span className="text-[10px] text-slate-500">
                {new Date(previousAssessment.assessmentDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-px" style={{ background: 'rgba(26,39,68,0.3)' }}>

              {/* Score delta */}
              <div className="px-4 py-4 flex flex-col gap-1" style={{ background: '#0D1421' }}>
                <p className="text-[10px] font-medium text-slate-500">Score</p>
                <p className="font-mono text-lg font-black text-white tabular-nums leading-none">
                  {score}
                  <span className="font-sans text-slate-600 font-light text-sm"> /100</span>
                </p>
                <span className={`font-mono text-xs font-bold tabular-nums ${
                  scoreDelta && !scoreDelta.startsWith('−')
                    ? 'text-emerald-400'
                    : scoreDelta === '±0'
                    ? 'text-slate-500'
                    : 'text-red-400'
                }`}>
                  {scoreDelta} pts
                </span>
              </div>

              {/* Protein delta */}
              <div className="px-4 py-4 flex flex-col gap-1" style={{ background: '#0D1421' }}>
                <p className="text-[10px] font-medium text-slate-500">Protein Target</p>
                <p className="font-mono text-lg font-black text-white tabular-nums leading-none">
                  {Math.round(ms.proteinTargetG)}
                  <span className="font-sans text-slate-600 font-light text-sm">g</span>
                </p>
                <span className={`font-mono text-xs font-bold tabular-nums ${
                  proteinDelta && !proteinDelta.startsWith('−')
                    ? 'text-teal-400'
                    : proteinDelta === '±0'
                    ? 'text-slate-500'
                    : 'text-slate-400'
                }`}>
                  {proteinDelta}g / day
                </span>
              </div>

              {/* Lean loss delta */}
              <div className="px-4 py-4 flex flex-col gap-1" style={{ background: '#0D1421' }}>
                <p className="text-[10px] font-medium text-slate-500">Lean Risk</p>
                <p className="font-mono text-lg font-black text-white tabular-nums leading-none">
                  {ms.leanLossEstPct}
                  <span className="font-sans text-slate-600 font-light text-sm">%</span>
                </p>
                {/* For lean loss, a DECREASE is good (green) */}
                <span className={`font-mono text-xs font-bold tabular-nums ${
                  leanLossDelta && leanLossDelta.startsWith('−')
                    ? 'text-emerald-400'
                    : leanLossDelta === '±0'
                    ? 'text-slate-500'
                    : 'text-red-400'
                }`}>
                  {leanLossDelta}%
                </span>
              </div>
            </div>

            {/* Band change row */}
            {prevBand && prevBand !== band && (
              <div
                className={`px-5 py-3 flex items-center gap-2 ${
                  bandImproved ? 'bg-emerald-950/50' : 'bg-red-950/50'
                }`}
                style={{ borderTop: '1px solid rgba(26,39,68,0.4)' }}
              >
                <span className="text-sm">{bandImproved ? '✅' : '⚠️'}</span>
                <p className="text-xs text-slate-300 leading-snug">
                  Risk band changed:{' '}
                  <span className={`font-semibold ${BAND_META[prevBand].colour}`}>
                    {BAND_META[prevBand].label}
                  </span>
                  {' → '}
                  <span className={`font-semibold ${meta.colour}`}>
                    {meta.label}
                  </span>
                </p>
              </div>
            )}

            {/* No band change — neutral acknowledgement */}
            {prevBand && prevBand === band && (
              <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(26,39,68,0.4)' }}>
                <p className="text-[11px] text-slate-500">
                  Risk band unchanged — {BAND_META[band].label}. Keep tracking weekly to move the needle.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── PROTEIN TARGET ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-3xl overflow-hidden" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(26,39,68,0.7)' }}>
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
              <span className="font-mono text-5xl font-black text-white tabular-nums leading-none">
                {Math.round(ms.proteinTargetG)}
              </span>
              <span className="text-xl text-slate-500 font-light">g/day</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: '#1A2744' }}>
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
        {/* ── SUPPLEMENT STACK — placed after protein target per clinical flow ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <SupplementCTA
          dark
          lowProtein={lowProtein}
          hasGISymptoms={hasGISymptoms}
          lowRecovery={lowRecovery}
        />

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── LEAN MASS RISK ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <ClinicalAlert
          band={band}
          leanLossPct={ms.leanLossEstPct}
          message={LEAN_LOSS_MSG[band]}
        />

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── CLINICAL EXPLANATION ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(26,39,68,0.7)' }}>
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
        {/* ── RECOVERY SIGNAL ── only renders when sleep data was collected ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <RecoverySignalCard
          sleepHours={assessment.sleepHours}
          sleepQuality={assessment.sleepQuality}
          recoveryStatus={assessment.recoveryStatus}
        />

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── PROTOCOL PLAN ── persisted from DB; null-safe fallback ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {plan && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>
            <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(26,39,68,0.7)' }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                Your Protocol Plan
              </p>
            </div>

            {/* ── Supplementation ── */}
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(26,39,68,0.4)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">💊</span>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Supplementation
                </p>
              </div>
              <ul className="space-y-2">
                {plan.supplementation.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-teal-500" />
                    <p className="text-xs text-slate-300 leading-relaxed">{item}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Training plan ── */}
            <div className="px-5 pt-4 pb-4" style={{ borderBottom: '1px solid rgba(26,39,68,0.4)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🏋️</span>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Training Plan
                </p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{plan.trainingPlan}</p>
            </div>

            {/* ── Protein sources ── */}
            <div className="px-5 pt-4 pb-4" style={{ borderBottom: '1px solid rgba(26,39,68,0.4)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🥩</span>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Top Protein Sources
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {plan.proteinSources.map((src, i) => (
                  <span
                    key={i}
                    className="text-[11px] text-slate-300 rounded-lg px-2.5 py-1.5 leading-tight"
                    style={{ background: 'rgba(26,39,68,0.6)', border: '1px solid rgba(26,39,68,0.5)' }}
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Hydration + Electrolytes ── */}
            <div className="px-5 pt-4 pb-4" style={{ borderBottom: '1px solid rgba(26,39,68,0.4)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">💧</span>
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                    Hydration & Electrolytes
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-teal-400 tabular-nums">
                  {plan.hydrationTarget}L / day
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{plan.electrolyteNotes}</p>
            </div>

            {/* ── GI guidance ── */}
            <div className="px-5 pt-4 pb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🫁</span>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  GI Guidance
                </p>
              </div>
              {plan.giGuidance.includes(' | ')
                ? (
                    <ul className="space-y-2.5">
                      {plan.giGuidance.split(' | ').map((segment, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <p className="text-xs text-slate-400 leading-relaxed">{segment}</p>
                        </li>
                      ))}
                    </ul>
                  )
                : (
                    <p className="text-xs text-slate-400 leading-relaxed">{plan.giGuidance}</p>
                  )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── ASSESSMENT INPUTS ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0D1421', border: '1px solid #1A2744' }}>
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(26,39,68,0.7)' }}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
              Assessment Inputs
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px" style={{ background: 'rgba(26,39,68,0.4)' }}>
            {[
              { label: 'Body weight',    value: `${assessment.weightKg} kg`                    },
              { label: 'Protein intake', value: `${Math.round(assessment.proteinGrams)} g/day` },
              { label: 'Training days',  value: `${assessment.exerciseDaysWk} days/wk`         },
              { label: 'Hydration',      value: `${assessment.hydrationLitres} L/day`          },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3" style={{ background: '#0D1421' }}>
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">{label}</p>
                <p className="font-mono text-sm font-semibold text-white tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          {assessment.symptoms.length > 0 && (
            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(26,39,68,0.4)' }}>
              <p className="text-[10px] font-medium text-slate-500 mb-2">Reported symptoms</p>
              <div className="flex flex-wrap gap-2">
                {assessment.symptoms.map(s => (
                  <span
                    key={s}
                    className="text-xs text-slate-300 rounded-full px-2.5 py-1"
                    style={{ background: 'rgba(26,39,68,0.7)', border: '1px solid rgba(26,39,68,0.5)' }}
                  >
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
              className="border text-white font-semibold text-sm py-3.5 rounded-2xl text-center transition-colors"
              style={{ background: '#0D1421', borderColor: '#1A2744' }}
            >
              Log this week →
            </Link>
            <Link
              href="/dashboard/assessment"
              className="border text-white font-semibold text-sm py-3.5 rounded-2xl text-center transition-colors"
              style={{ background: '#0D1421', borderColor: '#1A2744' }}
            >
              New assessment
            </Link>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── BOTTOM CTAs ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-3 pt-2">
          <Link
            href="/dashboard/assessment"
            className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-3.5 rounded-xl text-center transition-colors"
          >
            New Assessment →
          </Link>
          <Link
            href="/dashboard"
            className="block w-full text-center text-sm text-slate-400 hover:text-white font-medium py-2 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <p className="text-center text-[10px] text-slate-600 pt-1 leading-relaxed">
          MyoGuard Protocol · Clinical Decision Support System<br />
          © 2026 Meridian Wellness Systems LLC
        </p>

      </div>
    </main>
  );
}
