/**
 * scripts/evidenceExplainedPublicRoute.test.mjs
 *
 * Evidence Explained, Step 4A — the public route under closed publication gates.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs --import ./scripts/_load-tsx.mjs scripts/evidenceExplainedPublicRoute.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * The central selector (src/lib/learn/evidenceExplained/publicArticles.ts) is
 * pure given its context, so every gate is exercised by calling it on a fully
 * valid SYNTHETIC published article and on copies that break exactly one thing.
 * The synthetic article is proven exposable first (A), so each refusal can only
 * come from the rule under test. The real renderer, metadata builder, JSON-LD
 * builder, /learn discovery component, sitemap and CCC selector are then run on
 * that synthetic article, and on production data.
 *
 * The real pilot is never modified: production-context tests assert it is
 * refused everywhere. That the route, metadata and analytics cannot bypass the
 * selector is asserted against shipped source.
 *
 *   [gate]      — the selector refuses (or accepts) a case.
 *   [render]    — the real renderer / metadata / JSON-LD output.
 *   [leak]      — refused or draft content is absent from a public surface.
 *   [ordering]  — a structural invariant in shipped source.
 *
 * Browser layout and accessibility checks are in tests/evidence-article.e2e.mjs.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import ReactDOMServer from 'react-dom/server';
import { EVIDENCE_REGISTER, isCCCVisible, safeSourceHref } from '../src/data/evidenceRegister.ts';
import { TREATMENT_TRANSITION_PILOT as PILOT } from '../src/lib/learn/evidenceExplained/manuscripts/treatmentTransitionPilot.ts';
import {
  ARTICLE_BASE_PATH,
  articleJsonLd,
  articleMetadata,
  isArticleAnalyticsEligible,
  listPublicArticles,
  productionContext,
  publicArticleBlockers,
  publicArticleCards,
  publicArticlePathForEvidence,
  publicArticleSitemapEntries,
  resolvePublicArticle,
} from '../src/lib/learn/evidenceExplained/publicArticles.ts';
import { PUBLIC_REVIEWERS, PUBLIC_REVIEW_ASSIGNMENTS } from '../src/lib/learn/evidenceExplained/publicReviewers.ts';
import { buildClinicalPracticeUpdates, getClinicalPracticeUpdates } from '../src/lib/practiceUpdates/clinicalPracticeUpdates.ts';
import { redactAnalyticsPath, AnalyticsEvents } from '../src/lib/posthog.ts';
import EvidenceArticle from '../src/components/learn/EvidenceArticle.tsx';
import EvidenceExplainedDiscovery from '../src/components/learn/EvidenceExplainedDiscovery.tsx';
import ClinicalPracticeUpdates from '../src/components/doctor/intelligence/ClinicalPracticeUpdates.tsx';
import sitemap from '../app/sitemap.ts';

let pass = 0, fail = 0;
const t = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name + (detail ? `  → ${detail}` : '')); }
};
const section = s => console.log('\n' + s);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const src = p => readFileSync(join(ROOT, p), 'utf8');
const clone = o => JSON.parse(JSON.stringify(o));
const html = el => ReactDOMServer.renderToStaticMarkup(el);

// ── The real pilot's identifiers: must never appear on a public surface ──────
const SEED = EVIDENCE_REGISTER.find(e => e.id === PILOT.linkedEvidenceId);
const PILOT_MARKERS = [
  PILOT.headline, PILOT.manuscriptId, PILOT.internalWorkingSlug, PILOT.linkedEvidenceId,
  'modest in this cohort', 'informal dietary or lifestyle changes', 'Why the Next Plan Matters',
  '10.1111/dom.70660', '41816857', 'Gasoyan',
];
const hasPilot = s => PILOT_MARKERS.filter(m => s.includes(m));

// ── A synthetic, fully governed, published article ───────────────────────────
// Built from the pilot's structure so it passes every manuscript rule, with
// every identifying value replaced. Never added to the shipped register.
const SLUG = 'synthetic-transition-article';
const EV_ID = 'ev-synthetic-published';
const MN_ID = 'mn-synthetic-published';
const SENT = 'ZQXSENTINEL';
const swap = s => s
  .split('10.1111/dom.70660').join('10.5555/synthetic.0001')
  .split('41816857').join('99999991')
  .split('Gasoyan').join('Fixture');
const EVIDENCE = Object.freeze({
  ...JSON.parse(swap(JSON.stringify(SEED))),
  id: EV_ID,
  title: `Synthetic evidence title ${SENT}`,
  status: 'PUBLISHED',
  decision: { by: 'FOUNDER', at: '2026-09-20', rationale: `Founder rationale ${SENT}-RATIONALE.` },
  publicInterestRationale: `Public interest ${SENT}-PUBLIC.`,
  myoguardImplication: { proposalOnly: true, text: `Proposal only: internal implication ${SENT}-IMPLICATION.` },
  explainerSlug: SLUG,
  publishedAt: '2026-09-21',
  lastReviewedAt: '2026-09-20',
  reviewDueAt: '2027-03-20',
});
const MANUSCRIPT = Object.freeze((() => {
  const m = JSON.parse(swap(JSON.stringify(PILOT)));
  m.manuscriptId = MN_ID;
  m.linkedEvidenceId = EV_ID;
  m.sourceReferences[0].evidenceId = EV_ID;
  m.internalWorkingSlug = SLUG;
  m.manuscriptStatus = 'APPROVED';
  m.headline = 'Synthetic Explainer Headline for Route Tests';
  m.standfirst = 'A synthetic standfirst used only to test the governed public route.';
  m.draftedAt = '2026-09-20';
  m.lastReviewedAt = '2026-09-21';
  m.reviewDueAt = '2027-03-21';
  return m;
})());
const TODAY = '2026-10-01';

// A synthetic public reviewer, assigned to this manuscript version. No real
// reviewer is configured in Step 4A: PUBLIC_REVIEWERS ships empty.
const REVIEWER = Object.freeze({
  reviewerId: 'rv-synthetic-reviewer',
  governanceRole: 'FOUNDER',
  displayName: 'Alex Fixture',
  credentials: ['MD', 'FACP'],
  publicTitle: 'Consultant physician',
  status: 'ACTIVE',
  approvedBy: 'FOUNDER',
  approvedAt: '2026-09-20',
});
const ASSIGNMENT = Object.freeze({ manuscriptId: MN_ID, manuscriptVersion: MANUSCRIPT.version, reviewerId: REVIEWER.reviewerId });

const ctxWith = ({ manuscripts = [MANUSCRIPT], register = [...EVIDENCE_REGISTER, EVIDENCE], today = TODAY, routeEnabled = true,
                   reviewers = [REVIEWER], reviewAssignments = [ASSIGNMENT] } = {}) =>
  ({ manuscripts, register, today, routeEnabled, reviewers, reviewAssignments });
const rv = patch => ctxWith({ reviewers: [{ ...clone(REVIEWER), ...patch }] });
const CTX = ctxWith();
const ev = patch => ctxWith({ register: [...EVIDENCE_REGISTER, { ...clone(EVIDENCE), ...patch }] });
const mn = patch => ctxWith({ manuscripts: [{ ...clone(MANUSCRIPT), ...patch }] });
const refused = (ctx, slug = SLUG) => resolvePublicArticle(slug, ctx) === null && publicArticleBlockers(slug, ctx).length > 0;

// ── A. The synthetic article is exposable ────────────────────────────────────
section('-- A. A fully governed synthetic article is publicly exposable --');
{
  const b = publicArticleBlockers(SLUG, CTX);
  t('[gate] A. no blockers', b.length === 0, JSON.stringify(b));
  const a = resolvePublicArticle(SLUG, CTX);
  t('[gate] A. it resolves', a !== null);
  t('[gate] A. it is listed once', listPublicArticles(CTX).length === 1 && listPublicArticles(CTX)[0].slug === SLUG);
  t('[gate] A. its path is /learn/evidence/<slug>', a?.path === `${ARTICLE_BASE_PATH}/${SLUG}`);
  t('[gate] A. the linked evidence is CCC-visible too', isCCCVisible(EVIDENCE));
}

// ── B. Publication gates ─────────────────────────────────────────────────────
section('-- B. Every publication gate refuses when it is not met --');
{
  for (const s of ['DRAFT', 'FOUNDER_REVIEW', 'WITHDRAWN']) t(`[gate] B. manuscript ${s} is refused`, refused(mn({ manuscriptStatus: s })));
  for (const s of ['DRAFT', 'HELD', 'REJECTED', 'WITHDRAWN']) t(`[gate] B. evidence ${s} is refused`, refused(ev({ status: s })));
  const approved = { ...clone(EVIDENCE), status: 'APPROVED', publishedAt: null };
  t('[gate] B. evidence APPROVED is refused publicly', refused(ctxWith({ register: [...EVIDENCE_REGISTER, approved] })));
  t('[gate] B. …although APPROVED evidence is CCC-visible', isCCCVisible(approved));
  t('[gate] B. evidence APPROVED with a publishedAt is still refused', refused(ev({ status: 'APPROVED' })));
  for (const v of ['CCC_ONLY', 'NO_PUBLICATION', 'WATCHLIST']) t(`[gate] B. visibility ${v} is refused`, refused(ev({ visibility: v, explainerSlug: v === 'CCC_ONLY' ? SLUG : SLUG })));
  t('[gate] B. PUBLIC_MYTH_CORRECTION is accepted', !refused(ev({ visibility: 'PUBLIC_MYTH_CORRECTION' })));
  t('[gate] B. missing Founder decision is refused', refused(ev({ decision: null })));
  t('[gate] B. decision without rationale is refused', refused(ev({ decision: { by: 'FOUNDER', at: '2026-09-20', rationale: '' } })));
  t('[gate] B. decision without a valid date is refused', refused(ev({ decision: { by: 'FOUNDER', at: '2026-02-30', rationale: 'x' } })));
  t('[gate] B. decision not by the Founder is refused', refused(ev({ decision: { by: 'EDITOR', at: '2026-09-20', rationale: 'x' } })));
  t('[gate] B. decision dated in the future is refused', refused(ev({ decision: { by: 'FOUNDER', at: '2026-12-01', rationale: 'x' }, publishedAt: '2026-12-02' })));
  t('[gate] B. missing explainerSlug is refused', refused(ev({ explainerSlug: null })));
  t('[gate] B. mismatched explainerSlug is refused (both slugs)',
    refused(ev({ explainerSlug: 'another-article' })) && refused(ev({ explainerSlug: 'another-article' }), 'another-article'));
  t('[gate] B. mismatched manuscript slug is refused (both slugs)',
    refused(mn({ internalWorkingSlug: 'another-article' })) && refused(mn({ internalWorkingSlug: 'another-article' }), 'another-article'));
  t('[gate] B. missing publishedAt is refused', refused(ev({ publishedAt: null })));
  t('[gate] B. invalid publishedAt is refused', refused(ev({ publishedAt: '2026-13-01' })));
  t('[gate] B. future publishedAt is refused', refused(ev({ publishedAt: '2026-12-01' })));
  t('[gate] B. unverified source is refused', refused(ev({ externalSource: { ...clone(EVIDENCE.externalSource), identifiersConfirmed: false } })));
  t('[gate] B. unclassified evidence is refused', refused(ev({ evidenceType: 'PENDING_CLASSIFICATION' })));
  t('[gate] B. ungraded evidence is refused', refused(ev({ evidenceQuality: 'NOT_YET_GRADED' })));
  t('[gate] B. expired manuscript review is refused', refused(mn({ reviewDueAt: '2026-09-30' })));
  t('[gate] B. expired evidence review is refused', refused(ev({ reviewDueAt: '2026-09-30' })));
  t('[gate] B. missing evidence review dates are refused', refused(ev({ lastReviewedAt: null, reviewDueAt: null })));
  t('[gate] B. the review clock alone refuses: valid today, refused after reviewDueAt',
    !refused(ctxWith({ today: '2027-03-20' })) && refused(ctxWith({ today: '2027-03-21' })) && refused(ctxWith({ today: '2027-03-22' })));
  t('[gate] B. invalid register entry is refused', refused(ev({ limitations: [] })));
  const badText = clone(MANUSCRIPT); badText.sections[2].blocks.push({ k: 'p', text: 'Most people regained 90% of their weight.' });
  t('[gate] B. invalid manuscript is refused', refused(ctxWith({ manuscripts: [badText] })));
  const otherEv = { ...clone(EVIDENCE), id: 'ev-synthetic-other', explainerSlug: 'unrelated-article' };
  t('[gate] B. manuscript linked to a different entry is refused',
    refused(ctxWith({ manuscripts: [{ ...clone(MANUSCRIPT), linkedEvidenceId: 'ev-synthetic-other' }], register: [...EVIDENCE_REGISTER, EVIDENCE, otherEv] })));
  const wrongDoi = JSON.parse(JSON.stringify(MANUSCRIPT).split('10.5555/synthetic.0001').join('10.5555/synthetic.0002'));
  t('[gate] B. manuscript and evidence disagreeing on the DOI is refused', refused(ctxWith({ manuscripts: [wrongDoi] })));
  t('[gate] B. two manuscripts with the slug are refused',
    refused(ctxWith({ manuscripts: [MANUSCRIPT, { ...clone(MANUSCRIPT), manuscriptId: 'mn-synthetic-twin' }] })));
  t('[gate] B. two evidence entries with the slug are refused',
    refused(ctxWith({ register: [...EVIDENCE_REGISTER, EVIDENCE, { ...clone(EVIDENCE), id: 'ev-synthetic-twin' }] })));
  t('[gate] B. the route capability disabled refuses', refused(ctxWith({ routeEnabled: false })));

  for (const bad of ['no-such-article', 'Synthetic-Transition-Article', SLUG.toUpperCase(), `${SLUG}-`, `-${SLUG}`, ` ${SLUG}`, `${SLUG} `,
                     `${SLUG}/`, `../${SLUG}`, `${SLUG}%20`, `${SLUG}?x=1`, `${SLUG}#x`, 'a', 'x'.repeat(101), '', MN_ID, EV_ID,
                     PILOT.internalWorkingSlug, PILOT.manuscriptId, PILOT.linkedEvidenceId]) {
    t(`[gate] B. slug ${JSON.stringify(bad.length > 30 ? bad.slice(0, 20) + '…' : bad)} is refused`, refused(CTX, bad));
  }
  for (const bad of [null, undefined, 42, {}, [SLUG]]) {
    t(`[gate] B. non-string slug ${String(JSON.stringify(bad))} is refused`,
      resolvePublicArticle(bad, CTX) === null && publicArticleBlockers(bad, CTX).length > 0);
  }
  t('[gate] B. a refusal returns null only — no partial article', resolvePublicArticle('no-such-article', CTX) === null);
}

// ── B2. The controlled public reviewer ───────────────────────────────────────
section('-- B2. A named, approved, active public reviewer is required --');
{
  t('[gate] B2. no reviewer configured refuses', refused(ctxWith({ reviewers: [], reviewAssignments: [] })));
  t('[gate] B2. an assignment with no matching record refuses', refused(ctxWith({ reviewers: [] })));
  t('[gate] B2. a record with no assignment refuses', refused(ctxWith({ reviewAssignments: [] })));
  t('[gate] B2. an INACTIVE reviewer refuses', refused(rv({ status: 'INACTIVE' })));
  t('[gate] B2. an unknown status refuses', refused(rv({ status: 'PENDING' })));
  t('[gate] B2. an assignment naming another manuscript refuses',
    refused(ctxWith({ reviewAssignments: [{ ...clone(ASSIGNMENT), manuscriptId: 'mn-other' }] })));
  t('[gate] B2. an assignment for another manuscript version refuses',
    refused(ctxWith({ reviewAssignments: [{ ...clone(ASSIGNMENT), manuscriptVersion: 'v0.2' }] })));
  t('[gate] B2. two assignments for the same version refuse',
    refused(ctxWith({ reviewAssignments: [ASSIGNMENT, { ...clone(ASSIGNMENT), reviewerId: 'rv-other' }] })));
  t('[gate] B2. two records with the same id refuse',
    refused(ctxWith({ reviewers: [REVIEWER, { ...clone(REVIEWER), displayName: 'Other Fixture' }] })));
  t('[gate] B2. a reviewer representing a different governance role refuses', refused(rv({ governanceRole: 'EDITOR' })));
  t('[gate] B2. no credentials refuse', refused(rv({ credentials: [] })));
  t('[gate] B2. an unapproved credential refuses', refused(rv({ credentials: ['MD', 'Guru'] })));
  t('[gate] B2. duplicate credentials refuse', refused(rv({ credentials: ['MD', 'MD'] })));
  t('[gate] B2. not approved by the Founder refuses', refused(rv({ approvedBy: 'ADMIN' })));
  t('[gate] B2. a future approval date refuses', refused(rv({ approvedAt: '2026-12-01' })));
  t('[gate] B2. an invalid approval date refuses', refused(rv({ approvedAt: '2026-02-30' })));
  t('[gate] B2. an unknown field on the record refuses', refused(rv({ email: 'x@example.com' })));
  for (const [what, name] of [['a role, not a person', 'Founder'], ['the organisation', 'MyoGuard Protocol'],
                              ['a placeholder', 'TBD'], ['a title prefix', 'Dr Alex Fixture'], ['an empty name', ''],
                              ['an email address', 'alex@example.com'], ['a digit run', 'Alex 3075550142']]) {
    t(`[gate] B2. a displayName that is ${what} refuses`, refused(rv({ displayName: name })));
  }
  t('[gate] B2. an internal role as publicTitle refuses', refused(rv({ publicTitle: 'Founder' })));
  const rev = resolvePublicArticle(SLUG, CTX).reviewer;
  t('[render] B2. a valid reviewer renders as name, credentials and title',
    rev.byline === 'Alex Fixture, MD, FACP' && rev.name === 'Alex Fixture' &&
    rev.title === 'Consultant physician' && JSON.stringify(rev.credentials) === JSON.stringify(['MD', 'FACP']));
  t('[render] B2. a reviewer without a title is still valid', resolvePublicArticle(SLUG, rv({ publicTitle: null }))?.reviewer.title === null);
  t('[leak] B2. the manuscript keeps FOUNDER as its internal authority', MANUSCRIPT.reviewedBy === 'FOUNDER' && PILOT.reviewedBy === 'FOUNDER');
  t('[leak] B2. no public reviewer is configured in the repository',
    PUBLIC_REVIEWERS.length === 0 && PUBLIC_REVIEW_ASSIGNMENTS.length === 0);
  t('[ordering] B2. the shipped reviewer records are frozen', Object.isFrozen(PUBLIC_REVIEWERS) && Object.isFrozen(PUBLIC_REVIEW_ASSIGNMENTS));
}

// ── C. The real pilot and production data ────────────────────────────────────
section('-- C. With production data nothing is public, and the pilot is refused --');
{
  const P = productionContext();
  t('[gate] C. production route capability is enabled', P.routeEnabled === true);
  t('[gate] C. the pilot slug is refused', resolvePublicArticle(PILOT.internalWorkingSlug) === null);
  t('[gate] C. the pilot stays DRAFT with DRAFT evidence, no decision, slug or publishedAt',
    PILOT.manuscriptStatus === 'DRAFT' && SEED.status === 'DRAFT' && SEED.decision === null && SEED.explainerSlug === null && SEED.publishedAt === null);
  t('[gate] C. no article is public', listPublicArticles().length === 0 && publicArticleCards().length === 0);
  t('[gate] C. no sitemap entry', publicArticleSitemapEntries().length === 0);
  t('[gate] C. no CCC link for the seed', publicArticlePathForEvidence(SEED.id) === null);
  t('[gate] C. the CCC keeps its empty state', getClinicalPracticeUpdates().length === 0);
  t('[gate] C. the pilot path is not analytics-eligible', !isArticleAnalyticsEligible(`${ARTICLE_BASE_PATH}/${PILOT.internalWorkingSlug}`));
  t('[gate] C. pilot as a synthetic-context request is also refused', refused(CTX, PILOT.internalWorkingSlug));
}

// ── D. Renderer ──────────────────────────────────────────────────────────────
section('-- D. The renderer shows exactly the governed article --');
const A = resolvePublicArticle(SLUG, CTX);
const PAGE = html(createElement(EvidenceArticle, { article: A }));
{
  const h2 = [...PAGE.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map(m => m[1].replace(/&#x27;/g, "'"));
  const expected = MANUSCRIPT.sections.map(s => s.heading);
  t('[render] D. all ten sections render once, in order', JSON.stringify(h2) === JSON.stringify(expected), JSON.stringify(h2));
  t('[render] D. one h1, the headline', (PAGE.match(/<h1/g) ?? []).length === 1 && PAGE.includes(`>${MANUSCRIPT.headline}</h1>`));
  t('[render] D. standfirst', PAGE.includes(MANUSCRIPT.standfirst));
  t('[render] D. reviewer byline, title and dates', PAGE.includes('Reviewed by') && PAGE.includes('Alex Fixture, MD, FACP') &&
    PAGE.includes('Consultant physician') && PAGE.includes('21 September 2026') && PAGE.includes('dateTime="2026-09-21"'));
  t('[leak] D. the internal governance role never appears on the page', !/\bFOUNDER\b/.test(PAGE) && !/\bFounder\b/.test(PAGE));
  const esc = s => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
  const allText = MANUSCRIPT.sections.flatMap(s => s.blocks.flatMap(b => (b.k === 'ul' ? b.items : [b.text])));
  t('[render] D. every governed sentence and list item renders', allText.every(x => PAGE.includes(esc(x))), allText.filter(x => !PAGE.includes(esc(x))).slice(0, 2).join(' | '));
  t('[render] D. limitations render', PAGE.includes('What does this study not prove?') && PAGE.includes('does not prove that stopping treatment prevents weight regain'));
  t('[render] D. physician-oversight language renders', PAGE.includes('clinically supervised') && PAGE.includes('physician-led'));
  t('[render] D. educational disclaimer renders', PAGE.includes('This material is for education only'));
  t('[render] D. evidence classification renders', PAGE.includes('Observational study · Low certainty'));
  const link = PAGE.match(/<a href="(https:[^"]+)"[^>]*>/);
  t('[render] D. source link is the DOI', link?.[1] === 'https://doi.org/10.5555/synthetic.0001');
  t('[render] D. source link opens safely in a new tab', /target="_blank"/.test(link?.[0] ?? '') && /rel="noopener noreferrer"/.test(link?.[0] ?? ''));
  t('[render] D. source link has an accessible label naming the new tab', /aria-label="Read the source publication via its DOI \(opens in a new tab\)"/.test(link?.[0] ?? ''));
  t('[render] D. source link carries no tracking parameter', !/[?&](utm_|fbclid|gclid)/.test(link?.[1] ?? ''));
  t('[render] D. footer standard lines', PAGE.includes('Physician-led Clinical Decision Support') && PAGE.includes('Meridian Wellness Systems LLC'));
  for (const [what, s] of [['Founder rationale', `${SENT}-RATIONALE`], ['public-interest rationale', `${SENT}-PUBLIC`], ['MyoGuard implication', `${SENT}-IMPLICATION`],
                           ['evidence title', `Synthetic evidence title`], ['manuscript id', MN_ID], ['evidence id', EV_ID], ['source facts', 'A total of 7938 patients'],
                           ['proposalOnly', 'proposalOnly'], ['FOUNDER enum', '>FOUNDER<']]) {
    t(`[leak] D. ${what} never reaches the page`, !PAGE.includes(s));
  }
  t('[leak] D. the display model carries only whitelisted fields',
    JSON.stringify(Object.keys(A).sort()) === JSON.stringify(['canonicalUrl', 'dateModified', 'educationalDisclaimer', 'evidenceLabel', 'headline', 'lastReviewedAt',
      'lastReviewedLabel', 'path', 'publishedAt', 'publishedLabel', 'reviewer', 'sections', 'slug', 'source', 'standfirst']));
  t('[leak] D. the reviewer model carries only name, credentials, title and byline',
    JSON.stringify(Object.keys(A.reviewer).sort()) === JSON.stringify(['byline', 'credentials', 'name', 'title']));
  t('[render] D. no treatment directive, brand or prohibited term was added by the renderer',
    !/\b(ozempic|wegovy|mounjaro|zepbound|novo nordisk|eli lilly|calculator|score)\b/i.test(PAGE.replace(/<[^>]+>/g, ' ')));
}

// ── E. Source-link priority and safety ───────────────────────────────────────
section('-- E. Source links: DOI, then PubMed, then canonical URL; unsafe links never render --');
{
  const noDoi = (() => {
    const m = clone(MANUSCRIPT); m.sourceReferences[0].doi = null;
    m.sourceReferences[0].citation = m.sourceReferences[0].citation.replace(' DOI 10.5555/synthetic.0001.', '');
    m.sections.find(s => s.id === 'sources').blocks[0].text = m.sourceReferences[0].citation;
    const e = { ...clone(EVIDENCE), externalSource: { ...clone(EVIDENCE.externalSource), doi: null } };
    return ctxWith({ manuscripts: [m], register: [...EVIDENCE_REGISTER, e] });
  })();
  const pm = resolvePublicArticle(SLUG, noDoi);
  t('[render] E. no DOI → PubMed link', pm?.source.href === 'https://pubmed.ncbi.nlm.nih.gov/99999991/' && pm?.source.kind === 'PubMed', JSON.stringify(publicArticleBlockers(SLUG, noDoi)));
  t('[render] E. DOI wins over PubMed', A.source.href.startsWith('https://doi.org/'));
  t('[render] E. canonical URL used only without DOI or PMID', safeSourceHref(null, null, 'https://www.example.org/report') === 'https://www.example.org/report');
  for (const [what, args] of [['HTTP', [null, null, 'http://www.example.org/report']], ['shortener', [null, null, 'https://bit.ly/abc']],
                              ['tracking parameter', [null, null, 'https://www.example.org/r?utm_source=x']], ['IP host', [null, null, 'https://127.0.0.1/r']],
                              ['credentials', [null, null, 'https://u:p@example.org/r']], ['malformed DOI', ['doi:10.1/x', null, null]],
                              ['malformed PMID', [null, '12345678901', null]], ['nothing', [null, null, null]]]) {
    t(`[render] E. unsafe source (${what}) yields no link`, safeSourceHref(...args) === null);
  }
  const noIds = (() => {
    const m = clone(MANUSCRIPT); Object.assign(m.sourceReferences[0], { doi: null, pmid: null });
    const e = { ...clone(EVIDENCE), externalSource: { ...clone(EVIDENCE.externalSource), doi: null, pmid: null } };
    return ctxWith({ manuscripts: [m], register: [...EVIDENCE_REGISTER, e] });
  })();
  t('[gate] E. an article with no safe source link is refused', refused(noIds));
}

// ── F. Metadata and JSON-LD ──────────────────────────────────────────────────
section('-- F. Metadata and structured data, for an exposable article only --');
{
  const md = articleMetadata(A);
  const url = `https://myoguard.health/learn/evidence/${SLUG}`;
  t('[render] F. title and description', md.title === MANUSCRIPT.headline && md.description === MANUSCRIPT.standfirst);
  t('[render] F. canonical URL', md.alternates?.canonical === url);
  t('[render] F. Open Graph article with dates', md.openGraph?.type === 'article' && md.openGraph?.url === url &&
    md.openGraph?.publishedTime === '2026-09-21' && md.openGraph?.modifiedTime === '2026-09-21');
  t('[render] F. no Open Graph image is declared (the site image convention applies)', !('images' in (md.openGraph ?? {})));
  const ld = articleJsonLd(A);
  t('[render] F. MedicalWebPage', ld['@type'] === 'MedicalWebPage' && ld['@context'] === 'https://schema.org');
  t('[render] F. headline, description, url', ld.headline === MANUSCRIPT.headline && ld.description === MANUSCRIPT.standfirst && ld.url === url);
  t('[render] F. datePublished, dateModified, lastReviewed from records',
    ld.datePublished === EVIDENCE.publishedAt && ld.dateModified === '2026-09-21' && ld.lastReviewed === MANUSCRIPT.lastReviewedAt);
  t('[render] F. reviewer by role only — no invented name or credentials',
    ld.reviewedBy['@type'] === 'Person' && ld.reviewedBy.name === 'Alex Fixture, MD, FACP' &&
    ld.reviewedBy.honorificSuffix === 'MD, FACP' && ld.reviewedBy.jobTitle === 'Consultant physician' &&
    !JSON.stringify(ld.reviewedBy).includes('FOUNDER') && !/\bFounder\b/.test(JSON.stringify(ld.reviewedBy)));
  t('[render] F. publisher is MyoGuard Protocol / Meridian Wellness Systems LLC', ld.publisher.name === 'MyoGuard Protocol' && ld.publisher.legalName === 'Meridian Wellness Systems LLC');
  t('[render] F. cited source is the verified DOI', ld.citation.url === 'https://doi.org/10.5555/synthetic.0001');
  const ldText = JSON.stringify(ld);
  t('[leak] F. no governance field in JSON-LD', ![`${SENT}-RATIONALE`, `${SENT}-PUBLIC`, `${SENT}-IMPLICATION`, MN_ID, EV_ID].some(s => ldText.includes(s)));
  t('[leak] F. no governance field in metadata', ![`${SENT}-RATIONALE`, `${SENT}-PUBLIC`, MN_ID, EV_ID].some(s => JSON.stringify(md).includes(s)));
}

// ── G. Discovery: /learn, sitemap, CCC, analytics ────────────────────────────
section('-- G. Discovery activates only for exposable articles --');
{
  t('[leak] G. /learn discovery renders nothing with no articles', html(createElement(EvidenceExplainedDiscovery, { articles: [] })) === '');
  const learn = html(createElement(EvidenceExplainedDiscovery, { articles: publicArticleCards(CTX) }));
  t('[render] G. /learn discovery lists an exposable article', learn.includes('Evidence Explained') && learn.includes(`href="/learn/evidence/${SLUG}"`));
  t('[leak] G. /learn discovery carries only headline, standfirst and date', !learn.includes(`${SENT}-`) && !learn.includes(EV_ID) && !learn.includes('10.5555'));
  t('[leak] G. production /learn discovery is empty', html(createElement(EvidenceExplainedDiscovery, { articles: publicArticleCards() })) === '');

  const sm = sitemap().map(e => e.url);
  const expected = ['', '/get-started', '/privacy', '/terms', '/research', '/research/library', '/research/glp1-therapy', '/research/muscle-preservation',
    '/research/protein-requirements', '/research/sarcopenia-risk', '/research/participate', '/learn', '/learn/protein-on-glp-1'].map(p => `https://myoguard.health${p}`);
  t('[leak] G. production sitemap URLs are exactly the existing thirteen', JSON.stringify(sm) === JSON.stringify(expected), JSON.stringify(sm));
  const sEntries = publicArticleSitemapEntries(CTX);
  t('[render] G. sitemap entries activate for an exposable article', sEntries.length === 1 && sEntries[0].url === `https://myoguard.health/learn/evidence/${SLUG}`);
  t('[leak] G. sitemap entries stay empty for a refused article', publicArticleSitemapEntries(mn({ manuscriptStatus: 'DRAFT' })).length === 0);

  const cccCtx = ctxWith();
  const models = buildClinicalPracticeUpdates([EVIDENCE], undefined, id => publicArticlePathForEvidence(id, cccCtx));
  const cccHtml = html(createElement(ClinicalPracticeUpdates, { updates: models }));
  t('[render] G. CCC shows a working link for an exposable article',
    models[0]?.explainerHref === `/learn/evidence/${SLUG}` && cccHtml.includes(`href="/learn/evidence/${SLUG}"`) && cccHtml.includes('Patient explainer available'));
  const draftCtx = mn({ manuscriptStatus: 'DRAFT' });
  const draftModels = buildClinicalPracticeUpdates([EVIDENCE], undefined, id => publicArticlePathForEvidence(id, draftCtx));
  t('[leak] G. CCC shows "Clinical note only" and no link when the article is not exposable',
    draftModels[0]?.explainerHref === null && draftModels[0]?.explainerStatus === 'Clinical note only' &&
    !html(createElement(ClinicalPracticeUpdates, { updates: draftModels })).includes('/learn/evidence/'));
  const expiredCtx = ctxWith({ today: '2027-04-01' });
  t('[leak] G. CCC drops the link when the review expires', publicArticlePathForEvidence(EV_ID, expiredCtx) === null);
  t('[leak] G. production CCC path for the seed is null', buildClinicalPracticeUpdates([SEED]).length === 0);

  t('[render] G. an exposable article path is analytics-eligible', isArticleAnalyticsEligible(`/learn/evidence/${SLUG}`, CTX));
  for (const p of [`/learn/evidence/${SLUG}/`, `/learn/evidence/${SLUG}x`, '/learn/evidence/', '/learn/evidence', `/learn/${SLUG}`]) {
    t(`[leak] G. ${p} is not analytics-eligible`, !isArticleAnalyticsEligible(p, CTX));
  }
  t('[leak] G. a refused article is not analytics-eligible', !isArticleAnalyticsEligible(`/learn/evidence/${SLUG}`, draftCtx));
  t('[leak] G. every article URL reports to analytics as the route pattern',
    redactAnalyticsPath(`/learn/evidence/${PILOT.internalWorkingSlug}`) === '/learn/evidence/[slug]' &&
    redactAnalyticsPath(`/learn/evidence/${SLUG}`) === '/learn/evidence/[slug]');
  t('[leak] G. the article-view event exists and names no slug', AnalyticsEvents.EVIDENCE_ARTICLE_VIEWED === 'evidence_article_viewed');
}

// ── H. The route cannot bypass the selector ──────────────────────────────────
section('-- H. Route structure --');
{
  const ROUTE = 'app/learn/evidence/[slug]/page.tsx';
  const page = src(ROUTE);
  t('[ordering] H. rendered per request (force-dynamic)', /export const dynamic = 'force-dynamic';/.test(page));
  t('[ordering] H. no generateStaticParams export (no article is pre-rendered)',
    !/export\s+(?:async\s+)?(?:function|const)\s+generateStaticParams/.test(page) && !/export\s+const\s+dynamicParams\s*=\s*false/.test(page));
  t('[ordering] H. server component (no "use client")', !/['"]use client['"]/.test(page));
  t('[ordering] H. metadata refuses through notFound() before building anything',
    /generateMetadata[\s\S]*?const article = resolvePublicArticle\(\(await params\)\.slug\);\s*if \(!article\) notFound\(\);\s*return articleMetadata\(article\);/.test(page));
  const body = page.slice(page.indexOf('export default'));
  t('[ordering] H. the page refuses through notFound() before rendering anything',
    /const article = resolvePublicArticle\(\(await params\)\.slug\);\s*if \(!article\) notFound\(\);/.test(body) &&
    body.indexOf('notFound()') < body.indexOf('<main') && body.indexOf('notFound()') < body.indexOf('AnalyticsMount'));
  t('[ordering] H. the article-view event fires only after acceptance, with the article slug only',
    /<AnalyticsMount event=\{AnalyticsEvents\.EVIDENCE_ARTICLE_VIEWED\} properties=\{\{ article: article\.slug \}\} \/>/.test(page));
  t('[ordering] H. JSON-LD is escaped against </script> injection', /\.replace\(\/<\/g, '\\\\u003c'\)/.test(page));
  const walk = dir => readdirSync(join(ROOT, dir)).flatMap(n => (statSync(join(ROOT, dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n).replace(/\\/g, '/')]));
  t('[ordering] H. no index page, loading, error or alternative route under /learn/evidence',
    JSON.stringify(walk('app/learn/evidence')) === JSON.stringify([ROUTE]));
  t('[ordering] H. no loading.tsx on the path (a streamed 200 could replace the 404)',
    !existsSync(join(ROOT, 'app/learn/loading.tsx')) && !existsSync(join(ROOT, 'app/loading.tsx')));
  const appRoutes = walk('app').filter(f => /(page|route)\.tsx?$/.test(f));
  const otherUsers = appRoutes.filter(f => f !== ROUTE && /evidenceExplained/.test(src(f)));
  t('[ordering] H. no other route resolves an article (no id, query-string or fallback route)',
    appRoutes.filter(f => f !== ROUTE && /resolvePublicArticle/.test(src(f))).length === 0 &&
    JSON.stringify(otherUsers) === JSON.stringify(['app/learn/page.tsx']), JSON.stringify(otherUsers));
  t('[ordering] H. middleware unchanged in this step: /learn is not a protected route', !/'\/learn/.test(src('middleware.ts')));
}

// ── I. Browser-accessible build output ───────────────────────────────────────
section('-- I. Browser bundles (when a build exists) --');
{
  const STATIC = join(ROOT, '.next/static');
  if (!existsSync(STATIC)) {
    console.log('  SKIP  no .next build present — run npm run build first for this check');
  } else {
    const files = (function w(d) { return readdirSync(d).flatMap(n => (statSync(join(d, n)).isDirectory() ? w(join(d, n)) : [join(d, n)])); })(STATIC);
    const hits = files.flatMap(f => hasPilot(readFileSync(f, 'utf8')).map(m => `${f.slice(ROOT.length)}: ${m}`));
    t(`[leak] I. no pilot identifier or sentence in any of ${files.length} browser-delivered files`, hits.length === 0, hits.slice(0, 3).join(' | '));
  }
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
