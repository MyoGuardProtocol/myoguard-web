import { RiskBand } from '@prisma/client';

// Fields that must never appear in any research export or publication dataset.
// Enforced at runtime by assertNoPhiInRow() before any CSV or JSON write.
export const PHI_FIELDS = [
  'patientId',
  'userId',
  'clerkId',
  'email',
  'fullName',
  'name',
  'ipAddress',
  'referralCode',
  'referralSlug',
  'stripeCustomerId',
  'stripeSubId',
  'physicianClerkId',
  'physicianId',
] as const;

export type PhiField = (typeof PHI_FIELDS)[number];

// ProgressLog is excluded from all research exports and publication datasets.
//
// Why: ProgressLog.notes is a free-text field with no structured schema or
// consent gate — it may contain patient-authored PHI. The model also duplicates
// WeeklyCheckin data at lower clinical fidelity, was not collected under
// structured study consent, and has no enrollment context (no studyId,
// enrollmentId, or researchParticipantId linkage).
//
// Exclusion is permanent for this phase. Any future inclusion requires a
// dedicated consent amendment and schema revision reviewed by Dr. Okpala.
export const PROGRESS_LOG_EXCLUSION_REASON =
  'ProgressLog contains free-text patient notes (PHI risk), is not collected ' +
  'under structured study consent, duplicates WeeklyCheckin data at lower clinical ' +
  'fidelity, and lacks enrollment context. Excluded from all research exports and ' +
  'publication datasets. Inclusion requires a consent amendment and schema revision.';

// ─── Quasi-identifier Bucketing ───────────────────────────────────────────────
// Weight and age are quasi-identifiers. When combined with sex they can narrow
// re-identification risk in small cohorts. Bucketing replaces precise values
// with bands before any publication or cross-institution export.

/**
 * Returns a 5 kg band string for a given weight.
 * Example: bucketWeight(72.3) → "70–75 kg"
 * Default band is 5 kg; narrow to 2 kg or widen to 10 kg for cohort size.
 */
export function bucketWeight(weightKg: number, bandKg = 5): string {
  const lower = Math.floor(weightKg / bandKg) * bandKg;
  return `${lower}–${lower + bandKg} kg`;
}

/**
 * Returns a 10-year age band string.
 * Example: bucketAge(43) → "40–49"
 * Consistent with standard epidemiological reporting conventions.
 */
export function bucketAge(age: number, bandYears = 10): string {
  const lower = Math.floor(age / bandYears) * bandYears;
  return `${lower}–${lower + bandYears - 1}`;
}

// ─── PHI Enforcement ──────────────────────────────────────────────────────────

/**
 * Throws if any PHI field is present in an export row object.
 * Use this as a hard gate before writing any row to CSV or JSON output.
 * Failures here indicate a programming error in the export pipeline.
 */
export function assertNoPhiInRow(row: Record<string, unknown>): void {
  for (const field of PHI_FIELDS) {
    if (field in row) {
      throw new Error(
        `[research:deidentify] PHI field "${field}" detected in export row. ` +
          'Remove it before export. See PHI_FIELDS in src/lib/research/deidentify.ts.'
      );
    }
  }
}

/**
 * Returns a new object with all PHI fields removed.
 * Non-throwing alternative to assertNoPhiInRow — use for defensive sanitisation
 * of untrusted inputs. Use assertNoPhiInRow in strict export pipelines.
 */
export function stripPhiFromRow(row: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!PHI_FIELDS.includes(key as PhiField)) {
      clean[key] = value;
    }
  }
  return clean;
}

// ─── Ordinal Encoding ─────────────────────────────────────────────────────────

/**
 * Maps RiskBand to a numeric ordinal for regression and trajectory analysis.
 * 1 = LOW … 4 = CRITICAL. Compatible with ordered logistic regression in R/Python.
 */
export const RISK_BAND_ORDINAL: Record<RiskBand, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};
