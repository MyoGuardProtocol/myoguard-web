import { auth }                  from '@clerk/nextjs/server';
import { redirect }              from 'next/navigation';
import Link                      from 'next/link';
import { prisma }                from '@/src/lib/prisma';
import { generateWeeklyDigest }  from '@/src/lib/weeklyDigest';
import {
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
import SupplementCTA             from '@/src/components/ui/SupplementCTA';

const TREND_LABEL: Record<string, { text: string; colour: string; icon: string }> = {
  improving:    { text: 'Improving',         colour: '#2DD4BF', icon: '↑' },
  stable:       { text: 'Stable',            colour: '#94A3B8', icon: '→' },
  declining:    { text: 'Declining',         colour: '#FB7185', icon: '↓' },
  insufficient: { text: 'Insufficient data', colour: '#475569', icon: '–' },
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

// ─── Dark band display helper ─────────────────────────────────────────────────
function darkBand(b: string): { label: string; color: string; bg: string; border: string } {
  if (b === 'LOW')      return { label: 'Low Risk',      color: '#2DD4BF', bg: 'rgba(45,212,191,0.1)',   border: 'rgba(45,212,191,0.3)'   };
  if (b === 'MODERATE') return { label: 'Moderate Risk', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)'  };
  return                       { label: 'High Risk',     color: '#FB7185', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function longDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const NAV_STYLE: React.CSSProperties = {
  background: '#060D1E',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  position: 'sticky', top: 0, zIndex: 50,
  padding: '0 20px',
};

function DarkNav() {
  return (
    <nav style={NAV_STYLE}>
      <div style={{ maxWidth: '720px', margin: '0 auto',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '56px' }}>
        <a href="/dashboard" style={{ textDecoration: 'none',
          fontSize: '18px', fontWeight: '900',
          letterSpacing: '-0.03em', color: '#F8FAFC' }}>
          Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
        </a>
        <a href="/dashboard" style={{ fontSize: '13px',
          color: '#94A3B8', textDecoration: 'none' }}>
          ← Dashboard
        </a>
      </div>
    </nav>
  );
}

export default async function ReportPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where:  { clerkId },
      select: {
        id:          true,
        fullName:    true,
        email:       true,
        physicianId: true,
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
  } catch (err) {
    console.error('[/dashboard/report] DB query failed:', err);
    return (
      <main style={{ background: '#080C14', minHeight: '100vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#F1F5F9' }}>
        <DarkNav />
        <div style={{ display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '80px 20px' }}>
          <div style={{ background: '#0D1421', border: '1px solid #1A2744',
            borderRadius: '16px', padding: '32px', maxWidth: '360px',
            width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: '600',
              color: '#F1F5F9', marginBottom: '8px' }}>
              Unable to load your report
            </p>
            <p style={{ fontSize: '13px', color: '#94A3B8',
              marginBottom: '20px', lineHeight: '1.6' }}>
              There was a problem fetching your protocol data. Please try again.
            </p>
            <Link href="/dashboard/report" style={{
              display: 'inline-block', background: '#2DD4BF',
              color: '#080C14', padding: '10px 24px', borderRadius: '99px',
              fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
              Try again →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!user) redirect('/dashboard');

  // Walk assessments (already desc by date) to find the most recent one with a
  // valid muscleScore. If the newest assessment is missing its score record (e.g.
  // a partial write), this falls back to the last fully-scored assessment instead
  // of showing a false empty state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestAssessment = user.assessments.find((a: any) => a.muscleScore != null) ?? null;
  if (!latestAssessment) {
    return (
      <main style={{ background: '#080C14', minHeight: '100vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#F1F5F9' }}>
        <DarkNav />
        <div style={{ display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '80px 20px' }}>
          <div style={{ background: '#0D1421', border: '1px solid #1A2744',
            borderRadius: '16px', padding: '32px', maxWidth: '360px',
            width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: '22px', marginBottom: '12px' }}>📋</p>
            <p style={{ fontSize: '16px', fontWeight: '600',
              color: '#F1F5F9', marginBottom: '8px' }}>
              No assessment on record
            </p>
            <p style={{ fontSize: '13px', color: '#94A3B8',
              marginBottom: '20px', lineHeight: '1.6' }}>
              A protocol report is generated automatically after your first
              MyoGuard assessment is scored. It only takes a few minutes.
            </p>
            <Link href="/dashboard/assessment" style={{
              display: 'inline-block', background: '#2DD4BF',
              color: '#080C14', padding: '10px 24px', borderRadius: '99px',
              fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
              Start Your Assessment →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const ms          = latestAssessment.muscleScore;
  const score       = Math.round(ms.score);
  const band        = ms.riskBand as Band;
  const db          = darkBand(band);
  const pointsToLow = score < 80 ? 80 - score : null;

  const digest   = await generateWeeklyDigest(user.id);
  const trendCfg = TREND_LABEL[digest?.trendStatus ?? 'insufficient'];

  // ── Physician link — resolve display name if linked ──────────────────────────
  let physicianName: string | null = null;
  if (user.physicianId) {
    const physician = await prisma.user.findUnique({
      where:  { id: user.physicianId },
      select: { fullName: true },
    });
    physicianName = physician?.fullName ?? null;
  }

  // ── Supplement relevance signals ─────────────────────────────────────────────
  const lowProtein    = latestAssessment.proteinGrams && ms.proteinTargetG
    ? latestAssessment.proteinGrams < ms.proteinTargetG * 0.85
    : false;
  const hasGISymptoms = latestAssessment.symptoms.some((s: string) =>
    ['nausea', 'vomiting', 'constipation', 'gastroparesis', 'bloating', 'reduced appetite']
      .includes(s.toLowerCase())
  );
  const lowRecovery   = latestAssessment.sleepHours != null
    ? latestAssessment.sleepHours < 6.5
    : false;

  const historyAsc  = [...user.assessments].reverse();
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

  const signal = buildEscalationSignal({
    riskBand:        band,
    symptomAvg:      (latestAssessment.fatigue + latestAssessment.nausea + latestAssessment.muscleWeakness) / 3,
    proteinDeficit:  ms.proteinTargetG - latestAssessment.proteinGrams,
    exerciseDaysWk:  latestAssessment.exerciseDaysWk,
    hydrationLitres: latestAssessment.hydrationLitres,
    leanLossEstPct:  ms.leanLossEstPct,
    trendStatus:     digest?.trendStatus ?? 'insufficient',
  });

  // ── Physician review ──────────────────────────────────────────────────────────
  const savedReview = await prisma.physicianReview.findUnique({
    where:  { assessmentId: latestAssessment.id },
    select: {
      overallImpression: true,
      followUpDays:      true,
      note:              true,
      reviewedAt:        true,
    },
  });

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

  // ── Report status indicators ──────────────────────────────────────────────────
  const existingShareCard = await prisma.shareCard.findFirst({
    where:  { userId: user.id },
    select: { id: true },
  });
  const shareCardExists = existingShareCard !== null;

  const firstName   = (user.fullName ?? 'Patient').split(' ')[0];
  const dateStamp   = generatedAt.toISOString().slice(0, 10);
  const pdfFilename = `MyoGuard-Report-${firstName}-${dateStamp}`;

  // ── Card surface style shared across sections ─────────────────────────────────
  const card: React.CSSProperties = {
    background: '#0D1421',
    border: '1px solid #1A2744',
    borderRadius: '16px',
    padding: '24px',
  };

  const sectionHeading: React.CSSProperties = {
    fontFamily: 'Georgia, serif',
    color: '#F1F5F9',
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
  };

  return (
    <main style={{ background: '#080C14', minHeight: '100vh',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#F1F5F9' }}>

      {/* NAV */}
      <DarkNav />

      {/* ACTION BAR — screen only */}
      <div className="print:hidden" style={{ maxWidth: '720px', margin: '0 auto', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: '700',
              fontFamily: 'Georgia, serif', color: '#F1F5F9' }}>
              Your MyoGuard Protocol Report
            </p>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
              Download or share with your physician
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <ShareButton physicianLinked={!!user.physicianId} physicianName={physicianName} />
            <DownloadPDFButton filename={pdfFilename} />
          </div>
        </div>
      </div>

      {/* STATUS STRIP — screen only */}
      <div className="print:hidden" style={{ maxWidth: '720px', margin: '0 auto', padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 20px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%',
              background: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Report generated {shortDate(generatedAt)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%',
              background: shareCardExists ? '#10b981' : '#1E293B', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {shareCardExists ? 'Share link created' : 'Share link not yet created'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%',
              background: savedReview ? '#10b981' : '#1E293B', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {savedReview
                ? `Physician review saved ${shortDate(savedReview.reviewedAt)}`
                : 'Physician review not yet saved'}
            </span>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* REPORT DOCUMENT                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div id="physician-report"
        style={{ maxWidth: '720px', margin: '0 auto', padding: '0 20px 48px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* ── Document header ── */}
          <div style={{ borderBottom: '2px solid #2DD4BF', paddingBottom: '20px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '22px', fontWeight: '900',
                letterSpacing: '-0.02em', color: '#F8FAFC' }}>
                Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
                <span style={{ color: '#475569', fontWeight: '300',
                  marginLeft: '6px', fontSize: '15px' }}>Protocol</span>
              </p>
              <p style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                Physician-Formulated · Data-Driven Muscle Protection
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#2DD4BF',
                textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Protocol Report
              </p>
              <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                Generated: {longDate(generatedAt)}
              </p>
              <p style={{ fontSize: '10px', color: '#475569', marginTop: '2px',
                fontFamily: 'monospace' }}>
                REF: {latestAssessment.id.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* ── Patient info row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px',
            background: '#0D1421', border: '1px solid #1A2744',
            borderRadius: '16px', padding: '16px 20px' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: '4px' }}>Patient</p>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#F1F5F9' }}>
                {user.fullName}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: '4px' }}>Assessment Date</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                {new Date(latestAssessment.assessmentDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {user.profile?.age && (
              <div>
                <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: '4px' }}>Age</p>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                  {user.profile.age} years
                </p>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* SCORE SUMMARY                                                     */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 style={sectionHeading}>MyoGuard Muscle Protection Score</h2>

            <div style={{ background: '#0D1421',
              border: '1px solid #1A2744',
              borderLeft: `4px solid ${db.color}`,
              borderRadius: '16px', padding: '20px 24px' }}>

              <div style={{ display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '60px', fontWeight: '900',
                      fontFamily: 'Georgia, serif', color: '#2DD4BF', lineHeight: 1 }}>
                      {score}
                    </span>
                    <span style={{ fontSize: '20px', color: '#475569', fontWeight: '300' }}>
                      /100
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                    Composite muscle-loss risk score — higher is better
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column',
                  alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '99px',
                    fontSize: '12px', fontWeight: '700',
                    background: db.bg, border: `1px solid ${db.border}`, color: db.color,
                  }}>
                    <span style={{ width: '6px', height: '6px',
                      borderRadius: '50%', background: db.color }} />
                    {db.label}
                  </span>
                  {false && (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>
                    {ms.leanLossEstPct}% estimated lean mass loss risk
                  </span>
                  )}
                </div>
              </div>

              {/* Score bar */}
              <div style={{ height: '10px', borderRadius: '99px', background: '#080C14',
                overflow: 'hidden', position: 'relative', marginBottom: '16px' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                  width: '40%', background: 'rgba(251,113,133,0.45)' }} />
                <div style={{ position: 'absolute', left: '40%', top: 0, height: '100%',
                  width: '20%', background: 'rgba(245,158,11,0.45)' }} />
                <div style={{ position: 'absolute', left: '60%', top: 0, height: '100%',
                  width: '20%', background: 'rgba(251,191,36,0.45)' }} />
                <div style={{ position: 'absolute', left: '80%', top: 0, height: '100%',
                  width: '20%', background: 'rgba(45,212,191,0.45)' }} />
                <div style={{
                  position: 'absolute', top: '50%',
                  transform: 'translate(-50%, -50%)',
                  left: `${Math.min(97, Math.max(3, score))}%`,
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: db.color, border: '2px solid #080C14',
                }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#080C14', border: '1px solid #1A2744',
                  borderRadius: '12px', padding: '12px 16px' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '4px' }}>
                    Distance to Low Risk
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                    {pointsToLow !== null ? `${pointsToLow} points` : '✓ In optimal zone'}
                  </p>
                </div>
                <div style={{ background: '#080C14', border: '1px solid #1A2744',
                  borderRadius: '12px', padding: '12px 16px' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '4px' }}>
                    Daily Protein Target
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#2DD4BF' }}>
                    {Math.round(ms.proteinTargetG)} g/day
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* PATIENT SUMMARY CARD (Part C)                                     */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <div style={{
            background: ms.score >= 70
              ? 'rgba(45,212,191,0.08)'
              : ms.score >= 50
              ? 'rgba(245,158,11,0.08)'
              : 'rgba(248,113,113,0.08)',
            border: `1px solid ${
              ms.score >= 70 ? '#2DD4BF40' :
              ms.score >= 50 ? '#F59E0B40' : '#FB718540'
            }`,
            borderRadius: '16px',
            padding: '20px 24px',
          }}>
            <p style={{
              fontFamily: 'Georgia, serif',
              fontSize: '15px',
              color: '#F1F5F9',
              lineHeight: '1.6',
              marginBottom: '12px',
            }}>
              {ms.score >= 70
                ? 'Your muscle protection is on track. Keep hitting your protein target and maintaining your activity — your body is responding well.'
                : ms.score >= 50
                ? 'Your muscle protection needs some attention. Focus on your daily protein target — this is the most important action you can take right now.'
                : 'Your muscle protection needs immediate attention. Speak with your physician about adjusting your protocol.'
              }
            </p>
            <div style={{
              display: 'inline-block',
              background: 'rgba(45,212,191,0.12)',
              border: '1px solid #2DD4BF40',
              borderRadius: '99px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#2DD4BF',
            }}>
              Daily protein target: {ms.proteinTargetG}g
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* THIS WEEK'S FOCUS                                                  */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <div style={{
            background: '#0D1421',
            border: '1px solid #1A2744',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
          }}>
            <p style={{
              fontFamily: 'Georgia, serif',
              fontSize: '16px', fontWeight: '600',
              color: '#F1F5F9', marginBottom: '16px',
            }}>
              This Week&apos;s Focus
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'rgba(45,212,191,0.12)',
                  border: '1px solid rgba(45,212,191,0.3)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                }}>
                  <span style={{ fontSize: '11px', color: '#2DD4BF', fontWeight: '700' }}>1</span>
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9', marginBottom: '4px' }}>
                    Hit your protein target daily
                  </p>
                  <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.5' }}>
                    {ms.proteinTargetG}g/day — spread across 4–5 meals.
                    Whey protein supplement recommended if dietary intake falls short.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'rgba(45,212,191,0.12)',
                  border: '1px solid rgba(45,212,191,0.3)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                }}>
                  <span style={{ fontSize: '11px', color: '#2DD4BF', fontWeight: '700' }}>2</span>
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9', marginBottom: '4px' }}>
                    Complete at least 2 resistance sessions
                  </p>
                  <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.5' }}>
                    Compound movements — squat, press, row, hinge.
                    Resistance training is the most evidence-supported strategy for
                    preserving muscle during GLP-1 therapy.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'rgba(45,212,191,0.12)',
                  border: '1px solid rgba(45,212,191,0.3)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                }}>
                  <span style={{ fontSize: '11px', color: '#2DD4BF', fontWeight: '700' }}>3</span>
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9', marginBottom: '4px' }}>
                    Log your weekly check-in
                  </p>
                  <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.5' }}>
                    Takes 60 seconds. Consistent logging builds your progress trajectory in The Odyssey.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* SUPPLEMENT PROTOCOL                                                */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <SupplementCTA
            dark
            lowProtein={lowProtein}
            hasGISymptoms={hasGISymptoms}
            lowRecovery={lowRecovery}
          />

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ESCALATION ALERT — hidden from patient view (Part B-1)            */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {false && (
            <section aria-live="assertive">
              <div style={{ borderRadius: '16px', border: '2px solid',
                borderColor: signal.urgency === 'urgent' ? '#f87171' : '#fbbf24',
                background: signal.urgency === 'urgent' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                padding: '16px 20px' }}>
                <p style={{ fontWeight: '800', color: signal.urgency === 'urgent' ? '#FB7185' : '#F59E0B' }}>
                  Physician Escalation Alert
                </p>
                <p style={{ fontSize: '13px', marginTop: '8px', color: '#94A3B8' }}>
                  {signal.reason}
                </p>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* CLINICAL INTERPRETATION                                            */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 style={sectionHeading}>Clinical Interpretation</h2>

            <div style={{ background: '#0D1421', border: '1px solid #1A2744',
              borderRadius: '16px', overflow: 'hidden' }}>

              {/* Row 1: Risk Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
                <div style={{ padding: '16px 20px',
                  borderBottom: '1px solid #1A2744' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Risk Category
                  </p>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '99px', marginBottom: '8px',
                    fontSize: '12px', fontWeight: '700',
                    background: db.bg, border: `1px solid ${db.border}`, color: db.color,
                  }}>
                    <span style={{ width: '6px', height: '6px',
                      borderRadius: '50%', background: db.color }} />
                    {interp.riskCategory.label}
                  </span>
                  <p style={{ fontSize: '12px', color: '#94A3B8', lineHeight: '1.5', marginTop: '6px' }}>
                    {interp.riskCategory.detail}
                  </p>
                </div>

                {false && (
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #1A2744' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '10px' }}>
                    30-Day Lean Mass Projection
                  </p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: db.color,
                    fontFamily: 'Georgia, serif', lineHeight: 1, marginBottom: '4px' }}>
                    {ms.leanLossEstPct}%
                    <span style={{ fontSize: '13px', fontWeight: '400',
                      color: '#94A3B8', marginLeft: '6px' }}>lean loss risk</span>
                  </p>
                  <p style={{ fontSize: '12px', color: '#94A3B8', lineHeight: '1.5' }}>
                    {interp.leanMassProjection.split('. ').slice(1).join('. ')}
                  </p>
                </div>
                )}
              </div>

              {/* Row 2: Key Risk Drivers + Protocol Adherence */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '12px' }}>
                    Key Risk Drivers
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {interp.keyDrivers.map((driver, i) =>
                      /deficit|−|below target/i.test(driver.text) ? null : (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{
                          flexShrink: 0, marginTop: '2px',
                          width: '16px', height: '16px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: '900',
                          background: driver.severity === 'concern'
                            ? 'rgba(251,113,133,0.15)'
                            : driver.severity === 'caution'
                            ? 'rgba(245,158,11,0.15)'
                            : 'rgba(45,212,191,0.15)',
                          color: driver.severity === 'concern' ? '#FB7185'
                            : driver.severity === 'caution' ? '#F59E0B' : '#2DD4BF',
                        }}>
                          {driver.severity === 'concern' ? '!' : driver.severity === 'caution' ? '~' : '✓'}
                        </span>
                        <span style={{
                          fontSize: '12px', lineHeight: '1.5',
                          color: driver.severity === 'concern' ? '#FB7185'
                            : driver.severity === 'caution' ? '#F59E0B' : '#94A3B8',
                        }}>
                          {driver.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {false && (
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '12px' }}>
                    Protocol Adherence Signal
                  </p>
                  {interp.adherenceSignal.lines.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {interp.adherenceSignal.lines.map((line, i) => {
                        const isHigh = line.includes('High') || line.includes('Consistent') || line.includes('Strong');
                        const isLow  = line.includes('Low') || line.includes('Poor');
                        return (
                          <p key={i} style={{ fontSize: '12px', lineHeight: '1.5',
                            color: isHigh ? '#2DD4BF' : isLow ? '#FB7185' : '#94A3B8' }}>
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: '#475569',
                      fontStyle: 'italic', lineHeight: '1.5' }}>
                      {interp.adherenceSignal.summary}
                    </p>
                  )}
                </div>
                )}
              </div>

            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* SUGGESTED PHYSICIAN ACTIONS — hidden from patient view (Part B-2) */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {false && (
            <section>
              <h2 style={sectionHeading}>Suggested Physician Actions</h2>
              <ol style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {actions.map((action, i) => (
                  <li key={i} style={{ background: '#0D1421', border: '1px solid #1A2744',
                    borderRadius: '16px', padding: '14px 16px' }}>
                    <p style={{ fontSize: '12px', color: '#94A3B8' }}>{action.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* PHYSICIAN REVIEW — hidden from patient view (Part B-3)            */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {false && (
            <section>
              <h2 style={sectionHeading}>Physician Review</h2>
              <PhysicianFeedback
                assessmentId={latestAssessment.id}
                initialFeedback={initialFeedback}
              />
            </section>
          )}


          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ASSESSMENT HISTORY — moved to Odyssey                             */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {false && historyAsc.length >= 2 && (
            <section>
              <style>{`
                .hist-row { cursor: pointer; transition: background 0.15s; }
                .hist-row:hover { background: rgba(45,212,191,0.05) !important; }
                .hist-row td:first-child { position: relative; }
                .hist-row-link { position: absolute; inset: 0; z-index: 1; }
              `}</style>
              <h2 style={sectionHeading}>Assessment History</h2>
              <div style={{ background: '#0D1421', border: '1px solid #1A2744',
                borderRadius: '16px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1A2744' }}>
                      <th style={{ textAlign: 'left', fontSize: '10px', color: '#94A3B8',
                        textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 16px' }}>
                        Date
                      </th>
                      <th style={{ textAlign: 'left', fontSize: '10px', color: '#94A3B8',
                        textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 16px' }}>
                        Score
                      </th>
                      {false && (
                        <th style={{ textAlign: 'left', fontSize: '10px', color: '#94A3B8',
                          textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 16px' }}>
                          Risk Band
                        </th>
                      )}
                      <th style={{ textAlign: 'left', fontSize: '10px', color: '#94A3B8',
                        textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 16px' }}>
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyAsc.map((a, i) => {
                      const s     = a.muscleScore ? Math.round(a.muscleScore.score) : null;
                      const prev  = historyAsc[i - 1]?.muscleScore?.score ?? null;
                      const delta = s !== null && prev !== null ? Math.round(s - prev) : null;
                      return (
                        <tr key={a.id} className="hist-row" style={{
                          borderBottom: i < historyAsc.length - 1 ? '1px solid #1A2744' : 'none',
                          background: i === historyAsc.length - 1 ? 'rgba(45,212,191,0.04)' : 'transparent',
                        }}>
                          <td style={{ padding: '10px 16px', fontSize: '13px', color: '#94A3B8' }}>
                            <a href={`/dashboard/results/${a.id}`} className="hist-row-link" aria-label={`View assessment from ${new Date(a.assessmentDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`} />
                            {new Date(a.assessmentDate).toLocaleString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: '14px', fontWeight: '700',
                            color: '#2DD4BF', fontFamily: 'Georgia, serif' }}>
                            {s ?? '—'}
                          </td>
                          {false && (
                            <td style={{ padding: '10px 16px' }}>
                              {/* Risk band hidden from patient view */}
                            </td>
                          )}
                          <td style={{ padding: '10px 16px' }}>
                            {delta !== null ? (
                              <span style={{ fontSize: '12px', fontWeight: '600',
                                color: delta > 0 ? '#2DD4BF' : delta < 0 ? '#FB7185' : '#475569' }}>
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#1A2744' }}>—</span>
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
          {/* ASSESSMENT INPUTS                                                  */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 style={sectionHeading}>Your Assessment Details</h2>
            <div style={{ background: '#0D1421', border: '1px solid #1A2744',
              borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '14px 16px',
                  borderBottom: '1px solid #1A2744', borderRight: '1px solid #1A2744' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '4px' }}>Body Weight</p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                    {latestAssessment.weightKg} kg
                  </p>
                </div>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #1A2744' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '4px' }}>Protein Intake</p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                    {Math.round(latestAssessment.proteinGrams)} g/day
                  </p>
                </div>
                <div style={{ padding: '14px 16px', borderRight: '1px solid #1A2744' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '4px' }}>Exercise Frequency</p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                    {latestAssessment.exerciseDaysWk} days/week
                  </p>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '4px' }}>Hydration</p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                    {latestAssessment.hydrationLitres} L/day
                  </p>
                </div>
                {user.profile?.glp1Medication && (
                  <div style={{ padding: '14px 16px', gridColumn: 'span 2',
                    borderTop: '1px solid #1A2744' }}>
                    <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                      letterSpacing: '0.06em', marginBottom: '4px' }}>GLP-1 Medication</p>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                      {MED_LABEL[user.profile.glp1Medication] ?? user.profile.glp1Medication}
                      {user.profile.glp1DoseMg && (
                        <span style={{ fontWeight: '400', color: '#94A3B8' }}>
                          {' '}— {user.profile.glp1DoseMg} mg/week
                        </span>
                      )}
                      {user.profile.glp1Stage && (
                        <span style={{ fontWeight: '400', color: '#475569' }}>
                          {' '}· {STAGE_LABEL[user.profile.glp1Stage] ?? user.profile.glp1Stage}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              {latestAssessment.symptoms.length > 0 && (
                <div style={{ padding: '14px 16px', borderTop: '1px solid #1A2744' }}>
                  <p style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '8px' }}>Reported Symptoms</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {latestAssessment.symptoms.map((s: string) => (
                      <span key={s} style={{ fontSize: '12px', background: '#080C14',
                        color: '#94A3B8', border: '1px solid #1A2744',
                        borderRadius: '99px', padding: '3px 12px' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* CHECK-IN ADHERENCE — moved to Odyssey                             */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {false && user.weeklyCheckins.length > 0 && (
            <section>
              <h2 style={sectionHeading}>
                Weekly Check-in Adherence (last {user.weeklyCheckins.length} weeks)
              </h2>
              <div style={{ background: '#0D1421', border: '1px solid #1A2744',
                borderRadius: '16px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1A2744' }}>
                      {['Week of', 'Avg Protein', 'Workouts', 'Hydration'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontSize: '10px', color: '#94A3B8',
                          textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 16px' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {user.weeklyCheckins.map((
                      c: { weekStart: Date; avgProteinG: number | null; totalWorkouts: number | null; avgHydration: number | null; proteinAdherence: number | null; exerciseAdherence: number | null },
                      idx: number,
                    ) => (
                      <tr key={c.weekStart.toISOString()} style={{
                        borderBottom: idx < user.weeklyCheckins.length - 1 ? '1px solid #1A2744' : 'none',
                      }}>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: '#94A3B8' }}>
                          {shortDate(c.weekStart)}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: '#F1F5F9' }}>
                          {c.avgProteinG != null
                            ? <><span style={{ fontWeight: '700' }}>{Math.round(c.avgProteinG)}</span> g/day</>
                            : <span style={{ color: '#475569' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: '#F1F5F9' }}>
                          {c.totalWorkouts != null
                            ? <><span style={{ fontWeight: '700' }}>{c.totalWorkouts}</span> sessions</>
                            : <span style={{ color: '#475569' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: '#F1F5F9' }}>
                          {c.avgHydration != null
                            ? <><span style={{ fontWeight: '700' }}>{c.avgHydration}</span> L/day</>
                            : <span style={{ color: '#475569' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* CLINICAL SUMMARY — physician view only                            */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {false && (
          <section>
            <h2 style={sectionHeading}>Clinical Summary</h2>
            <div style={{ ...card }}>
              <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6',
                whiteSpace: 'pre-line' }}>
                {ms.explanation}
              </p>
            </div>
          </section>
          )}

          {/* ── Recommended Next Step ── */}
          {digest?.nextAction && (
            <section>
              <h2 style={sectionHeading}>Recommended Next Step</h2>
              <div style={{
                background: '#0D1421',
                border: `1px solid ${
                  digest.nextActionType === 'urgent'      ? 'rgba(251,113,133,0.3)' :
                  digest.nextActionType === 'recommended' ? 'rgba(245,158,11,0.3)'  :
                                                           'rgba(45,212,191,0.3)'
                }`,
                borderRadius: '16px', padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: '12px',
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>
                  {digest.nextActionType === 'urgent' ? '⚠️' : digest.nextActionType === 'recommended' ? '💡' : '✅'}
                </span>
                <p style={{
                  fontSize: '13px', fontWeight: '600', lineHeight: '1.5',
                  color: digest.nextActionType === 'urgent' ? '#FB7185'
                    : digest.nextActionType === 'recommended' ? '#F59E0B' : '#2DD4BF',
                }}>
                  {digest.nextAction}
                </p>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ODYSSEY LINK                                                       */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <a href="/dashboard/journey" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(45,212,191,0.08)',
              border: '1px solid rgba(45,212,191,0.3)',
              borderRadius: '99px', padding: '12px 24px',
              textDecoration: 'none',
              fontSize: '13px', fontWeight: '600',
              color: '#2DD4BF',
            }}>
              View your progress in The Odyssey →
            </a>
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* FOOTER                                                             */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <footer style={{ borderTop: '1px solid #1A2744', paddingTop: '20px' }}>
            <p style={{ fontSize: '11px', color: '#475569',
              lineHeight: '1.6', marginBottom: '8px' }}>
              <span style={{ fontWeight: '600', color: '#94A3B8' }}>CONFIDENTIALITY NOTICE: </span>
              This document contains protected health information generated by the MyoGuard Protocol
              system. It is intended solely for the named patient and their treating physician.
              Unauthorised disclosure is prohibited.
            </p>
            <p style={{ fontSize: '11px', color: '#475569',
              lineHeight: '1.6', marginBottom: '12px' }}>
              <span style={{ fontWeight: '600', color: '#94A3B8' }}>CLINICAL DISCLAIMER: </span>
              MyoGuard Protocol provides clinical decision support and educational guidance based on
              published GLP-1 muscle-loss research. It does not replace the clinical judgement of the
              treating physician. All recommendations should be reviewed in the context of the patient's
              full medical history and current treatment plan.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '11px', color: '#475569' }}>
                myoguard.health · © {new Date().getFullYear()} MyoGuard Protocol
              </p>
              <p style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                {longDate(generatedAt)}
              </p>
            </div>
          </footer>

        </div>
      </div>

    </main>
  );
}
