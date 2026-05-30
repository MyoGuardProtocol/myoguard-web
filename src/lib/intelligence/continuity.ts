// MyoGuard Intelligence Layer — Patient Check-In Continuity
//
// Observes the frequency and consistency of weekly check-in engagement
// within the configured lookback window.
//
// MyoGuard observes. MyoGuard does not predict.
// Explanation strings use governed clinical vocabulary only.

import { prisma } from '@/src/lib/prisma';
import {
  INTELLIGENCE_WINDOWS,
  deriveConfidence,
  type ContinuitySignal,
  type ContinuityStatus,
} from './types';

// ─── Engagement threshold ─────────────────────────────────────────────────────
// Expected frequency: ~1 check-in per 7 days.
// In a 30-day window: 3+ check-ins = engaged with expected protocol frequency.

const ENGAGED_THRESHOLD = 3;

// ─── Signal computation ───────────────────────────────────────────────────────

/**
 * computeContinuity()
 *
 * Observes patient check-in engagement within the CONTINUITY_WINDOW_DAYS lookback.
 *
 * Status derivation:
 *   inactive          — 0 check-ins: confirmed absence of engagement activity
 *                       over the observation window. Absence is itself a signal.
 *   inconsistent      — 1–2 check-ins: engagement present but below expected frequency
 *   engaged           — 3+ check-ins: consistent with expected protocol frequency
 *   insufficient_data — reserved for future use (e.g. newly enrolled patients
 *                       where the window predates enrollment)
 *
 * Confidence:
 *   inactive:    insufficient_data — 0 data points; absence is observable but
 *                                   we cannot assess the engagement pattern itself
 *   inconsistent: low (1) or moderate (2)
 *   engaged:      high (3+)
 *
 * Note: "inactive" and "insufficient_data" are semantically distinct statuses.
 *   inactive          = window of sufficient length, confirmed absence of activity
 *   insufficient_data = no basis to assess any pattern (used by other signals)
 *
 * Explanation strings are deterministic clinical copy — no AI-generated language.
 */
export async function computeContinuity(patientId: string): Promise<ContinuitySignal> {
  const since = new Date(
    Date.now() - INTELLIGENCE_WINDOWS.CONTINUITY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const checkins = await prisma.weeklyCheckin.findMany({
    where: {
      userId:    patientId,
      createdAt: { gte: since },
    },
    select: { id: true },
  });

  const count = checkins.length;

  // ── No check-ins — inactive pattern ─────────────────────────────────────────
  // Absence of engagement over 30 days is a longitudinal signal in itself.
  // Status: inactive. Confidence: insufficient_data (no pattern data to assess).
  if (count === 0) {
    return {
      status:     'inactive',
      confidence: 'insufficient_data',
      explanation:
        `No check-in activity recorded in the ${INTELLIGENCE_WINDOWS.CONTINUITY_WINDOW_DAYS}-day ` +
        'observation window. Absence of engagement activity over this period is a longitudinal signal.',
    };
  }

  const confidence   = deriveConfidence(count);
  let status: ContinuityStatus;
  let explanation: string;

  if (count >= ENGAGED_THRESHOLD) {
    status = 'engaged';
    explanation =
      `${count} check-in${count !== 1 ? 's' : ''} recorded in the ` +
      `${INTELLIGENCE_WINDOWS.CONTINUITY_WINDOW_DAYS}-day observation window. ` +
      'Check-in frequency is consistent with expected protocol engagement.';
  } else {
    status = 'inconsistent';
    explanation =
      `${count} check-in${count !== 1 ? 's' : ''} recorded in the ` +
      `${INTELLIGENCE_WINDOWS.CONTINUITY_WINDOW_DAYS}-day observation window. ` +
      'Check-in frequency is below the expected protocol engagement threshold. ' +
      'Continuity review may be appropriate.';
  }

  return { status, confidence, explanation };
}
