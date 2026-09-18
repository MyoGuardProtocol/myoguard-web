/**
 * src/lib/clinical/proteinContainment.ts
 *
 * Phase SRI-R1C — temporary containment of individualized numeric protein
 * guidance on patient-facing and public surfaces.
 *
 * WHY THIS EXISTS
 * `MuscleScore.proteinTargetG` and `ProtocolPlan.proteinTargetG` both store
 * `proteinAggressive` — the HIGH end of the activity range (1.5 / 1.7 / 2.0
 * g/kg), calculated from actual total body weight. That value could reach a
 * patient before any PhysicianReview exists, and the system holds no renal
 * information of any kind, so it could not be checked against the one
 * circumstance that most clearly contraindicates it.
 *
 * KDIGO 2024 sets 0.8 g/kg/d for adults with CKD G3-G5 and a practice point to
 * avoid >1.3 g/kg/d in CKD at risk of progression. All three activity ceilings
 * sit above that avoidance threshold. Type 2 diabetes is both a core indication
 * for these agents and a leading cause of CKD, much of it undiagnosed, so the
 * affected population overlaps this one.
 *
 * WHAT THIS CONTAINS AND WHAT IT DOES NOT
 * This module changes what is DISPLAYED. It changes no calculation, no stored
 * value, no schema, no SRI mathematics and no physician surface. Every number
 * is still computed and still persisted exactly as before; physicians still see
 * all of it. What stops is the unreviewed delivery of an individualized figure
 * to someone who cannot be screened for the contraindication.
 *
 * WHY NON-NUMERIC RATHER THAN A SAFER NUMBER
 * Substituting a lower number would be inventing a clinical recommendation this
 * phase is not authorised to make, and would be wrong in the opposite direction
 * for dialysis patients and for some older adults with frailty or sarcopenia,
 * where guidance permits higher intake. The safe containment is to stop
 * asserting a personal figure, not to assert a different one.
 *
 * THIS IS TEMPORARY. It is the smallest defensible correction pending the
 * permanent renal decision boundary (SRI-R2). Reversing it means removing this
 * module and restoring the call sites that reference it.
 */

/**
 * Patient-facing replacement for an individualized numeric protein figure.
 *
 * Deliberately makes no recommendation, names no number and no range, and
 * points to the clinician rather than to a MyoGuard value.
 */
export const PROTEIN_GUIDANCE_PENDING_REVIEW =
  'Your individual protein needs should be set with your treating clinician.';

/**
 * Shorter form for compact tiles and table cells where the sentence above does
 * not fit. Same meaning, same absence of a number.
 */
export const PROTEIN_GUIDANCE_PENDING_SHORT = 'Set with your clinician';

/**
 * Supporting line explaining why no figure is shown, for surfaces that have
 * room for it. States the reason plainly without alarming the reader and
 * without implying anything about their own kidney function.
 */
export const PROTEIN_GUIDANCE_PENDING_DETAIL =
  'Protein needs vary between individuals, and some conditions require a lower ' +
  'intake than others. Your clinician can set the figure that applies to you.';

/**
 * Neutral label for the upper bound of the calculated range on PHYSICIAN
 * surfaces, where the number remains visible.
 *
 * `proteinAggressive` is the ceiling of a range. Calling a ceiling a "target"
 * reads as a value to be achieved rather than a bound not to exceed, which is
 * the opposite of what the number represents.
 */
export const PROTEIN_CEILING_LABEL = 'Upper end of calculated range';
