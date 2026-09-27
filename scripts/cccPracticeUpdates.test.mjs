/**
 * scripts/cccPracticeUpdates.test.mjs
 *
 * Evidence Register, Step 2 — the CCC Clinical Practice Updates renderer.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs --import ./scripts/_load-tsx.mjs scripts/cccPracticeUpdates.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * Every visibility, content and ordering claim is proven by building display
 * models from synthetic register entries with the shipped
 * `buildClinicalPracticeUpdates` and rendering the shipped component to HTML
 * with react-dom/server. "Does not render" means absent from that HTML.
 *
 * A complete APPROVED CCC_ONLY fixture is proven to render first (A), so every
 * "does not render" result below is attributable to the single field changed.
 *
 * The page itself needs Clerk and Prisma, so that it keeps its access gates
 * and wires in the renderer is asserted against shipped source (L).
 *
 *   [behaviour] — calls shipped code and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would show a physician
 *                 unapproved evidence, internal rationale or PHI.
 *
 * Synthetic fixtures only. Touches no database, renders no route.
 */

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  EVIDENCE_REGISTER,
  isCCCVisible,
  cccBlockers,
  hasPatientExplainer,
  CCC_VISIBILITIES,
  EVIDENCE_QUALITY_LABELS,
  canonicalUrlProblems,
  evidenceGovernanceViolations,
  isPhoneShaped,
  terminologyFindings,
} from '../src/data/evidenceRegister.ts';
import {
  buildClinicalPracticeUpdates,
  getClinicalPracticeUpdates,
  formatIsoDate,
} from '../src/lib/practiceUpdates/clinicalPracticeUpdates.ts';
import { CITATIONS } from '../src/data/citations.ts';

const { default: ClinicalPracticeUpdates, EMPTY_STATE_TEXT } =
  await import('../src/components/doctor/intelligence/ClinicalPracticeUpdates.tsx');

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);
const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const clone = o => JSON.parse(JSON.stringify(o));
const with_ = (o, patch) => ({ ...clone(o), ...patch });
const without = (o, key) => { const c = clone(o); delete c[key]; return c; };

const renderModels = models => ReactDOMServer.renderToStaticMarkup(createElement(ClinicalPracticeUpdates, { updates: models }));
const render = entries => renderModels(buildClinicalPracticeUpdates(entries));
const shows = (entry) => render([entry]).includes(entry.title);

const FOUNDER_SENTINEL = 'FOUNDER-RATIONALE-SENTINEL';
const PUBLIC_SENTINEL = 'PUBLIC-INTEREST-SENTINEL';
const CITE = CITATIONS[0];

// Complete, valid, APPROVED CCC_ONLY entry. Synthetic — never added to the register.
const CCC = Object.freeze({
  id: 'ev-test-ccc-only',
  title: 'Fixture title CCC only',
  briefIssue: '2026-W39',
  sourceCitationId: CITE.id,
  externalSource: null,
  evidenceType: 'RCT',
  evidenceQuality: 'MODERATE',
  clinicalRelevance: 'Fixture clinical relevance text.',
  limitations: ['Fixture limitation one.', 'Fixture limitation two.'],
  myoguardImplication: { proposalOnly: true, text: 'Fixture product consideration text.' },
  visibility: 'CCC_ONLY',
  status: 'APPROVED',
  practiceClassification: 'CONSIDER',
  persistenceThemes: ['NUTRITION', 'MUSCLE_PRESERVATION'],
  publicInterestRationale: `${PUBLIC_SENTINEL} internal only.`,
  decision: { by: 'FOUNDER', at: '2026-09-20', rationale: `${FOUNDER_SENTINEL} internal only.` },
  explainerSlug: null,
  publishedAt: null,
  lastReviewedAt: '2026-09-20',
  reviewDueAt: '2027-03-20',
});
const PUBLIC_APPROVED = Object.freeze(with_(CCC, {
  id: 'ev-test-public-approved', title: 'Fixture title public approved',
  visibility: 'PUBLIC_AND_CCC', explainerSlug: 'fixture-public-approved',
}));
const MYTH_PUBLISHED = Object.freeze(with_(CCC, {
  id: 'ev-test-myth-published', title: 'Fixture title myth published',
  visibility: 'PUBLIC_MYTH_CORRECTION', status: 'PUBLISHED',
  explainerSlug: 'fixture-myth-published', publishedAt: '2026-09-21',
}));

// ── A. Eligible entries render (positive controls) ───────────────────────────
section('-- A. Complete Founder-approved entries render --');
{
  for (const [name, e] of [['APPROVED CCC_ONLY', CCC], ['APPROVED PUBLIC_AND_CCC', PUBLIC_APPROVED], ['PUBLISHED PUBLIC_MYTH_CORRECTION', MYTH_PUBLISHED]]) {
    t(`[behaviour] A. ${name} is CCC-visible`, isCCCVisible(e));
    if (!isCCCVisible(e)) cccBlockers(e).forEach(m => console.log('        ' + m));
    t(`[behaviour] A. ${name} renders`, shows(e));
  }
  const published = with_(CCC, { status: 'PUBLISHED', publishedAt: '2026-09-21', id: 'ev-test-ccc-published', title: 'Fixture ccc published' });
  t('[behaviour] A. PUBLISHED CCC_ONLY renders', shows(published));
  t('[ordering] A. the CCC visibilities are exactly CCC_ONLY, PUBLIC_AND_CCC, PUBLIC_MYTH_CORRECTION',
    JSON.stringify(CCC_VISIBILITIES) === JSON.stringify(['CCC_ONLY', 'PUBLIC_AND_CCC', 'PUBLIC_MYTH_CORRECTION']));
}

// ── B. Rendered fields ───────────────────────────────────────────────────────
section('-- B. Each approved item shows the specified fields --');
{
  const html = render([CCC]);
  t('[behaviour] B. title', html.includes('Fixture title CCC only'));
  t('[behaviour] B. evidence-quality label', html.includes('Moderate certainty'));
  t('[behaviour] B. evidence type', html.includes('RCT'));
  t('[behaviour] B. practice classification label', html.includes('>Consider<'));
  t('[behaviour] B. clinical relevance', html.includes('Fixture clinical relevance text.'));
  t('[behaviour] B. key limitations, every one',
    html.includes('Key limitations') && html.includes('Fixture limitation one.') && html.includes('Fixture limitation two.'));
  t('[behaviour] B. implication, labelled "Product consideration only"',
    html.includes('Product consideration only') && html.includes('Fixture product consideration text.'));
  t('[behaviour] B. persistence-theme labels', html.includes('>Nutrition<') && html.includes('>Muscle preservation<'));
  t('[behaviour] B. source citation with DOI link',
    html.includes(CITE.journal) && html.includes(`href="https://doi.org/${CITE.doi}"`));
  t('[behaviour] B. external link opens safely in a new tab',
    /target="_blank" rel="noopener noreferrer"/.test(html) && html.includes('(opens in a new tab)'));
  t('[behaviour] B. last-reviewed date', html.includes('<time dateTime="2026-09-20">20 Sep 2026</time>'));
  t('[behaviour] B. review-due date', html.includes('<time dateTime="2027-03-20">20 Mar 2027</time>'));
  t('[behaviour] B. explainer status', html.includes('Clinical note only'));
  t('[behaviour] B. CDS framing is present', /physician-led Clinical Decision Support/.test(html));

  const noThemes = render([with_(CCC, { persistenceThemes: [] })]);
  t('[behaviour] B. themes block is omitted when there are none', !noThemes.includes('>Themes<'));

  const ext = with_(CCC, {
    sourceCitationId: null,
    externalSource: { description: 'Fixture verified external source.', doi: null, pmid: '12345678', canonicalUrl: null, identifiersConfirmed: true },
  });
  const extHtml = render([ext]);
  t('[behaviour] B. verified external source renders with PubMed link',
    extHtml.includes('Fixture verified external source.') && extHtml.includes('href="https://pubmed.ncbi.nlm.nih.gov/12345678/"'));
  t('[behaviour] B. dates format deterministically', formatIsoDate('2026-01-05') === '5 Jan 2026');
}

// ── C. Non-approved statuses never render ────────────────────────────────────
section('-- C. DRAFT, HELD, REJECTED and WITHDRAWN never render --');
{
  for (const status of ['DRAFT', 'HELD', 'REJECTED', 'WITHDRAWN']) {
    for (const base of [CCC, PUBLIC_APPROVED, MYTH_PUBLISHED]) {
      const e = with_(base, { status });
      t(`[safety] C. ${status} ${base.visibility} does not render`, !isCCCVisible(e) && !shows(e));
    }
  }
}

// ── D. Internal dispositions never render ────────────────────────────────────
section('-- D. WATCHLIST and NO_PUBLICATION never render --');
{
  for (const vis of ['WATCHLIST', 'NO_PUBLICATION']) {
    for (const status of ['DRAFT', 'HELD', 'REJECTED', 'WITHDRAWN', 'APPROVED', 'PUBLISHED']) {
      const e = with_(CCC, { visibility: vis, status, publishedAt: status === 'PUBLISHED' ? '2026-09-21' : null });
      t(`[safety] D. ${vis} ${status} does not render`, !isCCCVisible(e) && !shows(e));
    }
  }
}

// ── E. Missing governance blocks rendering ───────────────────────────────────
section('-- E. Missing decision, unverified source, ungraded or unclassified evidence block rendering --');
{
  const cases = {
    'decision null': with_(CCC, { decision: null }),
    'decision absent': without(CCC, 'decision'),
    'decision.by not FOUNDER': with_(CCC, { decision: { ...CCC.decision, by: 'ADMIN' } }),
    'decision.rationale blank': with_(CCC, { decision: { ...CCC.decision, rationale: ' ' } }),
    'decision.at invalid': with_(CCC, { decision: { ...CCC.decision, at: '2026-13-01' } }),
    'unverified external source': with_(CCC, {
      sourceCitationId: null,
      externalSource: { description: 'Unverified fixture source.', doi: '10.1000/x', pmid: null, canonicalUrl: null, identifiersConfirmed: false },
    }),
    'verified external source without DOI or PMID': with_(CCC, {
      sourceCitationId: null,
      externalSource: { description: 'No identifier fixture.', doi: null, pmid: null, canonicalUrl: null, identifiersConfirmed: true },
    }),
    'citation not in the library': with_(CCC, { sourceCitationId: 'not-a-real-citation' }),
    'ungraded evidence': with_(CCC, { evidenceQuality: 'NOT_YET_GRADED' }),
    'unclassified evidence': with_(CCC, { evidenceType: 'PENDING_CLASSIFICATION' }),
    'no review dates': with_(CCC, { lastReviewedAt: null, reviewDueAt: null }),
  };
  for (const [name, e] of Object.entries(cases)) {
    t(`[safety] E. ${name} does not render`, !shows(e));
  }
  const unverifiedHtml = render([cases['unverified external source']]);
  t('[safety] E. unverified source metadata never reaches the HTML', !unverifiedHtml.includes('Unverified fixture source.'));
}

// ── F. Invalid entries fail closed ───────────────────────────────────────────
section('-- F. Invalid entries fail closed --');
{
  for (const bad of [null, undefined, 'entry', 42, [], {}]) {
    t(`[safety] F. ${JSON.stringify(bad) ?? 'undefined'} yields no update`,
      !isCCCVisible(bad) && buildClinicalPracticeUpdates([bad]).length === 0);
  }
  for (const key of ['title', 'status', 'visibility', 'limitations', 'myoguardImplication', 'reviewDueAt']) {
    t(`[safety] F. entry missing "${key}" does not render`, buildClinicalPracticeUpdates([without(CCC, key)]).length === 0);
  }
  t('[safety] F. unknown status does not render', !shows(with_(CCC, { status: 'LIVE' })));
  t('[safety] F. prohibited terminology makes an entry invalid',
    !shows(with_(CCC, { clinicalRelevance: 'Improves the SRI score.' })));
  t('[safety] F. a valid entry beside invalid ones still renders alone',
    buildClinicalPracticeUpdates([null, {}, CCC, with_(CCC, { status: 'DRAFT', id: 'x-draft' })]).map(u => u.id).join() === CCC.id);
}

// ── G. The production seed stays invisible ───────────────────────────────────
section('-- G. The production register renders the empty state --');
{
  const seed = EVIDENCE_REGISTER.find(e => e.id === 'ev-2026-w39-treatment-discontinuation');
  t('[safety] G. the seed is not CCC-visible', !!seed && !isCCCVisible(seed));
  t('[safety] G. production updates are empty', getClinicalPracticeUpdates().length === 0);
  const html = renderModels(getClinicalPracticeUpdates());
  t('[safety] G. production render is the empty state', html.includes(EMPTY_STATE_TEXT));
  t('[safety] G. the seed title is absent', !html.includes(seed.title));
  t('[safety] G. the seed id is absent', !html.includes(seed.id));
  t('[safety] G. no update list is rendered', !html.includes('<ul') && !html.includes('<article'));
}

// ── H. Internal rationale never renders ──────────────────────────────────────
section('-- H. Founder and public-interest rationale never render --');
{
  const html = render([CCC, PUBLIC_APPROVED, MYTH_PUBLISHED]);
  t('[safety] H. Founder decision rationale absent', !html.includes(FOUNDER_SENTINEL));
  t('[safety] H. public-interest rationale absent', !html.includes(PUBLIC_SENTINEL));
  const keys = Object.keys(buildClinicalPracticeUpdates([CCC])[0]).sort();
  const expected = ['clinicalRelevance', 'evidenceQualityLabel', 'evidenceTypeLabel', 'explainerStatus', 'id',
    'lastReviewedAt', 'lastReviewedLabel', 'limitations', 'persistenceThemeLabels', 'practiceClassification',
    'practiceClassificationLabel', 'productConsideration', 'reviewDueAt', 'reviewDueLabel', 'source', 'title'].sort();
  t('[safety] H. the display model carries exactly the whitelisted fields', JSON.stringify(keys) === JSON.stringify(expected));
  t('[safety] H. no decision, rationale, slug or visibility on the display model',
    !keys.some(k => /decision|rationale|publicInterest|explainerSlug|visibility/i.test(k) || k === 'status'));
}

// ── I. No patient-level field or PHI can render ──────────────────────────────
section('-- I. No patient-level field or PHI can render --');
{
  for (const f of ['patientId', 'userId', 'email', 'dateOfBirth', 'mrn', 'assessmentId']) {
    const e = { ...clone(CCC), [f]: 'fixture-value' };
    t(`[safety] I. an entry carrying "${f}" does not render`, !shows(e) && !render([e]).includes('fixture-value'));
  }
  for (const s of ['Contact jane.doe@example.com', 'A 54-year-old woman on therapy', 'Patient A lost muscle', 'Call (307) 555-0142']) {
    const e = with_(CCC, { clinicalRelevance: s });
    t(`[safety] I. PHI-shaped text "${s}" does not render`, !shows(e) && !render([e]).includes(s));
  }
}

// ── J. Patient explainer status ──────────────────────────────────────────────
section('-- J. "Patient explainer available" only when every public condition holds --');
{
  const LABEL = 'Patient explainer available';
  t('[behaviour] J. PUBLISHED public entry with slug shows it',
    hasPatientExplainer(MYTH_PUBLISHED) && render([MYTH_PUBLISHED]).includes(LABEL));
  t('[behaviour] J. PUBLISHED PUBLIC_AND_CCC with slug shows it',
    render([with_(PUBLIC_APPROVED, { status: 'PUBLISHED', publishedAt: '2026-09-21' })]).includes(LABEL));
  const noteOnly = {
    'APPROVED public (not yet published)': PUBLIC_APPROVED,
    'PUBLISHED CCC_ONLY': with_(CCC, { status: 'PUBLISHED', publishedAt: '2026-09-21' }),
    'APPROVED CCC_ONLY': CCC,
  };
  for (const [name, e] of Object.entries(noteOnly)) {
    const html = render([e]);
    t(`[safety] J. ${name} shows "Clinical note only", never the explainer label`,
      html.includes('Clinical note only') && !html.includes(LABEL) && !hasPatientExplainer(e));
  }
  t('[safety] J. PUBLISHED public without a slug is invalid and not rendered at all',
    !shows(with_(MYTH_PUBLISHED, { explainerSlug: null })));
  t('[safety] J. PUBLISHED public without publicInterestRationale is not rendered',
    !shows(with_(MYTH_PUBLISHED, { publicInterestRationale: null })));
  t('[safety] J. no explainer link is rendered (no public page exists yet)',
    !render([MYTH_PUBLISHED]).includes('/learn/'));
}

// ── K. Ordering ──────────────────────────────────────────────────────────────
section('-- K. Order: practice classification, then most recently reviewed, then id --');
{
  const mk = (id, practiceClassification, lastReviewedAt) =>
    with_(CCC, { id, title: `Order ${id}`, practiceClassification, lastReviewedAt, reviewDueAt: '2027-12-31' });
  const items = [
    mk('ev-k-not-ready', 'NOT_READY', '2026-09-25'),
    mk('ev-k-monitor', 'MONITOR', '2026-09-25'),
    mk('ev-k-consider-old', 'CONSIDER', '2026-01-10'),
    mk('ev-k-consider-b', 'CONSIDER', '2026-09-01'),
    mk('ev-k-practice-now', 'PRACTICE_NOW', '2025-12-01'),
    mk('ev-k-consider-a', 'CONSIDER', '2026-09-01'),
  ];
  const expected = ['ev-k-practice-now', 'ev-k-consider-a', 'ev-k-consider-b', 'ev-k-consider-old', 'ev-k-monitor', 'ev-k-not-ready'];
  const order = list => buildClinicalPracticeUpdates(list).map(u => u.id);
  t('[behaviour] K. order follows the approved priority', JSON.stringify(order(items)) === JSON.stringify(expected));
  t('[behaviour] K. order is independent of input order (reversed)', JSON.stringify(order([...items].reverse())) === JSON.stringify(expected));
  const shuffled = [items[3], items[0], items[5], items[1], items[4], items[2]];
  t('[behaviour] K. order is independent of input order (shuffled)', JSON.stringify(order(shuffled)) === JSON.stringify(expected));
  const html = render(shuffled);
  const pos = expected.map(id => html.indexOf(`Order ${id}`));
  t('[behaviour] K. rendered HTML follows the same order', pos.every((p, i) => p > -1 && (i === 0 || p > pos[i - 1])));
  // Visible text only: inline styles carry hex colours such as #1A2744.
  const visible = html.replace(/<[^>]+>/g, ' ');
  t('[safety] K. no ranking number or "score" is rendered', !/\bscore|calculator|\brank|#\d/i.test(visible));
}

// ── L. Empty state, UI constraints and the page ──────────────────────────────
section('-- L. Empty state, controls, accessibility and the page wiring --');
{
  const empty = renderModels([]);
  t('[behaviour] L. empty input renders the empty state', empty.includes(EMPTY_STATE_TEXT) && empty.includes('Institutional Bulletin'));
  t('[behaviour] L. all-ineligible input renders the empty state',
    render([with_(CCC, { status: 'DRAFT' }), with_(CCC, { visibility: 'WATCHLIST', status: 'HELD' })]).includes(EMPTY_STATE_TEXT));
  t('[behaviour] L. empty-state wording', EMPTY_STATE_TEXT === 'No approved clinical practice updates are available at this time.');

  const html = render([CCC, PUBLIC_APPROVED, MYTH_PUBLISHED]);
  t('[safety] L. no interactive controls (button, form, input, select, textarea)',
    !/<(button|form|input|select|textarea)\b/i.test(html));
  t('[safety] L. no edit, approve, publish or delete control labels', !/>\s*(Edit|Approve|Publish|Delete)\b/.test(html));
  t('[behaviour] L. each article is labelled by its heading',
    /<article aria-labelledby="cpu-ev-test-ccc-only"/.test(html) && /<h3 id="cpu-ev-test-ccc-only"/.test(html));
  t('[behaviour] L. the list is labelled', html.includes('aria-label="Approved clinical practice updates"'));
  t('[behaviour] L. chips and source text wrap on narrow screens',
    /flex-wrap:wrap/.test(html) && /overflow-wrap:anywhere/.test(html));

  const comp = src('src/components/doctor/intelligence/ClinicalPracticeUpdates.tsx');
  t('[ordering] L. the component is a server component with type-only imports',
    !/['"]use client['"]/.test(comp) && (comp.match(/^import\s[^;]+;/gm) ?? []).every(i => /^import type /.test(i)));
  t('[ordering] L. the component has no data access', !/prisma|fetch\s*\(|EVIDENCE_REGISTER/.test(comp));

  const view = src('src/lib/practiceUpdates/clinicalPracticeUpdates.ts');
  t('[ordering] L. the view module has no Prisma, network or patient-engine access',
    !/from ['"][^'"]*prisma|fetch\s*\(|from ['"][^'"]*src\/lib\/evidence\//.test(view));

  const page = src('app/doctor/practice-intelligence/page.tsx');
  t('[ordering] L. the page renders the component from getClinicalPracticeUpdates()',
    /<ClinicalPracticeUpdates updates=\{getClinicalPracticeUpdates\(\)\} \/>/.test(page));
  t('[ordering] L. the page does not read the register directly', !/EVIDENCE_REGISTER|evidenceRegister/.test(page));
  t('[ordering] L. the old placeholder bulletin text is gone', !page.includes('Clinical practice bulletins will appear here'));
  t('[safety] L. sign-in gate unchanged', page.includes("if (!userId) redirect('/doctor/sign-in');"));
  t('[safety] L. PHYSICIAN_PENDING gate unchanged', page.includes("if (user.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');"));
  t('[safety] L. PHYSICIAN role gate unchanged', page.includes("if (user.role !== 'PHYSICIAN')         redirect('/dashboard');"));
  t('[safety] L. ACTIVE subscription gate unchanged',
    page.includes("if (user.subscriptionStatus !== 'ACTIVE') {") && page.includes("redirect('/doctor/billing?status=access_required');"));
}

// ── M. Source identifiers and canonical URLs ─────────────────────────────────
section('-- M. DOI, PMID or canonical URL; canonical URLs validated; quality unaffected --');
{
  const src_ = (doi, pmid, canonicalUrl, identifiersConfirmed = true) => ({
    sourceCitationId: null,
    externalSource: { description: 'Fixture external source.', doi, pmid, canonicalUrl, identifiersConfirmed },
  });
  const ext = (doi, pmid, url, confirmed, patch = {}) => with_(CCC, { ...src_(doi, pmid, url, confirmed), ...patch });
  const URL_OK = 'https://www.fda.gov/drugs/drug-safety-and-availability/fixture-communication';
  const hrefOf = e => buildClinicalPracticeUpdates([e])[0]?.source.href ?? null;

  t('[behaviour] M. verified DOI-only source renders', shows(ext('10.1000/fixture', null, null)) && hrefOf(ext('10.1000/fixture', null, null)) === 'https://doi.org/10.1000/fixture');
  t('[behaviour] M. verified PMID-only source renders', shows(ext(null, '12345678', null)) && hrefOf(ext(null, '12345678', null)) === 'https://pubmed.ncbi.nlm.nih.gov/12345678/');
  t('[behaviour] M. verified canonical-URL-only source renders', shows(ext(null, null, URL_OK)) && hrefOf(ext(null, null, URL_OK)) === URL_OK);
  t('[behaviour] M. rendered canonical link is the exact URL', render([ext(null, null, URL_OK)]).includes(`href="${URL_OK}"`));
  t('[safety] M. a source with none of the three does not render', !shows(ext(null, null, null)));
  t('[safety] M. an unverified canonical URL does not render',
    !shows(ext(null, null, URL_OK, false)) && !render([ext(null, null, URL_OK, false)]).includes(URL_OK));

  t('[behaviour] M. DOI takes priority over PMID and canonical URL', hrefOf(ext('10.1000/fixture', '12345678', URL_OK)) === 'https://doi.org/10.1000/fixture');
  t('[behaviour] M. PMID takes priority over canonical URL', hrefOf(ext(null, '12345678', URL_OK)) === 'https://pubmed.ncbi.nlm.nih.gov/12345678/');

  const valid = [
    URL_OK,
    'https://clinicaltrials.gov/study/NCT01234567?tab=results',
    'https://www.nice.org.uk/guidance/fixture#section-2',
    'https://www.ema.europa.eu/en/medicines/human/fixture',
  ];
  for (const u of valid) {
    t(`[behaviour] M. accepted: ${u}`, canonicalUrlProblems(u).length === 0 && shows(ext(null, null, u)));
  }

  const invalid = {
    'HTTP': 'http://www.fda.gov/drugs/fixture',
    'relative path': '/drugs/fixture',
    'scheme-less host': 'www.fda.gov/drugs/fixture',
    'javascript scheme': 'javascript:alert(1)',
    'data scheme': 'data:text/html,hello',
    'embedded user and password': 'https://user:secret@www.fda.gov/drugs/fixture',
    'embedded user': 'https://user@www.fda.gov/drugs/fixture',
    'localhost': 'https://localhost/fixture',
    'localhost subdomain': 'https://api.localhost/fixture',
    'IPv4 loopback': 'https://127.0.0.1/fixture',
    'IPv4 loopback, decimal form': 'https://2130706433/fixture',
    'IPv4 loopback, hex form': 'https://0x7f.0.0.1/fixture',
    'IPv6 loopback': 'https://[::1]/fixture',
    'private 10/8': 'https://10.0.0.5/fixture',
    'private 172.16/12': 'https://172.16.4.2/fixture',
    'private 192.168/16': 'https://192.168.1.10/fixture',
    'link-local metadata address': 'https://169.254.169.254/latest/meta-data',
    'IPv6 unique-local': 'https://[fd00::1]/fixture',
    'IPv4-mapped IPv6 private': 'https://[::ffff:192.168.1.1]/fixture',
    'single-label host': 'https://intranet/fixture',
    '.local host': 'https://server.local/fixture',
    'bit.ly': 'https://bit.ly/3abcDEF',
    'tinyurl.com': 'https://tinyurl.com/fixture',
    't.co': 'https://t.co/abc123',
    'goo.gl': 'https://goo.gl/abc',
    'ow.ly': 'https://ow.ly/abc',
    'lnkd.in': 'https://lnkd.in/abc',
    'shortener subdomain': 'https://www.bit.ly/abc',
    'utm_ tracking': 'https://www.fda.gov/drugs/fixture?utm_source=newsletter',
    'fbclid tracking': 'https://www.fda.gov/drugs/fixture?fbclid=abc',
    'gclid tracking': 'https://www.fda.gov/drugs/fixture?gclid=abc',
    'mailchimp tracking': 'https://www.fda.gov/drugs/fixture?mc_cid=abc',
    'surrounding whitespace': ' https://www.fda.gov/drugs/fixture',
    'empty string': '',
  };
  for (const [name, u] of Object.entries(invalid)) {
    const e = ext(null, null, u);
    t(`[safety] M. rejected (${name})`,
      canonicalUrlProblems(u).length > 0 && evidenceGovernanceViolations(e).length > 0 && !shows(e) && (u === '' || !render([e]).includes(u)));
  }
  t('[safety] M. an invalid canonical URL invalidates the entry even beside a DOI',
    !shows(ext('10.1000/fixture', null, 'http://www.fda.gov/x')));
  t('[safety] M. a missing canonicalUrl key fails closed', (() => {
    const e = clone(ext('10.1000/fixture', null, null));
    delete e.externalSource.canonicalUrl;
    return !shows(e) && evidenceGovernanceViolations(e).some(m => /missing required field "canonicalUrl"/.test(m));
  })());

  // Source type identifies; it never grades.
  for (const q of ['HIGH', 'MODERATE', 'LOW', 'VERY_LOW']) {
    const variants = [
      ['library citation', with_(CCC, { evidenceQuality: q })],
      ['DOI', ext('10.1000/fixture', null, null, true, { evidenceQuality: q })],
      ['PMID', ext(null, '12345678', null, true, { evidenceQuality: q })],
      ['canonical URL', ext(null, null, URL_OK, true, { evidenceQuality: q })],
    ];
    const labels = variants.map(([, e]) => buildClinicalPracticeUpdates([e])[0]?.evidenceQualityLabel);
    t(`[safety] M. ${q}: quality label identical across all source types (${labels[0]})`,
      labels.every(l => l === EVIDENCE_QUALITY_LABELS[q]));
  }
  const typeLabels = [
    with_(CCC, { evidenceType: 'Observational' }),
    ext(null, null, URL_OK, true, { evidenceType: 'Observational' }),
  ].map(e => buildClinicalPracticeUpdates([e])[0]?.evidenceTypeLabel);
  t('[safety] M. evidence type label unchanged by a canonical URL', typeLabels.every(l => l === 'Observational'));

  const seed = EVIDENCE_REGISTER.find(e => e.id === 'ev-2026-w39-treatment-discontinuation');
  // Step 3 verified the seed's DOI and PMID; verification alone never makes it CCC-visible.
  t('[safety] M. the seed records canonicalUrl: null and stays DRAFT, undecided and invisible',
    seed.externalSource.canonicalUrl === null && seed.status === 'DRAFT' && seed.decision === null &&
    seed.externalSource.identifiersConfirmed === true && !isCCCVisible(seed));
}

// ── N. Structured identifiers vs the generic PHI detector ────────────────────
section('-- N. Long numeric source ids pass; PHI in URLs and human text is refused --');
{
  const ext = (doi, pmid, canonicalUrl) => with_(CCC, {
    sourceCitationId: null,
    externalSource: { description: 'Fixture external source.', doi, pmid, canonicalUrl, identifiersConfirmed: true },
  });
  const ok = u => canonicalUrlProblems(u).length === 0 && evidenceGovernanceViolations(ext(null, null, u)).length === 0 && shows(ext(null, null, u));

  const longIdUrls = {
    'regulator, 10-digit document id in path': 'https://www.fda.gov/media/1234567890/download',
    'regulator, 12-digit id in query': 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=215356123456',
    'regulator, long id in fragment': 'https://www.ema.europa.eu/en/documents/fixture#doc-12345678901234',
    'trial registry, NCT id': 'https://clinicaltrials.gov/study/NCT01234567?tab=results',
    'trial registry, EU CT number': 'https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en&EUCT=2023-123456-78-00',
    'publication, long article number': 'https://www.thelancet.com/journals/lancet/article/PIIS0140673623012345678/fulltext',
    'guideline, dated long id': 'https://www.nice.org.uk/guidance/ng246/resources/fixture-66143965123456',
  };
  for (const [name, u] of Object.entries(longIdUrls)) {
    t(`[behaviour] N. passes: ${name}`, ok(u));
    if (!ok(u)) console.log('        ' + JSON.stringify([...canonicalUrlProblems(u), ...evidenceGovernanceViolations(ext(null, null, u))]));
  }

  // Structured identifiers remain valid and are not read by the generic detector.
  for (const [name, doi, pmid] of [
    ['DOI with a long numeric suffix', '10.1016/j.cmet.2024.1234567890', null],
    ['DOI from the library', '10.1056/NEJMoa2032183', null],
    ['8-digit PMID', null, '33567185'],
    ['9-digit PMID', null, '123456789'],
  ]) {
    t(`[behaviour] N. structured identifier valid: ${name}`, evidenceGovernanceViolations(ext(doi, pmid, null)).length === 0 && shows(ext(doi, pmid, null)));
  }
  for (const [name, doi, pmid] of [
    ['a 10-digit PMID (phone-length)', null, '3075550142'],
    ['a PMID with separators', null, '307-555-0142'],
    ['a DOI that is an email', 'jane.doe@example.com', null],
    ['a DOI without the 10. prefix', '1056/NEJMoa2032183', null],
  ]) {
    t(`[safety] N. structured identifier rejected: ${name}`, evidenceGovernanceViolations(ext(doi, pmid, null)).length > 0 && !shows(ext(doi, pmid, null)));
  }

  const B = 'https://www.fda.gov/drugs/fixture';
  const phiUrls = {
    'patientId in query': `${B}?patientId=A123`,
    'patient_id in query': `${B}?patient_id=A123`,
    'Patient-ID in query (normalised)': `${B}?Patient-ID=A123`,
    'patient in query': `${B}?patient=jane`,
    'patientName in query (patient prefix)': `${B}?patientName=jane`,
    'MRN in query': `${B}?MRN=445566`,
    'mrn in query': `${B}?mrn=445566`,
    'medicalRecordNumber in query': `${B}?medicalRecordNumber=445566`,
    'dob in query': `${B}?dob=1970-01-01`,
    'dateOfBirth in query': `${B}?dateOfBirth=1970-01-01`,
    'email key in query': `${B}?email=x`,
    'phone key in query': `${B}?phone=x`,
    'memberId in query': `${B}?memberId=77`,
    'accountNumber in query': `${B}?accountNumber=77`,
    'clerkUserId in query': `${B}?clerkUserId=x`,
    'patient key in fragment parameters': `${B}#patientId=A123`,
    'email-shaped query value': `${B}?ref=jane.doe%40example.com`,
    'email-shaped value, unencoded': `${B}?contact=jane.doe@example.com`,
    'phone-shaped query value, North American': `${B}?contact=307-555-0142`,
    'phone-shaped query value, bracketed': `${B}?contact=(307)%20555-0142`,
    'phone-shaped query value, international encoded +': `${B}?contact=%2B13075550142`,
    'phone-shaped query value, international raw +': `${B}?contact=+13075550142`,
    'phone-shaped query value, UK national': `${B}?contact=020%207946%200958`,
    'Clerk user id in query value': `${B}?u=user_2abcdefghijklmnopqrstuvwx`,
    'Clerk user id in fragment': `${B}#user_2abcdefghijklmnopqrstuvwx`,
    'Clerk user id in path': 'https://www.fda.gov/users/user_2abcdefghijklmnopqrstuvwx/page',
    'cuid record id in query value': `${B}?id=ckz1a2b3c4d5e6f7g8h9i0j1k`,
    'cuid record id in fragment parameters': `${B}#ref=ckz1a2b3c4d5e6f7g8h9i0j1k`,
    'embedded credentials': 'https://jane:secret@www.fda.gov/drugs/fixture',
  };
  for (const [name, u] of Object.entries(phiUrls)) {
    t(`[safety] N. rejected: ${name}`, canonicalUrlProblems(u).length > 0 && !shows(ext(null, null, u)));
  }
  t('[behaviour] N. an unbroken 10-digit query value is a document id, not a phone number', !isPhoneShaped('1234567890'));
  t('[behaviour] N. an EU CT number is not a phone number', !isPhoneShaped('2023-123456-78-00'));

  // Human-authored text keeps the complete PHI detector, long-digit rule included.
  const humanFields = [
    ['title', s => ({ title: s })],
    ['externalSource.description', s => ({
      sourceCitationId: null,
      externalSource: { description: s, doi: '10.1000/fixture', pmid: null, canonicalUrl: null, identifiersConfirmed: true },
    })],
    ['clinicalRelevance', s => ({ clinicalRelevance: s })],
    ['limitations', s => ({ limitations: [s] })],
    ['myoguardImplication.text', s => ({ myoguardImplication: { proposalOnly: true, text: s } })],
    ['publicInterestRationale', s => ({ publicInterestRationale: s })],
    ['decision.rationale', s => ({ decision: { ...CCC.decision, rationale: s } })],
  ];
  for (const [name, patch] of humanFields) {
    for (const s of ['Reference 3075550142 noted', 'Call (307) 555-0142', 'Contact jane.doe@example.com']) {
      const e = with_(CCC, patch(s));
      t(`[safety] N. PHI-shaped "${s}" still rejected in ${name}`,
        evidenceGovernanceViolations(e).some(m => /possible PHI/.test(m)) && !shows(e));
    }
  }

  // URL-security rules from the previous refinement are unchanged.
  for (const u of ['http://www.fda.gov/x', '/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x',
                   'https://10.0.0.5/x', 'https://bit.ly/abc', 'https://www.fda.gov/x?utm_source=a']) {
    t(`[safety] N. URL-security rule still rejects ${u}`, canonicalUrlProblems(u).length > 0);
  }

  const seed = EVIDENCE_REGISTER.find(e => e.id === 'ev-2026-w39-treatment-discontinuation');
  t('[safety] N. the DRAFT seed remains valid, invisible and absent from production output',
    evidenceGovernanceViolations(seed).length === 0 && seed.status === 'DRAFT' && !isCCCVisible(seed) &&
    getClinicalPracticeUpdates().length === 0 && !renderModels(getClinicalPracticeUpdates()).includes(seed.id));
}

// ── O. Terminology guardrail: about MyoGuard, not about the words ────────────
section('-- O. MyoGuard/SRI never a score or calculator; third-party citation stays accurate --');
{
  const ext = (patch) => with_(CCC, {
    sourceCitationId: null,
    externalSource: { description: 'Fixture external source.', doi: '10.1000/fixture', pmid: null, canonicalUrl: null, identifiersConfirmed: true, ...patch },
  });
  const valid = e => evidenceGovernanceViolations(e).length === 0 && shows(e);
  const termViolation = e => evidenceGovernanceViolations(e).some(m => /prohibited terminology/.test(m));

  // Structured identifiers are never terminology-checked.
  t('[behaviour] O. a canonical URL containing "score" passes',
    valid(ext({ doi: null, canonicalUrl: 'https://www.mdcalc.com/calc/3945/sarc-f-score-sarcopenia' })));
  t('[behaviour] O. a canonical URL containing "risk-score-calculator" passes',
    valid(ext({ doi: null, canonicalUrl: 'https://www.nice.org.uk/guidance/fixture-risk-score-calculator' })));
  t('[behaviour] O. a DOI suffix containing "score" passes', valid(ext({ doi: '10.1002/jcsm.score.2023.12345' })));

  // Accurate third-party bibliography passes.
  const thirdParty = {
    'study title with "risk score"': { title: 'Development and validation of a sarcopenia risk score in community-dwelling adults' },
    'study title with "polygenic risk score"': { title: 'A polygenic risk score for lean mass loss during weight reduction' },
    'study title with "calculator"': { title: 'The FRAX fracture risk calculator in older adults with obesity' },
    'title where SRI means another instrument': { title: 'Sleep Regularity Index (SRI) scores and cardiometabolic risk' },
    'title mentioning Sri Lanka': { title: 'Muscle health risk scores in Sri Lanka' },
    'description naming third-party instruments': null,
  };
  for (const [name, patch] of Object.entries(thirdParty)) {
    const e = patch ? with_(CCC, patch) : ext({ description: 'Systematic review comparing the SARC-F score and the FRAX calculator.' });
    t(`[behaviour] O. passes: ${name}`, valid(e));
    if (!valid(e)) evidenceGovernanceViolations(e).forEach(m => console.log('        ' + m));
  }
  t('[behaviour] O. clinical relevance may describe third-party scores',
    valid(with_(CCC, { clinicalRelevance: 'The SARC-F score and grip strength were compared with DXA lean mass.' })));
  t('[behaviour] O. comparing the SRI with a third-party score is not describing the SRI as one',
    valid(with_(CCC, { clinicalRelevance: 'The SRI and the Framingham risk score address different questions.' })));
  t('[behaviour] O. a list separating the SRI from third-party scores passes',
    valid(with_(CCC, { clinicalRelevance: 'The SRI, scores from FRAX and SARC-F, and grip strength were reviewed.' })));
  t('[behaviour] O. another instrument abbreviated SRI, defined in the same text, passes',
    terminologyFindings('Serotonin Reuptake Inhibitor (SRI) calculator').length === 0);
  t('[safety] O. "(SRI)" after a non-expansion cannot escape the guardrail',
    terminologyFindings('A new score (SRI) for patients.').length > 0);

  // "MyoGuard score" fails in every MyoGuard-authored field.
  const authored = [
    ['title', s => ({ title: s })],
    ['externalSource.description', s => ({
      sourceCitationId: null,
      externalSource: { description: s, doi: '10.1000/fixture', pmid: null, canonicalUrl: null, identifiersConfirmed: true },
    })],
    ['clinicalRelevance', s => ({ clinicalRelevance: s })],
    ['limitations', s => ({ limitations: [s] })],
    ['myoguardImplication.text', s => ({ myoguardImplication: { proposalOnly: true, text: s } })],
    ['publicInterestRationale', s => ({ publicInterestRationale: s })],
    ['decision.rationale', s => ({ decision: { ...CCC.decision, rationale: s } })],
  ];
  for (const [name, patch] of authored) {
    const e = with_(CCC, patch('Update the MyoGuard score guidance.'));
    t(`[safety] O. "MyoGuard score" fails in ${name}`, termViolation(e) && !shows(e));
  }

  const prohibited = [
    'MyoGuard score', 'MyoGuard calculator', 'SRI score', 'SRI calculator',
    'Sarcopenia Risk Index score', 'Sarcopenia Risk Index (SRI) score', 'MyoGuard scoring tool',
    "MyoGuard's score", "MyoGuard’s risk score", 'myoguard SCORE', 'SRI-score', 'SRI: calculator',
    'the SRI risk score', 'SRI scores', 'MyoGuard Protocol risk calculator', 'SRI total score',
    'The SRI is a risk score.', 'MyoGuard works as a calculator.', 'A score generated by MyoGuard.',
    'The risk calculator of the SRI.', 'A validated risk score (SRI).',
  ];
  for (const s of prohibited) {
    t(`[safety] O. rejected: "${s}"`, terminologyFindings(s).length > 0 && termViolation(with_(CCC, { clinicalRelevance: s })));
  }

  const approved = [
    'Sarcopenia Risk Index', 'Sarcopenia Risk Index (SRI)', 'SRI', 'Clinical Decision Support',
    'Clinical Decision Support tool',
    'MyoGuard generates the Sarcopenia Risk Index (SRI) as Clinical Decision Support.',
    'The SRI is a Clinical Decision Support tool.',
    'The SRI is not a score.',
  ];
  for (const s of approved) {
    t(`[behaviour] O. approved terminology passes: "${s}"`,
      terminologyFindings(s).length === 0 && valid(with_(CCC, { clinicalRelevance: s })));
  }

  // Existing controls unchanged.
  t('[safety] O. PHI in a title is still rejected', !shows(with_(CCC, { title: 'Call (307) 555-0142' })));
  t('[safety] O. an unverified source still does not render', !shows(ext({ identifiersConfirmed: false })));
  t('[safety] O. a DRAFT entry still does not render', !shows(with_(CCC, { status: 'DRAFT' })));
  t('[safety] O. HTTP canonical URLs are still rejected', canonicalUrlProblems('http://www.mdcalc.com/score').length > 0);
  t('[safety] O. the production seed stays invisible and production renders the empty state',
    getClinicalPracticeUpdates().length === 0 && renderModels(getClinicalPracticeUpdates()).includes(EMPTY_STATE_TEXT));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
