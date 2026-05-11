/**
 * src/lib/research/errors.ts
 *
 * Typed error classes for the MyoGuard Protocol observational study domain.
 *
 * LAYER: Shared Research Infrastructure.
 * This module has no UI surface, no API routes, and no PostHog calls.
 *
 * Governance mandate: all error context objects are PHI-safe.
 * patientId, userId, clerkId, email, fullName, and all other PHI fields
 * must never appear in the detail objects of these errors, as they may
 * be passed to structured loggers or propagated to error reporting.
 *
 * Use enrollmentId, studyId, and assessmentId (internal non-identifiable IDs)
 * for correlation. Never use patientId or clerkId in error context.
 */

// ─── Base ─────────────────────────────────────────────────────────────────────

/** Base class for all MyoGuard research-domain errors. */
export abstract class ResearchError extends Error {
  abstract readonly code: string;
  readonly domain = 'research' as const;

  constructor(message: string) {
    super(message);
    // Ensures instanceof checks work correctly after TypeScript transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Consent Errors ───────────────────────────────────────────────────────────

export interface ConsentErrorDetail {
  /** Effective consent version of the patient (null → treated as "0.0"). */
  effectiveVersion?: string;
  /** Minimum required version for enrollment. */
  requiredVersion?: string;
  /** Enrollment ID, if the error occurs in an enrollment context. */
  enrollmentId?: string;
  /** Study ID the consent was evaluated against. */
  studyId?: string;
}

/**
 * Thrown when a patient's consent version is insufficient for study enrollment,
 * or when User.researchConsent is false or null.
 *
 * Clinical access is unaffected. This error blocks research enrollment only.
 */
export class ResearchConsentError extends ResearchError {
  readonly code = 'RESEARCH_CONSENT_ERROR' as const;

  constructor(
    message: string,
    readonly detail?: ConsentErrorDetail,
  ) {
    super(message);
    this.name = 'ResearchConsentError';
  }
}

// ─── Enrollment Errors ────────────────────────────────────────────────────────

export interface EnrollmentErrorDetail {
  studyId?: string;
  enrollmentId?: string;
  /** Reason code describing why the enrollment was rejected. */
  reason?:
    | 'DUPLICATE_ENROLLMENT'
    | 'STUDY_NOT_ACTIVE'
    | 'PHYSICIAN_NOT_FOUND'
    | 'PATIENT_NOT_FOUND'
    | 'ACTOR_MISMATCH'
    | 'ROLE_VIOLATION';
}

/**
 * Thrown when enrollment creation fails due to a precondition violation.
 * Covers: duplicate enrollment, study not active, actor/role mismatch,
 * patient or physician not found.
 */
export class InvalidEnrollmentError extends ResearchError {
  readonly code = 'INVALID_ENROLLMENT_ERROR' as const;

  constructor(
    message: string,
    readonly detail?: EnrollmentErrorDetail,
  ) {
    super(message);
    this.name = 'InvalidEnrollmentError';
  }
}

// ─── Snapshot Errors ──────────────────────────────────────────────────────────

export interface SnapshotErrorDetail {
  assessmentId?: string;
  enrollmentId?: string;
  /** Original error message from the failed snapshot operation. */
  cause?: string;
}

/**
 * Thrown (or constructed for logging) when AssessmentSnapshot creation fails.
 *
 * NOTE: createAssessmentSnapshotNonBlocking() never throws — it catches all
 * errors internally and logs them. This error class is provided for structured
 * logging context and for any future blocking snapshot paths.
 *
 * Clinical Assessment persistence is NEVER interrupted by snapshot failures.
 */
export class SnapshotGenerationError extends ResearchError {
  readonly code = 'SNAPSHOT_GENERATION_ERROR' as const;

  constructor(
    message: string,
    readonly detail?: SnapshotErrorDetail,
  ) {
    super(message);
    this.name = 'SnapshotGenerationError';
  }
}

// ─── Study Status Errors ──────────────────────────────────────────────────────

export interface StudyStatusErrorDetail {
  studyId?: string;
  currentStatus?: string;
  requiredStatus?: string[];
  operation?: string;
}

/**
 * Thrown when an operation is attempted on a Study that is not in the required status.
 * Examples: enrolling into a DRAFT or ARCHIVED study, exporting a CLOSED study.
 */
export class StudyStatusError extends ResearchError {
  readonly code = 'STUDY_STATUS_ERROR' as const;

  constructor(
    message: string,
    readonly detail?: StudyStatusErrorDetail,
  ) {
    super(message);
    this.name = 'StudyStatusError';
  }
}

// ─── Export Errors ────────────────────────────────────────────────────────────

export interface ExportErrorDetail {
  studyId?: string;
  rowCount?: number;
  /** Column name that caused the export failure, if identifiable. */
  column?: string;
  cause?: string;
}

/**
 * Thrown when the CSV export pipeline fails for a reason other than PHI detection.
 * Examples: study not found, status does not permit export, row serialisation failure.
 */
export class ResearchExportError extends ResearchError {
  readonly code = 'RESEARCH_EXPORT_ERROR' as const;

  constructor(
    message: string,
    readonly detail?: ExportErrorDetail,
  ) {
    super(message);
    this.name = 'ResearchExportError';
  }
}

// ─── PHI Violation Errors ─────────────────────────────────────────────────────

export interface PhiViolationDetail {
  /**
   * The name of the field that triggered the PHI violation.
   * This is the key name, not the value — the value is never logged.
   */
  fieldName?: string;
  /** The module or function where the violation was detected. */
  location?: string;
}

/**
 * Thrown when a PHI field is detected in a research export row or log context.
 *
 * This error indicates a programming error in the export pipeline — it should
 * never occur in a correctly implemented pipeline. When it does occur:
 *   1. The export is aborted immediately.
 *   2. No partial CSV is returned to the caller.
 *   3. The violation is logged with the field name (never the field value).
 *
 * See assertNoPhiInRow() in deidentify.ts for the runtime enforcement mechanism.
 */
export class PhiViolationError extends ResearchError {
  readonly code = 'PHI_VIOLATION_ERROR' as const;

  constructor(
    message: string,
    readonly detail?: PhiViolationDetail,
  ) {
    super(message);
    this.name = 'PhiViolationError';
  }
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isResearchError(err: unknown): err is ResearchError {
  return err instanceof ResearchError;
}

export function isPhiViolationError(err: unknown): err is PhiViolationError {
  return err instanceof PhiViolationError;
}

export function isConsentError(err: unknown): err is ResearchConsentError {
  return err instanceof ResearchConsentError;
}
