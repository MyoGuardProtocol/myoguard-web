/**
 * scripts/proteinGuidePdf.test.mjs
 *
 * Phase C3F-3C — the canonical PDF as a delivery artifact.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/proteinGuidePdf.test.mjs
 *
 * WHAT THIS GUARDS
 * The emailed HTML is checked line by line against the approved manuscript by
 * proteinGuideContent.test.mjs. The PDF cannot be checked that way here — it is
 * a committed binary, and nothing in the suite regenerates it. So the risk is
 * not that the PDF is wrong today; it is that the Guide changes tomorrow and
 * the PDF silently does not, leaving two documents in circulation under one
 * approved version.
 *
 * The manifest closes that gap. It records the SHA-256 of the exact document
 * the committed PDF was printed from, and this suite recomputes that signature
 * from the live renderer. Any change to the approved content or its
 * presentation breaks the match, and the suite stays red until
 * `scripts/generate-guide-pdf.mjs` is re-run.
 *
 *   [asset]  — the artifact exists, is fixed-layout, and is eight pages.
 *   [lock]   — the artifact is the current approved document, not a stale one.
 *   [safety] — the delivery mechanism exposes no recipient and grants nothing.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { renderProteinGuideHtml } from '../src/lib/guide/renderProteinGuide.ts';
import {
  PROTEIN_GUIDE_PDF_PATH,
  PROTEIN_GUIDE_PDF_TEMPLATE_ID,
  canonicalPdfSourceHtml,
  proteinGuidePdfUrl,
  SCREEN_ONLY_CLASSES,
} from '../src/lib/guide/proteinGuidePdf.ts';
import { currentProteinGuide } from '../src/lib/guide/proteinGuide.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const at = p => new URL('../' + p, import.meta.url);

const manifest = JSON.parse(
  readFileSync(at('src/lib/guide/proteinGuidePdf.manifest.json'), 'utf8'),
);
const publishedPath = 'public' + PROTEIN_GUIDE_PDF_PATH;
const pdfExists = existsSync(at(publishedPath));
const pdf = pdfExists ? readFileSync(at(publishedPath)) : Buffer.alloc(0);

const HTML = renderProteinGuideHtml();

/** Page objects in the PDF. The trailing [^s] excludes the /Pages tree node. */
const pdfPageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

section('-- A. The artifact exists and is what it claims to be --');
{
  t('[asset] the canonical PDF is published where the email points',
    pdfExists && pdf.length > 0);
  // The whole point of the artifact: pagination decided here, once, rather
  // than by the recipient's client. Eight approved pages, eight PDF pages.
  t('[asset] the PDF is exactly eight pages', pdfPageCount === 8);
  t('[asset] the PDF is a real PDF, not a placeholder',
    pdf.subarray(0, 5).toString('latin1') === '%PDF-'
    && pdf.subarray(-1024).toString('latin1').includes('%%EOF'));
  t('[asset] the committed bytes are the bytes the manifest describes',
    pdf.length === manifest.pdfBytes
    && createHash('sha256').update(pdf).digest('hex') === manifest.pdfSha256);
  t('[asset] the manifest declares the eight pages it recorded',
    manifest.pages === 8);
}

section('-- B. The artifact is the current approved document --');
{
  const signature = createHash('sha256')
    .update(canonicalPdfSourceHtml(HTML), 'utf8')
    .digest('hex');

  // THE DRIFT GUARD. If this fails, the Guide changed and the PDF did not:
  // re-run `node --import ./scripts/_resolve-ts.mjs scripts/generate-guide-pdf.mjs`
  // and commit the regenerated artifact. Do not edit the manifest by hand —
  // that would only silence the warning that the two have diverged.
  t('[lock]   the committed PDF was printed from the current Guide',
    manifest.htmlSha256 === signature);

  t('[lock]   the artifact is bound to the approved template id and version',
    manifest.templateId === PROTEIN_GUIDE_PDF_TEMPLATE_ID
    && manifest.templateId === currentProteinGuide().templateId
    && manifest.version === currentProteinGuide().version);

  // The version is in the filename so that a future approved manuscript
  // publishes alongside this one. A Guide already delivered keeps resolving to
  // the text its recipient was actually sent.
  t('[lock]   the published path carries the manuscript version',
    PROTEIN_GUIDE_PDF_PATH.includes('v1.2')
    && PROTEIN_GUIDE_PDF_TEMPLATE_ID.endsWith('v1_2'));

  // The signature must describe the printed document, not the emailed one.
  // The action block is the only part built from an environment variable, so
  // if it reached the signature a differently configured origin would fail
  // this suite while nothing about the approved content had changed.
  // The print rule `.mg-action{display:none}` legitimately survives in the
  // stylesheet — it is static. What must not survive is the action markup, and
  // with it the one value this document reads from the environment.
  t('[lock]   the signature does not depend on the configured origin',
    !canonicalPdfSourceHtml(HTML).includes('class="mg-action"')
    && !canonicalPdfSourceHtml(HTML).includes(proteinGuidePdfUrl())
    && !canonicalPdfSourceHtml(HTML).includes('href='));

  // C-FUNNEL-2 added a second screen-only block — the Preliminary SRI
  // continuation. It carries `mg-action` so the EXISTING print rule hides it,
  // which is what let it be added without a new stylesheet rule: the stylesheet
  // is static and therefore part of the signature above, so one extra CSS rule
  // would have invalidated the committed PDF while changing nothing printed.
  //
  // Every class named as screen-only must actually be stripped. If one is
  // added to that list and this fails, the block is reaching the artifact.
  t('[lock]   every declared screen-only class is stripped from the signature',
    SCREEN_ONLY_CLASSES.length === 2
    && SCREEN_ONLY_CLASSES.every(
      cls => !canonicalPdfSourceHtml(HTML).includes(`class="${cls}`)
        && !canonicalPdfSourceHtml(HTML).includes(`${cls}"`)));
  t('[lock]   the continuation block is removed, not merely hidden',
    HTML.includes('mg-continue')
    && !canonicalPdfSourceHtml(HTML).includes('mg-continue')
    && !canonicalPdfSourceHtml(HTML).includes('sri-form'));
}

section('-- C. The delivery mechanism grants nothing and exposes no one --');
{
  // Every recipient receives the identical link. No token, no per-recipient
  // path, no identifier — so the link cannot reveal who asked for the Guide,
  // cannot be correlated back to an address, and cannot be replayed to reach
  // anyone's data, because there is no data behind it.
  t('[safety] every link is the same for every recipient, and the PDF is first',
    renderProteinGuideHtml() === HTML
    && proteinGuidePdfUrl() === renderProteinGuideHtml().match(/href="([^"]+)"/)[1]);
  // Checked structurally rather than by keyword: the path is a plain versioned
  // filename under /guides, with no query string to carry anything at all.
  // (A substring scan would be worse than useless here — "guide" contains
  // "uid", so a keyword test passes or fails for the wrong reason.)
  t('[safety] the URL carries no query string, token or recipient identity',
    !proteinGuidePdfUrl().includes('?')
    && !proteinGuidePdfUrl().includes('&')
    && !proteinGuidePdfUrl().includes('#')
    && /^\/guides\/[a-z0-9.\-]+\.pdf$/.test(PROTEIN_GUIDE_PDF_PATH));
  t('[safety] the artifact is a static file, not an authenticated route',
    publishedPath.startsWith('public/')
    && !existsSync(at('app' + PROTEIN_GUIDE_PDF_PATH))
    && !existsSync(at('app/guides')));
  t('[safety] the URL is absolute, so it resolves outside a mail client',
    /^https:\/\//.test(proteinGuidePdfUrl()));

  // The PDF is printed from the same HTML as the email. If the action block
  // were not hidden in print, the artifact would carry a clickable link to
  // itself — and would have paginated to nine pages.
  t('[safety] the PDF carries no link annotations at all',
    !pdf.includes(Buffer.from('/URI')) && !pdf.includes(Buffer.from('/Annots')));
  t('[safety] the PDF contains no URL to itself or anywhere else',
    !pdf.includes(Buffer.from('guides/myoguard')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
