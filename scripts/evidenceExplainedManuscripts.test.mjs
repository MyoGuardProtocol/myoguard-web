/**
 * scripts/evidenceExplainedManuscripts.test.mjs
 *
 * Evidence Explained, Step 3 — manuscript framework, governance and the
 * unpublished pilot.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/evidenceExplainedManuscripts.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * The governance functions are pure, so every rule is exercised by calling the
 * shipped `manuscriptViolations` on the shipped pilot and on copies of it that
 * break exactly one thing. The pilot is proven valid first (A), so a copy that
 * fails can only have failed for the rule under test.
 *
 * That no page, sitemap entry, analytics path or CCC view can reach a
 * manuscript is the absence of a code path, so it is asserted against shipped
 * source (G).
 *
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would publish
 *                 unapproved content, give medication advice, expose PHI or
 *                 reach clinical logic.
 *   [lock]      — the manuscript text equals the approved fixture.
 *
 * REVIEW CLOCK
 * Section A validates the pilot against today's date. When its reviewDueAt
 * passes, this suite fails until the manuscript is reviewed again — that is the
 * rule working, not a flaky test.
 *
 * Touches no database, contacts no provider, renders nothing.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  EVIDENCE_REGISTER,
  evidenceGovernanceViolations,
  isCCCVisible,
  isPubliclyPublishable,
  isPubliclyExposable,
} from '../src/data/evidenceRegister.ts';
import {
  MANUSCRIPT_KEYS,
  MANUSCRIPT_STATUSES,
  REQUIRED_SECTIONS,
  PUBLIC_ROUTE_IMPLEMENTED,
  manuscriptViolations,
  manuscriptPublicationBlockers,
  manuscriptRegistryViolations,
  isManuscriptPubliclyExposable,
  numericalClaims,
  numericValue,
  patientFacingText,
} from '../src/lib/learn/evidenceExplained/manuscriptGovernance.ts';
import { EVIDENCE_EXPLAINED_MANUSCRIPTS } from '../src/lib/learn/evidenceExplained/registry.ts';
import { TREATMENT_TRANSITION_PILOT } from '../src/lib/learn/evidenceExplained/manuscripts/treatmentTransitionPilot.ts';
import { getClinicalPracticeUpdates } from '../src/lib/practiceUpdates/clinicalPracticeUpdates.ts';

let pass = 0, fail = 0;
const t = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name + (detail ? `  → ${detail}` : '')); }
};
const section = s => console.log('\n' + s);

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const src  = p => readFileSync(join(ROOT, p), 'utf8');

const TODAY = new Date().toISOString().slice(0, 10);
const DRAFT_DAY = '2026-09-27';
const PILOT = TREATMENT_TRANSITION_PILOT;
const SEED_ID = 'ev-2026-w39-treatment-discontinuation';
const SEED = EVIDENCE_REGISTER.find(e => e.id === SEED_ID);

const clone = o => JSON.parse(JSON.stringify(o));
const violations = (m, reg = EVIDENCE_REGISTER, today = DRAFT_DAY) => manuscriptViolations(m, reg, today);
const violates = (m, re, reg, today) => violations(m, reg, today).some(x => re.test(x));

/** A copy of the pilot with one section's blocks replaced. */
const withSection = (id, blocks) => {
  const c = clone(PILOT);
  c.sections.find(s => s.id === id).blocks = blocks;
  return c;
};
/** A copy of the pilot with one sentence appended to a section. */
const withSentence = (id, text) => {
  const c = clone(PILOT);
  c.sections.find(s => s.id === id).blocks.push({ k: 'p', text });
  return c;
};
/** A copy of the pilot with a string replaced in every text. */
const replacing = (from, to) => JSON.parse(JSON.stringify(PILOT).split(from).join(to));

// ── A. The pilot is a valid DRAFT ────────────────────────────────────────────
section('-- A. The pilot manuscript passes validation as a DRAFT --');
{
  const v = violations(PILOT);
  t('[behaviour] A. zero violations on the drafting date', v.length === 0, JSON.stringify(v));
  const now = manuscriptViolations(PILOT, EVIDENCE_REGISTER, TODAY);
  t(`[behaviour] A. zero violations today (${TODAY}) — review not overdue`, now.length === 0, JSON.stringify(now));
  t('[behaviour] A. the registry is valid and holds exactly the pilot',
    manuscriptRegistryViolations(EVIDENCE_EXPLAINED_MANUSCRIPTS, EVIDENCE_REGISTER, TODAY).length === 0 &&
    EVIDENCE_EXPLAINED_MANUSCRIPTS.length === 1 && EVIDENCE_EXPLAINED_MANUSCRIPTS[0] === PILOT);
  t('[behaviour] A. status DRAFT', PILOT.manuscriptStatus === 'DRAFT');
  t('[behaviour] A. carries every schema field and no other',
    JSON.stringify(Object.keys(PILOT).sort()) === JSON.stringify([...MANUSCRIPT_KEYS].sort()));
  t('[behaviour] A. the four statuses are DRAFT, FOUNDER_REVIEW, APPROVED, WITHDRAWN',
    JSON.stringify(MANUSCRIPT_STATUSES) === JSON.stringify(['DRAFT', 'FOUNDER_REVIEW', 'APPROVED', 'WITHDRAWN']));
  t('[behaviour] A. reviewer and review dates recorded',
    PILOT.reviewedBy === 'FOUNDER' && PILOT.draftedAt === '2026-09-27' &&
    PILOT.lastReviewedAt === '2026-09-27' && PILOT.reviewDueAt === '2027-03-27');
  t('[behaviour] A. linked to the treatment-discontinuation seed', PILOT.linkedEvidenceId === SEED_ID);
  t('[behaviour] A. version v0.1, audience patients and public', PILOT.version === 'v0.1' && PILOT.readingAudience === 'PATIENTS_AND_PUBLIC');
}

// ── B. Linked evidence and source ────────────────────────────────────────────
section('-- B. The linked evidence exists, is valid and verified, and stays DRAFT --');
{
  t('[behaviour] B. the linked entry exists', !!SEED);
  t('[behaviour] B. the linked entry has zero integrity violations', evidenceGovernanceViolations(SEED).length === 0);
  const s = SEED.externalSource;
  t('[behaviour] B. DOI is 10.1111/dom.70660', s.doi === '10.1111/dom.70660');
  t('[behaviour] B. PMID is 41816857', s.pmid === '41816857');
  t('[behaviour] B. identifiers confirmed', s.identifiersConfirmed === true);
  t('[behaviour] B. the pilot cites the same DOI and PMID',
    PILOT.sourceReferences.length === 1 && PILOT.sourceReferences[0].doi === s.doi && PILOT.sourceReferences[0].pmid === s.pmid &&
    PILOT.sourceReferences[0].citation.includes('DOI 10.1111/dom.70660') && PILOT.sourceReferences[0].citation.includes('PMID 41816857'));
  t('[behaviour] B. Observational, LOW, CONSIDER, PUBLIC_AND_CCC',
    SEED.evidenceType === 'Observational' && SEED.evidenceQuality === 'LOW' &&
    SEED.practiceClassification === 'CONSIDER' && SEED.visibility === 'PUBLIC_AND_CCC');
  t('[behaviour] B. persistence themes are the five approved',
    JSON.stringify(SEED.persistenceThemes) === JSON.stringify(['TREATMENT_INTERRUPTION', 'STRUCTURED_TRANSITION', 'NUTRITION', 'MUSCLE_PRESERVATION', 'FUNCTIONAL_HEALTH']));
  t('[safety] B. evidence stays DRAFT with no decision, slug or publication date',
    SEED.status === 'DRAFT' && SEED.decision === null && SEED.explainerSlug === null && SEED.publishedAt === null);
  t('[safety] B. evidence is not CCC-visible', !isCCCVisible(SEED));
  t('[safety] B. the CCC keeps its empty state', getClinicalPracticeUpdates().length === 0);
  t('[safety] B. evidence is not publicly publishable or exposable', !isPubliclyPublishable(SEED) && !isPubliclyExposable(SEED));
  const seedNumbers = [SEED.clinicalRelevance, ...SEED.limitations].flatMap(numericalClaims).map(numericValue);
  t('[safety] B. every number in the seed is from the verified abstract (7,938; 2021–2023; 3–12 months; 19.6%; 35.2%)',
    seedNumbers.every(n => ['7938', '2021', '2023', '3', '12', '19.6', '35.2'].includes(n)), JSON.stringify(seedNumbers));
}

// ── C. Required sections ─────────────────────────────────────────────────────
section('-- C. Every required section exists, in order --');
{
  const expected = [
    'What is being reported?', 'What did the researchers examine?', 'What did they find?',
    'What might this mean for patients?', 'What does this study not prove?', 'Why does a transition plan matter?',
    'What should you discuss with your clinician?', 'MyoGuard perspective', 'Sources', 'Educational disclaimer',
  ];
  t('[behaviour] C. the schema requires exactly the ten sections', JSON.stringify(REQUIRED_SECTIONS.map(s => s.heading)) === JSON.stringify(expected));
  t('[behaviour] C. the pilot has them, in order, with exact headings', JSON.stringify(PILOT.sections.map(s => s.heading)) === JSON.stringify(expected));
  for (const req of REQUIRED_SECTIONS) {
    const c = clone(PILOT); c.sections = c.sections.filter(s => s.id !== req.id);
    t(`[safety] C. removing "${req.heading}" fails`, violates(c, new RegExp(`missing required section "${req.heading.replace(/[?]/g, '\\?')}"`)));
  }
  const reordered = clone(PILOT); [reordered.sections[0], reordered.sections[1]] = [reordered.sections[1], reordered.sections[0]];
  t('[safety] C. reordering sections fails', violates(reordered, /exactly the required sections, in order/));
  const renamed = clone(PILOT); renamed.sections[2].heading = 'What they found';
  t('[safety] C. a changed heading fails', violates(renamed, /must be headed/));
  t('[safety] C. an empty section fails', violates(withSection('what-they-found', []), /must have content/));
}

// ── D. Numbers ───────────────────────────────────────────────────────────────
section('-- D. Every numerical claim matches a structured source fact --');
{
  const claims = patientFacingText(PILOT).flatMap(numericalClaims);
  t('[behaviour] D. the pilot states exactly 7,938 / three / twelve / 19.6% / 35.2%',
    JSON.stringify(claims.map(numericValue).sort()) === JSON.stringify(['12', '19.6', '3', '35.2', '7938']), JSON.stringify(claims));
  const facts = PILOT.sourceReferences[0].facts;
  t('[behaviour] D. four structured facts', facts.length === 4);
  t('[behaviour] D. each fact is quoted from the published abstract',
    facts.every(f => /restarted the index medication|A total of 7938 patients|within 3-12 months/.test(f.sourceStatement)));
  t('[behaviour] D. "GLP-1" in the headline is not a numerical claim', !numericalClaims(PILOT.headline).length);

  const changed = replacing('19.6% restarted', '21.6% restarted');
  t('[safety] D. a changed figure fails (19.6% → 21.6%)', violates(changed, /unsupported numerical claim "21\.6%"/));
  t('[safety] D. an added figure fails', violates(withSentence('what-they-found', 'Most regained 90% of the weight they had lost.'), /unsupported numerical claim "90%"/));
  t('[safety] D. an added number written as a word fails', violates(withSentence('what-they-found', 'Weight returned within two years.'), /unsupported numerical claim "two"/));
  t('[safety] D. a changed cohort size fails', violates(replacing('7,938 adults', '8,938 adults'), /unsupported numerical claim "8,938"/));
  const fact = clone(PILOT); fact.sourceReferences[0].facts[2].tokens = ['21.6%'];
  t('[safety] D. a fact whose value is not in its source statement fails', violates(fact, /token "21\.6%" is not in its source statement/));
  // The quoted source sentences are locked to the PubMed abstract (PMID 41816857),
  // so text, token and quote cannot all be changed together unnoticed.
  const ABSTRACT = [
    'A total of 7938 patients (mean [SD] age, 55.7 [13.4] years; 5061 [63.8%] female) were identified.',
    'Adults with overweight or obesity who initiated injectable semaglutide or tirzepatide for obesity or T2D between 2021 and 2023 and discontinued the medication within 3-12 months were included.',
    'During 1-year post-discontinuation, 19.6% restarted the index medication and 35.2% received an alternative obesity treatment, including starting another medication (27.4%), lifestyle modification visit (13.7%) and metabolic and bariatric surgery (0.6%).',
  ];
  const quotesVerbatim = m => m.sourceReferences.every(r => r.facts.every(f => ABSTRACT.includes(f.sourceStatement)));
  t('[lock]   every source fact quotes the PubMed abstract verbatim', quotesVerbatim(PILOT));
  t('[lock]   changing text, fact and quote together is caught', !quotesVerbatim(replacing('19.6%', '21.6%')));
}

// ── E. Editorial governance ──────────────────────────────────────────────────
section('-- E. Editorial rules reject what the manuscript must never say --');
{
  // Limitations
  t('[safety] E. missing limitations fail', violates(withSection('what-it-does-not-prove', [{ k: 'p', text: 'The findings are interesting and worth discussing.' }]), /limitations are missing/));
  t('[safety] E. a denial without a reason fails', violates(withSection('what-it-does-not-prove', [{ k: 'p', text: 'This study does not prove everything.' }]), /limitations are missing/));

  // Causation
  for (const s of ['Restarting treatment prevents weight regain.', 'This study proves that switching treatment reduces weight gain.',
                   'Stopping treatment causes weight regain.', 'Lifestyle support leads to better outcomes after stopping.']) {
    t(`[safety] E. causal overstatement fails: "${s}"`, violates(withSentence('what-they-found', s), /association presented as causation/));
  }
  t('[behaviour] E. a negated causal sentence is a limitation and passes', !violates(withSentence('what-it-does-not-prove', 'It cannot show that any strategy caused a better outcome.'), /causation/));

  // Medication directives
  for (const s of ['You should continue your medicine.', 'Stop your injections if your appetite returns.', 'Increase your dose after a break.',
                   'We recommend that you restart treatment.', 'Everyone should stay on treatment.', 'It is best to switch treatment early.',
                   'Continue treatment unless side effects occur.', 'Patients should not stop their medicine.']) {
    t(`[safety] E. medication directive fails: "${s}"`, violates(withSentence('meaning-for-patients', s), /medication directive|treatment-persistence/));
  }
  t('[safety] E. indefinite-use wording fails', violates(withSentence('meaning-for-patients', 'Remain on treatment indefinitely.'), /medication directive|treatment-persistence/));
  t('[behaviour] E. "The important message is not that everyone should continue" is not a directive', violations(PILOT).length === 0);

  // Promotion and endorsement
  for (const [label, s] of [['a brand name', 'Ask your doctor about Wegovy.'], ['a manufacturer', 'Novo Nordisk supports this approach.'],
                            ['a supplement', 'Our protein shakes can help after stopping.'], ['an offer', 'A discount is available for new members.'],
                            ['hype', 'This breakthrough changes everything.']]) {
    t(`[safety] E. promotion fails: ${label}`, violates(withSentence('myoguard-perspective', s), /brand or manufacturer|promotional/));
  }
  for (const s of ['MyoGuard recommends tirzepatide after a break.', 'We prefer semaglutide for most patients.']) {
    t(`[safety] E. MyoGuard endorsing a therapy fails: "${s}"`, violates(withSentence('myoguard-perspective', s), /endorses a therapy|endorses a brand/));
  }
  t('[behaviour] E. "Its role is not to favour a particular medicine" passes', !violates(PILOT, /endorse/));

  // Physician oversight
  const noOversight = JSON.parse(JSON.stringify(PILOT)
    .split('A clinically supervised transition plan').join('A transition plan')
    .split('MyoGuard’s physician-led Clinical Decision Support').join('MyoGuard’s Clinical Decision Support'));
  t('[safety] E. missing physician-oversight language fails', violates(noOversight, /physician-oversight language is missing/));

  // Disclaimer
  const noDisc = clone(PILOT); noDisc.educationalDisclaimer = '';
  t('[safety] E. a missing disclaimer fails', violates(noDisc, /educationalDisclaimer is required/));
  const weakDisc = replacing('does not replace individualized medical advice', 'is general information');
  t('[safety] E. a disclaimer that does not defer to individual advice fails', violates(weakDisc, /does not replace individual medical advice/));
  const mismatch = clone(PILOT); mismatch.sections.at(-1).blocks = [{ k: 'p', text: 'Educational only.' }];
  t('[safety] E. a disclaimer section that differs from educationalDisclaimer fails', violates(mismatch, /state educationalDisclaimer exactly/));

  // PHI and patient cases
  for (const [label, s] of [['a patient case', 'One patient who stopped presented with fatigue.'], ['a named individual', 'Mrs Smith restarted her medicine.'],
                            ['an age', 'A 54-year-old man stopped treatment.'], ['an email address', 'Write to jane@example.com for advice.']]) {
    t(`[safety] E. PHI fails: ${label}`, violates(withSentence('meaning-for-patients', s), /PHI|patient case/));
  }
  const field = clone(PILOT); field.sections[0].patientId = 'x';
  t('[safety] E. a patient-level field fails', violates(field, /patient-level field "patientId"|unknown field "patientId"/));

  // Terminology
  for (const s of ['Your MyoGuard score will guide this.', 'The SRI calculator shows your risk.', 'MyoGuard calculates your risk after stopping.']) {
    t(`[safety] E. prohibited MyoGuard terminology fails: "${s}"`, violates(withSentence('myoguard-perspective', s), /terminology/));
  }

  // Product changes and SRI/CDS implications
  for (const s of ['This study changes the SRI thresholds.', 'The SRI has been updated to reflect this study.',
                   'Update the CDS alerts for patients who stop.', 'MyoGuard will now flag everyone who stops treatment.']) {
    t(`[safety] E. product-change or SRI/CDS wording fails: "${s}"`, violates(withSentence('myoguard-perspective', s), /product-change/));
  }

  // Review
  t('[safety] E. an expired review date fails', violates(PILOT, /review overdue/, EVIDENCE_REGISTER, '2027-03-28'));
  t('[behaviour] E. the review is valid on its due date', !violates(PILOT, /review overdue/, EVIDENCE_REGISTER, '2027-03-27'));
  const noReviewer = clone(PILOT); noReviewer.reviewedBy = '';
  t('[safety] E. a missing reviewer fails', violates(noReviewer, /reviewedBy must identify the reviewer/));
  const noDate = clone(PILOT); noDate.lastReviewedAt = null;
  t('[safety] E. a missing review date fails', violates(noDate, /lastReviewedAt must be an ISO date/));
  const backwards = clone(PILOT); backwards.reviewDueAt = '2026-09-01';
  t('[safety] E. a due date before the review fails', violates(backwards, /reviewDueAt must be after lastReviewedAt/));

  // Structure
  const extra = clone(PILOT); extra.publishedAt = '2026-09-27';
  t('[safety] E. an unknown field fails (no publishedAt on a manuscript)', violates(extra, /unknown field "publishedAt"/));
  t('[safety] E. a non-object is rejected', manuscriptViolations(null, EVIDENCE_REGISTER, DRAFT_DAY).length > 0);
}

// ── F. Linked evidence and approval governance ───────────────────────────────
section('-- F. Evidence links and approval cannot be bypassed --');
{
  const missing = clone(PILOT); missing.linkedEvidenceId = 'ev-does-not-exist';
  t('[safety] F. an unknown linked entry fails', violates(missing, /does not exist/));
  const noLink = clone(PILOT); noLink.linkedEvidenceId = '';
  t('[safety] F. no linked entry fails', violates(noLink, /linkedEvidenceId is required/));

  const reg = patch => EVIDENCE_REGISTER.map(e => (e.id === SEED_ID ? { ...clone(e), ...patch } : e));
  const regSource = patch => EVIDENCE_REGISTER.map(e => (e.id === SEED_ID ? { ...clone(e), externalSource: { ...clone(e.externalSource), ...patch } } : e));
  t('[safety] F. unverified linked evidence fails', violates(PILOT, /source is not verified/, regSource({ identifiersConfirmed: false })));
  t('[safety] F. linked evidence without DOI, PMID or canonical URL fails', violates(PILOT, /no DOI, PMID or canonical source/, regSource({ doi: null, pmid: null })));
  t('[safety] F. invalid linked evidence fails', violates(PILOT, /linked Evidence Register entry is invalid/, reg({ limitations: [] })));
  t('[safety] F. CCC_ONLY evidence never permits a public explainer', violates(PILOT, /never permits a public explainer/, reg({ visibility: 'CCC_ONLY' })));
  const noIds = clone(PILOT); noIds.sourceReferences[0].doi = null; noIds.sourceReferences[0].pmid = null;
  t('[safety] F. a source without DOI, PMID or canonical URL fails', violates(noIds, /lacks a DOI, PMID or verified canonical source/));
  const wrongDoi = replacing('10.1111/dom.70660', '10.1111/dom.70661');
  t('[safety] F. a DOI that differs from the register fails', violates(wrongDoi, /do not match the linked Evidence Register entry/));
  const noRefs = clone(PILOT); noRefs.sourceReferences = [];
  t('[safety] F. no source references fails', violates(noRefs, /must list the verified source/));

  // Approval without Founder governance
  const approved = clone(PILOT); approved.manuscriptStatus = 'APPROVED';
  const av = violations(approved);
  t('[safety] F. APPROVED fails while the evidence is DRAFT', av.some(x => /linked evidence to be APPROVED or PUBLISHED/.test(x)));
  t('[safety] F. APPROVED fails without a Founder decision', av.some(x => /completed Founder decision/.test(x)));
  t('[safety] F. APPROVED fails unless the register slug names this manuscript', av.some(x => /explainerSlug to equal internalWorkingSlug/.test(x)));

  // With full Founder governance the record is valid — and still not exposable.
  const governed = reg({
    status: 'APPROVED',
    decision: { by: 'FOUNDER', at: '2026-09-27', rationale: 'Synthetic test decision.' },
    explainerSlug: PILOT.internalWorkingSlug,
    publicInterestRationale: 'Synthetic test rationale.',
    lastReviewedAt: '2026-09-27',
    reviewDueAt: '2027-03-27',
  });
  t('[behaviour] F. the synthetic governed entry is itself valid', evidenceGovernanceViolations(governed.find(e => e.id === SEED_ID)).length === 0);
  t('[behaviour] F. APPROVED with full Founder governance has no violations', violations(approved, governed).length === 0, JSON.stringify(violations(approved, governed)));
  const blockers = manuscriptPublicationBlockers(approved, governed, DRAFT_DAY);
  // Step 4A: only PUBLISHED evidence may go public. APPROVED evidence is CCC-only.
  t('[safety] F. even then it is not exposable: APPROVED evidence is not PUBLISHED',
    blockers.some(b => /linked evidence status APPROVED is not published/.test(b)) &&
    blockers.some(b => /no valid publishedAt/.test(b)) && !isManuscriptPubliclyExposable(approved, governed, DRAFT_DAY),
    JSON.stringify(blockers));
  t('[safety] F. with the route capability disabled nothing is exposable',
    manuscriptPublicationBlockers(approved, governed, DRAFT_DAY, false).some(b => /route is disabled/.test(b)));
  const slugMismatch = EVIDENCE_REGISTER.map(e => (e.id === SEED_ID ? { ...clone(e), explainerSlug: 'another-article' } : e));
  t('[safety] F. a register slug naming another article fails', violates(PILOT, /names a different explainerSlug/, slugMismatch));
}

// ── G. Publication separation ────────────────────────────────────────────────
// Step 4A added the governed route /learn/evidence/[slug] and enabled the route
// capability. These checks now prove that the ONLY way anything public reaches
// a manuscript is the central selector (publicArticles.ts), and that the pilot
// is refused by it. scripts/evidenceExplainedPublicRoute.test.mjs covers the
// route itself.
section('-- G. Only the central selector can reach a manuscript, and it refuses the pilot --');
{
  t('[safety] G. the route capability is enabled, and the pilot is still not exposable',
    PUBLIC_ROUTE_IMPLEMENTED === true && !isManuscriptPubliclyExposable(PILOT, EVIDENCE_REGISTER, TODAY));
  const b = manuscriptPublicationBlockers(PILOT, EVIDENCE_REGISTER, TODAY);
  for (const re of [/manuscript status DRAFT/, /linked evidence status DRAFT is not published/, /no complete Founder decision/,
                    /explainerSlug does not name/, /no valid publishedAt/, /review dates are incomplete/, /fails public governance/]) {
    t(`[safety] G. blocked for: ${re.source}`, b.some(x => re.test(x)));
  }

  const walk = dir => existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).flatMap(n => {
    const p = join(dir, n);
    return statSync(join(ROOT, p)).isDirectory() ? (['node_modules', '.next', '.git'].includes(n) ? [] : walk(p)) : [p];
  }) : [];
  const code = f => /\.(tsx?|jsx?|mjs|json|xml|txt)$/.test(f);
  const norm = p => p.replace(/\\/g, '/');
  const OWN = /^src\/lib\/learn\/evidenceExplained\//;
  const appFiles = walk('app').filter(code);
  const elsewhere = [...appFiles, ...walk('src').filter(code), ...walk('public'), 'middleware.ts', 'next.config.ts']
    .filter(f => existsSync(join(ROOT, f)) && !OWN.test(norm(f)));

  t('[safety] G. the only file under app/learn/evidence is [slug]/page.tsx (no index)',
    JSON.stringify(walk('app/learn/evidence').map(norm)) === JSON.stringify(['app/learn/evidence/[slug]/page.tsx']));
  t('[safety] G. no route under app/ is named after the working slug or "evidence-explained"',
    !appFiles.some(f => /evidence-explained|stopping-a-glp-1-medicine/.test(norm(f))));
  const specifiers = f => [...src(f).matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]*evidenceExplained[^'"]*)['"]/g)].map(m => m[1]);
  const outside = elsewhere.filter(f => /\.(tsx?|jsx?|mjs)$/.test(f)).flatMap(f => specifiers(f).map(sp => [norm(f), sp]));
  t('[safety] G. outside the folder, only the central selector is imported',
    outside.length > 0 && outside.every(([, sp]) => sp === '@/src/lib/learn/evidenceExplained/publicArticles'), JSON.stringify(outside));
  const importers = [...new Set(outside.map(([f]) => f))].sort();
  t('[safety] G. the selector is used by exactly the route, /learn, the sitemap, the CCC selector and two presentational components',
    JSON.stringify(importers) === JSON.stringify(['app/learn/evidence/[slug]/page.tsx', 'app/learn/page.tsx', 'app/sitemap.ts',
      'src/components/learn/EvidenceArticle.tsx', 'src/components/learn/EvidenceExplainedDiscovery.tsx',
      'src/lib/practiceUpdates/clinicalPracticeUpdates.ts']), JSON.stringify(importers));
  t('[safety] G. the presentational components import types only',
    ['src/components/learn/EvidenceArticle.tsx', 'src/components/learn/EvidenceExplainedDiscovery.tsx']
      .every(f => /import type \{[^}]*\} from '@\/src\/lib\/learn\/evidenceExplained\/publicArticles'/.test(src(f))));
  const clientFiles = elsewhere.filter(f => /\.(tsx?|jsx?)$/.test(f) && /^\s*['"]use client['"]/m.test(src(f)));
  t('[safety] G. no client component imports anything from the manuscript folder',
    clientFiles.length > 0 && clientFiles.every(f => specifiers(f).length === 0));
  const leaks = elsewhere.filter(f => code(f) && /Why the Next Plan Matters|stopping-a-glp-1-medicine-next-plan|mn-2026-w39-treatment-discontinuation/.test(src(f)));
  t('[safety] G. the headline, slug and manuscript id appear nowhere in app/, src/ or public/', leaks.length === 0, JSON.stringify(leaks));
  t('[safety] G. the sitemap lists articles only through the selector',
    /\.\.\.publicArticleSitemapEntries\(\)/.test(src('app/sitemap.ts')) && !/['"`]\/learn\/evidence/.test(src('app/sitemap.ts')));
  t('[safety] G. /learn lists articles only through the selector',
    /publicArticleCards\(\)/.test(src('app/learn/page.tsx')) && !/['"`]\/learn\/evidence/.test(src('app/learn/page.tsx')));
  const ph = src('src/lib/posthog.ts');
  t('[safety] G. analytics names only the route pattern and one event, never a slug',
    /'\/learn\/evidence\/\[slug\]'/.test(ph) && /EVIDENCE_ARTICLE_VIEWED/.test(ph) && !/stopping-a-glp|mn-2026/.test(ph));
  t('[safety] G. the CCC component and page read no Evidence Explained module',
    !/evidenceExplained|manuscript/i.test(src('src/components/doctor/intelligence/ClinicalPracticeUpdates.tsx')) &&
    !/evidenceExplained|manuscript/i.test(src('app/doctor/practice-intelligence/page.tsx')));
  t('[safety] G. the Evidence Register does not import manuscripts', !/import[^;]*evidenceExplained/.test(src('src/data/evidenceRegister.ts')));

  const own = walk('src/lib/learn/evidenceExplained').filter(f => /\.tsx?$/.test(f));
  const imports = own.flatMap(f => [...src(f).matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map(m => m[1]));
  t('[safety] G. the manuscript modules import only the register, each other, Next types and server-only',
    imports.every(i => i === '@/src/data/evidenceRegister' || i === 'next' || i === 'server-only' || i.startsWith('./') || i.startsWith('../')), JSON.stringify(imports));
  t('[safety] G. the only "next" import is a type import', !own.some(f => /import\s+(?!type)[^;]*from\s+'next'/.test(src(f))));
  t('[safety] G. the central selector is server-only', /^import 'server-only';/m.test(src('src/lib/learn/evidenceExplained/publicArticles.ts')));
  t('[safety] G. no React, Prisma, analytics or protocol-engine import',
    !own.some(f => /from\s+['"](?:react|next\/|@prisma|posthog|@\/src\/lib\/(?:prisma|protocolEngine|analytics|posthog))/.test(src(f))));
  t('[safety] G. no SRI or CDS logic is imported', !own.some(f => /protocolEngine|sriEngine|clinicalDecision|@\/src\/lib\/evidence\//.test(src(f))));
}

// ── H. Content lock ──────────────────────────────────────────────────────────
section('-- H. The manuscript text is locked to the approved fixture --');
{
  const FIXTURE = 'scripts/fixtures/evidenceExplained/mn-2026-w39-treatment-discontinuation.v0.1.txt';
  // SHA-256 of the fixture, line endings normalised. Changing the approved text
  // means a new version: a new fixture, a new hash and a new review.
  const FIXTURE_SHA256 = '97a19ae8d16f5c9783b2eb7c07a0a5f021695107f41833b0393067f55e4c50ab';
  const raw = src(FIXTURE).replace(/\r\n/g, '\n');
  const fixtureLines = raw.split('\n').filter(l => l.trim() !== '' && !l.startsWith('#'));
  const render = m => [
    m.headline, m.standfirst,
    ...m.sections.flatMap(s => [s.heading.toUpperCase(), ...s.blocks.flatMap(b => (b.k === 'ul' ? b.items.map(i => '- ' + i) : [b.text]))]),
  ];
  const lines = render(PILOT);
  t('[lock]   the fixture is unchanged (SHA-256)', createHash('sha256').update(raw).digest('hex') === FIXTURE_SHA256,
    createHash('sha256').update(raw).digest('hex'));
  t('[lock]   the manuscript renders to exactly the fixture, line for line and in order',
    JSON.stringify(lines) === JSON.stringify(fixtureLines),
    lines.map((l, i) => (l === fixtureLines[i] ? null : `#${i}: "${l.slice(0, 50)}" ≠ "${String(fixtureLines[i]).slice(0, 50)}"`)).filter(Boolean).slice(0, 3).join(' | '));
  t('[lock]   every fixture line is present', fixtureLines.every(l => lines.includes(l)));
  t('[lock]   no unapproved line is present', lines.every(l => fixtureLines.includes(l)));
  const softened = replacing('does not prove that stopping treatment prevents weight regain', 'suggests that stopping treatment rarely causes weight regain');
  t('[lock]   a softened sentence breaks the lock', JSON.stringify(render(softened)) !== JSON.stringify(fixtureLines));
  const added = withSentence('myoguard-perspective', 'MyoGuard supports every patient.');
  t('[lock]   an added sentence breaks the lock', JSON.stringify(render(added)) !== JSON.stringify(fixtureLines));
  let threw = false;
  try { PILOT.sections[0].blocks[0].text = 'changed'; } catch { threw = true; }
  t('[lock]   the pilot is frozen at runtime', threw && PILOT.sections[0].blocks[0].text.startsWith('A real-world study'));
  let pushThrew = false;
  try { EVIDENCE_EXPLAINED_MANUSCRIPTS.push(clone(PILOT)); } catch { pushThrew = true; }
  t('[lock]   the registry is frozen at runtime', pushThrew && EVIDENCE_EXPLAINED_MANUSCRIPTS.length === 1);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
