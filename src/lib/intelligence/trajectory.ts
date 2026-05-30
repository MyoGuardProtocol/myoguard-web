// MyoGuard Intelligence Layer — SRI Risk Band Trajectory
//
// Observes the direction and consistency of SRI risk band changes
// across qualifying assessments within the configured lookback window.
//
// MyoGuard observes. MyoGuard does not predict.
// Explanation strings use governed clinical vocabulary only.

import { prisma } from '@/src/lib/prisma';
import {
  INTELLIGENCE_WINDOWS,
  deriveConfidence,
  type TrajectorySignal,
  type TrajectoryStatus,
} from './types';

// ─── Risk band numeric map ────────────────────────────────────────────────────
// Higher rank = higher SRI risk classification.
// Used for net directional comparison across the observation window.

const BAND_RANK: Record<string, number> = {
  LOW:      1,
  MODERATE: 2,
  HIGH:     3,
  CRITICAL: 4,
};

// ─── Signal computation ───────────────────────────────────────────────────────

/**
 * computeTrajectory()
 *
 * Observes SRI risk band direction across qualifying assessments within
 * the TRAJECTORY_WINDOW_DAYS lookback.
 *
 * Status derivation:
 *   insufficient_data — 0 assessments in window
 *   stable            — 1 assessment (baseline established, no directional data),
 *                       or all bands identical across the window
 *   positive_trend    — net band movement toward lower risk categories (rank decreasing)
 *   declining_trend   — net band movement toward higher risk categories (rank increasing)
 *   variable          — mixed directional movement with no consistent net trend
 *                       (a reversal detected across 3+ assessments)
 *
 * Confidence: high = 3+ assessments, moderate = 2, low = 1, insufficient_data = 0.
 * Explanation strings are deterministic clinical copy — no AI-generated language.
 */
export async function computeTrajectory(patientId: string): Promise<TrajectorySignal> {
  const since = new Date(
    Date.now() - INTELLIGENCE_WINDOWS.TRAJECTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const assessments = await prisma.assessment.findMany({
    where: {
      userId:         patientId,
      assessmentDate: { gte: since },
    },
    select: {
      riskBand:       true,
      assessmentDate: true,
    },
    orderBy: { assessmentDate: 'asc' },
  });

  const count      = assessments.length;
  const confidence = deriveConfidence(count);

  // ── No assessments in window ────────────────────────────────────────────────
  if (count === 0) {
    return {
      status:     'insufficient_data',
      confidence: 'insufficient_data',
      explanation:
        'No assessments recorded within the observation window. ' +
        'SRI risk band trajectory cannot be determined.',
    };
  }

  // ── Single assessment — baseline only ───────────────────────────────────────
  if (count === 1) {
    const band = assessments[0].riskBand;
    return {
      status:     'stable',
      confidence: 'low',
      explanation:
        `One assessment recorded within the ${INTELLIGENCE_WINDOWS.TRAJECTORY_WINDOW_DAYS}-day ` +
        `observation window (SRI band: ${band}). ` +
        'A single data point establishes a baseline; longitudinal trajectory requires additional assessments.',
    };
  }

  // ── Two or more assessments — directional analysis ──────────────────────────
  const firstRank = BAND_RANK[assessments[0].riskBand]          ?? 0;
  const lastRank  = BAND_RANK[assessments[count - 1].riskBand]  ?? 0;
  const netDelta  = lastRank - firstRank;

  // Detect directional reversal across the sequence (requires 3+ data points)
  let hasReversal = false;
  if (count >= 3) {
    for (let i = 2; i < count; i++) {
      const prev  = BAND_RANK[assessments[i - 1].riskBand] ?? 0;
      const curr  = BAND_RANK[assessments[i].riskBand]     ?? 0;
      const delta = curr - prev;
      // Reversal: a step moves opposite to the overall net direction
      if ((netDelta > 0 && delta < 0) || (netDelta < 0 && delta > 0)) {
        hasReversal = true;
        break;
      }
    }
  }

  let status: TrajectoryStatus;
  let explanation: string;

  if (hasReversal) {
    status = 'variable';
    explanation =
      `SRI risk band shows variable movement across ${count} assessments ` +
      `in the ${INTELLIGENCE_WINDOWS.TRAJECTORY_WINDOW_DAYS}-day observation window. ` +
      'No consistent directional trend observed. Continued longitudinal monitoring is recommended.';

  } else if (netDelta === 0) {
    status = 'stable';
    explanation =
      `SRI risk band has remained consistent across ${count} assessments ` +
      `in the ${INTELLIGENCE_WINDOWS.TRAJECTORY_WINDOW_DAYS}-day observation window. ` +
      'No directional change in risk classification observed.';

  } else if (netDelta < 0) {
    // Band rank decreased — movement toward lower risk categories
    status = 'positive_trend';
    explanation =
      `SRI risk band has trended toward lower risk categories across ${count} assessments ` +
      `in the ${INTELLIGENCE_WINDOWS.TRAJECTORY_WINDOW_DAYS}-day observation window. ` +
      'This pattern reflects observed protocol continuity data — not a clinical projection.';

  } else {
    // Band rank increased — movement toward higher risk categories
    status = 'declining_trend';
    explanation =
      `SRI risk band has trended toward higher risk categories across ${count} assessments ` +
      `in the ${INTELLIGENCE_WINDOWS.TRAJECTORY_WINDOW_DAYS}-day observation window. ` +
      'Physician review of protocol appropriateness is recommended.';
  }

  return { status, confidence, explanation };
}
