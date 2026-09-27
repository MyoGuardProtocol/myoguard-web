/**
 * src/lib/learn/evidenceExplained/registry.ts
 *
 * Every Evidence Explained manuscript in the repository.
 *
 * NOT CONNECTED TO ANY ROUTE
 * Nothing in app/, the sitemap, analytics or the CCC imports this registry.
 * A manuscript here is an editorial record, not a page; whether one could ever
 * be shown is `isManuscriptPubliclyExposable`, which answers no for all of
 * them until a separately approved public route exists.
 * scripts/evidenceExplainedManuscripts.test.mjs enforces both.
 */

import { deepFreeze, type EvidenceExplainedManuscript } from './manuscriptGovernance';
import { TREATMENT_TRANSITION_PILOT } from './manuscripts/treatmentTransitionPilot';

export const EVIDENCE_EXPLAINED_MANUSCRIPTS: readonly EvidenceExplainedManuscript[] = deepFreeze([
  TREATMENT_TRANSITION_PILOT,
]);
