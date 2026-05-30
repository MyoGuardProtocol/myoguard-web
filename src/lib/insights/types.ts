// MyoGuard Insights Layer — Shared Types and Interfaces
//
// All insights are observational aggregates derived from the Intelligence Layer.
// No predictive claims. No diagnostic conclusions. No causal inference.
//
// Preferred vocabulary: observed, recorded, measured, aggregated, identified.
// Never: predicted, will, forecast, diagnostic, improving, deteriorating.
//
// Architecture:
//   Raw Data → Intelligence Layer → Insights Layer → InstitutionalInsightsSummary

import type {
  TrajectoryStatus,
  ContinuityStatus,
  AdherenceStatus,
  PhysicianSignalStatus,
  OverallContinuityStatus,
} from '../intelligence/types';

// ─── Status distribution maps ─────────────────────────────────────────────────
//
// Each distribution maps every known status value to a patient count.
// TypeScript enforces exhaustiveness — all union members must be present.

export type TrajectoryDistribution     = Record<TrajectoryStatus,      number>;
export type ContinuityDistribution     = Record<ContinuityStatus,      number>;
export type AdherenceDistribution      = Record<AdherenceStatus,       number>;
export type PhysicianSignalDistribution = Record<PhysicianSignalStatus, number>;
export type OverallContinuityDistribution = Record<OverallContinuityStatus, number>;

// ─── Cohort Insights ──────────────────────────────────────────────────────────

/**
 * CohortInsightsSummary
 *
 * System-wide aggregation of PatientIntelligenceSummary outputs across all patients.
 * All counts are observational — no predictive inference.
 *
 * Source: Intelligence Layer (getPatientIntelligenceSummary per patient, concurrent).
 * Justified raw access: one routing query to fetch patient IDs (no clinical fields).
 */
export interface CohortInsightsSummary {
  /** Total PATIENT users in the platform. */
  totalPatients: number;
  /** Patients with at least one actionable signal (overallContinuityStatus ≠ insufficient_data). */
  patientsWithIntelligence: number;

  // ── Overall continuity distribution ──
  overallDistribution: OverallContinuityDistribution;
  /** Patients observed at continuity_active status. */
  patientsActive: number;
  /** Patients observed at continuity_concern status. */
  patientsConcern: number;
  /** Patients identified at continuity_at_risk status — requiring attention. */
  patientsRequiringAttention: number;
  /** Patients with insufficient data across all signal dimensions. */
  patientsInsufficient: number;

  // ── Derived signal counts ──
  /** Patients with review_threshold_crossed OR review_recommended physician signal. */
  reviewRequiredCount: number;
  /** Patients with review_threshold_crossed signal specifically. */
  reviewThresholdCount: number;
  /** Patients with continuity status = inactive. */
  inactiveCount: number;
  /** Patients with adherence status = persistent_deficit. */
  persistentDeficitCount: number;

  // ── Signal distributions ──
  trajectoryDistribution:      TrajectoryDistribution;
  continuityDistribution:      ContinuityDistribution;
  adherenceDistribution:       AdherenceDistribution;
  physicianSignalDistribution: PhysicianSignalDistribution;
}

// ─── Physician Insights ───────────────────────────────────────────────────────

/**
 * PhysicianInsightsSummary
 *
 * System-wide aggregation of signal metrics across all patients assigned to a physician.
 * Represents the physician-patient relationship dimension of platform intelligence.
 *
 * Source: Intelligence Layer (getPatientIntelligenceSummary for assigned patients).
 * Justified raw accesses:
 *   (1) Count of PHYSICIAN role users — routing aggregate.
 *   (2) Patient IDs where physicianId IS NOT NULL — routing query, no clinical fields.
 */
export interface PhysicianInsightsSummary {
  /** Total users with role = PHYSICIAN. */
  activePhysicianCount: number;
  /** Patients who have a physician assigned (User.physicianId IS NOT NULL). */
  totalPatientsUnderCare: number;
  /** Patients with physician signal = review_threshold_crossed OR review_recommended. */
  patientsRequiringReview: number;
  /** Patients with physician signal = review_threshold_crossed specifically. */
  reviewThresholdCount: number;
  /** Patients with continuity status = inactive OR inconsistent. */
  engagementConcernCount: number;
  /** Patients with adherence status = persistent_deficit. */
  adherenceConcernCount: number;
  /** totalPatientsUnderCare / activePhysicianCount; 0 if no physicians. */
  averagePatientsPerPhysician: number;
}

// ─── Platform Insights ────────────────────────────────────────────────────────

/**
 * PlatformInsightsSummary
 *
 * Platform-level engagement and delivery metrics.
 * Derived from Notification records and raw engagement counts.
 *
 * These metrics represent infrastructure state — not clinical signals.
 * They are not derivable from the Intelligence Layer.
 * Direct Prisma access in platform.ts is the documented justified exception.
 *
 * All rates are expressed as percentages (0.0–100.0), rounded to one decimal place.
 */
export interface PlatformInsightsSummary {
  /** Total PATIENT users in the platform. */
  totalPatients: number;
  /** WEEKLY_REMINDER notifications recorded in the last 7 days. */
  weeklyReminderSentLast7Days: number;
  /** LONGITUDINAL_SUMMARY notifications recorded in the last 30 days. */
  longitudinalSummarySentLast30Days: number;
  /** PHYSICIAN_REVIEW notifications recorded in the last 30 days. */
  physicianReviewNotificationsLast30Days: number;
  /** Percentage of patients with at least one check-in recorded in the last 7 days. */
  weeklyCheckinRate: number;
  /** Percentage of patients with at least one assessment recorded in the last 30 days. */
  assessmentCompletionRate: number;
  /** Percentage of patients who received a LONGITUDINAL_SUMMARY in the last 30 days. */
  longitudinalParticipationRate: number;
}

// ─── Research Insights ────────────────────────────────────────────────────────

/**
 * ResearchInsightsSummary
 *
 * Aggregate observational study metrics across all ACTIVE studies.
 * Sourced via src/lib/research/cohort.ts — not raw Prisma directly.
 *
 * Justified raw accesses:
 *   (1) ACTIVE study IDs — routing query to identify which studies to aggregate.
 *   (2) StudyEnrollment.enrolledAt — metadata timestamp, not clinical signal data.
 *   (3) AssessmentSnapshot groupBy enrollmentId — snapshot count per enrollment.
 */
export interface ResearchInsightsSummary {
  /** Number of studies currently in ACTIVE status. */
  activeStudyCount: number;
  /** Sum of active enrollment counts across all ACTIVE studies. */
  activeCohortSize: number;
  /** Sum of totalEnrolled counts across all ACTIVE studies. */
  totalEnrolledAcrossStudies: number;
  /** Sum of withdrawal counts across all ACTIVE studies. */
  withdrawalCount: number;
  /** Sum of AssessmentSnapshot counts across all ACTIVE studies. */
  snapshotCount: number;
  /**
   * Average days since enrollment across all ACTIVE enrollments in ACTIVE studies.
   * Null when no active enrollments exist.
   */
  averageFollowUpDays: number | null;
  /**
   * Percentage of active enrollments with ≥2 snapshots (longitudinal data available).
   * 0 when no enrollments exist.
   */
  longitudinalParticipationRate: number;
}

// ─── Executive Insights ───────────────────────────────────────────────────────

/**
 * ExecutiveInsights
 *
 * High-level platform health indicators derived from all four insight categories.
 * No additional database queries — all values derived from already-computed outputs.
 *
 * Intended for institutional dashboards and operational health summaries.
 * Sources for each field are documented inline.
 */
export interface ExecutiveInsights {
  /** Source: cohort.totalPatients */
  totalPatients: number;
  /** Source: cohort.patientsActive (overallContinuityStatus = continuity_active) */
  activePatients: number;
  /** Source: cohort.reviewRequiredCount (review_threshold_crossed + review_recommended) */
  patientsRequiringReview: number;
  /** Source: physician.activePhysicianCount */
  activePhysicians: number;
  /** Source: research.activeCohortSize */
  activeCohortSize: number;
  /** Source: platform.weeklyCheckinRate */
  weeklyCheckinRate: number;
}

// ─── Institutional Insights Summary ──────────────────────────────────────────

/**
 * InstitutionalInsightsSummary
 *
 * Top-level aggregate output of the MyoGuard Insights Layer.
 * Combines all five insight categories into a single synthesised record.
 *
 * Architecture:
 *   Raw Data
 *   ↓ Intelligence Layer (src/lib/intelligence/)
 *   ↓ Insights Layer     (src/lib/insights/)
 *   └── InstitutionalInsightsSummary
 *       ├── executive   — derived from cohort + physician + platform + research
 *       ├── cohort      — system-wide signal distribution
 *       ├── physician   — physician-patient relationship metrics
 *       ├── platform    — delivery and engagement infrastructure metrics
 *       └── research    — observational study participation metrics
 *
 * Read-only. No side effects. No writes. No emails. No cron triggers.
 * Safe to call from server components and server-side API routes (Node.js runtime only).
 * Must NOT be called from client components or Edge runtime routes.
 */
export interface InstitutionalInsightsSummary {
  executive:   ExecutiveInsights;
  cohort:      CohortInsightsSummary;
  physician:   PhysicianInsightsSummary;
  platform:    PlatformInsightsSummary;
  research:    ResearchInsightsSummary;
  /** Timestamp of insight computation — not a clinical encounter timestamp. */
  generatedAt: Date;
}
