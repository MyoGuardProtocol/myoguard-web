// MyoGuard Intelligence Layer — Protein Protocol Adherence
//
// Observes protein adherence patterns from qualifying weekly check-ins
// within the configured lookback window.
//
// MyoGuard observes. MyoGuard does not predict.
// Explanation strings use governed clinical vocabulary only.

import { prisma } from '@/src/lib/prisma';
import { PROTEIN_ADHERENCE_INTERPRETATION_WITHHELD } from '@/src/lib/clinical/proteinIntegrityContainment';
import {
  INTELLIGENCE_WINDOWS,
  type AdherenceSignal,
} from './types';

// ─── Protein Clinical Integrity P0 containment ────────────────────────────────
//
// This layer classified WeeklyCheckin.proteinAdherence as a percentage (0–100)
// against thresholds of 90 (target_achieved) and 70 (near_target). The stored
// value is a ratio (about 0–1; /api/checkins), so every patient with protein
// check-ins was classified persistent_deficit — including fully adherent ones —
// and that status drove physician review prioritisation, insight counts and
// Clinical Evidence Record text.
//
// The classification is withheld. The canonical adherence scale and denominator
// are reserved for a Founder clinical ruling (Protein Clinical Integrity Gate
// v1.0, Decision E). The previous thresholds (90 / 70) were governance constants
// and are not redefined here; restore the classification only under that ruling.
//
// No stored value is read differently or altered.

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
 * Status derivation, under Protein Clinical Integrity P0 containment:
 *   insufficient_data — always. With no qualifying check-ins the explanation
 *                       says no data was recorded; with qualifying check-ins it
 *                       says interpretation is withheld. target_achieved,
 *                       near_target and persistent_deficit are not produced.
 *
 * Confidence: insufficient_data — no classification is asserted.
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

  // ── Qualifying data exist — interpretation withheld ──────────────────────────
  // No average and no classification is computed (see the containment note at
  // the top of this file).
  return {
    status:      'insufficient_data',
    confidence:  'insufficient_data',
    explanation: PROTEIN_ADHERENCE_INTERPRETATION_WITHHELD,
  };
}
