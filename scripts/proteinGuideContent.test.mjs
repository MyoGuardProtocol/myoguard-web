/**
 * scripts/proteinGuideContent.test.mjs
 *
 * Phase C3F-3C — content lock for the Protein Guide production asset.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/proteinGuideContent.test.mjs
 *
 * WHAT THIS PROVES, AND WHY IT IS NOT CIRCULAR
 * The fixture at scripts/fixtures/proteinGuideV1_2.manuscript.txt was extracted
 * mechanically from the approved MyoGuard_Protein_Guide_Manuscript_v1.2.docx —
 * not written by the implementation, and not derived from the content module.
 * Section A renders the shipped Guide, reduces it to the text a patient can
 * actually see, and requires that text to be the manuscript: every approved line
 * present, in order, and nothing else visible beyond a declared allowlist of
 * presentational furniture.
 *
 * That is a two-way lock. Losing a sentence fails it. Softening one fails it.
 * Adding a heading, a reassurance, a protein target or a call to action fails
 * it, because the addition lands in the leftover check with nothing to match.
 *
 *   [lock]     — visible text equals the approved manuscript.
 *   [safety]   — an invariant whose violation would put an unapproved clinical
 *                claim, or an unapproved commercial ask, in front of a patient.
 *   [render]   — the document is usable on a phone, in a mail client, on paper.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync } from 'node:fs';
import { renderProteinGuideHtml } from '../src/lib/guide/renderProteinGuide.ts';
import { currentProteinGuide, proteinGuideAvailable } from '../src/lib/guide/proteinGuide.ts';
import { GUIDE_PAGES, GUIDE_COVER } from '../src/lib/guide/proteinGuideContent.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const HTML = renderProteinGuideHtml();

// ── Reduce the document to what a patient can see ────────────────────────────
//
// Body only, minus the hidden preheader; entities decoded; tags removed;
// whitespace collapsed. What remains is the readable surface, which is the only
// thing the content lock has an opinion about.
const visible = (() => {
  let s = HTML.slice(HTML.indexOf('<body'));
  s = s.replace(/<div style="display:none[\s\S]*?<\/div>/, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&bull;/g, ' • ')
    .replace(/&copy;/g, '©')
    .replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return s.replace(/\s+/g, ' ').trim();
})();

// ── The manuscript, as approved ──────────────────────────────────────────────
//
// '@@PAGE n' markers and the '•  ' list prefixes are manuscript layout, not
// wording: the renderer draws the bullet as a glyph and the page number as a
// numeral, so both are normalised away here. A citation marker is reattached to
// its sentence exactly where the manuscript sets it — a marker that drifted to a
// different sentence would misattribute a source, and must fail.
const fixtureLines = src('scripts/fixtures/proteinGuideV1_2.manuscript.txt')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean)
  .filter(l => !l.startsWith('@@PAGE'))
  .map(l => l.replace(/^•\s+/, ''))
  .map(l => l.replace(/\[\[CITE([^\]]+)\]\]/g, ' $1'))
  .map(l => l.replace(/^\d+\.\s+/, ''))
  .map(l => l.replace(/\s+/g, ' '));

section('-- A. The visible document is Manuscript v1.2 and nothing else --');
{
  // Every approved line, in manuscript order.
  let cursor = 0, missing = null, outOfOrder = null;
  const spans = [];
  for (const line of fixtureLines) {
    const at = visible.indexOf(line, cursor);
    if (at === -1) {
      if (visible.includes(line)) { outOfOrder ??= line; }
      else { missing ??= line; }
      break;
    }
    spans.push([at, at + line.length]);
    cursor = at + line.length;
  }
  t('[lock]   every approved manuscript line is present, verbatim'
    + (missing ? ` — missing: "${missing.slice(0, 70)}..."` : ''), missing === null);
  t('[lock]   approved lines appear in manuscript order'
    + (outOfOrder ? ` — moved: "${outOfOrder.slice(0, 70)}..."` : ''), outOfOrder === null);

  // Nothing else is visible. Anything between two approved lines must be
  // presentational furniture that this phase declared in advance.
  const ALLOWED = new Set([
    '',
    '•',                                            // list glyph
    'MyoGuard Protocol',                                 // cover eyebrow
    '© 2026 Meridian Wellness Systems LLC · myoguard.health',
  ]);
  // The save/print action, added by the Founder's C3F-3C delivery-format
  // decision. Declared here as the exact strings the renderer owns: they are
  // subtracted from a gap before it is judged, so these two may appear and
  // nothing else may travel with them. A third sentence fails the lock.
  const DECLARED_ACTION_TEXT = [
    'Download / Print the Protein Guide (PDF)',
    'The fixed eight-page version, for saving or printing.',
  ];
  // The Preliminary SRI continuation, added by the Founder's C-FUNNEL-2
  // decision after production review found a recipient opening the Guide from
  // their inbox had no route onward. Declared the same way and for the same
  // reason: these three strings may appear and nothing else may travel with
  // them. A fourth sentence fails the lock.
  //
  // The second string is a LIMIT on the claim, not a description of a feature.
  // It says the preliminary instrument is educational and that the full SRI
  // carries additional clinical factors and physician oversight. If it is ever
  // softened, this lock is where that must be noticed.
  const DECLARED_CONTINUATION_TEXT = [
    'Want to understand your own muscle-health risk?',
    "You can complete MyoGuard's Preliminary Sarcopenia Risk Index (SRI). It uses a small set of "
      + 'core inputs and is educational; your full SRI includes additional clinical factors and '
      + 'physician oversight.',
    'Complete your Preliminary SRI →',
  ];
  const isAllowedGap = g => {
    let s = g.trim();
    for (const declared of [...DECLARED_ACTION_TEXT, ...DECLARED_CONTINUATION_TEXT]) {
      s = s.split(declared).join(' ');
    }
    s = s.replace(/\s+/g, ' ').trim();
    if (ALLOWED.has(s)) return true;
    if (/^\d{2}$/.test(s)) return true;                  // page numeral, 02–08
    if (/^\d\.$/.test(s)) return true;                   // reference numeral
    return false;
  };
  const gaps = [];
  let prev = 0;
  for (const [a, b] of spans) { gaps.push(visible.slice(prev, a)); prev = b; }
  gaps.push(visible.slice(prev));
  const intruders = gaps.filter(g => !isAllowedGap(g)).map(g => g.trim());
  t('[lock]   no unapproved text is visible anywhere in the document'
    + (intruders.length ? ` — found: "${intruders[0].slice(0, 90)}"` : ''), intruders.length === 0);

  t('[lock]   all eight manuscript pages are represented',
    GUIDE_PAGES.length === 7 && GUIDE_PAGES[0].n === 2 && GUIDE_PAGES[6].n === 8
    && typeof GUIDE_COVER.title === 'string');
}

section('-- B. The nine references and the verified Page 7 values --');
{
  const refs = GUIDE_PAGES.at(-1).blocks.find(b => b.k === 'refs');
  t('[lock]   the reference library carries exactly nine references',
    refs !== undefined && refs.items.length === 9);
  t('[lock]   every reference is visible in the rendered document',
    refs.items.every(r => visible.includes(r.replace(/\s+/g, ' '))));
  t('[safety] no reference was invented — each carries a DOI',
    refs.items.every(r => /DOI\s10\./.test(r)));

  // The Page 7 amounts were verified against USDA FoodData Central in M2 and
  // carried unchanged through M2B. They are asserted individually because a
  // silent digit change here is the highest-consequence, lowest-visibility
  // defect this asset can carry.
  const P7 = [
    '1 large egg — around 6 g',
    '100 g plain Greek yogurt — around 10 g',
    '100 g cottage cheese — around 10–12 g',
    'A glass of milk (about 250 ml) — around 8 g',
    '100 g cooked chicken breast — around 31 g',
    '100 g canned tuna in water, drained — around 20 g',
    '100 g cooked white fish — around 20–25 g',
    '100 g lean cooked beef — around 26–30 g, depending on the cut',
    '100 g cooked lentils — around 9 g',
    '100 g cooked beans — around 8–9 g',
    '100 g tofu — around 10–17 g, depending on firmness and brand. Check the label.',
  ];
  t('[lock]   all eleven verified Page 7 protein amounts are unchanged',
    P7.every(v => visible.includes(v)));
  t('[lock]   the USDA source line accompanies the food values',
    visible.includes('Food composition values: USDA FoodData Central.'));
}

section('-- C. Renal safety and SRI wording are untouched --');
{
  t('[safety] the renal checkpoint states guidance is bidirectional',
    visible.includes('In some situations clinicians advise reducing protein. In others — including dialysis, and in some older adults who are frail or have low muscle — clinicians advise the opposite.'));
  t('[safety] the renal instruction to speak with a clinician first survives',
    visible.includes('If you have kidney disease or any prescribed diet, do not substantially increase your protein intake before speaking with your clinician.'));
  // The manuscript discusses kidney health at length and must keep doing so.
  // What C3F-3C prohibits is an *assessment instruction* — a number to look up,
  // a test to request, a threshold to act on. That is what this matches.
  t('[safety] no eGFR or kidney-assessment instruction was introduced',
    !/\b(eGFR|creatinine|albumin[- ]to[- ]creatinine|\bACR\b|CKD stage|kidney function (test|result|number))\b/i.test(visible));
  t('[safety] the SRI description is the approved one, unaltered',
    visible.includes('The Sarcopenia Risk Index (SRI) is a physician-led Clinical Decision Support tool that helps clinicians consider factors associated with vulnerability to sarcopenia and muscle compromise during treatment.'));
  t('[safety] the clinical disclaimer is intact',
    visible.includes('This guide is general education. It is not medical advice, it is not a diet plan, and it does not create a clinician–patient relationship.'));
}

section('-- D. No new clinical claim, target or commercial ask --');
{
  // Dossier §14 prohibitions, asserted against the rendered surface.
  t('[safety] no protein target, ratio or gram-per-kilogram figure',
    !/g\s*\/\s*kg|grams? per kilo|per kg of body|1\.\d\s*g\/kg/i.test(visible));
  t('[safety] no hydration, calorie or macro target',
    !/\b(calorie target|macro|kcal|\d+\s*(ml|litres?|liters?|glasses)\s+(of\s+)?(water|fluid) (a|per) day)\b/i.test(visible));
  t('[safety] no supplement recommendation',
    !/\b(supplement|whey|creatine|collagen|protein powder|shake)s?\b/i.test(visible));
  t('[safety] no titration or dose-adjustment guidance',
    !/\b(titrat|increase your dose|reduce your dose|adjust your dose|skip a dose)/i.test(visible));
  t('[safety] no digestibility rating or protein-quality scoring',
    !/\b(DIAAS|PDCAAS|biological value|digestibility (score|rating)|complete protein)\b/i.test(visible));
  // Page 2 explains what a body-composition scan does and does not measure, and
  // that explanation is the guide's most important clinical framing. The
  // prohibition is on telling a patient to obtain or track one.
  t('[safety] no body-composition testing or lean-mass tracking instruction',
    !/\b(DEXA|DXA|InBody|bioimpedance)\b/i.test(visible)
    && !/\b(ask for|request|get|book|arrange|repeat) (a |an )?(scan|body[- ]composition)/i.test(visible)
    && !/\b(track|monitor|check) your (lean|muscle|body composition)/i.test(visible));
  // Page 7 disclaims guarantees, which is the opposite of promising one, so the
  // bare word must not fail. Only an actual promise does.
  t('[safety] no preventive or protective promise',
    !/\b(prevents? sarcopenia|protects? your muscle|preserves? (your )?muscle|will (protect|preserve|prevent)|guarantees? (that|you|results))/i.test(visible));
  t('[safety] no "clinically proven" or "doctor-approved" framing',
    !/\b(clinically proven|doctor[- ]approved|physician[- ]approved|medically proven)\b/i.test(visible));
  // The Guide carried no link at all until the canonical PDF existed, then
  // exactly one, and now two: the PDF action and — by the Founder's C-FUNNEL-2
  // decision of 23 September 2026 — the Preliminary SRI continuation. TWO is
  // the number this assertion now defends, because a third destination is what
  // would turn a requested delivery into a surface that acquires, and would put
  // the ESSENTIAL_SERVICE classification in question.
  //
  // Order is asserted, not incidental. The PDF is FIRST, because the Guide is
  // what the recipient asked for and must remain the email's primary purpose;
  // the continuation is second and sits after all eight pages.
  const links = [...HTML.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
  t('[safety] the asset carries exactly two links, and no more',
    (HTML.match(/<a\s/g) || []).length === 2 && links.length === 2);
  t('[safety] the Guide as a PDF is the first and primary link',
    /^https:\/\/[^?#]*\/guides\/myoguard-protein-guide-v1\.2\.pdf$/.test(links[0]));
  t('[safety] the second link is the Preliminary SRI, and there is only one',
    links.filter(u => u.includes('#sri-form')).length === 1
    && links[1].includes('#sri-form'));

  // Tracking is still forbidden — but the thing that was ever forbidden is a
  // parameter that identifies the RECIPIENT. `utm_source=protein_guide_email`
  // is a fixed campaign label, byte-identical in every copy of this email, so
  // it says which email the click came from and nothing whatever about who
  // received it. It cannot be correlated back to an address and cannot be
  // replayed to reach anyone's data.
  //
  // The PDF link keeps a clean path with no query string at all, which is what
  // proteinGuidePdf.test.mjs asserts from the other side.
  const ALLOWED_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign']);
  const paramsOf = u => [...new URL(u).searchParams.keys()];
  t('[safety] the PDF link carries no query string of any kind',
    !links[0].includes('?') && !links[0].includes('&') && !links[0].includes('#'));
  t('[safety] the SRI link carries only fixed campaign attribution',
    paramsOf(links[1]).every(k => ALLOWED_PARAMS.has(k))
    && new URL(links[1]).searchParams.get('utm_source') === 'protein_guide_email');
  t('[safety] no link carries a token, address or recipient identity',
    links.every(u => !/(token=|[?&]t=|[?&]e=|uid=|email=|rid=|recipient)/i.test(u))
    && !/href="(mailto:|tel:)/i.test(HTML));
  t('[safety] the asset contains no button or commercial call to action',
    !/Click here|Get started|Book a|Sign up|Subscribe|Upgrade|Buy|Order now|Learn more|Free trial/i.test(HTML));
  // The action is a screen affordance. The canonical PDF is printed from this
  // same HTML, so if it were not hidden in print it would paginate into the
  // artifact — a ninth element, and a link to the file being read.
  t('[safety] the save/print action is excluded from the printed artifact',
    /\.mg-action\{display:none!important\}/.test(HTML)
    && (HTML.match(/class="mg-action"/g) || []).length === 1);

  // The visual specification's internal production labels. These name sections
  // for the design unit and were never patient copy; if one reached the page it
  // would read as a clinical heading the manuscript never approved.
  const INTERNAL_LABELS = [
    'Lean Mass vs. Muscle Quality',
    'Nutrition & Physical Activity',
    'Gastrointestinal Tolerability & Safety',
    'Educational Safety Checkpoint',
    'Whole-Food Protein Reference',
    'renal monitoring alerts',
  ];
  t('[safety] no internal production label leaked into patient-facing copy',
    INTERNAL_LABELS.every(l => !visible.toLowerCase().includes(l.toLowerCase())));

  // Part Two is the dossier reconciliation record. Patients must never see it.
  t('[safety] the internal citation closure record is not shipped',
    !/CITATION CLOSURE|Evidence Map|Dossier|GENERAL-EXTRAPOLATED|INCRETIN-SPECIFIC|Founder/i.test(visible));
}

section('-- E. House terminology --');
{
  t('[safety] the instrument is never called a calculator',
    !/calculator/i.test(visible));
  t('[safety] the SRI is never described as a score in patient copy',
    !/\bscores?\b/i.test(visible));
  t('[safety] the entity is named in full, never as "Meridian Health"',
    !/Meridian Health/i.test(visible) && visible.includes('Meridian Wellness Systems LLC'));
}

section('-- F. Rendering, accessibility and print --');
{
  t('[render] the document declares a charset and a mobile viewport',
    /charset="utf-8"/.test(HTML) && /width=device-width/.test(HTML));
  t('[render] layout is table-based and fluid below its 660px measure',
    /max-width:660px/.test(HTML) && /width="100%"/.test(HTML));
  t('[render] a narrow-viewport rule reduces page padding on phones',
    /@media only screen and \(max-width:620px\)/.test(HTML));
  t('[render] print rules break one manuscript page to a sheet',
    /@media print/.test(HTML) && /page-break-after:always/.test(HTML));
  t('[render] structural styling is inlined, so a client that drops <style> still renders',
    (HTML.match(/style="/g) || []).length > 150);
  // Tables here are layout, not data. Left unmarked, a screen reader would
  // announce the whole guide as forty tables and read it cell by cell.
  t('[render] every layout table is hidden from assistive technology',
    (HTML.match(/<table[^>]*>/g) || []).every(tag => /role="presentation"/.test(tag)));
  t('[render] the document is well-formed — every element is closed',
    ['table', 'tr', 'td', 'p', 'h1', 'h2', 'h3', 'sup'].every(tag =>
      (HTML.match(new RegExp('<' + tag + '[ >]', 'g')) || []).length ===
      (HTML.match(new RegExp('</' + tag + '>', 'g')) || []).length));
  t('[render] one superscript marker per manuscript citation, and no more',
    (HTML.match(/<sup/g) || []).length === 11);
  t('[render] headings descend h1 → h2 → h3 without skipping a level',
    /<h1[\s>]/.test(HTML) && /<h2[\s>]/.test(HTML) && /<h3[\s>]/.test(HTML)
    && HTML.indexOf('<h1') < HTML.indexOf('<h2') && HTML.indexOf('<h2') < HTML.indexOf('<h3'));
  // Readability overrides brand purity: teal marks structure, cream carries the
  // reading. A paragraph set in the accent colour would be the first thing to
  // go wrong if the palette were ever loosened.
  // The cover subtitle is teal and should be — it is a deck line, one of the
  // "selected structural elements" the direction allows. What must never be
  // teal is long-form reading, which is identifiable by its body line height.
  t('[render] teal never carries long-form body text',
    !(HTML.match(/<p [^>]*>/g) || []).some(
      tag => /line-height:1\.7[0-9]/.test(tag) && /color:#2DD4BF/.test(tag)));
  t('[render] body copy is the warm off-white, not pure white',
    /color:#F0EBE1/.test(HTML) && !/color:#FFFFFF/i.test(HTML));
  t('[render] the document stays well inside the Gmail clipping threshold',
    Buffer.byteLength(HTML, 'utf8') < 102000);

  // Amber is reserved for the two genuine safety passages. If it spread, the
  // document would stop reading as calm clinical education and start reading as
  // a warning notice — the opposite of the approved register.
  const amberFields = (HTML.match(/#261B0E/g) || []).length;
  t('[render] amber emphasis stays restrained — three passages at most',
    amberFields > 0 && amberFields <= 3);

  // ── Midnight Silk, on every page ─────────────────────────────────────────
  //
  // The Founder's C3F-3C visual decision. Asserted rather than eyeballed,
  // because a later edit that returns one page to a light card would otherwise
  // pass review unnoticed.
  // The final page also carries mg-page-last, so the class attribute is matched
  // loosely rather than exactly.
  const pageSurfaces = (HTML.match(/class="mg-page[^"]*"[^>]*background-color:#0F172A/g) || []).length;
  t('[render] all eight pages sit on the Midnight Navy surface',
    pageSurfaces === 8);
  t('[render] no light card surface survives anywhere in the document',
    !/background-color:#FFFFFF/i.test(HTML) && !/background-color:#F7F7F5/i.test(HTML));
  t('[render] the document declares itself dark, so mail clients do not invert it',
    /name="color-scheme" content="dark"/.test(HTML));

  // ── Clinical Parchment: the approved printed form ────────────────────────
  //
  // Screen and paper deliberately diverge. Gmail converts the document to a
  // light sheet when printing and the Founder approved that result, so the
  // print stylesheet produces the same thing rather than forcing navy onto
  // paper. The screen assertions above are what guard the Midnight Silk
  // presentation; these guard the printed one.
  // ── The blank-band defect, locked shut ──────────────────────────────────
  //
  // The printed Guide came back as ten sheets with four dark bands that read
  // as inserted blank pages. The cause was a colour split: print whitened
  // `html`, `body` and `.mg-page`, but the wrapper table carries #080C14
  // inline and was never overridden, so it painted the column Midnight Silk
  // under every white page box and showed through wherever a page fell short.
  //
  // The band cannot come back while the ground and the page surface are the
  // same colour. That is what this asserts — not a shade, but the identity.
  t('[render] the sheet ground and the page surface are the same colour in print',
    /@media print\{html,body\{background-color:#0F172A!important\}/.test(HTML)
    && /\.mg-ground\{background-color:#0F172A!important\}/.test(HTML)
    && !/@media print\{[^@]*\.mg-page\{[^}]*background/.test(HTML));
  // Midnight Silk is preserved on paper rather than converted to a light
  // sheet, so nothing may re-whiten a surface or re-colour the inlined text.
  t('[render] print preserves Midnight Silk instead of converting it',
    !/#FFFFFF!important/.test(HTML)
    && !/color:#1F2937!important/.test(HTML)
    && !/background-color:#FFF8E7!important/.test(HTML));
  // Load-bearing. Browsers drop backgrounds when printing by default; without
  // this the navy would not paint and the cream body text would print
  // white-on-white. Every surface that carries a background needs it.
  t('[render] every printed surface forces its background to paint',
    /html,body,\.mg-ground,\.mg-page,\.mg-amber\{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important\}/.test(HTML));
  // Three amber passages, unchanged in count, now split across two classes:
  // the panel carries mg-alert for its top margin, the list does not.
  t('[render] amber emphasis stays restrained — three passages, still a dark field',
    (HTML.match(/class="mg-amber mg-alert"/g) || []).length === 2
    && (HTML.match(/class="mg-amber"/g) || []).length === 1
    && /class="mg-amber[^"]*" style="[^"]*background-color:#261B0E/.test(HTML));
  // Pagination is bought with layout — paper margins, furniture margins and
  // apparatus sizing — never by shrinking what the patient actually reads.
  t('[render] print body text stays at a readable size', (() => {
    const print = HTML.slice(HTML.indexOf('@media print'), HTML.indexOf('</style>'));
    if (!/\.mg-page p,\.mg-page span,\.mg-page td,\.mg-page li\{font-size:10\.5pt!important/.test(print)) return false;
    // Everything that carries reading text must be 8pt or more. The only
    // declarations allowed below that are the superscript citation marker,
    // which is a marker rather than text, and the two hairline spacer cells.
    return print
      .split('}')
      .filter(r => /font-size:[\d.]+pt/.test(r))
      .filter(r => !/\.mg-page sup\{/.test(r))
      .every(r => parseFloat(r.match(/font-size:([\d.]+)pt/)[1]) >= 8);
  })());
  // The references are apparatus and set smaller than body copy, but they are
  // a patient's route to the evidence and must not shrink to footnote dust.
  t('[render] references are apparatus, but not below 8pt',
    /\.mg-refs td\{font-size:8pt!important/.test(HTML));
  // The hairlines are spacer cells holding font-size:0. The blanket cell rule
  // overrode both and inflated them into ~19px slabs on paper.
  t('[render] hairline rules survive the blanket print cell rule',
    /\.mg-hr td\{font-size:0!important;line-height:1px!important/.test(HTML)
    && /\.mg-rule td\{font-size:0!important;line-height:2px!important/.test(HTML));
  // The 660px reading measure is a screen constraint; on paper it only buys
  // extra lines, which is height the two dense pages cannot spare.
  t('[render] the column opens to the full printable width on paper',
    /\.mg-wrap\{width:100%!important;max-width:none!important\}/.test(HTML)
    && (HTML.match(/class="mg-wrap"/g) || []).length === 1);
  t('[render] each manuscript page starts a fresh sheet, and the last does not',
    /\.mg-page\{[^}]*page-break-after:always/.test(HTML)
    && /\.mg-page-last\{page-break-after:auto!important/.test(HTML)
    && (HTML.match(/class="mg-page mg-page-last"/g) || []).length === 1);
  // Paged-media only, so inlining them cannot touch the screen. They stop a
  // safety panel being sliced across a fold or a heading stranding itself.
  t('[render] callouts and headings carry inline keep-together rules',
    (HTML.match(/page-break-inside:avoid/g) || []).length >= 5
    && (HTML.match(/page-break-after:avoid/g) || []).length >= 25);
}

section('-- G. The asset is declared and bound to its version --');
{
  const guide = currentProteinGuide();
  t('[safety] an approved Guide asset is now declared',
    guide !== null && proteinGuideAvailable() === true);
  t('[safety] the template id names the manuscript version it delivers',
    guide.templateId === 'service.protein_guide.v1_2' && guide.version === 'v1.2');
  t('[safety] the subject line is fixed and carries no clinical claim',
    guide.subject === 'The MyoGuard Protein Guide');
  t('[safety] renderHtml takes no argument, so nothing recipient-supplied reaches the body',
    guide.renderHtml.length === 0);
  t('[safety] rendering is deterministic',
    guide.renderHtml() === guide.renderHtml());
  t('[safety] the content module holds no markup of its own',
    !/<html|<body|<!DOCTYPE|<table/i.test(src('src/lib/guide/proteinGuideContent.ts')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
