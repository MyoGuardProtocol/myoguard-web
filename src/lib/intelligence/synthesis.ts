// MyoGuard Intelligence Layer — Patient Intelligence Synthesis
//
// Aggregates all individual signals into a unified PatientIntelligenceSummary.
// All signals are computed independently and run concurrently.
//
// MyoGuard observes. MyoGuard does not predict.

import {
  type PatientIntelligenceSummary,
  type OverallContinuityStatus,
  type TrajectoryStatus,
  type ContinuityStatus,
  type AdherenceStatus,
  type PhysicianSignalStatus,
} from './types';
import { computeTrajectory }       from './trajectory';
import { computeContinuity }       from './continuity';
import { computeAdherence }        from './adherence';
import { computePhysicianSignals } from './physicianSignals';

// ─── Overall continuity status derivation ─────────────────────────────────────

/**
 * deriveOverallContinuityStatus()
 *
 * Derives a composite continuity status from the four individual signal statuses.
 *
 * Priority order (highest to lowest):
 *
 *   continuity_at_risk  — escalated physician signal (review_threshold_crossed)
 *                         OR declining trajectory combined with non-engaged continuity
 *
 *   continuity_concern  — review_recommended or continuity_concern physician signal
 *                         OR confirmed inactive check-in pattern
 *                         OR persistent adherence gap
 *
 *   insufficient_data   — all four signals are at insufficient_data status
 *                         (patient too new, no longitudinal data)
 *
 *   continuity_active   — no concerns identified across all signal dimensions
 */
function deriveOverallContinuityStatus(
  trajectory:      TrajectoryStatus,
  continuity:      ContinuityStatus,
  adherence:       AdherenceStatus,
  physicianSignal: PhysicianSignalStatus,
): OverallContinuityStatus {

  // ── Highest priority: escalated signal or declining trajectory with poor continuity
  if (
    physicianSignal === 'review_threshold_crossed' ||
    (trajectory === 'declining_trend' && continuity !== 'engaged')
  ) {
    return 'continuity_at_risk';
  }

  // ── Mid-priority: review recommendation, inactive pattern, persistent adherence gap
  if (
    physicianSignal === 'review_recommended'  ||
    physicianSignal === 'continuity_concern'  ||
    continuity      === 'inactive'            ||
    adherence       === 'persistent_deficit'
  ) {
    return 'continuity_concern';
  }

  // ── Insufficient data across all dimensions (e.g. newly enrolled patient)
  const allInsufficient =
    trajectory === 'insufficient_data' &&
    continuity === 'insufficient_data' &&
    adherence  === 'insufficient_data';

  if (allInsufficient) {
    return 'insufficient_data';
  }

  // ── No concerns identified
  return 'continuity_active';
}

// ─── Primary export ───────────────────────────────────────────────────────────

/**
 * getPatientIntelligenceSummary()
 *
 * Computes all four intelligence signals for a given patient concurrently,
 * then returns the synthesised PatientIntelligenceSummary.
 *
 * Signals are independent and share no state.
 * Promise.all() is used to minimise database round-trip latency.
 *
 * Safe to call from:
 *   - Physician dashboard server components (RSC)
 *   - Longitudinal summary email cron routes
 *   - Any server-side context with access to the Prisma singleton
 *
 * Must NOT be called from:
 *   - Client components (no direct Prisma access in browser)
 *   - Edge runtime routes (Prisma requires Node.js runtime)
 *
 * This function is read-only — it writes nothing to the database.
 * It does not trigger notifications, emails, or any side effects.
 */
export async function getPatientIntelligenceSummary(
  patientId: string,
): Promise<PatientIntelligenceSummary> {

  const [trajectory, continuity, adherence, physicianSignals] = await Promise.all([
    computeTrajectory(patientId),
    computeContinuity(patientId),
    computeAdherence(patientId),
    computePhysicianSignals(patientId),
  ]);

  const overallContinuityStatus = deriveOverallContinuityStatus(
    trajectory.status,
    continuity.status,
    adherence.status,
    physicianSignals.status,
  );

  return {
    patientId,
    generatedAt: new Date(),
    trajectory,
    continuity,
    adherence,
    physicianSignals,
    overallContinuityStatus,
  };
}
