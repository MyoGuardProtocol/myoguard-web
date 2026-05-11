/**
 * src/lib/research/export.ts
 *
 * De-identified CSV export pipeline for MyoGuard Protocol observational studies.
 *
 * LAYER: Publication/Export Infrastructure.
 * This module has no UI surface, no API routes, and no PostHog calls.
 *
 * Governance mandates enforced at every export:
 *   (1) researchParticipantId is the sole patient identifier in all output.
 *   (2) patientId, userId, clerkId, email, fullName are never in any row.
 *   (3) ipAddress is never in any row.
 *   (4) Raw weight is never exported — weight_band_kg replaces it (quasi-identifier mitigation).
 *   (5) ProgressLog is excluded from all exports (see EXCLUDED_MODELS for reason).
 *   (6) sriScore is exported under the column label "sri_value_internal" — never renamed.
 *   (7) assertNoPhiInRow() is called before every row write as a hard gate.
 *
 * Column order is normative (CSV_COLUMNS). Downstream tools (R, Python, SPSS)
 * are expected to consume this order. Do not reorder columns without updating
 * all statistical analysis scripts.
 */

import { prisma } from '../prisma';
import { EnrollmentStatus } from '@prisma/client';
import {
  bucketWeight,
  assertNoPhiInRow,
  PROGRESS_LOG_EXCLUSION_REASON,
} from './deidentify';
import { getSriTrajectory } from './cohort';
import type { SriTimepoint } from './cohort';

// ─── Column Registry ──────────────────────────────────────────────────────────

/**
 * Normative column order for all MyoGuard research CSV exports.
 * Order is frozen. Add new columns at the end only, with a migration note.
 *
 * "sri_value_internal" is the mandated export label for the internal SRI score.
 * It must never be renamed to "sriScore", "score", or "sri_score" in any output.
 */
export const CSV_COLUMNS = [
  'participant_id',      // researchParticipantId — UUID v4, sole patient identifier
  'study_id',            // Study reference — safe to include (not patient-identifiable)
  'cohort_label',        // Optional cohort segmentation label
  'enrollment_date',     // YYYY-MM-DD — date only, no time component
  'timepoint',           // Ordinal within enrollment: 1, 2, 3 …
  'snapshot_date',       // YYYY-MM-DD — date of AssessmentSnapshot creation
  'sri_band',            // LOW | MODERATE | HIGH | CRITICAL
  'sri_value_internal',  // Internal SRI numeric output — NEVER renamed in exports
  'protein_target_g',    // Prescribed protein target (g/day)
  'hydration_target_l',  // Prescribed hydration target (litres/day)
  'activity_status',     // SEDENTARY | LIGHTLY_ACTIVE | MODERATELY_ACTIVE | VERY_ACTIVE
  'gi_tolerance',        // none | mild | moderate | severe (nullable)
  'sleep_quality',       // 1–5 self-reported (nullable)
  'grip_strength_kg',    // Dynamometer reading (nullable)
  'glp1_stage',          // INITIATION | DOSE_ESCALATION | MAINTENANCE | DISCONTINUATION (nullable)
  'weight_band_kg',      // Bucketed weight band — NOT raw weight (quasi-identifier mitigation)
  'symptoms',            // JSON array of structured codes — no free-text PHI
  'interval_days',       // Days since previous snapshot; null for first timepoint
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];
export type ExportRow = Record<CsvColumn, string | number | null>;

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ExportOptions {
  /**
   * Include enrollments with WITHDRAWN status in the export.
   * Previously collected snapshots for withdrawn participants are preserved
   * per the immutability contract. Default: false (ACTIVE only).
   */
  includeWithdrawn?: boolean;
  /** Include enrollments with COMPLETED status. Default: false. */
  includeCompleted?: boolean;
  /**
   * Weight bucket band size in kg. Default: 5.
   * Narrow to 2 kg for large cohorts; widen to 10 kg for small cohorts
   * where 5 kg buckets increase re-identification risk.
   */
  weightBandKg?: number;
}

// ─── Excluded Data Sources ────────────────────────────────────────────────────

/**
 * Documents data sources that are intentionally excluded from all research exports.
 * This object is the canonical reference for exclusion decisions.
 * See deidentify.ts for the full exclusion reasoning per model.
 */
export const EXCLUDED_MODELS = {
  ProgressLog: PROGRESS_LOG_EXCLUSION_REASON,
} as const;

// ─── Internal Utilities ───────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function escapeCsvCell(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // RFC 4180: wrap in double-quotes if the value contains comma, quote, or newline.
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildExportRow(
  participantId: string,
  studyId: string,
  cohortLabel: string | null,
  enrolledAt: Date,
  timepoint: SriTimepoint,
  options: ExportOptions
): ExportRow {
  const row: ExportRow = {
    participant_id: participantId,
    study_id: studyId,
    cohort_label: cohortLabel,
    enrollment_date: formatDate(enrolledAt),
    timepoint: timepoint.timepoint,
    snapshot_date: formatDate(timepoint.snapshotDate),
    sri_band: timepoint.sri_band,
    sri_value_internal: timepoint.sri_value_internal,
    protein_target_g: timepoint.proteinTargetG,
    hydration_target_l: timepoint.hydrationTargetL,
    activity_status: timepoint.activityStatus,
    gi_tolerance: timepoint.giTolerance,
    sleep_quality: timepoint.sleepQuality,
    grip_strength_kg: timepoint.gripStrengthKg,
    glp1_stage: timepoint.glp1Stage,
    // Raw weightKg is replaced by a bucketed band to mitigate quasi-identifier risk.
    weight_band_kg: bucketWeight(timepoint.weightKg, options.weightBandKg),
    symptoms:
      typeof timepoint.symptoms === 'string'
        ? timepoint.symptoms
        : JSON.stringify(timepoint.symptoms ?? []),
    interval_days: timepoint.intervalDays,
  };

  // Hard gate: throws if any PHI field slipped into the row.
  // This should never fire in production — it indicates a programming error upstream.
  assertNoPhiInRow(row as unknown as Record<string, unknown>);

  return row;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a set of ExportRows to a RFC 4180-compliant CSV string.
 * Header row uses the normative CSV_COLUMNS order.
 * Suitable for direct download response or file write.
 */
export function toCsv(rows: ExportRow[]): string {
  const header = CSV_COLUMNS.join(',');
  const dataRows = rows.map((row) =>
    CSV_COLUMNS.map((col) => escapeCsvCell(row[col])).join(',')
  );
  return [header, ...dataRows].join('\n');
}

/**
 * Exports a full de-identified longitudinal dataset for a study cohort as CSV.
 *
 * Pipeline:
 *   1. Fetch enrollments by studyId and status filter.
 *   2. For each enrollment, fetch the full SRI trajectory via getSriTrajectory().
 *   3. Build an ExportRow per timepoint, replacing raw weight with a bucketed band.
 *   4. Assert no PHI in each row before it enters the output buffer.
 *   5. Serialize to CSV with normative column order.
 *
 * Exclusions enforced:
 *   - patientId, userId, clerkId, email, fullName: never in output (PHI_FIELDS gate)
 *   - ipAddress: never in output (not in ExportRow type; PHI_FIELDS gate as backup)
 *   - ProgressLog: excluded entirely (see EXCLUDED_MODELS.ProgressLog)
 *   - Raw weight: replaced by weight_band_kg
 *   - sriScore column: exported as "sri_value_internal" per governance mandate
 *
 * By default, only ACTIVE enrollments are exported. Pass options.includeWithdrawn
 * or options.includeCompleted to include those cohorts.
 *
 * @param studyId  - The Study.id to export.
 * @param options  - Export configuration (status filter, weight band size).
 * @returns        - RFC 4180 CSV string with header row.
 */
export async function exportStudyCohort(
  studyId: string,
  options: ExportOptions = {}
): Promise<string> {
  const statusFilter: EnrollmentStatus[] = [EnrollmentStatus.ACTIVE];
  if (options.includeWithdrawn) statusFilter.push(EnrollmentStatus.WITHDRAWN);
  if (options.includeCompleted) statusFilter.push(EnrollmentStatus.COMPLETED);

  const enrollments = await prisma.studyEnrollment.findMany({
    where: {
      studyId,
      status: { in: statusFilter },
    },
    orderBy: { enrolledAt: 'asc' },
  });

  const rows: ExportRow[] = [];

  for (const enrollment of enrollments) {
    const trajectory = await getSriTrajectory(enrollment.id);

    for (const tp of trajectory) {
      rows.push(
        buildExportRow(
          enrollment.researchParticipantId,
          enrollment.studyId,
          enrollment.cohortLabel,
          enrollment.enrolledAt,
          tp,
          options
        )
      );
    }
  }

  return toCsv(rows);
}
