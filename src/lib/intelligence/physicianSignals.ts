// MyoGuard Intelligence Layer — Physician-Relevant Clinical Signals
//
// Synthesises lean velocity flags, SRI risk band, and engagement patterns
// into a physician-facing signal level for CDS context.
//
// MyoGuard observes. MyoGuard does not predict.
// Explanation strings use governed clinical vocabulary only.

import { prisma } from '@/src/lib/prisma';
import {
  INTELLIGENCE_WINDOWS,
  deriveConfidence,
  type PhysicianSignal,
  type PhysicianSignalStatus,
} from './types';

// ─── Signal computation ───────────────────────────────────────────────────────

/**
 * computePhysicianSignals()
 *
 * Observes lean velocity flags and SRI risk band from qualifying assessments
 * within PHYSICIAN_SIGNAL_WINDOW_DAYS, then derives a physician-facing signal level.
 *
 * Signal precedence (highest to lowest):
 *   review_threshold_crossed — leanVelocityFlag = 'critical_review' observed in window
 *   review_recommended       — leanVelocityFlag = 'concerning' observed in window
 *   continuity_concern       — most recent band = CRITICAL or HIGH,
 *                              AND no check-in recorded in the same window
 *   within_expected_range    — no escalated lean velocity signals in window
 *
 * Confidence: based on qualifying assessment count in window.
 *   0 assessments → insufficient_data (signal defaults to within_expected_range by absence)
 *
 * Explanation strings are deterministic clinical copy — no AI-generated language.
 * Never: "urgent", "worsening", "deteriorating", "severe", "predicted", "will".
 */
export async function computePhysicianSignals(patientId: string): Promise<PhysicianSignal> {
  const since = new Date(
    Date.now() - INTELLIGENCE_WINDOWS.PHYSICIAN_SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // Fetch qualifying assessments with lean velocity and risk band data
  const assessments = await prisma.assessment.findMany({
    where: {
      userId:         patientId,
      assessmentDate: { gte: since },
    },
    select: {
      riskBand:       true,
      assessmentDate: true,
      muscleScore: {
        select: { leanVelocityFlag: true },
      },
    },
    orderBy: { assessmentDate: 'desc' },
  });

  const count      = assessments.length;
  const confidence = deriveConfidence(count);

  // ── No assessments in window ─────────────────────────────────────────────────
  if (count === 0) {
    return {
      status:     'within_expected_range',
      confidence: 'insufficient_data',
      explanation:
        `No assessments recorded within the ` +
        `${INTELLIGENCE_WINDOWS.PHYSICIAN_SIGNAL_WINDOW_DAYS}-day observation window. ` +
        'Physician signal level cannot be determined from current data.',
    };
  }

  // ── Lean velocity flag scan — highest-precedence signals ────────────────────
  const hasCriticalReview = assessments.some(
    a => a.muscleScore?.leanVelocityFlag === 'critical_review',
  );
  const hasConcerning = assessments.some(
    a => a.muscleScore?.leanVelocityFlag === 'concerning',
  );

  // ── Continuity concern: elevated band + absence of recent check-in ───────────
  const mostRecentBand = assessments[0].riskBand;
  const isElevatedBand = mostRecentBand === 'CRITICAL' || mostRecentBand === 'HIGH';

  const recentCheckin = await prisma.weeklyCheckin.findFirst({
    where: {
      userId:    patientId,
      createdAt: { gte: since },
    },
    select: { id: true },
  });

  // ── Status derivation ────────────────────────────────────────────────────────
  let status: PhysicianSignalStatus;
  let explanation: string;

  if (hasCriticalReview) {
    status = 'review_threshold_crossed';
    explanation =
      `An escalated lean mass velocity signal (critical_review threshold) was recorded ` +
      `within the ${INTELLIGENCE_WINDOWS.PHYSICIAN_SIGNAL_WINDOW_DAYS}-day observation window. ` +
      'Physician review of protocol appropriateness is recommended at earliest clinical convenience.';

  } else if (hasConcerning) {
    status = 'review_recommended';
    explanation =
      `A lean mass velocity signal (review threshold) was recorded ` +
      `within the ${INTELLIGENCE_WINDOWS.PHYSICIAN_SIGNAL_WINDOW_DAYS}-day observation window. ` +
      'Physician review of protocol appropriateness is recommended.';

  } else if (isElevatedBand && !recentCheckin) {
    status = 'continuity_concern';
    explanation =
      `Patient is classified at ${mostRecentBand} SRI risk band ` +
      `with no check-in activity recorded in the ` +
      `${INTELLIGENCE_WINDOWS.PHYSICIAN_SIGNAL_WINDOW_DAYS}-day observation window. ` +
      'Engagement continuity at an elevated risk classification may warrant physician attention.';

  } else {
    status = 'within_expected_range';
    explanation =
      `No escalated lean velocity signals observed within the ` +
      `${INTELLIGENCE_WINDOWS.PHYSICIAN_SIGNAL_WINDOW_DAYS}-day observation window. ` +
      `Current SRI classification: ${mostRecentBand}.`;
  }

  return { status, confidence, explanation };
}
