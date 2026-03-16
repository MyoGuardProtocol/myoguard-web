/**
 * /report/[token] — Public physician-facing report page.
 *
 * No authentication required. The share token in the URL grants read-only
 * access to the patient's latest assessment report. Identical layout to
 * /dashboard/report but without action buttons and with an attribution banner.
 *
 * Clinical parity sections (read-only, no editing controls):
 *   • Escalation Alert         — conditional on buildEscalationSignal()
 *   • Clinical Interpretation  — from buildInterpretation()
 *   • Suggested Physician Actions — from buildSuggestedActions()
 *   • Physician Review         — static display of saved PhysicianReview record
 */

import { notFound }             from 'next/navigation';
import Link                     from 'next/link';
import { prisma }               from '@/src/lib/prisma';
import { generateWeeklyDigest } from '@/src/lib/weeklyDigest';
import {
  BAND_LIGHT,
  buildInterpretation,
  buildSuggestedActions,
  buildEscalationSignal,
  type Band,
}                               from '@/src/lib/reportClinical';

// ─── Display helpers ──────────────────────────────────────────────────────────

const TREND_LABEL: Record<string, { text: string; colour: string; icon: string }> = {
  improving:    { text: 'Improving',         colour: 'text-emerald-700', icon: '↑' },
  stable:       { text: 'Stable',            colour: 'text-slate-600',   icon: '→' },
  declining:    { text: 'Declining',          colour: 'text-red-700',    icon: '↓' },
  insufficient: { text: 'Insufficient data', colour: 'text-slate-500',   icon: '–' },
};

const MED_LABEL: Record<string, string> = {
  semaglutide: 'Semaglutide (Ozempic / Wegovy)',
  tirzepatide: 'Tirzepatide (Zepbound / Mounjaro)',
};

const STAGE_LABEL: Record<string, string> = {
  INITIATION:      'Initiation',
  DOSE_ESCALATION: 'Dose escalation',
  MAINTENANCE:     'Maintenance',
  DISCONTINUING:   'Discontinuing',
};

const IMPRESSION_LABEL: Record<string, string> = {
  stable:       'Stable — continue current protocol',
  monitoring:   'Monitoring — watch and reassess',
  intervention: 'Intervention required',
};

function longDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Resolve share token → userId
  const card = await prisma.shareCard.findUnique({
    where:  { shareToken: token },
    select: { userId: true, createdAt: true },
  });

  if (!card) notFound();

  // Fetch the patient's data using their internal userId
  const user = await prisma.user.findUnique({
    where:  { id: card.userId },
    select: {
      id:       true,
      fullName: true,
      profile:  {
        select: {
          age:            true,
          sex:            true,
          glp1Medication: true,
          glp1DoseMg:     true,
          glp1Stage:      true,
        },
      },
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take:    5,
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
      },
      weeklyCheckins: {
        orderBy: { weekStart: 'desc' },
        take:    4,
        select: {
          weekStart:          true,
          avgProteinG:        true,
          totalWorkouts:      true,
          avgHydration:       true,
          proteinAdherence:   true,
          exerciseAdherence:  true,
        },
      },
    },
  });

  if (!user || !user.assessments[0]?.muscleScore) notFound();

  const latestAssessment = user.assessments[0];
  const ms               = latestAssessment.muscleScore!;
  const score            = Math.round(ms.score);
  const band             = ms.riskBand as Band;
  const meta             = BAND_LIGHT[band];
  const pointsToLow      = score < 80 ? 80 - score : null;

  const digest    = await generateWeeklyDigest(user.id);
  const trendCfg  = TREND_LABEL[digest?.trendStatus ?? 'insufficient'];
  const historyAsc = [...user.assessments].reverse();
  const generatedAt = new Date();

  // ── Clinical intelligence — same signals as /dashboard/report ────────────────
  const sharedSignals = {
    band,
    proteinTargetG:  ms.proteinTargetG,
    proteinIntakeG:  latestAssessment.proteinGrams,
    exerciseDaysWk:  latestAssessment.exerciseDaysWk,
    hydrationLitres: latestAssessment.hydrationLitres,
    fatigue:         latestAssessment.fatigue,
    nausea:          latestAssessment.nausea,
    muscleWeakness:  latestAssessment.muscleWeakness,
    trendStatus:     digest?.trendStatus ?? 'insufficient',
    checkins:        user.weeklyCheckins,
    glp1Stage:       user.profile?.glp1Stage ?? null,
  };

  const interp  = buildInterpretation({ leanLossEstPct: ms.leanLossEstPct, ...sharedSignals });
  const actions = buildSuggestedActions(sharedSignals);

  const signal = buildEscalationSignal({
    riskBand:        band,
    symptomAvg:      (latestAssessment.fatigue + latestAssessment.nausea + latestAssessment.muscleWeakness) / 3,
    proteinDeficit:  ms.proteinTargetG - latestAssessment.proteinGrams,
    exerciseDaysWk:  latestAssessment.exerciseDaysWk,
    hydrationLitres: latestAssessment.hydrationLitres,
    leanLossEstPct:  ms.leanLossEstPct,
    trendStatus:     digest?.trendStatus ?? 'insufficient',
  });

  // ── Saved physician review (read-only on public page) ────────────────────────
  const savedReview = await prisma.physicianReview.findUnique({
    where:  { assessmentId: latestAssessment.id },
    select: {
      overallImpression: true,
      followUpDays:      true,
      note:              true,
      reviewedAt:        true,
    },
  });

  return (
    <main className="min-h-screen bg-slate-100 font-sans">

      {/* ── Attribution banner (screen only) ── */}
      <div className="print:hidden bg-teal-700 text-white px-5 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <p className="text-xs leading-snug">
            <span className="font-semibold">MyoGuard Physician Report</span>
            {' '}— shared by {user.fullName} on {shortDate(card.createdAt)}.
            This link always reflects their most recent assessment data.
          </p>
          <Link
            href="/"
            className="flex-shrink-0 text-xs font-semibold text-teal-200 hover:text-white transition-colors underline"
          >
            myoguard.health
          </Link>
        </div>
      </div>

      {/* ── REPORT DOCUMENT ── */}
      <article className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none mb-10 print:mb-0">
        <div className="px-8 py-8 print:px-0 print:py-6 space-y-7">

          {/* Document header */}
          <div className="flex items-start justify-between border-b-2 border-teal-600 pb-5">
            <div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                Myo<span className="text-teal-600">Guard</span>
                <span className="text-slate-400 font-light ml-1 text-base">Protocol</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">Physician Report</p>
              <p className="text-xs text-slate-500 mt-0.5">Generated: {longDate(generatedAt)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">REF: {latestAssessment.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          {/* Patient info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 rounded-xl px-5 py-4 border border-slate-200">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Patient</p>
              <p className="text-sm font-bold text-slate-900">{user.fullName}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Assessment Date</p>
              <p className="text-sm font-semibold text-slate-800">{shortDate(latestAssessment.assessmentDate)}</p>
            </div>
            {user.profile?.age && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Age</p>
                <p className="text-sm font-semibold text-slate-800">{user.profile.age} years</p>
              </div>
            )}
          </div>

          {/* Score summary */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              MyoGuard Muscle Protection Score
            </h2>
            <div className={`rounded-xl border ${meta.border} ${meta.bg} px-5 py-5`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-6xl font-black text-slate-900 tabular-nums leading-none">{score}</span>
                    <span className="text-xl text-slate-400 font-light">/100</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Composite muscle-loss risk score — higher is better</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.border} ${meta.colour}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    {ms.leanLossEstPct}% estimated lean mass loss risk
                  </span>
                </div>
              </div>
              <div className="h-3 rounded-full bg-white/70 overflow-hidden flex gap-px mb-3 border border-slate-200">
                <div className="h-full bg-red-200"     style={{ width: '40%' }} />
                <div className="h-full bg-orange-200"  style={{ width: '20%' }} />
                <div className="h-full bg-amber-200"   style={{ width: '20%' }} />
                <div className="h-full bg-emerald-200" style={{ width: '20%' }} />
              </div>
              <div className="relative h-1 mb-4">
                <div
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${meta.barCls}`}
                  style={{ left: `${Math.min(97, Math.max(3, score))}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/70 rounded-lg px-3 py-2.5 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Distance to Low Risk</p>
                  <p className="text-sm font-bold text-slate-900">
                    {pointsToLow !== null ? `${pointsToLow} points` : '✓ In optimal zone'}
                  </p>
                </div>
                <div className="bg-white/70 rounded-lg px-3 py-2.5 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Daily Protein Target</p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">{Math.round(ms.proteinTargetG)} g/day</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Escalation Alert (conditional) ── */}
          {signal.escalate && (
            <section aria-live="assertive">
              <div className={`rounded-xl border-2 px-5 py-4 space-y-2.5 ${
                signal.urgency === 'urgent'
                  ? 'border-red-400 bg-red-50'
                  : 'border-amber-400 bg-amber-50'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      signal.urgency === 'urgent' ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      <svg
                        className={`w-4 h-4 ${signal.urgency === 'urgent' ? 'text-red-700' : 'text-amber-700'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        />
                      </svg>
                    </span>
                    <p className={`text-sm font-black tracking-tight ${
                      signal.urgency === 'urgent' ? 'text-red-900' : 'text-amber-900'
                    }`}>
                      Physician Escalation Alert
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded border ${
                    signal.urgency === 'urgent'
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-amber-100 text-amber-700 border-amber-300'
                  }`}>
                    {signal.urgency === 'urgent' ? 'Urgent' : 'Monitor'}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${
                  signal.urgency === 'urgent' ? 'text-red-800' : 'text-amber-800'
                }`}>
                  {signal.reason}
                </p>
                <p className={`text-[11px] font-semibold ${
                  signal.urgency === 'urgent' ? 'text-red-700' : 'text-amber-700'
                }`}>
                  Consider reassessment or intervention.
                </p>
              </div>
            </section>
          )}

          {/* ── Clinical Interpretation ── */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Clinical Interpretation
            </h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">

              {/* Row 1: Risk Category + 30-day projection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-100">
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">
                    Risk Category
                  </p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border mb-2 ${meta.bg} ${meta.border} ${meta.colour}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {interp.riskCategory.label}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                    {interp.riskCategory.detail}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">
                    30-Day Lean Mass Projection
                  </p>
                  <p className={`text-2xl font-black tabular-nums leading-tight mb-1 ${meta.colour}`}>
                    {ms.leanLossEstPct}%
                    <span className="text-sm font-normal text-slate-500 ml-1">lean loss risk</span>
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {interp.leanMassProjection.split('. ').slice(1).join('. ')}
                  </p>
                </div>
              </div>

              {/* Row 2: Key Risk Drivers + Protocol Adherence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-100">
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Key Risk Drivers
                  </p>
                  <ul className="space-y-2">
                    {interp.keyDrivers.map((driver, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                          driver.severity === 'concern'
                            ? 'bg-red-100 text-red-700'
                            : driver.severity === 'caution'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {driver.severity === 'concern' ? '!' : driver.severity === 'caution' ? '~' : '✓'}
                        </span>
                        <span className={`text-[11px] leading-snug ${
                          driver.severity === 'concern'
                            ? 'text-red-800'
                            : driver.severity === 'caution'
                            ? 'text-amber-800'
                            : 'text-slate-500'
                        }`}>
                          {driver.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Protocol Adherence Signal
                  </p>
                  {interp.adherenceSignal.lines.length > 0 ? (
                    <ul className="space-y-2">
                      {interp.adherenceSignal.lines.map((line, i) => {
                        const isHigh = line.includes('High') || line.includes('Consistent') || line.includes('Strong');
                        const isLow  = line.includes('Low') || line.includes('Poor');
                        return (
                          <li key={i} className={`text-[11px] leading-snug ${
                            isHigh ? 'text-emerald-700' : isLow ? 'text-red-700' : 'text-slate-700'
                          }`}>
                            {line}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic leading-relaxed">
                      {interp.adherenceSignal.summary}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </section>

          {/* ── Suggested Physician Actions ── */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Suggested Physician Actions
            </h2>
            <ol className="space-y-2.5">
              {actions.map((action, i) => {
                const urgencyTokens = {
                  urgent: {
                    cardBorder:  'border-red-200',
                    cardBg:      'bg-red-50/60',
                    numBg:       'bg-red-100 text-red-700',
                    badgeBg:     'bg-red-100 text-red-700 border-red-200',
                    timeBg:      'bg-red-100/70 text-red-600',
                    label:       'Urgent',
                  },
                  recommended: {
                    cardBorder:  'border-amber-200',
                    cardBg:      'bg-amber-50/40',
                    numBg:       'bg-amber-100 text-amber-700',
                    badgeBg:     'bg-amber-100 text-amber-700 border-amber-200',
                    timeBg:      'bg-amber-100/70 text-amber-600',
                    label:       'Recommended',
                  },
                  maintenance: {
                    cardBorder:  'border-emerald-200',
                    cardBg:      'bg-emerald-50/40',
                    numBg:       'bg-emerald-100 text-emerald-700',
                    badgeBg:     'bg-emerald-100 text-emerald-700 border-emerald-200',
                    timeBg:      'bg-emerald-100/70 text-emerald-600',
                    label:       'Maintenance',
                  },
                }[action.urgency];

                return (
                  <li
                    key={i}
                    className={`rounded-xl border px-4 py-3.5 flex items-start gap-3.5 ${urgencyTokens.cardBorder} ${urgencyTokens.cardBg}`}
                  >
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black mt-0.5 ${urgencyTokens.numBg}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${urgencyTokens.badgeBg}`}>
                          {action.urgency === 'urgent' && (
                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 2v3m0 2.5v.5" />
                            </svg>
                          )}
                          {action.urgency === 'recommended' && (
                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 1a4 4 0 100 8A4 4 0 005 1zm0 2v2.5l1.5 1" />
                            </svg>
                          )}
                          {action.urgency === 'maintenance' && (
                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2 5l2.5 2.5 3.5-3.5" />
                            </svg>
                          )}
                          {urgencyTokens.label}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgencyTokens.timeBg}`}>
                          {action.timeframe}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {action.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ── Physician Review (read-only static display) ── */}
          {savedReview && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Physician Review
              </h2>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">

                {/* Header row — reviewed date + author note */}
                <div className="px-5 py-3 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[11px] font-semibold text-teal-700">
                      Review recorded {shortDate(savedReview.reviewedAt)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {savedReview.reviewedAt.toISOString().slice(0, 10)}
                  </span>
                </div>

                {/* Overall impression */}
                {savedReview.overallImpression && (
                  <div className="px-5 py-3.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Overall Impression
                    </p>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                      savedReview.overallImpression === 'stable'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : savedReview.overallImpression === 'monitoring'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        savedReview.overallImpression === 'stable'
                          ? 'bg-emerald-500'
                          : savedReview.overallImpression === 'monitoring'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`} />
                      {IMPRESSION_LABEL[savedReview.overallImpression] ?? savedReview.overallImpression}
                    </span>
                  </div>
                )}

                {/* Follow-up timing */}
                {savedReview.followUpDays != null && (
                  <div className="px-5 py-3.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Recommended Follow-up
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      Within {savedReview.followUpDays} days
                    </p>
                  </div>
                )}

                {/* Physician note */}
                {savedReview.note && (
                  <div className="px-5 py-3.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Physician Note
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {savedReview.note}
                    </p>
                  </div>
                )}

              </div>
            </section>
          )}

          {/* Trajectory */}
          {digest && (digest.projectedScore !== null || digest.streakWeeks > 0) && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Trend & Consistency
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">30-Day Projection</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-tight">
                    {digest.projectedScore !== null ? Math.round(digest.projectedScore) : '—'}
                    {digest.projectedScore !== null && <span className="text-sm text-slate-400 font-light ml-0.5">/100</span>}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Score Trend</p>
                  <p className={`text-base font-bold ${trendCfg.colour} flex items-center gap-1`}>
                    <span>{trendCfg.icon}</span>{trendCfg.text}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Check-in Streak</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-tight">
                    {digest.streakWeeks}<span className="text-sm text-slate-400 font-light ml-1">wks</span>
                  </p>
                  <p className="text-[10px] text-slate-400">Best: {digest.bestStreak} wks</p>
                </div>
              </div>
            </section>
          )}

          {/* Score history */}
          {historyAsc.length >= 2 && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">Assessment History</h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Date','Score','Risk Band','Change'].map(h => (
                        <th key={h} className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyAsc.map((a, i) => {
                      const s    = a.muscleScore ? Math.round(a.muscleScore.score) : null;
                      const prev = historyAsc[i - 1]?.muscleScore?.score ?? null;
                      const delta = s !== null && prev !== null ? Math.round(s - prev) : null;
                      const b  = (a.muscleScore?.riskBand ?? 'HIGH') as Band;
                      const bm = BAND_LIGHT[b];
                      return (
                        <tr key={a.id} className={i === historyAsc.length - 1 ? 'bg-teal-50/50' : ''}>
                          <td className="px-4 py-2.5 text-slate-700 font-medium">{shortDate(a.assessmentDate)}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900 tabular-nums">{s ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${bm.bg} ${bm.border} ${bm.colour}`}>
                              <span className={`w-1 h-1 rounded-full ${bm.dot}`} />{bm.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {delta !== null
                              ? <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>{delta > 0 ? '+' : ''}{delta}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Assessment inputs */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">Assessment Inputs</h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                <div className="px-4 py-3"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Body Weight</p><p className="text-sm font-bold text-slate-900">{latestAssessment.weightKg} kg</p></div>
                <div className="px-4 py-3"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Protein Intake</p><p className="text-sm font-bold text-slate-900">{Math.round(latestAssessment.proteinGrams)} g/day</p></div>
                <div className="px-4 py-3"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Exercise Frequency</p><p className="text-sm font-bold text-slate-900">{latestAssessment.exerciseDaysWk} days/week</p></div>
                <div className="px-4 py-3"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Hydration</p><p className="text-sm font-bold text-slate-900">{latestAssessment.hydrationLitres} L/day</p></div>
                {user.profile?.glp1Medication && (
                  <div className="px-4 py-3 col-span-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">GLP-1 Medication</p>
                    <p className="text-sm font-bold text-slate-900">
                      {MED_LABEL[user.profile.glp1Medication] ?? user.profile.glp1Medication}
                      {user.profile.glp1DoseMg && <span className="font-normal text-slate-600"> — {user.profile.glp1DoseMg} mg/week</span>}
                      {user.profile.glp1Stage && <span className="font-normal text-slate-500"> · {STAGE_LABEL[user.profile.glp1Stage] ?? user.profile.glp1Stage}</span>}
                    </p>
                  </div>
                )}
              </div>
              {latestAssessment.symptoms.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Reported Symptoms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {latestAssessment.symptoms.map(s => (
                      <span key={s} className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Check-in adherence */}
          {user.weeklyCheckins.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Weekly Check-in Adherence (last {user.weeklyCheckins.length} weeks)
              </h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Week of','Avg Protein','Workouts','Hydration'].map(h => (
                        <th key={h} className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {user.weeklyCheckins.map(c => (
                      <tr key={c.weekStart.toISOString()}>
                        <td className="px-4 py-2.5 text-slate-700">{shortDate(c.weekStart)}</td>
                        <td className="px-4 py-2.5 font-medium tabular-nums">{c.avgProteinG != null ? <><span className="font-bold">{Math.round(c.avgProteinG)}</span> g/day</> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-4 py-2.5 font-medium tabular-nums">{c.totalWorkouts != null ? <><span className="font-bold">{c.totalWorkouts}</span> sessions</> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-4 py-2.5 font-medium tabular-nums">{c.avgHydration != null ? <><span className="font-bold">{c.avgHydration}</span> L/day</> : <span className="text-slate-400">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Clinical explanation */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">Clinical Summary</h2>
            <div className="border border-slate-200 rounded-xl px-5 py-4 bg-slate-50">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{ms.explanation}</p>
            </div>
          </section>

          {/* Recommended action */}
          {digest?.nextAction && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">Recommended Next Step</h2>
              <div className={`border rounded-xl px-5 py-4 flex items-start gap-3 ${
                digest.nextActionType === 'urgent' ? 'border-red-200 bg-red-50'
                : digest.nextActionType === 'recommended' ? 'border-amber-200 bg-amber-50'
                : 'border-teal-200 bg-teal-50'
              }`}>
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {digest.nextActionType === 'urgent' ? '⚠️' : digest.nextActionType === 'recommended' ? '💡' : '✅'}
                </span>
                <p className={`text-sm font-semibold leading-snug ${
                  digest.nextActionType === 'urgent' ? 'text-red-800' : digest.nextActionType === 'recommended' ? 'text-amber-800' : 'text-teal-800'
                }`}>
                  {digest.nextAction}
                </p>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="border-t-2 border-slate-200 pt-5 space-y-2">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">CONFIDENTIALITY NOTICE: </span>
              This document contains protected health information generated by the MyoGuard Protocol system.
              It is intended solely for the named patient and their treating physician.
            </p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">CLINICAL DISCLAIMER: </span>
              MyoGuard Protocol provides clinical decision support and educational guidance. It does not replace
              the clinical judgement of the treating physician. All recommendations should be reviewed in the
              context of the patient's full medical history and current treatment plan.
            </p>
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-slate-400">myoguard.health · © {new Date().getFullYear()} MyoGuard Protocol</p>
              <p className="text-[10px] text-slate-400 font-mono">{longDate(generatedAt)}</p>
            </div>
          </footer>

        </div>
      </article>
    </main>
  );
}
