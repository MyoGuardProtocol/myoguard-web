// MyoGuard Insights Layer — Physician-Scoped Intelligence
//
// Computes an intelligence summary scoped to a given list of patient IDs.
// Used server-side in /doctor/patients and /doctor/dashboard to derive
// per-physician aggregates without calling the system-wide insight functions.
//
// Architecture:
//   Raw Data → Intelligence Layer → Scoped Physician Aggregation
//
// Called server-side only (Node.js / Prisma runtime).
// generatedAt is returned as an ISO string, safe to pass across the
// server/client boundary as a serialized prop.
//
// MyoGuard observes. MyoGuard does not predict.

import { getPatientIntelligenceSummary } from '@/src/lib/intelligence/synthesis';

// ─── Serialized types ─────────────────────────────────────────────────────────
//
// These mirror CohortInsightsSummary / ExecutiveInsights from the insights layer
// but with generatedAt as ISO string (safe to pass as RSC prop to client components).

export interface PhysicianScopedIntelligence {
  // Patient counts
  totalPatients:              number;
  patientsWithIntelligence:   number;
  patientsActive:             number;
  patientsConcern:            number;
  patientsRequiringAttention: number;
  patientsInsufficient:       number;

  // Review signals
  reviewRequiredCount:  number;
  reviewThresholdCount: number;

  // Engagement concerns
  inactiveCount:          number;
  persistentDeficitCount: number;

  // Signal distributions — exhaustive union member counts
  trajectoryDistribution: {
    stable:            number;
    positive_trend:    number;
    variable:          number;
    declining_trend:   number;
    insufficient_data: number;
  };
  continuityDistribution: {
    engaged:           number;
    inconsistent:      number;
    inactive:          number;
    insufficient_data: number;
  };
  adherenceDistribution: {
    target_achieved:    number;
    near_target:        number;
    persistent_deficit: number;
    insufficient_data:  number;
  };
  physicianSignalDistribution: {
    within_expected_range:    number;
    review_recommended:       number;
    review_threshold_crossed: number;
    continuity_concern:       number;
  };

  /** ISO string — serialized from new Date() at computation time */
  generatedAt: string;
}

export interface PhysicianExecutiveSummary {
  totalPatients:              number;
  patientsActive:             number;
  patientsRequiringAttention: number;
  reviewRequiredCount:        number;
  /** ISO string */
  generatedAt: string;
}

// ─── Zero-patient baseline ─────────────────────────────────────────────────────

export function emptyPhysicianScopedIntelligence(): PhysicianScopedIntelligence {
  return {
    totalPatients:              0,
    patientsWithIntelligence:   0,
    patientsActive:             0,
    patientsConcern:            0,
    patientsRequiringAttention: 0,
    patientsInsufficient:       0,
    reviewRequiredCount:        0,
    reviewThresholdCount:       0,
    inactiveCount:              0,
    persistentDeficitCount:     0,
    trajectoryDistribution: {
      stable:            0,
      positive_trend:    0,
      variable:          0,
      declining_trend:   0,
      insufficient_data: 0,
    },
    continuityDistribution: {
      engaged:           0,
      inconsistent:      0,
      inactive:          0,
      insufficient_data: 0,
    },
    adherenceDistribution: {
      target_achieved:    0,
      near_target:        0,
      persistent_deficit: 0,
      insufficient_data:  0,
    },
    physicianSignalDistribution: {
      within_expected_range:    0,
      review_recommended:       0,
      review_threshold_crossed: 0,
      continuity_concern:       0,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ─── Physician-scoped aggregation ─────────────────────────────────────────────

/**
 * computePhysicianScopedIntelligence()
 *
 * Accepts patient IDs already scoped to this physician's panel.
 * Runs getPatientIntelligenceSummary() concurrently for each ID, then
 * aggregates into a PhysicianScopedIntelligence summary.
 *
 * Mirrors getCohortInsights() from the cohort module, but operates on
 * a caller-provided ID set rather than fetching all PATIENT users.
 *
 * generatedAt returned as ISO string — safe to pass as serialized RSC prop.
 *
 * Called server-side only (Node.js runtime).
 * Read-only. No writes. No side effects.
 */
export async function computePhysicianScopedIntelligence(
  patientIds: string[],
): Promise<PhysicianScopedIntelligence> {
  if (patientIds.length === 0) return emptyPhysicianScopedIntelligence();

  const summaries = await Promise.all(
    patientIds.map(id => getPatientIntelligenceSummary(id)),
  );

  // ── Accumulator initialisation ─────────────────────────────────────────────
  const traj = { stable: 0, positive_trend: 0, variable: 0, declining_trend: 0, insufficient_data: 0 };
  const cont = { engaged: 0, inconsistent: 0, inactive: 0, insufficient_data: 0 };
  const adhr = { target_achieved: 0, near_target: 0, persistent_deficit: 0, insufficient_data: 0 };
  const phys = { within_expected_range: 0, review_recommended: 0, review_threshold_crossed: 0, continuity_concern: 0 };
  const over = { continuity_active: 0, continuity_concern: 0, continuity_at_risk: 0, insufficient_data: 0 };

  let patientsWithIntelligence = 0;
  let reviewRequiredCount      = 0;
  let reviewThresholdCount     = 0;
  let inactiveCount            = 0;
  let persistentDeficitCount   = 0;

  // ── Aggregation pass ───────────────────────────────────────────────────────
  for (const s of summaries) {
    if (s.overallContinuityStatus !== 'insufficient_data') patientsWithIntelligence++;

    over[s.overallContinuityStatus]++;
    traj[s.trajectory.status]++;
    cont[s.continuity.status]++;
    adhr[s.adherence.status]++;
    phys[s.physicianSignals.status]++;

    if (
      s.physicianSignals.status === 'review_threshold_crossed' ||
      s.physicianSignals.status === 'review_recommended'
    ) {
      reviewRequiredCount++;
    }
    if (s.physicianSignals.status === 'review_threshold_crossed') reviewThresholdCount++;
    if (s.continuity.status === 'inactive')                        inactiveCount++;
    if (s.adherence.status === 'persistent_deficit')               persistentDeficitCount++;
  }

  return {
    totalPatients:              patientIds.length,
    patientsWithIntelligence,
    patientsActive:             over.continuity_active,
    patientsConcern:            over.continuity_concern,
    patientsRequiringAttention: over.continuity_at_risk,
    patientsInsufficient:       over.insufficient_data,
    reviewRequiredCount,
    reviewThresholdCount,
    inactiveCount,
    persistentDeficitCount,
    trajectoryDistribution:      traj,
    continuityDistribution:      cont,
    adherenceDistribution:       adhr,
    physicianSignalDistribution: phys,
    generatedAt:                 new Date().toISOString(),
  };
}
