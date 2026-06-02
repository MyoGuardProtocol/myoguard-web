// MyoGuard — Physician Patient Evidence Page
//
// BUILD 5E: Connects the BUILD 5D evidence engine to the physician workflow.
//
// Core principle:
// MyoGuard generates clinical evidence. The physician generates clinical decisions.
// Never cross that boundary. All outputs are observational. Never diagnostic.
// Never predictive. Never directive.
//
// Authorization:
//   Physician ownership is verified at the route level using the full OR pattern:
//   physicianId (direct link) + referralSlug (legacy referral-linked patients).
//   Authorization is NEVER delegated to generateClinicalEvidenceRecord() —
//   this route is the IDOR guard for the evidence surface.
//
// Data flow:
//   1. Verify physician role and identity
//   2. Verify patient ownership (full OR pattern)
//   3. generateClinicalEvidenceRecord(patientId, physician.id, { windowDays: 90 })
//   4. generatePhysicianReviewSummary(record)
//   5. Server render
//
// DO NOT:
//   - Add PDF export or download functionality
//   - Add EHR export (BUILD 6A)
//   - Alter evidence engine (evidencePacket.ts, types.ts, etc.)
//   - Alter schema
//   - Add patient-facing routes

import { auth }               from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link                   from 'next/link';
import { prisma }                        from '@/src/lib/prisma';
import { generateClinicalEvidenceRecord } from '@/src/lib/evidence/evidencePacket';
import { generatePhysicianReviewSummary } from '@/src/lib/evidence/physicianReviewSummary';
import PhysicianNav                        from '@/src/components/ui/PhysicianNav';
import PhysicianReviewSummaryCollapsible   from '@/src/components/doctor/evidence/PhysicianReviewSummaryCollapsible';
import DocumentationTimelineToggle         from '@/src/components/doctor/evidence/DocumentationTimelineToggle';

// ─── Readiness label map ──────────────────────────────────────────────────────
//
// Maps the evidence engine's readiness status to display labels.
// Uses record.evidenceReadiness.status as the authoritative source —
// evidence readiness is not re-derived in the UI layer.

const READINESS_LABEL: Record<string, string> = {
  sufficient: 'Sufficient',
  developing: 'Developing',
  limited:    'Limited',
};

// ─── Physician signal → summary bar display label ─────────────────────────────
//
// Maps intelligence signal status values to physician-readable review status labels.
// "within_expected_range" maps to "No Review Signals" — the absence of a signal
// is the most common state and deserves a clear affirmative label.

const PHYSICIAN_SIGNAL_DISPLAY: Record<string, string> = {
  review_recommended:       'Review Recommended',
  review_threshold_crossed: 'Review Threshold Crossed',
  continuity_concern:       'Continuity Concern',
  within_expected_range:    'No Review Signals',
};

// ─── Signal display helpers ───────────────────────────────────────────────────
//
// formatStatus()    — Title Case from underscore_separated enum values.
//                     e.g. "positive_trend" → "Positive Trend"
// formatConfidence()— Physician-readable confidence label.
//                     e.g. "high" → "High Confidence"
//                     e.g. "insufficient_data" → "Insufficient Data"

function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatConfidence(confidence: string): string {
  if (confidence === 'insufficient_data') return 'Insufficient Data';
  const capitalised = confidence.charAt(0).toUpperCase() + confidence.slice(1);
  return `${capitalised} Confidence`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PatientEvidencePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in-new');

  // ── Physician guard ─────────────────────────────────────────────────────
  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, referralSlug: true, fullName: true },
  });
  if (!physician) redirect('/dashboard');
  if (physician.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (physician.role !== 'PHYSICIAN') redirect('/dashboard');

  // Resolve physician display name
  const physicianSlug = physician.referralSlug;
  let displayName = physician.fullName ?? 'Physician';
  if (physicianSlug) {
    const profile = await prisma.physicianProfile.findUnique({
      where:  { slug: physicianSlug },
      select: { displayName: true },
    });
    if (profile?.displayName) displayName = profile.displayName;
  }

  const { userId: patientId } = await params;

  // ── IDOR guard ─────────────────────────────────────────────────────────
  // Verify this patient is linked to this physician before generating evidence.
  // Full OR pattern — includes both direct physicianId links and legacy
  // referral-linked patients (referralSlug). Omitting the referralSlug branch
  // would silently exclude patients linked via invitation.
  // Authorization is NEVER delegated to generateClinicalEvidenceRecord().
  const patient = await prisma.user.findFirst({
    where: {
      id:   patientId,
      role: 'PATIENT',
      OR: [
        { physicianId: physician.id },
        ...(physicianSlug ? [{ referralSlug: physicianSlug }] : []),
      ],
    },
    select: { id: true, fullName: true },
  });
  if (!patient) notFound();

  const patientName = patient.fullName ?? 'Patient';

  // ── Evidence generation ────────────────────────────────────────────────
  //
  // .catch(() => null) converts any evidence engine error to null so the
  // server component can render the error state rather than throwing a 500.
  const record = await generateClinicalEvidenceRecord(
    patientId,
    physician.id,
    { windowDays: 90 },
  ).catch(() => null);

  // ── Error state ────────────────────────────────────────────────────────
  if (!record) {
    return (
      <main style={{ minHeight: '100vh', background: '#080C14' }}>
        <PhysicianNav activePath="/doctor/patients" displayName={displayName} />
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
          <Link
            href={`/doctor/patients/${patientId}`}
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              minHeight:      '44px',
              fontSize:       '13px',
              color:          '#94A3B8',
              textDecoration: 'none',
              marginBottom:   '24px',
            }}
          >
            ← Back to Patient Profile
          </Link>
          <div
            style={{
              background:    '#0D1421',
              border:        '1px solid #1A2744',
              borderRadius:  '16px',
              padding:       '40px 24px',
              textAlign:     'center',
            }}
          >
            <p
              style={{
                fontFamily:   'Georgia, serif',
                fontSize:     '15px',
                color:        '#F1F5F9',
                marginBottom: '8px',
                marginTop:    0,
              }}
            >
              Evidence temporarily unavailable. Refresh to retry.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Derived display values ─────────────────────────────────────────────
  const reviewSummary = generatePhysicianReviewSummary(record);

  const readinessLabel =
    READINESS_LABEL[record.evidenceReadiness.status] ?? 'Limited';

  const hasData       = record.patientSummary.assessmentCount > 0;
  const windowLabel   = `${record.windowDays}-day observation window`;
  const generatedAt   = new Date(record.generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Summary bar values ────────────────────────────────────────────────
  //
  // lastAssessmentRecord: minimal Prisma lookup for display only.
  // Does not alter evidence calculations or signals.
  const lastAssessmentRecord = hasData
    ? await prisma.assessment.findFirst({
        where:   { userId: patientId },
        orderBy: { createdAt: 'desc' },
        select:  { createdAt: true },
      }).catch(() => null)
    : null;

  const lastAssessmentDisplay = (() => {
    if (!lastAssessmentRecord) return hasData ? 'Recently' : 'No assessments';
    const days = Math.floor(
      (Date.now() - lastAssessmentRecord.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  })();

  const reviewSignalDisplay =
    PHYSICIAN_SIGNAL_DISPLAY[record.physicianSignals[0]?.status ?? ''] ?? 'No Review Signals';

  // ── Page render ────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', background: '#080C14' }}>

      <PhysicianNav activePath="/doctor/patients" displayName={displayName} />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Back navigation ────────────────────────────────────────────── */}
        <Link
          href={`/doctor/patients/${patientId}`}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            minHeight:      '44px',
            fontSize:       '13px',
            color:          '#94A3B8',
            textDecoration: 'none',
            marginBottom:   '24px',
          }}
        >
          ← Back to Patient Profile
        </Link>

        {/* ── Page header ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontFamily:   'Georgia, serif',
              fontSize:     '22px',
              fontWeight:   '700',
              color:        '#F1F5F9',
              marginBottom: '6px',
              marginTop:    0,
            }}
          >
            Clinical Evidence Record
          </h1>
          <p
            style={{
              fontSize:     '13px',
              color:        '#94A3B8',
              marginBottom: '4px',
              marginTop:    0,
            }}
          >
            Physician-facing longitudinal documentation summary
          </p>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', marginBottom: 0 }}>
            {patientName} · {windowLabel} · Generated {generatedAt}
          </p>
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* EVIDENCE SUMMARY BAR                                            */}
        {/* 5-second physician orientation: trajectory · engagement ·       */}
        {/* adherence · last assessment · review status                     */}
        {/* Always shown. Stacks on mobile (flexWrap).                      */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div
          style={{
            background:    '#0D1421',
            border:        '1px solid #1A2744',
            borderRadius:  '16px',
            padding:       '20px 24px',
            marginBottom:  '16px',
            display:       'flex',
            flexWrap:      'wrap',
            gap:           '20px 32px',
          }}
        >
          {(
            [
              {
                label: 'Trajectory',
                value: formatStatus(record.trajectory.status),
              },
              {
                label: 'Engagement',
                value: formatStatus(record.continuity.status),
              },
              {
                label: 'Adherence',
                value: formatStatus(record.adherence.status),
              },
              {
                label: 'Last Assessment',
                value: lastAssessmentDisplay,
              },
              {
                label: 'Review Status',
                value: reviewSignalDisplay,
              },
            ] as const
          ).map(({ label, value }) => (
            <div key={label} style={{ minWidth: '130px', flex: '1 1 130px' }}>
              <p
                style={{
                  fontSize:      '11px',
                  fontWeight:    '700',
                  color:         '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom:  '5px',
                  marginTop:     0,
                }}
              >
                {label}
              </p>
              <p
                style={{
                  fontFamily:   'Georgia, serif',
                  fontSize:     '14px',
                  fontWeight:   '600',
                  color:        '#2DD4BF',
                  margin:       0,
                  lineHeight:   '1.3',
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!hasData && (
          <div
            style={{
              background:   '#0D1421',
              border:       '1px solid #1A2744',
              borderRadius: '16px',
              padding:      '32px 24px',
              marginBottom: '24px',
              textAlign:    'center',
            }}
          >
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6', margin: 0 }}>
              No longitudinal evidence is currently available for this observation window.
            </p>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 1 — Documentation Status                                */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div
          style={{
            background:   '#0D1421',
            border:       '1px solid #1A2744',
            borderRadius: '16px',
            padding:      '20px 24px',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              fontSize:      '11px',
              fontWeight:    '700',
              color:         '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom:  '16px',
              marginTop:     0,
            }}
          >
            Documentation Status
          </p>

          {/* Readiness label */}
          <p
            style={{
              fontFamily:   'Georgia, serif',
              fontSize:     '20px',
              fontWeight:   '700',
              color:        '#F1F5F9',
              marginBottom: '16px',
              marginTop:    0,
            }}
          >
            {readinessLabel}
          </p>

          {/* Readiness fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                label: 'Assessment Count',
                value: String(record.evidenceReadiness.assessmentCount),
              },
              {
                label: 'Weekly Check-ins',
                value: String(record.evidenceReadiness.checkinCount),
              },
              {
                label: 'Observation Window',
                value: windowLabel,
              },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                }}
              >
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>{item.label}</span>
                <span style={{ fontSize: '13px', color: '#F1F5F9', fontWeight: '500' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 2 — Patient Summary                                     */}
        {/* ──────────────────────────────────────────────────────────────── */}
        {hasData && (
          <div
            style={{
              background:   '#0D1421',
              border:       '1px solid #1A2744',
              borderRadius: '16px',
              padding:      '20px 24px',
              marginBottom: '16px',
            }}
          >
            <p
              style={{
                fontSize:      '11px',
                fontWeight:    '700',
                color:         '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom:  '16px',
                marginTop:     0,
              }}
            >
              Patient Summary
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Current SRI Band */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>Current SRI Band</span>
                <span style={{ fontSize: '13px', color: '#F1F5F9', fontWeight: '500' }}>
                  {record.patientSummary.currentBand ?? 'Not yet recorded'}
                </span>
              </div>

              {/* Protein Target */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>Protein Target</span>
                <span style={{ fontSize: '13px', color: '#F1F5F9', fontWeight: '500' }}>
                  {record.patientSummary.proteinTargetG != null
                    ? `${record.patientSummary.proteinTargetG}g/day`
                    : 'Not yet assigned'}
                </span>
              </div>

              {/* GLP-1 Stage — conditional */}
              {record.patientSummary.glp1Stage && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#94A3B8' }}>GLP-1 Stage</span>
                  <span style={{ fontSize: '13px', color: '#F1F5F9', fontWeight: '500' }}>
                    {record.patientSummary.glp1Stage}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 3 — Longitudinal Observations                           */}
        {/* Three signal cards: trajectory · continuity · adherence         */}
        {/* ──────────────────────────────────────────────────────────────── */}
        {hasData && (
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           '12px',
              marginBottom:  '16px',
            }}
          >
            {(
              [
                { label: 'Trajectory', signal: record.trajectory },
                { label: 'Continuity', signal: record.continuity },
                { label: 'Adherence',  signal: record.adherence  },
              ] as const
            ).map(({ label, signal }) => (
              <div
                key={label}
                style={{
                  background:   '#0D1421',
                  border:       '1px solid #1A2744',
                  borderRadius: '16px',
                  padding:      '20px 24px',
                }}
              >
                {/* Card header: label + confidence */}
                <div
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    marginBottom:   '10px',
                  }}
                >
                  <p
                    style={{
                      fontSize:      '11px',
                      fontWeight:    '700',
                      color:         '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      margin:        0,
                    }}
                  >
                    {label}
                  </p>
                  <span
                    style={{
                      fontSize:     '11px',
                      color:        '#94A3B8',
                      background:   'rgba(148,163,184,0.1)',
                      borderRadius: '99px',
                      padding:      '2px 8px',
                    }}
                  >
                    {formatConfidence(signal.confidence)}
                  </span>
                </div>

                {/* Status */}
                <p
                  style={{
                    fontSize:     '14px',
                    fontWeight:   '600',
                    color:        '#2DD4BF',
                    marginBottom: '8px',
                    marginTop:    0,
                  }}
                >
                  {formatStatus(signal.status)}
                </p>

                {/* Observation text */}
                <p
                  style={{
                    fontSize:   '13px',
                    color:      '#F1F5F9',
                    lineHeight: '1.6',
                    margin:     0,
                  }}
                >
                  {signal.observationText}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 4 — Physician Review Summary (collapsible)              */}
        {/* Collapsed by default. Client component handles toggle state.    */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '16px' }}>
          <PhysicianReviewSummaryCollapsible summary={reviewSummary} />
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* SECTION 5 — Documentation Timeline                              */}
        {/* DocumentationNote[] from PhysicianReview records, newest first. */}
        {/* Default: latest 3 entries. Toggle reveals earlier entries.      */}
        {/* DocumentationTimelineToggle handles expand state (client).      */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div
          style={{
            background:   '#0D1421',
            border:       '1px solid #1A2744',
            borderRadius: '16px',
            padding:      '20px 24px',
            marginBottom: '32px',
          }}
        >
          <p
            style={{
              fontSize:      '11px',
              fontWeight:    '700',
              color:         '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom:  '16px',
              marginTop:     0,
            }}
          >
            Documentation Timeline
          </p>

          {record.documentationNotes.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              No physician review documentation recorded within this observation window.
            </p>
          ) : (
            <DocumentationTimelineToggle notes={record.documentationNotes} />
          )}
        </div>

        {/* ── CDS footer ─────────────────────────────────────────────────── */}
        <p
          style={{
            fontSize:   '11px',
            color:      '#94A3B8',
            lineHeight: '1.7',
            textAlign:  'center',
            marginTop:  0,
          }}
        >
          MyoGuard Protocol · Physician-led Clinical Decision Support
          <br />
          All clinical observations are generated by the MyoGuard evidence engine
          and are observational only.
          <br />
          Clinical interpretation and all clinical decisions remain with the treating physician.
          <br />
          © 2026 Meridian Wellness Systems LLC · myoguard.health
        </p>

      </div>
    </main>
  );
}
