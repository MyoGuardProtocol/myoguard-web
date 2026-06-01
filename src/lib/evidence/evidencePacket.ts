// MyoGuard — Clinical Evidence Engine: Evidence Packet
//
// Core principle:
// MyoGuard generates clinical evidence. The physician generates clinical decisions.
// Never cross that boundary. All outputs are observational. Never diagnostic.
// Never predictive. Never directive.
//
// PRIMARY ENTRY POINT for the evidence layer.
//
// This is the ONLY file in src/lib/evidence/ that accesses Prisma.
// All other files in this directory are pure functions that accept
// a ClinicalEvidenceRecord and return derived structures.
//
// Architecture:
//   1. Calls getPatientIntelligenceSummary() — the single intelligence source.
//      No signal logic is re-derived here; the intelligence layer owns all signals.
//   2. Queries Prisma for evidence window data: assessments, check-ins,
//      physician reviews, protocol plan, research enrollment.
//   3. Maps intelligence signals + Prisma data → ClinicalEvidenceRecord.
//
// BUILD 5E CONNECTION:
//   generateClinicalEvidenceRecord() is the server-side data source for the
//   physician-facing evidence surface planned in BUILD 5E (clinical evidence UI).
//   No UI, routes, or client code belongs in this file.
//
// DO NOT:
//   - Alter protocolEngine.ts
//   - Alter SRI calculations
//   - Alter intelligence layer signal logic
//   - Introduce reimbursement or billing calculations
//   - Add new PrismaClient() — use singleton from @/src/lib/prisma

import { prisma }                        from '@/src/lib/prisma';
import { getPatientIntelligenceSummary } from '@/src/lib/intelligence/synthesis';
import { INTELLIGENCE_WINDOWS }          from '@/src/lib/intelligence/types';
import { generateLongitudinalNarrative } from './longitudinalSummary';
import type {
  ClinicalEvidenceRecord,
  EvidenceGovernance,
  EvidenceReadiness,
  EvidenceSummary,
  DocumentationNote,
  PatientSummary,
  ExportMetadata,
  IntelligenceSignal,
  ConfidenceLevel,
} from './types';

// ─── Internal constants ───────────────────────────────────────────────────────

/** Default evidence observation window. Aligns with TRAJECTORY_WINDOW_DAYS. */
const DEFAULT_WINDOW_DAYS = 90;

// Protocol and intelligence layer version placeholders.
// TODO(BUILD 6A): Source protocolVersion from package.json or protocolEngine.ts version export.
// TODO(BUILD 6A): Source intelligenceVersion from a dedicated version constant in src/lib/intelligence/.
const PROTOCOL_VERSION      = '1.0.0';
const INTELLIGENCE_VERSION  = '1.0.0';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * deriveEvidenceReadiness()
 *
 * Evidence Readiness reflects documentation maturity only.
 * It is not a clinical judgment, recommendation, risk classification, or prediction.
 *
 *   limited:     0–1 assessments
 *   developing:  2 assessments
 *   sufficient:  3+ assessments
 *
 * assessmentCount is the primary determinant. checkinCount is informational.
 */
function deriveEvidenceReadiness(
  assessmentCount: number,
  checkinCount:    number,
): EvidenceReadiness {
  const status =
    assessmentCount >= 3 ? 'sufficient'  :
    assessmentCount === 2 ? 'developing' :
    'limited';

  return { status, assessmentCount, checkinCount };
}

/**
 * toEvidenceSummary()
 *
 * Maps an IntelligenceSignal + data-point context → EvidenceSummary.
 * The intelligence layer explanation becomes observationText verbatim.
 * No transformation of status or explanation is performed here.
 */
function toEvidenceSummary(
  signal:     IntelligenceSignal,
  dataPoints: number,
  windowDays: number,
): EvidenceSummary {
  return {
    status:          signal.status,
    confidence:      signal.confidence as ConfidenceLevel,
    observationText: signal.explanation,
    dataPoints,
    windowDays,
  };
}

// ─── Public options ───────────────────────────────────────────────────────────

export interface GenerateEvidenceOptions {
  /**
   * Observation window in days. Defaults to 90 (TRAJECTORY_WINDOW_DAYS).
   * Shorter windows produce lower-confidence evidence summaries.
   */
  windowDays?: number;
  /**
   * When true, queries StudyEnrollment to resolve researchParticipantId.
   * Set to true only when the consuming context requires research export eligibility.
   * Defaults to false to avoid unnecessary DB queries on every physician view.
   */
  includeResearchData?: boolean;
}

// ─── Primary entry point ──────────────────────────────────────────────────────

/**
 * generateClinicalEvidenceRecord()
 *
 * Generates a ClinicalEvidenceRecord for a patient under a specific physician.
 *
 * This function:
 *   - Calls getPatientIntelligenceSummary() for all intelligence signals
 *   - Queries Prisma for evidence window data (assessments, check-ins, reviews)
 *   - Derives EvidenceReadiness, EvidenceGovernance, and ExportMetadata
 *   - Composes the longitudinal narrative via generateLongitudinalNarrative()
 *   - Returns a fully formed ClinicalEvidenceRecord
 *
 * All outputs are observational. No diagnostic or predictive claims.
 *
 * @param patientId    — User.id of the patient (internal only; never in exports)
 * @param physicianId  — User.id of the requesting physician
 * @param options      — Window configuration and research data flag
 */
export async function generateClinicalEvidenceRecord(
  patientId:   string,
  physicianId: string,
  options?:    GenerateEvidenceOptions,
): Promise<ClinicalEvidenceRecord> {
  const windowDays          = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const includeResearchData = options?.includeResearchData ?? false;

  const now          = Date.now();
  const generatedAt  = new Date(now).toISOString();
  const windowStart  = new Date(now - windowDays * 24 * 60 * 60 * 1000);

  // Continuity window is shorter than the full evidence window.
  const continuityWindowStart = new Date(
    now - INTELLIGENCE_WINDOWS.CONTINUITY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // ── 1. Intelligence signals ───────────────────────────────────────────────
  //
  // The intelligence layer is the single source of truth for all signal computation.
  // We do not re-query or re-derive signals here — we consume and document them.
  const intelligence = await getPatientIntelligenceSummary(patientId);

  // ── 2. Prisma queries (concurrent) ───────────────────────────────────────
  const [assessments, checkins, physicianReviews, patientProfile, researchEnrollment] =
    await Promise.all([

      // Assessments within the evidence window, newest first.
      prisma.assessment.findMany({
        where:   { userId: patientId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        include: { muscleScore: true },
      }),

      // Weekly check-ins within the continuity window.
      prisma.weeklyCheckin.findMany({
        where:   { userId: patientId, createdAt: { gte: continuityWindowStart } },
        orderBy: { createdAt: 'desc' },
      }),

      // Physician review documentation within the evidence window.
      prisma.physicianReview.findMany({
        where:   { userId: patientId, reviewedAt: { gte: windowStart } },
        orderBy: { reviewedAt: 'desc' },
      }),

      // UserProfile for GLP-1 stage context.
      prisma.userProfile.findUnique({
        where:  { userId: patientId },
        select: { glp1Stage: true },
      }).catch(() => null),

      // StudyEnrollment — only when research data is requested.
      includeResearchData
        ? prisma.studyEnrollment.findFirst({
            where:  { patientId, status: 'ACTIVE' },
            select: { researchParticipantId: true },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

  // ── 3. Patient summary ────────────────────────────────────────────────────
  const latestAssessment  = assessments[0] ?? null;
  const latestMuscleScore = latestAssessment?.muscleScore ?? null;

  const patientSummary: PatientSummary = {
    currentBand:     latestMuscleScore?.riskBand    ?? null,
    glp1Stage:       patientProfile?.glp1Stage      ? String(patientProfile.glp1Stage) : null,
    proteinTargetG:  latestMuscleScore?.proteinTargetG ?? null,
    assessmentCount: assessments.length,
    checkinCount:    checkins.length,
  };

  // ── 4. Evidence readiness ─────────────────────────────────────────────────
  const evidenceReadiness = deriveEvidenceReadiness(
    assessments.length,
    checkins.length,
  );

  // ── 5. Evidence summaries (mapped from intelligence signals) ──────────────
  const trajectory = toEvidenceSummary(
    intelligence.trajectory,
    assessments.length,
    INTELLIGENCE_WINDOWS.TRAJECTORY_WINDOW_DAYS,
  );

  const continuity = toEvidenceSummary(
    intelligence.continuity,
    checkins.length,
    INTELLIGENCE_WINDOWS.CONTINUITY_WINDOW_DAYS,
  );

  // Adherence data points: check-ins where proteinAdherence was recorded.
  const adherenceDataPoints = checkins.filter(c => c.proteinAdherence !== null).length;
  const adherence = toEvidenceSummary(
    intelligence.adherence,
    adherenceDataPoints,
    INTELLIGENCE_WINDOWS.ADHERENCE_WINDOW_DAYS,
  );

  // PhysicianSignal is a single object in PatientIntelligenceSummary.
  // The evidence layer represents physician signals as an array for extensibility.
  const physicianSignals: IntelligenceSignal[] = [intelligence.physicianSignals];

  // ── 6. Documentation notes (from PhysicianReview records) ─────────────────
  const documentationNotes: DocumentationNote[] = physicianReviews.map(review => ({
    noteDate:          review.reviewedAt.toISOString(),
    assessmentId:      review.assessmentId,
    overallImpression: review.overallImpression ?? null,
    followUpDays:      review.followUpDays      ?? null,
    note:              review.note              ?? null,
  }));

  // ── 7. Longitudinal narrative ─────────────────────────────────────────────
  const longitudinalNarrative = generateLongitudinalNarrative(
    trajectory,
    continuity,
    adherence,
    physicianSignals,
    windowDays,
  );

  // ── 8. Export metadata ────────────────────────────────────────────────────
  const researchParticipantId =
    researchEnrollment?.researchParticipantId ?? null;

  const exportMetadata: ExportMetadata = {
    supportsPhysicianReport: true,
    supportsResearchExport:  !!researchParticipantId,
    supportsEHRExport:       false,   // BUILD 6A
    researchParticipantId,
  };

  // ── 9. Evidence governance ────────────────────────────────────────────────
  const evidenceGovernance: EvidenceGovernance = {
    generatedBy:         'myoguard_evidence_engine',
    generatedAt,
    protocolVersion:     PROTOCOL_VERSION,
    intelligenceVersion: INTELLIGENCE_VERSION,
  };

  // ── 10. Assemble and return ClinicalEvidenceRecord ────────────────────────
  return {
    patientId,
    physicianId,
    windowDays,
    generatedAt,
    evidenceGovernance,
    evidenceReadiness,
    patientSummary,
    trajectory,
    continuity,
    adherence,
    physicianSignals,
    overallContinuityStatus: intelligence.overallContinuityStatus,
    longitudinalNarrative,
    documentationNotes,
    exportMetadata,
  };
}
