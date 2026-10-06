/**
 * src/lib/clinical/proteinIntegrityContainment.ts
 *
 * Protein Clinical Integrity — P0 immediate containment (Founder-approved).
 * Source: Protein Clinical Integrity Gate v1.0.
 *
 * WHY THIS EXISTS
 * `Assessment.proteinGrams` does not hold the patient's protein intake. The
 * authenticated assessment discards the intake the patient enters, and
 * /api/assessment stores the engine's calculated Clinical Protein Floor in that
 * column. Every surface that read it as intake therefore presented a calculated
 * value as reported intake, and every "deficit", "gap" or "below minimum"
 * derived from it compared one calculated reference with another. Separately,
 * `WeeklyCheckin.proteinAdherence` is stored as a ratio (about 0–1) while its
 * interpreters read it as a percentage (0–100), so they classified adherent
 * patients as in persistent deficit.
 *
 * WHAT THIS CONTAINS AND WHAT IT DOES NOT
 * This containment changes what is DISPLAYED and what is INTERPRETED. It changes
 * no calculation, no stored value, no schema, no SRI mathematics, no protein
 * floor, range or step target, and no adherence formula or denominator. Where an
 * output could not be relabelled without a clinical decision it is suppressed,
 * not rewritten. Correctly labelled calculated references (Clinical Protein
 * Floor, Step Target, Upper end of calculated range) are retained on physician
 * surfaces. Genuine check-in protein values are retained everywhere.
 *
 * Contained call sites (each removal is asserted by
 * scripts/proteinIntegrityContainment.test.mjs):
 *   - app/doctor/patients/page.tsx                 "Protein Gap" flag
 *   - src/components/ui/PatientDrawer.tsx          intake-vs-target bar, "Protein
 *                                                  Deficit" driver, adherence bar
 *   - app/doctor/patients/[userId]/page.tsx        protein factor card, escalation
 *                                                  line, urgent protein action,
 *                                                  snapshot "Protein" value
 *   - app/doctor/patients/[userId]/results/[assessmentId]/page.tsx  "Daily Protein"
 *   - app/doctor/patients/[userId]/print/page.tsx  "Protein Intake" row and status
 *   - app/report/[token]/page.tsx                  "Protein Intake" tile
 *   - app/dashboard/results/[id]/page.tsx          "Protein intake" value, the
 *                                                  floor-driven supplement trigger
 *   - app/dashboard/report/page.tsx                "Protein Intake" tile, the
 *                                                  floor-driven supplement trigger
 *   - src/lib/reportClinical.ts                    protein deficit driver, action
 *                                                  and escalation; protein
 *                                                  adherence classification
 *   - src/lib/intelligence/adherence.ts            adherence status classification
 *
 * THIS IS TEMPORARY. It holds until the Founder Clinical Governance Review rules
 * on Decisions A–G (Protein Clinical Integrity Gate v1.0, Section 12). Lifting it
 * means restoring genuine intake and a governed adherence scale first, then
 * restoring the call sites above under those rulings — never simply reverting.
 */

/**
 * Shown, on physician surfaces only, where a protein adherence classification
 * would otherwise have been derived from the mis-scaled stored ratio.
 *
 * States that interpretation is withheld and that recorded values are intact.
 * Names no number, no status and no denominator.
 */
export const PROTEIN_ADHERENCE_INTERPRETATION_WITHHELD =
  'Protein adherence interpretation is withheld while its calculation is under ' +
  'clinical governance review. Recorded check-in protein values are unaffected.';
