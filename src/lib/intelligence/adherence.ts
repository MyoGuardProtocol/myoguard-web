// MyoGuard Intelligence Layer — Protein Protocol Adherence
//
// Observes protein adherence patterns from qualifying weekly check-ins
// within the configured lookback window.
//
// MyoGuard observes. MyoGuard does not predict.
// Explanation strings use governed clinical vocabulary only.

import { prisma } from '@/src/lib/prisma';
import {
  INTELLIGENCE_WINDOWS,
  deriveConfidence,
  type AdherenceSignal,
  type AdherenceStatus,
} from './types';

// ─── Adherence thresholds ─────────────────────────────────────────────────────
//
// WeeklyCheckin.proteinAdherence is treated as a percentage value (0–100).
// Source: the field tracks adherence relative to the patient's protein target.
//
// target_achieved:    ≥ 90% of protein target (average across qualifying check-ins)
// near_target:        70–89% of protein target
// persistent_deficit: < 70% of protein target
//
// These thresholds are governance constants — do not adjust without explicit approval.

const TARGET_ACHIEVED_PCT  = 90;
const NEAR_TARGET_PCT      = 70;

// ─── Signal computation ───────────────────────────────────────────────────────

/**
 * computeAdherence()
 *
 * Observes protein protocol adherence across qualifying weekly check-ins
 * within the ADHERENCE_WINDOW_DAYS lookback.
 *
 * Uses WeeklyCheckin.proteinAdherence as the authoritative adherence indicator
 * for this layer. This is the single governed adherence model for intelligence
 * signals — not a recomputed estimate from raw intake fields.
 *
 * Status derivation (by average adherence over qualifying check-ins):
 *   insufficient_data  — 0 qualifying check-ins with proteinAdherence data
 *   target_achieved    — average ≥ 90% of protein target
 *   near_target        — average 70–89% of protein target
 *   persistent_deficit — average < 70% of protein target
 *
 * Confidence: high = 3+, moderate = 2, low = 1, insufficient_data = 0.
 * Explanation strings are deterministic clinical copy — no AI-generated language.
 */
export async function computeAdherence(patientId: string): Promise<AdherenceSignal> {
  const since = new Date(
    Date.now() - INTELLIGENCE_WINDOWS.ADHERENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const checkins = await prisma.weeklyCheckin.findMany({
    where: {
      userId:          patientId,
      createdAt:       { gte: since },
      proteinAdherence: { not: null },
    },
    select: { proteinAdherence: true },
  });

  const count      = checkins.length;
  const confidence = deriveConfidence(count);

  // ── No qualifying data ───────────────────────────────────────────────────────
  if (count === 0) {
    return {
      status:     'insufficient_data',
      confidence: 'insufficient_data',
      explanation:
        `No protein adherence data recorded within the ` +
        `${INTELLIGENCE_WINDOWS.ADHERENCE_WINDOW_DAYS}-day observation window. ` +
        'Adherence pattern cannot be determined.',
    };
  }

  // ── Average adherence across qualifying check-ins ────────────────────────────
  const sum          = checkins.reduce((acc, c) => acc + (c.proteinAdherence ?? 0), 0);
  const avgAdherence = sum / count;

  let status: AdherenceStatus;
  let explanation: string;

  if (avgAdherence >= TARGET_ACHIEVED_PCT) {
    status = 'target_achieved';
    explanation =
      `Average protein adherence of ${avgAdherence.toFixed(1)}% observed across ` +
      `${count} check-in${count !== 1 ? 's' : ''} in the ` +
      `${INTELLIGENCE_WINDOWS.ADHERENCE_WINDOW_DAYS}-day observation window. ` +
      'Adherence pattern is consistent with protocol target.';

  } else if (avgAdherence >= NEAR_TARGET_PCT) {
    status = 'near_target';
    explanation =
      `Average protein adherence of ${avgAdherence.toFixed(1)}% observed across ` +
      `${count} check-in${count !== 1 ? 's' : ''} in the ` +
      `${INTELLIGENCE_WINDOWS.ADHERENCE_WINDOW_DAYS}-day observation window. ` +
      'Adherence pattern is approaching the protocol target.';

  } else {
    status = 'persistent_deficit';
    explanation =
      `Average protein adherence of ${avgAdherence.toFixed(1)}% observed across ` +
      `${count} check-in${count !== 1 ? 's' : ''} in the ` +
      `${INTELLIGENCE_WINDOWS.ADHERENCE_WINDOW_DAYS}-day observation window. ` +
      'Adherence pattern reflects a persistent gap relative to the protocol protein target. ' +
      'Physician review of nutritional support may be appropriate.';
  }

  return { status, confidence, explanation };
}
