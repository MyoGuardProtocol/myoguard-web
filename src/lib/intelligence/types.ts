// MyoGuard Intelligence Layer — Shared Types and Constants
//
// Core principle: "MyoGuard observes. MyoGuard does not predict."
// All explanations use governed clinical vocabulary.
//
// PREFER: trend direction, continuity concern, review threshold, pattern observed,
//         trajectory, consistency, longitudinal signal.
// NEVER:  worsening, failure, severe decline, urgent, improving,
//         deteriorating, score trend, predicted, will, forecast.

// ─── Confidence ───────────────────────────────────────────────────────────────

/**
 * ConfidenceLevel — derived from qualifying data point count within the window.
 *
 * high:              3+ qualifying data points
 * moderate:          2 qualifying data points
 * low:               1 qualifying data point
 * insufficient_data: 0 qualifying data points
 */
export type ConfidenceLevel =
  | 'high'
  | 'moderate'
  | 'low'
  | 'insufficient_data';

/**
 * deriveConfidence()
 *
 * Converts a raw data point count into a ConfidenceLevel.
 * Applied consistently across all signal modules.
 */
export function deriveConfidence(dataPointCount: number): ConfidenceLevel {
  if (dataPointCount >= 3) return 'high';
  if (dataPointCount === 2) return 'moderate';
  if (dataPointCount === 1) return 'low';
  return 'insufficient_data';
}

// ─── Base signal shape ────────────────────────────────────────────────────────

/**
 * IntelligenceSignal
 *
 * Base shape for all intelligence signals.
 * Explanation strings must use governed clinical vocabulary — see module header.
 * No predictive claims. No AI-generated language.
 */
export interface IntelligenceSignal {
  status:      string;
  confidence:  ConfidenceLevel;
  explanation: string;
}

// ─── Status unions ────────────────────────────────────────────────────────────

/** SRI risk band trajectory over the observation window. */
export type TrajectoryStatus =
  | 'stable'
  | 'positive_trend'
  | 'variable'
  | 'declining_trend'
  | 'insufficient_data';

/** Patient check-in engagement over the observation window. */
export type ContinuityStatus =
  | 'engaged'
  | 'inconsistent'
  | 'inactive'
  | 'insufficient_data';

/** Protein protocol adherence over the observation window. */
export type AdherenceStatus =
  | 'target_achieved'
  | 'near_target'
  | 'persistent_deficit'
  | 'insufficient_data';

/** Physician-relevant clinical signal level. */
export type PhysicianSignalStatus =
  | 'review_recommended'
  | 'review_threshold_crossed'
  | 'continuity_concern'
  | 'within_expected_range';

/** Composite continuity status across all signal dimensions. */
export type OverallContinuityStatus =
  | 'continuity_active'
  | 'continuity_concern'
  | 'continuity_at_risk'
  | 'insufficient_data';

// ─── Typed signal interfaces ──────────────────────────────────────────────────

export interface TrajectorySignal extends IntelligenceSignal {
  status: TrajectoryStatus;
}

export interface ContinuitySignal extends IntelligenceSignal {
  status: ContinuityStatus;
}

export interface AdherenceSignal extends IntelligenceSignal {
  status: AdherenceStatus;
}

export interface PhysicianSignal extends IntelligenceSignal {
  status: PhysicianSignalStatus;
}

// ─── Synthesised output ───────────────────────────────────────────────────────

/**
 * PatientIntelligenceSummary
 *
 * Aggregated intelligence output for a single patient.
 * All signal fields are independently computed and independently observable.
 * No predictive claims. No AI-generated language.
 * generatedAt is the timestamp of computation, not a clinical encounter timestamp.
 */
export interface PatientIntelligenceSummary {
  patientId:               string;
  generatedAt:             Date;
  trajectory:              TrajectorySignal;
  continuity:              ContinuitySignal;
  adherence:               AdherenceSignal;
  physicianSignals:        PhysicianSignal;
  overallContinuityStatus: OverallContinuityStatus;
}

// ─── Observation window constants ─────────────────────────────────────────────

/**
 * INTELLIGENCE_WINDOWS
 *
 * Observation window lengths for each intelligence signal.
 * All windows are backward-looking from the point of evaluation.
 * All queries use Notification.createdAt or model-native createdAt fields
 * as the time anchor — never sentAt (nullable, unsafe as window anchor).
 */
export const INTELLIGENCE_WINDOWS = {
  /** SRI risk band trajectory: 90-day lookback. */
  TRAJECTORY_WINDOW_DAYS:       90,
  /** Check-in continuity: 30-day lookback. */
  CONTINUITY_WINDOW_DAYS:       30,
  /** Protein adherence: 14-day lookback. */
  ADHERENCE_WINDOW_DAYS:        14,
  /** Physician-relevant signals: 30-day lookback. */
  PHYSICIAN_SIGNAL_WINDOW_DAYS: 30,
} as const;
