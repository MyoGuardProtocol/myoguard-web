/**
 * src/lib/units/weight.ts
 *
 * Body-weight input normalisation for assessment entry (Protein Clinical
 * Integrity P0 containment, PROT-UNIT-001).
 *
 * WHY THIS EXISTS
 * The authenticated assessment accepted weight in kilograms only, while a
 * plausible pound value (66–250) is also a valid kilogram value, so a patient
 * entering pounds was stored at about 2.2× their weight. This module lets the
 * form take kg or lb and send kilograms, and lets the API reject a weight
 * outside the existing accepted range.
 *
 * WHAT IT IS NOT
 * It is not clinical logic and changes no calculation. The conversion factor is
 * the one `toKg` in src/lib/protocolEngine.ts already uses, and the range is the
 * one the assessment forms already enforce. scripts/proteinIntegrityContainment
 * .test.mjs asserts parity with `toKg`, so the two cannot drift silently.
 *
 * Kept separate from protocolEngine.ts so a client component can normalise
 * input without bundling SRI logic into the browser. Imports nothing.
 */

export type WeightUnit = 'kg' | 'lbs';

/** Pounds to kilograms — the factor used by `toKg` in protocolEngine.ts. */
export const LB_TO_KG = 0.453592;

/** The accepted body-weight range in kg, as already enforced by the assessment forms. */
export const WEIGHT_KG_RANGE = { min: 30, max: 250 } as const;

/**
 * The same range expressed in whole pounds, for display only. Derived from
 * WEIGHT_KG_RANGE (rounded inward so every value shown is accepted); validation
 * always happens in kilograms.
 */
export const WEIGHT_LB_DISPLAY_RANGE = {
  min: Math.ceil(WEIGHT_KG_RANGE.min / LB_TO_KG),
  max: Math.floor(WEIGHT_KG_RANGE.max / LB_TO_KG),
} as const;

/** A typed weight in kilograms, or NaN when the text is not a number. Mirrors `toKg`. */
export function weightInputToKg(weight: string, unit: WeightUnit): number {
  const raw = parseFloat(weight);
  return unit === 'lbs' ? raw * LB_TO_KG : raw;
}

/** Whether a typed weight, once in kilograms, falls inside WEIGHT_KG_RANGE. */
export function isAcceptedWeight(weight: string, unit: WeightUnit): boolean {
  const kg = weightInputToKg(weight, unit);
  return Number.isFinite(kg) && kg >= WEIGHT_KG_RANGE.min && kg <= WEIGHT_KG_RANGE.max;
}
