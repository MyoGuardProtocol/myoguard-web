/**
 * src/lib/research/constants.ts
 *
 * Canonical constants for the MyoGuard Protocol observational study infrastructure.
 *
 * LAYER: Shared Research Infrastructure.
 * This module has no UI surface, no API routes, and no PostHog calls.
 *
 * Governance mandate: values in this file are the single source of truth.
 * Do not inline these values in service modules — import from here.
 * Version bumps to MIN_CONSENT_VERSION require physician governance review.
 */

import { StudyStatus, StudyEventType } from '@prisma/client';

// ─── Consent ──────────────────────────────────────────────────────────────────

/** Minimum study consent version accepted for enrollment. */
export const MIN_CONSENT_VERSION = '1.0' as const;

/**
 * Sentinel value used when User.consentVersion is null.
 * Treated as "0.0" in all consent gate comparisons — always below MIN_CONSENT_VERSION.
 * Null users are not blocked from clinical use; only research enrollment is gated.
 */
export const NULL_CONSENT_VERSION_SENTINEL = '0.0' as const;

// ─── Cohort Labels ────────────────────────────────────────────────────────────

/**
 * Canonical cohort segmentation labels for multi-arm observational studies.
 * These are advisory — StudyEnrollment.cohortLabel is a free-text field
 * and accepts any string. Use these for internal consistency across studies.
 */
export const COHORT_LABELS = {
  CONTROL: 'control',
  INTERVENTION: 'intervention',
  OBSERVATIONAL: 'observational',
  PILOT: 'pilot',
  HIGH_RISK: 'high-risk',
  STANDARD_CARE: 'standard-care',
  GLP1_INITIATION: 'glp1-initiation',
  GLP1_MAINTENANCE: 'glp1-maintenance',
  GLP1_DISCONTINUATION: 'glp1-discontinuation',
} as const;

export type CohortLabel = (typeof COHORT_LABELS)[keyof typeof COHORT_LABELS];

// ─── Export Settings ──────────────────────────────────────────────────────────

/**
 * Default weight bucket band size in kg.
 * Used by bucketWeight() in deidentify.ts when no override is provided.
 */
export const DEFAULT_WEIGHT_BAND_KG = 5;

/**
 * Narrow weight band for large cohorts (≥200 participants).
 * Provides better clinical granularity; re-identification risk acceptable at scale.
 */
export const LARGE_COHORT_WEIGHT_BAND_KG = 2;

/**
 * Wide weight band for small cohorts (<50 participants).
 * Reduces quasi-identifier re-identification risk in rare or narrow-eligibility studies.
 */
export const SMALL_COHORT_WEIGHT_BAND_KG = 10;

/**
 * Minimum cohort size threshold for publication-ready longitudinal exports.
 * Exports below this size should be reviewed for aggregate suppression before release.
 */
export const MIN_PUBLICATION_COHORT_SIZE = 10;

/** Maximum rows permitted in a single export call. Enforces query pagination contract. */
export const MAX_EXPORT_ROWS = 50_000;

// ─── SRI Export Naming ────────────────────────────────────────────────────────

/**
 * Normative export column label for the internal SRI numeric value.
 *
 * This label is frozen for downstream statistical tool compatibility (R, Python, SPSS).
 * Do not rename to 'sriScore', 'score', 'sri_score', or any other variant in any output.
 * See CSV_COLUMNS in export.ts — this constant must match that column name exactly.
 */
export const SRI_EXPORT_COLUMN_LABEL = 'sri_value_internal' as const;

/**
 * Normative SRI band column label for longitudinal exports.
 * Frozen alongside SRI_EXPORT_COLUMN_LABEL for statistical tool compatibility.
 */
export const SRI_BAND_COLUMN_LABEL = 'sri_band' as const;

/**
 * Normative methodology citation for the SRI in academic publications.
 * Use verbatim in methodology sections and supplementary material.
 *
 * Format: "MyoGuard Sarcopenia Risk Index (SRI), Meridian Wellness Systems LLC, 2026."
 */
export const SRI_METHODOLOGY_CITATION =
  'MyoGuard Sarcopenia Risk Index (SRI), Meridian Wellness Systems LLC, 2026.' as const;

// ─── Publication Attribution ──────────────────────────────────────────────────

export const PUBLICATION_ATTRIBUTION = {
  /** Legal entity name. Use in all citations, attributions, and methodology sections. */
  ENTITY_NAME: 'Meridian Wellness Systems LLC' as const,
  /** Platform name for attribution in publications and dataset acknowledgements. */
  PLATFORM_NAME: 'MyoGuard Protocol' as const,
  /** Canonical domain for methodology citations. */
  DOMAIN: 'myoguard.health' as const,
  /** Attribution year. Update annually for multi-year datasets. */
  YEAR: 2026,
  /**
   * Standard dataset acknowledgement string for publication supplementary material.
   * Append study-specific details (cohort size, date range) after this base string.
   */
  DATASET_ACKNOWLEDGEMENT:
    'Observational data collected via MyoGuard Protocol, Meridian Wellness Systems LLC (myoguard.health), 2026.' as const,
  /**
   * IP protection notice for methodology sections.
   * Include when the SRI computation is described in any published methodology.
   */
  IP_NOTICE:
    'The Sarcopenia Risk Index (SRI) methodology is proprietary to Meridian Wellness Systems LLC. ' +
    'Provisional intellectual property protection is associated with the SRI framework.',
} as const;

// ─── CDS Positioning ──────────────────────────────────────────────────────────

/**
 * Canonical Clinical Decision Support positioning strings.
 * Use these verbatim in any consent forms, study protocols, or publication disclosures
 * to maintain consistent regulatory and clinical positioning.
 */
export const CDS_POSITIONING = {
  CLASSIFICATION: 'Physician-led Clinical Decision Support (CDS)' as const,
  INSTRUMENT: 'Sarcopenia Risk Index (SRI)' as const,
  VALIDATION_STATUS: 'expert-consensus-framework' as const,
  /**
   * Mandatory disclaimer for any study protocol, consent form, or publication
   * that references MyoGuard outputs.
   */
  DISCLAIMER:
    'All outputs from MyoGuard Protocol are clinical decision support and do not constitute ' +
    'medical advice. Physician oversight is mandatory for all clinical applications. ' +
    'The Sarcopenia Risk Index (SRI) is an expert-consensus framework; it is not a ' +
    'validated diagnostic instrument.',
  /**
   * Required patient-facing consent positioning statement.
   * Must appear verbatim in any research consent UI.
   */
  PATIENT_CONSENT_POSITIONING:
    'MyoGuard Protocol is a physician-led Clinical Decision Support (CDS) platform. ' +
    'Participation in observational data collection is voluntary and does not affect your clinical care.',
} as const;

// ─── Study Lifecycle ──────────────────────────────────────────────────────────

/**
 * Study statuses that permit new patient enrollments.
 * Only ACTIVE studies may receive new enrollments.
 */
export const ENROLLMENT_PERMITTED_STATUSES: readonly StudyStatus[] = [
  StudyStatus.ACTIVE,
] as const;

/**
 * Study statuses that permit longitudinal data export for statistical analysis.
 * ACTIVE and COMPLETED studies may be exported.
 */
export const EXPORT_PERMITTED_STATUSES: readonly StudyStatus[] = [
  StudyStatus.ACTIVE,
  StudyStatus.CLOSED,
] as const;

/**
 * Terminal study statuses — no further state transitions are permitted.
 * Enrollments and exports associated with ARCHIVED studies require governance review.
 */
export const TERMINAL_STUDY_STATUSES: readonly StudyStatus[] = [
  StudyStatus.ARCHIVED,
] as const;

// ─── Event Type Classification ────────────────────────────────────────────────

/**
 * StudyEventType values that represent patient clinical trajectory events.
 * These events are linked to an enrollmentId and optionally a patientId.
 */
export const PATIENT_TRAJECTORY_EVENT_TYPES: readonly StudyEventType[] = [
  StudyEventType.ENROLLMENT,
  StudyEventType.REASSESSMENT,
  StudyEventType.ADHERENCE_CHECKPOINT,
  StudyEventType.WITHDRAWAL,
] as const;

/**
 * StudyEventType values that represent protocol or physician governance events.
 * These may be study-level (no enrollmentId) or enrollment-level.
 */
export const GOVERNANCE_EVENT_TYPES: readonly StudyEventType[] = [
  StudyEventType.PROTOCOL_MODIFICATION,
  StudyEventType.PHYSICIAN_REVIEW,
] as const;

// ─── Export Format ────────────────────────────────────────────────────────────

/** CSV line ending per RFC 4180. */
export const CSV_LINE_ENDING = '\n' as const;

/** MIME type for cohort CSV downloads. */
export const CSV_MIME_TYPE = 'text/csv; charset=utf-8' as const;

/** Filename prefix for cohort export downloads — append studyId and date before .csv. */
export const EXPORT_FILENAME_PREFIX = 'myoguard-cohort-export' as const;

// ─── Slug Convention ──────────────────────────────────────────────────────────

/**
 * Regex for valid study slugs.
 * Lowercase letters, digits, and hyphens only. No leading/trailing hyphens.
 * Example: "glp1-sarcopenia-2026"
 */
export const STUDY_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Maximum character length for a study slug.
 * Enforced at the application guard layer; no DB-level constraint.
 */
export const MAX_STUDY_SLUG_LENGTH = 64;
