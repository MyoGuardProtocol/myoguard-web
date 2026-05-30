// MyoGuard Insights Layer — Cohort Insights
//
// Aggregates PatientIntelligenceSummary outputs across all patients to produce
// system-wide signal distributions and continuity counts.
//
// Architecture: Raw Data → Intelligence Layer → Cohort Insights
//
// Justified raw data access: one routing query to fetch PATIENT user IDs.
// No clinical fields are read directly — all signal computation is delegated
// to the Intelligence Layer via getPatientIntelligenceSummary().
//
// MyoGuard observes. MyoGuard does not predict.

import { prisma }                       from '@/src/lib/prisma';
import { getPatientIntelligenceSummary } from '@/src/lib/intelligence/synthesis';
import type {
  CohortInsightsSummary,
  TrajectoryDistribution,
  ContinuityDistribution,
  AdherenceDistribution,
  PhysicianSignalDistribution,
  OverallContinuityDistribution,
} from './types';

// ─── Distribution initialisers ─────────────────────────────────────────────────
//
// TypeScript-exhaustive initialisers: every union member is explicitly set to 0.
// If a new status is added to the intelligence types, the build will catch the gap here.

function emptyOverallDistribution(): OverallContinuityDistribution {
  return {
    continuity_active:  0,
    continuity_concern: 0,
    continuity_at_risk: 0,
    insufficient_data:  0,
  };
}

function emptyTrajectoryDistribution(): TrajectoryDistribution {
  return {
    stable:            0,
    positive_trend:    0,
    variable:          0,
    declining_trend:   0,
    insufficient_data: 0,
  };
}

function emptyContinuityDistribution(): ContinuityDistribution {
  return {
    engaged:           0,
    inconsistent:      0,
    inactive:          0,
    insufficient_data: 0,
  };
}

function emptyAdherenceDistribution(): AdherenceDistribution {
  return {
    target_achieved:    0,
    near_target:        0,
    persistent_deficit: 0,
    insufficient_data:  0,
  };
}

function emptyPhysicianSignalDistribution(): PhysicianSignalDistribution {
  return {
    within_expected_range:   0,
    review_recommended:      0,
    review_threshold_crossed: 0,
    continuity_concern:       0,
  };
}

// ─── Zero-patient baseline ────────────────────────────────────────────────────

function emptyCohortInsights(): CohortInsightsSummary {
  return {
    totalPatients:           0,
    patientsWithIntelligence: 0,
    overallDistribution:     emptyOverallDistribution(),
    patientsActive:          0,
    patientsConcern:         0,
    patientsRequiringAttention: 0,
    patientsInsufficient:    0,
    reviewRequiredCount:     0,
    reviewThresholdCount:    0,
    inactiveCount:           0,
    persistentDeficitCount:  0,
    trajectoryDistribution:      emptyTrajectoryDistribution(),
    continuityDistribution:      emptyContinuityDistribution(),
    adherenceDistribution:       emptyAdherenceDistribution(),
    physicianSignalDistribution: emptyPhysicianSignalDistribution(),
  };
}

// ─── Insight computation ──────────────────────────────────────────────────────

/**
 * getCohortInsights()
 *
 * Fetches all PATIENT user IDs, runs getPatientIntelligenceSummary() for each
 * concurrently via Promise.all(), then aggregates into a CohortInsightsSummary.
 *
 * Raw data access: one routing query (User.id only — no clinical fields).
 * All clinical signal computation is delegated to the Intelligence Layer.
 *
 * Performance note: Promise.all() runs all patient intelligence computations
 * concurrently. For large patient populations this maximises throughput but
 * increases simultaneous database connections. Acceptable at current platform scale.
 *
 * Note: Patients assigned to a physician will also appear in getPhysicianInsights().
 * The double computation is a known trade-off for clean module separation.
 * Both calls run concurrently in the synthesis layer via Promise.all().
 *
 * Read-only. No writes. No side effects.
 */
export async function getCohortInsights(): Promise<CohortInsightsSummary> {
  // Routing query — IDs only; no clinical fields
  const patients = await prisma.user.findMany({
    where:  { role: 'PATIENT' },
    select: { id: true },
  });

  const totalPatients = patients.length;
  if (totalPatients === 0) return emptyCohortInsights();

  // Concurrent intelligence computation across all patients
  const summaries = await Promise.all(
    patients.map(p => getPatientIntelligenceSummary(p.id)),
  );

  // ── Accumulator initialisation ─────────────────────────────────────────────
  const overallDist    = emptyOverallDistribution();
  const trajectoryDist = emptyTrajectoryDistribution();
  const continuityDist = emptyContinuityDistribution();
  const adherenceDist  = emptyAdherenceDistribution();
  const physicianDist  = emptyPhysicianSignalDistribution();

  let patientsWithIntelligence = 0;
  let reviewRequiredCount      = 0;
  let reviewThresholdCount     = 0;
  let inactiveCount            = 0;
  let persistentDeficitCount   = 0;

  // ── Aggregation pass ───────────────────────────────────────────────────────
  for (const s of summaries) {
    // Patients with actionable intelligence (at least one dimension has data)
    if (s.overallContinuityStatus !== 'insufficient_data') {
      patientsWithIntelligence++;
    }

    // Distribute across all status dimensions
    overallDist[s.overallContinuityStatus]++;
    trajectoryDist[s.trajectory.status]++;
    continuityDist[s.continuity.status]++;
    adherenceDist[s.adherence.status]++;
    physicianDist[s.physicianSignals.status]++;

    // Derived clinical signal counts
    if (
      s.physicianSignals.status === 'review_threshold_crossed' ||
      s.physicianSignals.status === 'review_recommended'
    ) {
      reviewRequiredCount++;
    }
    if (s.physicianSignals.status === 'review_threshold_crossed') {
      reviewThresholdCount++;
    }
    if (s.continuity.status === 'inactive') {
      inactiveCount++;
    }
    if (s.adherence.status === 'persistent_deficit') {
      persistentDeficitCount++;
    }
  }

  return {
    totalPatients,
    patientsWithIntelligence,
    overallDistribution:   overallDist,
    patientsActive:        overallDist.continuity_active,
    patientsConcern:       overallDist.continuity_concern,
    patientsRequiringAttention: overallDist.continuity_at_risk,
    patientsInsufficient:  overallDist.insufficient_data,
    reviewRequiredCount,
    reviewThresholdCount,
    inactiveCount,
    persistentDeficitCount,
    trajectoryDistribution:      trajectoryDist,
    continuityDistribution:      continuityDist,
    adherenceDistribution:       adherenceDist,
    physicianSignalDistribution: physicianDist,
  };
}
