// SRI Containment C1.2 (K1.2) — quarantined lean-velocity physician signal.
//
// computePhysicianSignals() and deriveOverallContinuityStatus() are unchanged.
// They remain quarantined legacy logic pending Architecture Reconciliation.
// These helpers decide only what downstream consumers may present or transport.
// They never substitute another status, label or interpretation.
//
//   review_threshold_crossed — originates from leanVelocityFlag = 'critical_review'
//   review_recommended       — originates from leanVelocityFlag = 'concerning'
//   within_expected_range    — reached only when the lean-velocity scan finds
//                              nothing; its explanation reports that scan
//   continuity_concern       — elevated band without check-in; independent of
//                              lean velocity, so it remains presentable

import type { OverallContinuityStatus } from './types';

const LEAN_VELOCITY_ORIGINATED = new Set<string>(['review_threshold_crossed', 'review_recommended']);
const QUARANTINED = new Set<string>([...LEAN_VELOCITY_ORIGINATED, 'within_expected_range']);

/** True when the physician signal status originates from lean-velocity logic. */
export function isLeanVelocityOriginated(status: string): boolean {
  return LEAN_VELOCITY_ORIGINATED.has(status);
}

/** Physician signals that may be presented. A quarantined status is removed, not replaced. */
export function presentablePhysicianSignals<T extends { status: string }>(signals: T[]): T[] {
  return signals.filter(s => !QUARANTINED.has(s.status));
}

/**
 * The overall continuity status, or null when the physician signal behind it
 * originates from lean-velocity logic. It is not recomputed without that signal.
 */
export function presentableOverallContinuityStatus(
  overall:               OverallContinuityStatus,
  physicianSignalStatus: string,
): OverallContinuityStatus | null {
  return isLeanVelocityOriginated(physicianSignalStatus) ? null : overall;
}
