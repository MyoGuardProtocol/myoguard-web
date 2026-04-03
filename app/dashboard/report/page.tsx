import { auth }                  from '@clerk/nextjs/server';
import { redirect }              from 'next/navigation';
import Link                      from 'next/link';
import { prisma }                from '@/src/lib/prisma';
import { generateWeeklyDigest }  from '@/src/lib/weeklyDigest';
import {
  BAND_LIGHT,
  buildInterpretation,
  buildSuggestedActions,
  buildEscalationSignal,
  type Band,
  type Interpretation,
  type SuggestedAction,
  type EscalationSignal,
}                                from '@/src/lib/reportClinical';
import ShareButton               from './ShareButton';
import DownloadPDFButton         from './DownloadPDFButton';
import PhysicianFeedback         from './PhysicianFeedback';
import DashboardHeader           from '@/src/components/ui/DashboardHeader';

const TREND_LABEL: Record<string, { text: string; colour: string; icon: string }> = {
  improving:    { text: 'Improving',          colour: 'text-emerald-700', icon: '↑' },
  stable:       { text: 'Stable',             colour: 'text-slate-600',   icon: '→' },
  declining:    { text: 'Declining',           colour: 'text-red-700',    icon: '↓' },
  insufficient: { text: 'Insufficient data',  colour: 'text-slate-500',   icon: '–' },
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

// ─── Clinical functions imported from src/lib/reportClinical.ts ──────────────
// buildInterpretation, buildSuggestedActions, buildEscalationSignal,
// BAND_LIGHT, Band, Interpretation, SuggestedAction, EscalationSignal
// are all re-exported from the shared module imported above.

function longDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Phase 1 QA Checklist ────────────────────────────────────────────────────
//
// Verify each item in a real browser session before shipping Phase 1.
//
// SHARE FLOW
// □ "Share With My Physician" opens the modal (requires live auth session)
// □ Closing with ESC key or backdrop click works cleanly
// □ Body scroll is locked while modal open; restored on close
// □ QR code is blurred until consent checkbox is checked
// □ Consent persists within the tab session (sessionStorage key: myoguard_share_consent)
// □ Copy link, WhatsApp, and Email disabled until consented
// □ QR code scans correctly and opens /report/[token] without login required
// □ Generating the link twice returns the same stable URL
//
// PHYSICIAN FEEDBACK — SAVE / RELOAD
// □ No saved review → locked button + "Select an impression…" helper text visible
// □ Selecting any field enables the Save button
// □ Save transitions: idle → saving (spinner) → saved (tick + "Physician review saved") → idle (4 s)
// □ After save: "Last reviewed [date]" clock appears in panel header
// □ After save: summary strip shows impression badge, follow-up days, reviewed date
// □ Reloading the page pre-populates all three saved fields correctly
// □ Editing any field after save → button enables; "Unsaved changes" indicator appears
// □ AuditLog row written on every save — verify in Supabase dashboard (action: PHYSICIAN_REVIEW_SAVED)
//
// DIRTY-STATE WARNING
// □ Edit any field without saving → navigate away / refresh → browser "Leave site?" dialog shown
// □ After saving successfully → navigating away does NOT trigger the dialog
//
// PRINT / PDF OUTPUT
// □ window.print() shows only clinical content — no buttons, modals, nav, action bar, or status strip
// □ Escalation alert prints with colour (print-color-adjust: exact set in globals.css)
// □ Physician review section prints saved values only (not editing UI, not transient states)
// □ If no review saved → print shows blank annotation lines + blank signature/date fields
// □ PDF filename defaults to MyoGuard-Report-[Firstname]-[YYYY-MM-DD]
//
// MOBILE RESPONSIVENESS
// □ Action bar buttons wrap cleanly at < 420 px viewport width
// □ Report status strip items wrap without horizontal overflow on narrow screens
// □ Physician review impression cards stack vertically on mobile (grid-cols-1 sm:grid-cols-3)
// □ Score hero layout stays readable at 375 px width
// □ Share modal fits on-screen with overflow-y-auto scroll on small devices
//
// EMPTY / PARTIAL STATES
// □ /dashboard/report with no assessment → nav header present, clean empty-state card, CTA to assessment
// □ /dashboard/report with assessment but no physician review → feedback panel shows locked state
// □ Report status strip shows correct live state for all three indicators on first load

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: {
      id:       true,
      fullName: true,
      email:    true,
      profile:  {
        select: {
          age:           true,
          sex:           true,
          glp1Medication: true,
          glp1DoseMg:    true,
          glp1Stage:     true,
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

  if (!user) redirect('/dashboard');

  const latestAssessment = user.assessments[0];
  if (!latestAssessment?.muscleScore) {
    // No scored assessment yet — show a navigable empty state rather than a
    // dead-end card. Nav header is included so users can return to the dashboard.
    return (
      <main className="min-h-screen bg-slate-50 font-sans">
        {/* Nav stays present so the user is never stranded */}
        <DashboardHeader />
        <div className="flex items-center justify-center px-5 py-20">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
            <p className="text-2xl mb-3">📋</p>
            <p className="text-slate-800 font-semibold mb-2">No assessment on record</p>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              A physician report is generated automatically after your first MyoGuard
              assessment is scored. It only takes a few minutes.
            </p>
            <Link
              href="/dashboard/assessment"
              className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors inline-block"
            >
              Start Your Assessment →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const ms         = latestAssessment.muscleScore;
  const score      = Math.round(ms.score);
  const band       = ms.riskBand as Band;
  const meta       = BAND_LIGHT[band];
  const pointsToLow = score < 80 ? 80 - score : null;

  const digest = await generateWeeklyDigest(user.id);
  const trendCfg = TREND_LABEL[digest?.trendStatus ?? 'insufficient'];

  // Assessments in chronological order for the history table
  const historyAsc = [...user.assessments].reverse();

  const generatedAt = new Date();

  // ── Clinical interpretation + suggested actions (pure, server-side) ──────────
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

  // Escalation signal — evaluated independently from interpretation + actions
  const signal = buildEscalationSignal({
    riskBand:        band,
    symptomAvg:      (latestAssessment.fatigue + latestAssessment.nausea + latestAssessment.muscleWeakness) / 3,
    proteinDeficit:  ms.proteinTargetG - latestAssessment.proteinGrams,
    exerciseDaysWk:  latestAssessment.exerciseDaysWk,
    hydrationLitres: latestAssessment.hydrationLitres,
    leanLossEstPct:  ms.leanLossEstPct,
    trendStatus:     digest?.trendStatus ?? 'insufficient',
  });

  // ── Physician review — load any previously saved record for this assessment ──
  const savedReview = await prisma.physicianReview.findUnique({
    where:  { assessmentId: latestAssessment.id },
    select: {
      overallImpression: true,
      followUpDays:      true,
      note:              true,
      reviewedAt:        true,
    },
  });

  // Type-narrow the stored string values back to the component's union types.
  // Invalid DB values (defensive) fall back to null rather than throwing.
  const toImpression = (s: string | null): 'stable' | 'monitoring' | 'intervention' | null =>
    s === 'stable' || s === 'monitoring' || s === 'intervention' ? s : null;

  const toFollowUpDays = (n: number | null): 7 | 14 | 21 | 30 | null =>
    n === 7 || n === 14 || n === 21 || n === 30 ? n : null;

  const initialFeedback = savedReview
    ? {
        overallImpression: toImpression(savedReview.overallImpression ?? null),
        followUpDays:      toFollowUpDays(savedReview.followUpDays ?? null),
        note:              savedReview.note ?? '',
        reviewedAt:        savedReview.reviewedAt.toISOString(),
      }
    : null;

  // ── Report status indicators — fetched once at render time ─────────────────
  // Used by the screen-only status strip. Not rendered in print/PDF.
  const existingShareCard = await prisma.shareCard.findFirst({
    where:  { userId: user.id },
    select: { id: true },
  });
  const shareCardExists = existingShareCard !== null;

  // Suggested PDF filename: MyoGuard-Report-Firstname-YYYY-MM-DD
  const firstName      = (user.fullName ?? 'Patient').split(' ')[0];
  const dateStamp      = generatedAt.toISOString().slice(0, 10);           // YYYY-MM-DD
  const pdfFilename    = `MyoGuard-Report-${firstName}-${dateStamp}`;

  return (
    <main className="min-h-screen bg-slate-100 font-sans">

      {/* ── Screen-only nav ── */}
      <DashboardHeader />

      {/* ── Screen-only action bar ── */}
      {/*
        Hierarchy: Share (primary — teal outline) | Download PDF (secondary — teal solid).
        PrintButton is intentionally omitted — DownloadPDFButton already triggers the
        browser print dialog with the correct filename hint, covering both use-cases.
        flex-wrap ensures the two buttons collapse to a second line on narrow viewports
        without any horizontal overflow.
      */}
      <div className="print:hidden max-w-xl mx-auto px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Physician Report</p>
            <p className="text-xs text-slate-500">Download or share with your physician</p>
          </div>
          {/* Primary action first in DOM order matches visual left-to-right reading */}
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton />
            <DownloadPDFButton filename={pdfFilename} />
          </div>
        </div>
      </div>

      {/* ── Report status strip (screen-only, informational) ── */}
      {/*
        Shows the live state of the three key workflow milestones at a glance.
        Intentionally NOT rendered in print/PDF — it is transient screen state,
        not clinical content. Never redesign this into an interactive surface.
      */}
      <div className="print:hidden max-w-xl mx-auto px-5 pb-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">

          {/* ① Report generated */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
            <span className="text-[11px] text-slate-500 truncate">
              Report generated {shortDate(generatedAt)}
            </span>
          </div>

          {/* ② Share link */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${shareCardExists ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden="true"
            />
            <span className="text-[11px] text-slate-500 truncate">
              {shareCardExists ? 'Share link created' : 'Share link not yet created'}
            </span>
          </div>

          {/* ③ Physician review */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${savedReview ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden="true"
            />
            <span className="text-[11px] text-slate-500 truncate">
              {savedReview
                ? `Physician review saved ${shortDate(savedReview.reviewedAt)}`
                : 'Physician review not yet saved'}
            </span>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REPORT DOCUMENT ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <article
        id="physician-report"
        className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none mb-10 print:mb-0"
      >
        <div className="px-8 py-8 print:px-0 print:py-6 space-y-7">

          {/* ── Document header ── */}
          <div className="flex items-start justify-between border-b-2 border-teal-600 pb-5">
            <div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                Myo<span className="text-teal-600">Guard</span>
                <span className="text-slate-400 font-light ml-1 text-base">Protocol</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Physician-Formulated · Data-Driven Muscle Protection
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                Physician Report
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Generated: {longDate(generatedAt)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                REF: {latestAssessment.id.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* ── Patient info row ── */}
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

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── SCORE SUMMARY ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              MyoGuard Muscle Protection Score
            </h2>

            <div className={`rounded-xl border-l-4 ${meta.border.replace('border-', 'border-l-')} border border-l-4 ${meta.border} ${meta.bg} px-5 py-5`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-6xl font-black text-slate-900 tabular-nums leading-none">
                      {score}
                    </span>
                    <span className="text-xl text-slate-400 font-light">/100</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Composite muscle-loss risk score — higher is better
                  </p>
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

              {/* Score bar */}
              <div className="h-3 rounded-full bg-white/70 overflow-hidden flex gap-px mb-3 border border-slate-200">
                <div className="h-full bg-red-200"     style={{ width: '40%' }} />
                <div className="h-full bg-orange-200"  style={{ width: '20%' }} />
                <div className="h-full bg-amber-200"   style={{ width: '20%' }} />
                <div className="h-full bg-emerald-200" style={{ width: '20%' }} />
              </div>
              {/* Score thumb indicator */}
              <div className="relative h-1 mb-4">
                <div
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${meta.barCls}`}
                  style={{ left: `${Math.min(97, Math.max(3, score))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/70 rounded-lg px-3 py-2.5 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                    Distance to Low Risk
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {pointsToLow !== null
                      ? `${pointsToLow} points`
                      : '✓ In optimal zone'}
                  </p>
                </div>
                <div className="bg-white/70 rounded-lg px-3 py-2.5 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                    Daily Protein Target
                  </p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {Math.round(ms.proteinTargetG)} g/day
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── ESCALATION ALERT (conditional) ── */}
          {/* Rendered only when buildEscalationSignal() detects triggered       */}
          {/* criteria. Appears above Clinical Interpretation for maximum        */}
          {/* physician visibility. Prints cleanly with print-color-adjust.      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {signal.escalate && (
            <section aria-live="assertive">
              <div className={`rounded-xl border-2 px-5 py-4 space-y-2.5 ${
                signal.urgency === 'urgent'
                  ? 'border-red-400 bg-red-50'
                  : 'border-amber-400 bg-amber-50'
              }`}>

                {/* ── Header row ── */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Exclamation icon */}
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      signal.urgency === 'urgent' ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      <svg
                        className={`w-4.5 h-4.5 ${signal.urgency === 'urgent' ? 'text-red-700' : 'text-amber-700'}`}
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

                  {/* Urgency badge */}
                  <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded border ${
                    signal.urgency === 'urgent'
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-amber-100 text-amber-700 border-amber-300'
                  }`}>
                    {signal.urgency === 'urgent' ? 'Urgent' : 'Monitor'}
                  </span>
                </div>

                {/* ── Reason ── */}
                <p className={`text-xs leading-relaxed ${
                  signal.urgency === 'urgent' ? 'text-red-800' : 'text-amber-800'
                }`}>
                  {signal.reason}
                </p>

                {/* ── Call to action ── */}
                <p className={`text-[11px] font-semibold ${
                  signal.urgency === 'urgent' ? 'text-red-700' : 'text-amber-700'
                }`}>
                  Consider reassessment or intervention.
                </p>

              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── CLINICAL INTERPRETATION ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Clinical Interpretation
            </h2>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">

              {/* ── Row 1: Risk Category + 30-day projection ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-100">

                {/* Risk category */}
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

                {/* 30-day lean mass projection */}
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

              {/* ── Row 2: Key Risk Drivers + Protocol Adherence ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-100">

                {/* Key risk drivers */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Key Risk Drivers
                  </p>
                  <ul className="space-y-2">
                    {interp.keyDrivers.map((driver, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        {/* Severity pill */}
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

                {/* Protocol adherence signal */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Protocol Adherence Signal
                  </p>
                  {interp.adherenceSignal.lines.length > 0 ? (
                    <ul className="space-y-2">
                      {interp.adherenceSignal.lines.map((line, i) => {
                        // Colour-code by adherence keyword embedded in the line
                        const isHigh = line.includes('High') || line.includes('Consistent') || line.includes('Strong');
                        const isLow  = line.includes('Low') || line.includes('Poor') || line.includes('Poor');
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

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── SUGGESTED PHYSICIAN ACTIONS ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Suggested Physician Actions
            </h2>

            <ol className="space-y-2.5">
              {actions.map((action, i) => {
                // Per-urgency visual tokens
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
                    {/* Step number */}
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black mt-0.5 ${urgencyTokens.numBg}`}>
                      {i + 1}
                    </span>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Badge row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${urgencyTokens.badgeBg}`}>
                          {action.urgency === 'urgent'      && (
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

                      {/* Action text */}
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {action.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── PHYSICIAN FEEDBACK ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Physician Review
            </h2>
            <PhysicianFeedback
              assessmentId={latestAssessment.id}
              initialFeedback={initialFeedback}
            />
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── TRAJECTORY & PROJECTION ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
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
                    <span>{trendCfg.icon}</span>
                    {trendCfg.text}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Check-in Streak</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-tight">
                    {digest.streakWeeks}
                    <span className="text-sm text-slate-400 font-light ml-1">
                      wk{digest.streakWeeks !== 1 ? 's' : ''}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400">Best: {digest.bestStreak} wks</p>
                </div>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── SCORE HISTORY ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {historyAsc.length >= 2 && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Assessment History
              </h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Date</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Score</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Risk Band</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyAsc.map((a, i) => {
                      const s    = a.muscleScore ? Math.round(a.muscleScore.score) : null;
                      const prev = historyAsc[i - 1]?.muscleScore?.score ?? null;
                      const delta = s !== null && prev !== null ? Math.round(s - prev) : null;
                      const b    = (a.muscleScore?.riskBand ?? 'HIGH') as Band;
                      const bm   = BAND_LIGHT[b];
                      return (
                        <tr key={a.id} className={i === historyAsc.length - 1 ? 'bg-teal-50/50' : ''}>
                          <td className="px-4 py-2.5 text-slate-700 font-medium">{shortDate(a.assessmentDate)}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900 tabular-nums">{s ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${bm.bg} ${bm.border} ${bm.colour}`}>
                              <span className={`w-1 h-1 rounded-full ${bm.dot}`} />
                              {bm.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {delta !== null ? (
                              <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── MEDICATION & ASSESSMENT INPUTS ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Assessment Inputs
            </h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                {/* Left column */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Body Weight</p>
                  <p className="text-sm font-bold text-slate-900">{latestAssessment.weightKg} kg</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Protein Intake</p>
                  <p className="text-sm font-bold text-slate-900">{Math.round(latestAssessment.proteinGrams)} g/day</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Exercise Frequency</p>
                  <p className="text-sm font-bold text-slate-900">{latestAssessment.exerciseDaysWk} days/week</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Hydration</p>
                  <p className="text-sm font-bold text-slate-900">{latestAssessment.hydrationLitres} L/day</p>
                </div>
                {user.profile?.glp1Medication && (
                  <div className="px-4 py-3 col-span-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">GLP-1 Medication</p>
                    <p className="text-sm font-bold text-slate-900">
                      {MED_LABEL[user.profile.glp1Medication] ?? user.profile.glp1Medication}
                      {user.profile.glp1DoseMg && (
                        <span className="font-normal text-slate-600"> — {user.profile.glp1DoseMg} mg/week</span>
                      )}
                      {user.profile.glp1Stage && (
                        <span className="font-normal text-slate-500"> · {STAGE_LABEL[user.profile.glp1Stage] ?? user.profile.glp1Stage}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              {latestAssessment.symptoms.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Reported Symptoms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {latestAssessment.symptoms.map(s => (
                      <span key={s} className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── CHECK-IN ADHERENCE ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {user.weeklyCheckins.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Weekly Check-in Adherence (last {user.weeklyCheckins.length} weeks)
              </h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Week of</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Avg Protein</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Workouts</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Hydration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {user.weeklyCheckins.map(c => (
                      <tr key={c.weekStart.toISOString()}>
                        <td className="px-4 py-2.5 text-slate-700">{shortDate(c.weekStart)}</td>
                        <td className="px-4 py-2.5 text-slate-800 tabular-nums font-medium">
                          {c.avgProteinG != null
                            ? <><span className="font-bold">{Math.round(c.avgProteinG)}</span> g/day</>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 tabular-nums font-medium">
                          {c.totalWorkouts != null
                            ? <><span className="font-bold">{c.totalWorkouts}</span> sessions</>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 tabular-nums font-medium">
                          {c.avgHydration != null
                            ? <><span className="font-bold">{c.avgHydration}</span> L/day</>
                            : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── CLINICAL EXPLANATION ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Clinical Summary
            </h2>
            <div className="border border-slate-200 rounded-xl px-5 py-4 bg-slate-50">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {ms.explanation}
              </p>
            </div>
          </section>

          {/* ── Recommended action ── */}
          {digest?.nextAction && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Recommended Next Step
              </h2>
              <div className={`border rounded-xl px-5 py-4 flex items-start gap-3 ${
                digest.nextActionType === 'urgent'
                  ? 'border-red-200 bg-red-50'
                  : digest.nextActionType === 'recommended'
                  ? 'border-amber-200 bg-amber-50'
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

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── FOOTER DISCLAIMER ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <footer className="border-t-2 border-slate-200 pt-5 space-y-2">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">CONFIDENTIALITY NOTICE: </span>
              This document contains protected health information generated by the MyoGuard Protocol
              system. It is intended solely for the named patient and their treating physician.
              Unauthorised disclosure is prohibited.
            </p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">CLINICAL DISCLAIMER: </span>
              MyoGuard Protocol provides clinical decision support and educational guidance based on
              published GLP-1 muscle-loss research. It does not replace the clinical judgement of the
              treating physician. All recommendations should be reviewed in the context of the patient's
              full medical history and current treatment plan.
            </p>
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-slate-400">
                myoguard.health · © {new Date().getFullYear()} MyoGuard Protocol
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                {longDate(generatedAt)}
              </p>
            </div>
          </footer>

        </div>
      </article>

    </main>
  );
}
