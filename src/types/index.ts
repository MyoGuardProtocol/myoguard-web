/**
 * Shared TypeScript types for MyoGuard Protocol.
 * Re-exports core domain types so all pages/components import from one place.
 */

export type { AssessmentInput, ProtocolResult, RiskBand, RecoveryStatus } from "@/src/lib/protocolEngine";

// ─── Physician / Referral ────────────────────────────────────────────────────

export type PhysicianInfo = {
  slug: string;
  displayName: string;
  clinicName: string | null;
  specialty: string | null;
};

// ─── API response shapes ──────────────────────────────────────────────────────

export type AssessmentSaveResponse = {
  assessmentId: string;
  score: number;
  riskBand: string;
};

export type ApiError = {
  error: string;
  details?: unknown;
};

// ─── Dashboard / Check-in ────────────────────────────────────────────────────

export type CheckinInput = {
  avgWeightKg?:  number;
  avgProteinG?:  number;
  totalWorkouts?: number;
  avgHydration?: number;
  energyLevel?:  number;   // 1–5
  nauseaLevel?:  number;   // 1–5
  notes?:        string;
  sleepHours?:   number;   // avg nightly hours for the week
  sleepQuality?: number;   // 1–5
};
