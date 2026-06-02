// MyoGuard — Clinical Evidence Engine: Physician Review Summary
//
// Core principle:
// MyoGuard generates clinical evidence. The physician generates clinical decisions.
// Never cross that boundary. All outputs are observational. Never diagnostic.
// Never predictive. Never directive.
//
// Generates a 5-section physician-facing structured evidence document from a
// ClinicalEvidenceRecord. Structured for use in physician review workflows
// and as documentation support for clinical encounters.
//
// Pure function — no Prisma access, no UI, no client code.
//
// Sections:
//   1. Patient protocol context
//   2. Trajectory summary
//   3. Continuity and adherence
//   4. Physician signals
//   5. Documentation history

import type { ClinicalEvidenceRecord } from './types';

// ─── Output type ──────────────────────────────────────────────────────────────

export interface PhysicianReviewSummary {
  /** Protocol context: current band, GLP-1 stage, protein target, observation counts. */
  section1_protocolContext:       string;
  /** Band trajectory signal with confidence and data point count. */
  section2_trajectory:            string;
  /** Continuity and adherence signals with confidence. */
  section3_continuityAdherence:   string;
  /** Physician signals — review threshold and signal status. */
  section4_physicianSignals:      string;
  /** Physician review documentation history within the evidence window. */
  section5_documentationHistory:  string;
  /** Evidence readiness note — documentation maturity context only. */
  evidenceReadinessNote:          string;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * formatStatus()
 * Converts underscore_separated status strings to Title Case for display.
 * e.g. "positive_trend"        → "Positive Trend"
 * e.g. "within_expected_range" → "Within Expected Range"
 * Pure presentation — no logic change.
 */
function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * formatConfidence()
 * Converts confidence level strings to display form.
 * e.g. "high"             → "High Confidence"
 * e.g. "moderate"         → "Moderate Confidence"
 * e.g. "low"              → "Low Confidence"
 * e.g. "insufficient_data"→ "Insufficient Data"
 * Pure presentation — no logic change.
 */
function formatConfidence(confidence: string): string {
  if (confidence === 'insufficient_data') return 'Insufficient Data';
  const capitalised = confidence.charAt(0).toUpperCase() + confidence.slice(1);
  return `${capitalised} Confidence`;
}

// ─── Primary export ───────────────────────────────────────────────────────────

/**
 * generatePhysicianReviewSummary()
 *
 * Produces a 5-section structured evidence document from a ClinicalEvidenceRecord.
 * Each section is a plain-text string suitable for display, print, or export.
 *
 * All content is observational. No diagnostic, predictive, or directive language.
 * The evidenceReadinessNote describes documentation maturity only — not clinical judgment.
 */
export function generatePhysicianReviewSummary(
  record: ClinicalEvidenceRecord,
): PhysicianReviewSummary {
  const {
    patientSummary,
    trajectory,
    continuity,
    adherence,
    physicianSignals,
    documentationNotes,
    evidenceReadiness,
    windowDays,
  } = record;

  // ── Section 1 — Protocol context ──────────────────────────────────────────
  const contextParts: string[] = [
    patientSummary.currentBand
      ? `Current band: ${patientSummary.currentBand}.`
      : 'Current band: not yet recorded.',
    patientSummary.glp1Stage
      ? `GLP-1 stage: ${patientSummary.glp1Stage}.`
      : '',
    patientSummary.proteinTargetG
      ? `Protocol protein target: ${patientSummary.proteinTargetG}g.`
      : 'Protocol protein target: not yet assigned.',
    `Assessments within ${windowDays}-day window: ${patientSummary.assessmentCount}.`,
    `Check-ins within continuity window: ${patientSummary.checkinCount}.`,
  ].filter(Boolean);

  const section1_protocolContext = contextParts.join(' ');

  // ── Section 2 — Trajectory ────────────────────────────────────────────────
  const section2_trajectory = [
    `Band trajectory: ${formatStatus(trajectory.status)} (${formatConfidence(trajectory.confidence)}).`,
    trajectory.observationText,
    `${trajectory.dataPoints} assessment${trajectory.dataPoints !== 1 ? 's' : ''} within ${trajectory.windowDays}-day trajectory window.`,
  ].join(' ');

  // ── Section 3 — Continuity and adherence ─────────────────────────────────
  const section3_continuityAdherence = [
    `Continuity: ${formatStatus(continuity.status)} (${formatConfidence(continuity.confidence)}).`,
    continuity.observationText,
    `Adherence: ${formatStatus(adherence.status)} (${formatConfidence(adherence.confidence)}).`,
    adherence.observationText,
  ].join(' ');

  // ── Section 4 — Physician signals ────────────────────────────────────────
  const primarySignal = physicianSignals[0];
  const section4_physicianSignals = primarySignal
    ? [
        `Review signal: ${formatStatus(primarySignal.status)} (${formatConfidence(primarySignal.confidence)}).`,
        primarySignal.explanation,
      ].join(' ')
    : 'No physician signals recorded within the review window.';

  // ── Section 5 — Documentation history ────────────────────────────────────
  const section5_documentationHistory =
    documentationNotes.length === 0
      ? `No physician review documentation recorded within the ${windowDays}-day evidence window.`
      : documentationNotes
          .map((note, i) => {
            const dateLabel = new Date(note.noteDate).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            });
            const parts: string[] = [`Review ${i + 1} (${dateLabel}):`];
            if (note.overallImpression) parts.push(`Impression — ${note.overallImpression}.`);
            if (note.followUpDays)      parts.push(`Follow-up: ${note.followUpDays} days.`);
            if (note.note)             parts.push(`Note — ${note.note}.`);
            return parts.join(' ');
          })
          .join('\n');

  // ── Evidence readiness note ───────────────────────────────────────────────
  //
  // Evidence Readiness reflects documentation maturity only.
  // It is not a clinical judgment, recommendation, risk classification, or prediction.
  const readinessContext =
    evidenceReadiness.status === 'limited'
      ? 'Longitudinal documentation is limited. Additional observations will develop the evidence record.'
      : evidenceReadiness.status === 'developing'
      ? 'Longitudinal documentation is developing. Evidence record will mature with further observations.'
      : 'Sufficient longitudinal documentation is available for evidence record composition.';

  const evidenceReadinessNote = [
    `Documentation status: ${formatStatus(evidenceReadiness.status)}.`,
    `Based on ${evidenceReadiness.assessmentCount} assessment${evidenceReadiness.assessmentCount !== 1 ? 's' : ''}`,
    `and ${evidenceReadiness.checkinCount} check-in${evidenceReadiness.checkinCount !== 1 ? 's' : ''}.`,
    readinessContext,
  ].join(' ');

  return {
    section1_protocolContext,
    section2_trajectory,
    section3_continuityAdherence,
    section4_physicianSignals,
    section5_documentationHistory,
    evidenceReadinessNote,
  };
}
