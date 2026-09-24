/**
 * src/lib/guide/proteinGuidePdf.ts
 *
 * Locates the canonical Protein Guide PDF — the authoritative save/print
 * artifact that the delivered email links to.
 *
 * WHY A FIXED ASSET RATHER THAN A RENDERED ONE
 * The emailed HTML is the readable surface and stays exactly that. But its
 * pagination depends on the recipient's client honouring a print stylesheet,
 * and Gmail's native print does not. Paginating once, at authoring time, and
 * shipping the result makes the printed document independent of the client,
 * the browser, the printer and the CSS support behind them.
 *
 * WHY THE URL CARRIES NOTHING ABOUT THE RECIPIENT
 * Every recipient receives the identical link. There is no token, no
 * per-recipient path and no identifier of any kind, so the link cannot leak who
 * asked for the Guide, cannot be correlated back to an address, and cannot be
 * replayed to reach anyone's data — there is no data behind it to reach. The
 * document is the same public educational material already offered to anyone
 * at /learn/protein-on-glp-1, so serving it at a stable public path crosses no
 * confidentiality boundary. The alternative — a signed per-recipient URL —
 * would manufacture a bearer-token problem to protect a document that is
 * published on request anyway.
 *
 * VERSIONING
 * The filename carries the manuscript version, so a future approved manuscript
 * publishes alongside this one rather than silently replacing it: a Guide
 * already delivered keeps resolving to the text its recipient was sent.
 */

/** Served by Next from `public/`. The version is part of the identity. */
export const PROTEIN_GUIDE_PDF_PATH = '/guides/myoguard-protein-guide-v1.2.pdf';

/** The asset this PDF is the printable form of. Kept in step with the registry. */
export const PROTEIN_GUIDE_PDF_TEMPLATE_ID = 'service.protein_guide.v1_2';

// Same resolution the unsubscribe surface uses: a configured origin wins, but a
// local one never reaches a recipient's inbox, so it falls back to production.
const PRODUCTION_URL = 'https://myoguard.health';
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
const APP_URL =
  rawAppUrl && !rawAppUrl.includes('localhost') && !rawAppUrl.includes('127.0.0.1')
    ? rawAppUrl.replace(/\/$/, '')
    : PRODUCTION_URL;

/**
 * The absolute URL for the canonical PDF.
 *
 * Absolute because a relative path in an email body resolves against the mail
 * client, where it means nothing.
 */
export function proteinGuidePdfUrl(): string {
  return `${APP_URL}${PROTEIN_GUIDE_PDF_PATH}`;
}

/**
 * The origin the Guide email builds its absolute links from.
 *
 * Exported so the email's screen-only continuation panel resolves its
 * destination exactly as the PDF action does. Two copies of this resolution
 * would eventually disagree, and the one that drifted would send recipients at
 * a localhost URL from their inbox.
 */
export const GUIDE_EMAIL_ORIGIN = APP_URL;

/**
 * Blocks that exist on screen and must never reach the printed artifact.
 *
 * Each is hidden by a `display:none` print rule AND removed here before the
 * document is hashed. Both are needed and they do different jobs: the print
 * rule keeps the block out of the paginated PDF, and this removal keeps it out
 * of the signature, so a block built from an environment variable cannot fail
 * the drift test on a differently configured origin while the approved content
 * is untouched.
 *
 *   mg-action    — the save/print action (C3F-3C).
 *   mg-continue  — the Preliminary SRI continuation (C-FUNNEL-2).
 *
 * Adding a class here is a deliberate statement that the block is not part of
 * the approved document. Anything that IS part of it must never be listed.
 */
export const SCREEN_ONLY_CLASSES = ['mg-action', 'mg-continue'] as const;

/**
 * Matches one screen-only block, whole.
 *
 * Written as a regex literal rather than assembled from the list above: in a
 * template literal `\s` collapses to a bare `s`, so a constructed pattern
 * silently matches nothing and lets the block into the signature. The suite
 * asserts this pattern covers every class named above, which is what keeps the
 * two in step.
 *
 * Non-greedy to the first `</table>`, and neither block nests a table.
 */
const SCREEN_ONLY_BLOCK =
  /<table[^>]*class="[^"]*\b(?:mg-action|mg-continue)\b[^"]*"[\s\S]*?<\/table>/g;

/**
 * The Guide as the canonical PDF is printed from it.
 *
 * The save/print action is `display:none` in print, so it contributes nothing
 * to the artifact — and it is the one part of the document built from an
 * environment variable. Removing it before hashing gives the generator and the
 * drift test a signature over the printed document alone, so a differently
 * configured origin cannot fail the suite while a genuine change to approved
 * content or its presentation still does.
 *
 * Single-sourced deliberately: the generator and the test must strip the same
 * thing, or the signature would be comparing two different documents.
 */
export function canonicalPdfSourceHtml(html: string): string {
  return html.replace(SCREEN_ONLY_BLOCK, '');
}
