/**
 * src/lib/guide/proteinGuide.ts
 *
 * The Protein Guide delivery asset, and the one place it is declared.
 *
 * WHY THIS EXISTS WITH NOTHING IN IT
 * Phase 1D-C3F-2 builds the requested-delivery pathway for the Guide. The Guide
 * itself is clinical content that has not been written or approved, and C3F-2 is
 * explicitly not the phase that writes it.
 *
 * The alternative to an empty declaration is a placeholder — an email that
 * arrives titled "Your MyoGuard Protein Guide" and contains nothing a clinician
 * approved. Someone asked for protein guidance at a GLP-1 dose; sending them
 * filler under that title is worse than sending nothing, so the pathway refuses
 * to deliver until a real asset is declared here.
 *
 * This is the same shape as the consent-wording registry from C3F-1A, for the
 * same reason: the thing that must exist before the system acts is declared in
 * code, reviewable and attributable to a commit, and its absence is a refusal
 * rather than an improvisation.
 *
 * DECLARING THE ASSET (a future phase)
 * Set CURRENT_GUIDE to a ProteinGuideAsset. The pathway then works with no
 * further change — that is the whole point of the indirection. Never edit a
 * shipped asset's body in place once it has been delivered: bump `version` and
 * the `templateId` with it, so CommunicationEvent rows keep naming the exact
 * artefact that was sent.
 *
 * WHAT AN ASSET MAY NOT BE
 * `renderHtml` takes no arguments. The Guide is one fixed document sent to
 * everyone who asks, not a personalised clinical output: nothing recipient-
 * supplied reaches the body, so the pathway cannot be used to render attacker
 * text into an email from MyoGuard.
 */

export type ProteinGuideAsset = {
  /**
   * Template identity recorded on CommunicationEvent. Version-bound, so a
   * reissued Guide is distinguishable in the ledger from the one before it.
   */
  readonly templateId: string;

  /** Semantic version of the approved content. */
  readonly version: string;

  /** Fixed subject line. Never caller-supplied. */
  readonly subject: string;

  /** Renders the approved Guide. Takes no input by design. */
  readonly renderHtml: () => string;
};

/**
 * The approved Guide, or null when none has been approved.
 *
 * NULL TODAY — no approved Protein Guide content exists in this repository.
 * See C3F-2: PROTEIN GUIDE ASSET REQUIRED BEFORE PUBLIC DELIVERY.
 */
const CURRENT_GUIDE: ProteinGuideAsset | null = null;

/**
 * Returns the approved Guide asset, or null when delivery is not yet possible.
 *
 * Null is the fail-closed signal, exactly as it is for consent wording: the
 * caller must refuse the request rather than substitute anything of its own.
 */
export function currentProteinGuide(): ProteinGuideAsset | null {
  return CURRENT_GUIDE;
}

/** True when an approved Guide exists and the pathway can actually deliver. */
export function proteinGuideAvailable(): boolean {
  return currentProteinGuide() !== null;
}
