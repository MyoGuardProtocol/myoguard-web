// MyoGuard — Clinical Evidence Engine: Continuity Report
//
// Core principle:
// MyoGuard generates clinical evidence. The physician generates clinical decisions.
// Never cross that boundary. All outputs are observational. Never diagnostic.
// Never predictive. Never directive.
//
// Generates a structured continuity report object from a ClinicalEvidenceRecord.
// Surfaces continuity and adherence signal dimensions as a flat, portable structure
// suitable for physician review, registry reporting, and future EHR integration.
//
// Pure function — no Prisma access, no UI, no client code.

import type { ClinicalEvidenceRecord } from './types';

// ─── Output type ──────────────────────────────────────────────────────────────

export interface ContinuityReport {
  /** Observation window in days for this report. */
  windowDays:              number;
  /** Continuity signal status from the intelligence layer. */
  continuityStatus:        string;
  /** Confidence level for the continuity signal. */
  continuityConfidence:    string;
  /** Adherence signal status from the intelligence layer. */
  adherenceStatus:         string;
  /** Confidence level for the adherence signal. */
  adherenceConfidence:     string;
  /** Composite continuity status across all signal dimensions. */
  overallContinuityStatus: string;
  /** Number of check-ins within the continuity observation window. */
  checkinCount:            number;
  /** Plain-text observational summary combining all continuity dimensions. */
  observationSummary:      string;
}

// ─── Primary export ───────────────────────────────────────────────────────────

/**
 * generateContinuityReport()
 *
 * Produces a structured continuity report from a ClinicalEvidenceRecord.
 * All fields are observational. The observationSummary is plain text
 * suitable for documentation support and export surfaces.
 *
 * This report does not contain protocol context or trajectory data —
 * for the full evidence document see generatePhysicianReviewSummary().
 */
export function generateContinuityReport(
  record: ClinicalEvidenceRecord,
): ContinuityReport {
  const { continuity, adherence, overallContinuityStatus, patientSummary, windowDays } = record;

  const observationSummary = [
    `Continuity observed as "${continuity.status}" over ${continuity.windowDays} days.`,
    `Adherence observed as "${adherence.status}" over ${adherence.windowDays} days.`,
    `Overall continuity status: ${overallContinuityStatus}.`,
    `${patientSummary.checkinCount} check-in${patientSummary.checkinCount !== 1 ? 's' : ''} recorded within the continuity window.`,
  ].join(' ');

  return {
    windowDays,
    continuityStatus:        continuity.status,
    continuityConfidence:    continuity.confidence,
    adherenceStatus:         adherence.status,
    adherenceConfidence:     adherence.confidence,
    overallContinuityStatus: overallContinuityStatus as string,
    checkinCount:            patientSummary.checkinCount,
    observationSummary,
  };
}
