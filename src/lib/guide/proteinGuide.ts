/**
 * src/lib/guide/proteinGuide.ts
 *
 * The Protein Guide delivery asset, and the one place it is declared.
 *
 * WHY THE DECLARATION IS INDIRECT
 * C3F-2 built the requested-delivery pathway while the Guide itself was still
 * unwritten, and made the pathway refuse to deliver until an approved asset was
 * declared here. The alternative would have been a placeholder — an email
 * arriving under the Guide's title carrying nothing a clinician approved — and
 * for someone asking about protein at a GLP-1 dose, that is worse than sending
 * nothing.
 *
 * C3F-3C declared the asset. The indirection proved its worth: the pathway
 * needed no change at all, and the route's refusal branch still stands as the
 * behaviour whenever no approved content exists.
 *
 * This is the same shape as the consent-wording registry from C3F-1A, for the
 * same reason: the thing that must exist before the system acts is declared in
 * code, reviewable and attributable to a commit, and its absence is a refusal
 * rather than an improvisation.
 *
 * WHAT AN ASSET MAY NOT BE
 * `renderHtml` takes no arguments. The Guide is one fixed document sent to
 * everyone who asks, not a personalised clinical output: nothing recipient-
 * supplied reaches the body, so the pathway cannot be used to render attacker
 * text into an email from MyoGuard.
 */

import { GUIDE_MANUSCRIPT_VERSION } from './proteinGuideContent';
import { renderProteinGuideHtml } from './renderProteinGuide';

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
 * DECLARED — Manuscript v1.2 (C3F-3A-M2B Citation Closure), whose ten citation
 * markers are resolved against the C3F-3A-E Evidence Dossier v1.0 and whose
 * nine-reference library is attached in full. C3F-3C declared it.
 *
 * The content lives in `proteinGuideContent.ts` and its presentation in
 * `renderProteinGuide.ts`. This file stays a registry and nothing else: it
 * names which approved artefact is current, and the ledger's templateId is
 * bound to that version, so a CommunicationEvent always identifies the exact
 * document a recipient was sent.
 *
 * REISSUING
 * Never edit v1.2's wording in place. A new approved manuscript is a new
 * content module, a new `version`, and a new `templateId` — so the ledger can
 * still distinguish what was delivered before it from what was delivered after.
 */
const CURRENT_GUIDE: ProteinGuideAsset | null = {
  templateId: 'service.protein_guide.v1_2',
  version:    GUIDE_MANUSCRIPT_VERSION,
  subject:    'The MyoGuard Protein Guide',
  renderHtml: renderProteinGuideHtml,
};

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
