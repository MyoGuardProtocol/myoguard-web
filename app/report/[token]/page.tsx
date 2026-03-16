/**
 * /report/[token] — Public physician-facing report page.
 *
 * No authentication required. The share token in the URL grants read-only
 * access to the patient's latest assessment report. Identical layout to
 * /dashboard/report but without action buttons and with an attribution banner.
 */

import { notFound }             from 'next/navigation';
import Link                     from 'next/link';
import { prisma }               from '@/src/lib/prisma';
import { generateWeeklyDigest } from '@/src/lib/weeklyDigest';

// ─── Display helpers (mirrored from /dashboard/report) ───────────────────────

type Band = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

const BAND_LIGHT: Record<Band, {
  label:   string;
  colour:  string;
  bg:      string;
  border:  string;
  dot:     string;
  barCls:  string;
}> = {
  CRITICAL: { label: 'Critical Risk', colour: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     barCls: 'bg-red-500'     },
  HIGH:     { label: 'High Risk',     colour: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  dot: 'bg-orange-500',  barCls: 'bg-orange-500'  },
  MODERATE: { label: 'Moderate Risk', colour: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   barCls: 'bg-amber-500'   },
  LOW:      { label: 'Low Risk',      colour: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', barCls: 'bg-emerald-500' },
};

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
          weekStart:     true,
          avgProteinG:   true,
          totalWorkouts: true,
          avgHydration:  true,
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
