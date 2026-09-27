/**
 * scripts/evidenceRegister.test.mjs
 *
 * Evidence Register, Step 1 — foundation and governance.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/evidenceRegister.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * The governance functions are pure, so every rule is exercised by calling the
 * shipped `evidenceGovernanceViolations` / `publicationBlockers` on the shipped
 * register and on synthetic entries. Nothing is mocked.
 *
 * A fully valid PUBLISHED fixture is built first and proven publishable (B).
 * Every negative test then breaks exactly one thing in that fixture, so a
 * failure to block is attributable to the rule under test and cannot pass
 * vacuously because the fixture was already invalid for some other reason.
 *
 * That the register cannot alter the SRI or CDS logic is the absence of a code
 * path, so it is asserted against shipped source (K).
 *
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would publish
 *                 unapproved content, expose PHI, or reach clinical logic.
 *
 * Touches no database, contacts no provider, renders nothing.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EVIDENCE_REGISTER,
  VISIBILITIES,
  STATUSES,
  PRACTICE_CLASSIFICATIONS,
  PERSISTENCE_THEMES,
  PERMITTED_POSITIONING,
  POSITIONING_FIELDS,
  PROHIBITED_FIELD_NAMES,
  evidenceGovernanceViolations,
  publicationBlockers,
  isPubliclyPublishable,
  isPubliclyExposable,
  registerViolations,
  isValidIsoWeek,
  isValidIsoDate,
} from '../src/data/evidenceRegister.ts';
import { CITATIONS } from '../src/data/citations.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const src  = p => readFileSync(join(ROOT, p), 'utf8');

const clone = o => JSON.parse(JSON.stringify(o));
const without = (o, key) => { const c = clone(o); delete c[key]; return c; };
const with_ = (o, patch) => ({ ...clone(o), ...patch });
const blocked = e => !isPubliclyPublishable(e) && !isPubliclyExposable(e);
const violates = (e, re) => evidenceGovernanceViolations(e).some(m => re.test(m));

// A complete, valid, PUBLISHED public entry. Synthetic — never added to the register.
const PUBLISHED = Object.freeze({
  id: 'ev-test-published',
  title: 'Protein intake and lean mass during treatment',
  briefIssue: '2026-W39',
  sourceCitationId: CITATIONS[0].id,
  externalSource: null,
  evidenceType: 'RCT',
  evidenceQuality: 'MODERATE',
  clinicalRelevance: 'Relevant to nutrition planning under clinician oversight.',
  limitations: ['Single trial population.'],
  myoguardImplication: { proposalOnly: true, text: 'Proposal only: no change is authorised.' },
  visibility: 'PUBLIC_AND_CCC',
  status: 'PUBLISHED',
  practiceClassification: 'CONSIDER',
  persistenceThemes: ['NUTRITION', 'MUSCLE_PRESERVATION'],
  publicInterestRationale: PERMITTED_POSITIONING,
  decision: { by: 'FOUNDER', at: '2026-09-20', rationale: 'Credible, relevant and aligned.' },
  explainerSlug: 'protein-and-lean-mass',
  publishedAt: '2026-09-21',
  lastReviewedAt: '2026-09-20',
  reviewDueAt: '2027-03-20',
});

// ── A. The shipped register ──────────────────────────────────────────────────
section('-- A. The shipped register is valid --');
{
  const v = registerViolations(EVIDENCE_REGISTER);
  t('[behaviour] A. register has zero governance violations', v.length === 0);
  if (v.length) v.forEach(m => console.log('        ' + m));
  t('[behaviour] A. register is non-empty', EVIDENCE_REGISTER.length > 0);

  const ids = EVIDENCE_REGISTER.map(e => e.id);
  t('[behaviour] A. every entry has a unique id', new Set(ids).size === ids.length);
  t('[behaviour] A. every briefIssue is a valid ISO week',
    EVIDENCE_REGISTER.every(e => isValidIsoWeek(e.briefIssue)));
  t('[behaviour] A. every visibility is a permitted value',
    EVIDENCE_REGISTER.every(e => VISIBILITIES.includes(e.visibility)));
  t('[behaviour] A. every status is a permitted value',
    EVIDENCE_REGISTER.every(e => STATUSES.includes(e.status)));
  t('[behaviour] A. every practiceClassification is a permitted value',
    EVIDENCE_REGISTER.every(e => PRACTICE_CLASSIFICATIONS.includes(e.practiceClassification)));
  t('[behaviour] A. every persistence theme is a permitted value',
    EVIDENCE_REGISTER.every(e => e.persistenceThemes.every(p => PERSISTENCE_THEMES.includes(p))));

  const citationIds = new Set(CITATIONS.map(c => c.id));
  t('[safety] A. every sourceCitationId resolves to the Clinical Evidence Library',
    EVIDENCE_REGISTER.every(e => e.sourceCitationId === null || citationIds.has(e.sourceCitationId)));

  const dup = [PUBLISHED, with_(PUBLISHED, { explainerSlug: 'other-slug' })];
  t('[behaviour] A. a duplicate id is a register violation',
    registerViolations(dup).some(m => /duplicate id/.test(m)));
  const dupSlug = [PUBLISHED, with_(PUBLISHED, { id: 'ev-test-other' })];
  t('[behaviour] A. a duplicate explainerSlug is a register violation',
    registerViolations(dupSlug).some(m => /duplicate explainerSlug/.test(m)));
}

// ── B. Positive control ──────────────────────────────────────────────────────
section('-- B. A complete published entry passes (positive control) --');
{
  const v = evidenceGovernanceViolations(PUBLISHED);
  t('[behaviour] B. the fixture has zero violations', v.length === 0);
  if (v.length) v.forEach(m => console.log('        ' + m));
  t('[behaviour] B. the fixture is publicly publishable', isPubliclyPublishable(PUBLISHED));
  t('[behaviour] B. the fixture is publicly exposable', isPubliclyExposable(PUBLISHED));
  const myth = with_(PUBLISHED, { visibility: 'PUBLIC_MYTH_CORRECTION' });
  t('[behaviour] B. PUBLIC_MYTH_CORRECTION is equally publishable', isPubliclyPublishable(myth));
  const approved = with_(PUBLISHED, { status: 'APPROVED', publishedAt: null });
  t('[behaviour] B. APPROVED is publishable but not yet exposable',
    isPubliclyPublishable(approved) && !isPubliclyExposable(approved));
}

// ── C. ISO week and date primitives ──────────────────────────────────────────
section('-- C. ISO week and date validation --');
{
  t('[behaviour] C. 2026-W39 is valid', isValidIsoWeek('2026-W39'));
  t('[behaviour] C. 2026-W53 is valid (1 Jan 2026 is a Thursday)', isValidIsoWeek('2026-W53'));
  t('[behaviour] C. 2025-W53 is invalid (2025 has 52 weeks)', !isValidIsoWeek('2025-W53'));
  t('[behaviour] C. 2020-W53 is valid (leap year starting Wednesday)', isValidIsoWeek('2020-W53'));
  for (const bad of ['2026-W00', '2026-W54', '2026-W5', '2026-39', '2026W39', '', null, 202639]) {
    t(`[behaviour] C. ${JSON.stringify(bad)} is not an ISO week`, !isValidIsoWeek(bad));
  }
  t('[behaviour] C. an invalid briefIssue is an entry violation',
    violates(with_(PUBLISHED, { briefIssue: '2026-39' }), /briefIssue/));
  t('[behaviour] C. 2026-02-30 is not a date', !isValidIsoDate('2026-02-30'));
  t('[behaviour] C. 2026-09-25 is a date', isValidIsoDate('2026-09-25'));
}

// ── D. The seed entry ────────────────────────────────────────────────────────
section('-- D. The 2026-W39 discontinuation seed is valid but non-publishable --');
{
  const seed = EVIDENCE_REGISTER.find(e => e.id === 'ev-2026-w39-treatment-discontinuation');
  t('[behaviour] D. the seed entry exists', !!seed);
  t('[behaviour] D. it is the only entry', EVIDENCE_REGISTER.length === 1);
  t('[behaviour] D. visibility PUBLIC_AND_CCC, status DRAFT',
    seed?.visibility === 'PUBLIC_AND_CCC' && seed?.status === 'DRAFT');
  t('[behaviour] D. no explainerSlug, publishedAt or decision',
    seed?.explainerSlug === null && seed?.publishedAt === null && seed?.decision === null);
  t('[behaviour] D. briefIssue is 2026-W39 (week of 25 September 2026)', seed?.briefIssue === '2026-W39');
  t('[behaviour] D. it has zero integrity violations', evidenceGovernanceViolations(seed).length === 0);
  t('[safety] D. it is not publicly publishable', !isPubliclyPublishable(seed));
  t('[safety] D. it is not publicly exposable', !isPubliclyExposable(seed));
  const b = publicationBlockers(seed);
  for (const re of [/status DRAFT/, /Founder decision/, /explainerSlug/, /publicInterestRationale/,
                    /lastReviewedAt/, /reviewDueAt/, /not verified/]) {
    t(`[safety] D. blocked for: ${re.source}`, b.some(m => re.test(m)));
  }
}

// ── E. Founder approval metadata is mandatory for public entries ─────────────
section('-- E. Public entries cannot pass without Founder approval metadata --');
{
  for (const vis of ['PUBLIC_AND_CCC', 'PUBLIC_MYTH_CORRECTION']) {
    for (const status of ['APPROVED', 'PUBLISHED']) {
      const base = with_(PUBLISHED, { visibility: vis, status, publishedAt: status === 'PUBLISHED' ? '2026-09-21' : null });
      const cases = {
        'decision null':                  with_(base, { decision: null }),
        'decision key absent':            without(base, 'decision'),
        'decision.by not FOUNDER':        with_(base, { decision: { ...base.decision, by: 'ADMIN' } }),
        'decision.at missing':            with_(base, { decision: { by: 'FOUNDER', rationale: 'x' } }),
        'decision.rationale blank':       with_(base, { decision: { ...base.decision, rationale: '   ' } }),
        'publicInterestRationale null':   with_(base, { publicInterestRationale: null }),
        'explainerSlug null':             with_(base, { explainerSlug: null }),
        'lastReviewedAt + reviewDueAt null': with_(base, { lastReviewedAt: null, reviewDueAt: null }),
        'reviewDueAt key absent':         without(base, 'reviewDueAt'),
      };
      for (const [name, e] of Object.entries(cases)) {
        t(`[safety] E. ${vis}/${status}: ${name} → invalid and blocked`,
          evidenceGovernanceViolations(e).length > 0 && blocked(e));
      }
    }
  }
}

// ── F. Published entries ─────────────────────────────────────────────────────
section('-- F. Published entries require approval, slug, publishedAt and review dates --');
{
  t('[safety] F. PUBLISHED without publishedAt is invalid',
    violates(with_(PUBLISHED, { publishedAt: null }), /PUBLISHED items require publishedAt/));
  t('[safety] F. PUBLISHED without a decision is invalid',
    violates(with_(PUBLISHED, { decision: null }), /requires a Founder decision/));
  t('[safety] F. PUBLISHED without explainerSlug is invalid',
    violates(with_(PUBLISHED, { explainerSlug: null }), /explainerSlug/));
  t('[safety] F. PUBLISHED without review dates is invalid',
    violates(with_(PUBLISHED, { lastReviewedAt: null, reviewDueAt: null }), /review dates/));
  t('[safety] F. publishedAt before the Founder decision is invalid',
    violates(with_(PUBLISHED, { publishedAt: '2026-09-19' }), /precede the Founder decision/));
  for (const s of ['REJECTED', 'WITHDRAWN']) {
    t(`[safety] F. ${s} without a Founder decision is invalid`,
      violates(with_(PUBLISHED, { status: s, decision: null }), /requires a Founder decision/));
  }
}

// ── G. Non-publishable statuses, including WITHDRAWN ─────────────────────────
section('-- G. DRAFT, HELD, REJECTED and WITHDRAWN are never publicly publishable --');
{
  for (const status of ['DRAFT', 'HELD', 'REJECTED', 'WITHDRAWN']) {
    const e = with_(PUBLISHED, { status });
    t(`[safety] G. ${status} with otherwise-complete metadata is blocked`, blocked(e));
  }
  const withdrawn = with_(PUBLISHED, { status: 'WITHDRAWN' });
  t('[safety] G. WITHDRAWN keeps its history yet is not exposable',
    withdrawn.publishedAt !== null && !isPubliclyExposable(withdrawn));
}

// ── H. Never-public visibilities ─────────────────────────────────────────────
section('-- H. WATCHLIST and NO_PUBLICATION can never produce a public article --');
{
  for (const vis of ['WATCHLIST', 'NO_PUBLICATION']) {
    t(`[safety] H. ${vis} with an explainerSlug is invalid`,
      violates(with_(PUBLISHED, { visibility: vis, status: 'DRAFT', publishedAt: null }), /cannot have an explainerSlug/));
    t(`[safety] H. ${vis} with publishedAt is invalid`,
      violates(with_(PUBLISHED, { visibility: vis, status: 'DRAFT', explainerSlug: null }), /cannot have publishedAt/));
    t(`[safety] H. ${vis} cannot be PUBLISHED`,
      violates(with_(PUBLISHED, { visibility: vis }), new RegExp(`${vis} items cannot be PUBLISHED`)));
    const clean = with_(PUBLISHED, { visibility: vis, status: 'HELD', explainerSlug: null, publishedAt: null });
    t(`[behaviour] H. a clean HELD ${vis} entry is valid`, evidenceGovernanceViolations(clean).length === 0);
    t(`[safety] H. ...and still never publicly publishable`, blocked(clean));
  }
  const ccc = with_(PUBLISHED, { visibility: 'CCC_ONLY', explainerSlug: null, publicInterestRationale: null });
  t('[behaviour] H. a published CCC_ONLY entry is valid', evidenceGovernanceViolations(ccc).length === 0);
  t('[safety] H. ...and never publicly publishable', blocked(ccc));
  t('[safety] H. CCC_ONLY with an explainerSlug is invalid',
    violates(with_(ccc, { explainerSlug: 'x' }), /cannot have an explainerSlug/));
}

// ── I. Review window ─────────────────────────────────────────────────────────
section('-- I. reviewDueAt must follow lastReviewedAt --');
{
  t('[safety] I. equal dates are invalid',
    violates(with_(PUBLISHED, { reviewDueAt: '2026-09-20' }), /reviewDueAt must be after/));
  t('[safety] I. an earlier reviewDueAt is invalid',
    violates(with_(PUBLISHED, { reviewDueAt: '2026-01-01' }), /reviewDueAt must be after/));
  t('[safety] I. lastReviewedAt without reviewDueAt is invalid',
    violates(with_(PUBLISHED, { reviewDueAt: null }), /set together/));
  t('[safety] I. an impossible date is invalid',
    violates(with_(PUBLISHED, { reviewDueAt: '2027-02-30' }), /reviewDueAt must be an ISO date/));
}

// ── J. Treatment-persistence wording, terminology and therapy neutrality ─────
section('-- J. Positioning never urges continued use; evidence description stays free --');
{
  t('[ordering] J. the positioning fields are exactly publicInterestRationale and myoguardImplication.text',
    JSON.stringify(POSITIONING_FIELDS) === JSON.stringify(['publicInterestRationale', 'myoguardImplication.text']));

  // Positioning fields, and the patch that places text in each.
  const positioning = [
    ['publicInterestRationale', s => ({ publicInterestRationale: s })],
    ['myoguardImplication.text', s => ({ myoguardImplication: { proposalOnly: true, text: s } })],
  ];
  // Descriptive fields: source metadata, study titles, findings, limitations, CCC interpretation.
  const descriptive = [
    ['title', s => ({ title: s })],
    ['clinicalRelevance', s => ({ clinicalRelevance: s })],
    ['limitations', s => ({ limitations: [s] })],
    ['externalSource.description', s => ({
      sourceCitationId: null,
      externalSource: { description: s, doi: null, pmid: null, canonicalUrl: null, identifiersConfirmed: true },
    })],
    ['decision.rationale', s => ({ decision: { ...PUBLISHED.decision, rationale: s } })],
  ];

  const directive = [
    'You should stay on treatment.',
    'You must continue.',
    'Stay on your medication.',
    'Keep taking it.',
    "Don't stop treatment.",
    'Don’t stop treatment.',                // curly apostrophe
    'Do not stop your injections.',
    'Never stop.',
    'Remain on treatment indefinitely.',
    'Long-term use is necessary.',
    'You will need this medicine for life.',
    'Refill today so you never miss a week.',
    'Use the savings card to keep going.',
  ];
  for (const p of directive) {
    for (const [name, patch] of positioning) {
      t(`[safety] J. "${p}" is rejected in ${name}`,
        violates(with_(PUBLISHED, patch(p)), /treatment-persistence/));
    }
  }
  t('[safety] J. positioning is checked at every status and visibility (DRAFT CCC_ONLY)',
    violates(with_(PUBLISHED, { status: 'DRAFT', visibility: 'CCC_ONLY', explainerSlug: null,
      publicInterestRationale: 'You should stay on treatment.' }), /treatment-persistence/));

  // Accurate evidence description is permitted — in descriptive fields and in positioning alike.
  const accurate = [
    'Participants who remained on treatment maintained more lean mass.',
    'Continuous treatment was associated with sustained weight reduction.',
    'Treatment discontinuation was followed by partial weight regain.',
    'Long-term follow-up extended to 104 weeks.',
    'Do not stop treatment without first speaking to your clinician.',
    'Never stop abruptly; plan any change with your prescriber.',
    PERMITTED_POSITIONING,
  ];
  for (const s of accurate) {
    for (const [name, patch] of [...positioning, ...descriptive]) {
      t(`[behaviour] J. "${s.slice(0, 48)}" is permitted in ${name}`,
        !violates(with_(PUBLISHED, patch(s)), /treatment-persistence/));
    }
  }
  // Directive wording in a descriptive field is out of scope at the Register stage.
  for (const [name, patch] of descriptive) {
    t(`[behaviour] J. descriptive field ${name} is not persistence-checked`,
      !violates(with_(PUBLISHED, patch('Participants were told: do not stop treatment.')), /treatment-persistence/));
  }

  for (const term of ['SRI calculator', 'your SRI score', "MyoGuard's risk scores"]) {
    t(`[safety] J. "${term}" is prohibited terminology on any entry`,
      violates(with_(PUBLISHED, { visibility: 'CCC_ONLY', explainerSlug: null, clinicalRelevance: term }), /prohibited terminology/));
  }
  t('[behaviour] J. "risk scores" alone describes no MyoGuard instrument and is permitted',
    !violates(with_(PUBLISHED, { visibility: 'CCC_ONLY', explainerSlug: null, clinicalRelevance: 'Existing risk scores were compared.' }), /prohibited terminology/));
}

// ── N. Brand and manufacturer names ──────────────────────────────────────────
section('-- N. Brands may be named accurately; never promoted or endorsed --');
{
  const descriptiveBrand = [
    ['title (study title)', { title: 'SURMOUNT-5: Zepbound versus Wegovy in adults with obesity' }],
    ['externalSource.description (source metadata)', {
      sourceCitationId: null,
      externalSource: { description: 'Trial sponsored by Eli Lilly; Mounjaro arm reported.', doi: null, pmid: null, canonicalUrl: null, identifiersConfirmed: true },
    }],
    ['clinicalRelevance (evidence-supported comparison)', { clinicalRelevance: 'Mounjaro was superior to Wegovy for weight reduction in the trial.' }],
    ['clinicalRelevance (regulatory)', { clinicalRelevance: 'Wegovy is FDA-approved for chronic weight management.' }],
    ['limitations (conflict of interest)', { limitations: ['Funded by Novo Nordisk; authors declared manufacturer ties.'] }],
    ['publicInterestRationale (myth correction naming the product)', {
      visibility: 'PUBLIC_MYTH_CORRECTION',
      publicInterestRationale: 'Corrects a widely shared claim that Ozempic destroys muscle, which the evidence does not support.',
    }],
    ['publicInterestRationale (neutral mention)', { publicInterestRationale: 'Patients prescribed Wegovy often ask about muscle health.' }],
    ['clinicalRelevance (disclaimer)', { clinicalRelevance: 'MyoGuard does not endorse Wegovy or any branded medicine.' }],
  ];
  for (const [name, patch] of descriptiveBrand) {
    const e = with_(PUBLISHED, patch);
    const v = evidenceGovernanceViolations(e);
    t(`[behaviour] N. brand permitted in ${name}`, v.length === 0);
    if (v.length) v.forEach(m => console.log('        ' + m));
  }

  const promotional = [
    'Wegovy is the best option for weight loss.',
    'Mounjaro outperforms other treatments.',
    'Zepbound is better than older medicines.',
    'Ask your doctor about Ozempic.',
    'Switch to Mounjaro today.',
    'A breakthrough from Novo Nordisk.',
  ];
  for (const s of promotional) {
    for (const [name, patch] of [
      ['publicInterestRationale', { publicInterestRationale: s }],
      ['myoguardImplication.text', { myoguardImplication: { proposalOnly: true, text: s } }],
    ]) {
      t(`[safety] N. "${s}" is rejected in ${name}`,
        violates(with_(PUBLISHED, patch), /promotional brand wording/));
    }
  }
  t('[behaviour] N. promotion without a brand name is not a brand violation',
    !violates(with_(PUBLISHED, { publicInterestRationale: 'Supports the best available care under clinician oversight.' }), /promotional brand/));

  for (const [name, patch] of [
    ['clinicalRelevance', { clinicalRelevance: 'MyoGuard recommends Wegovy for eligible patients.' }],
    ['title', { title: 'MyoGuard endorses Mounjaro' }],
    ['limitations', { limitations: ['MyoGuard prefers Zepbound in this setting.'] }],
    ['publicInterestRationale', { publicInterestRationale: 'MyoGuard favours Novo Nordisk products.' }],
  ]) {
    t(`[safety] N. MyoGuard endorsement is rejected in ${name}`,
      violates(with_(PUBLISHED, patch), /endorses a brand/));
  }
}

// ── K. No patient identifiers or patient-level fields ────────────────────────
section('-- K. No PHI, no patient-level fields --');
{
  for (const f of PROHIBITED_FIELD_NAMES) {
    t(`[safety] K. top-level field "${f}" is rejected`,
      violates({ ...clone(PUBLISHED), [f]: 'x' }, new RegExp(`"${f}"`)));
  }
  t('[safety] K. a patient field nested in decision is rejected',
    violates(with_(PUBLISHED, { decision: { ...PUBLISHED.decision, patientId: 'x' } }), /patientId/));
  t('[safety] K. any unknown field is rejected (fail closed)',
    violates({ ...clone(PUBLISHED), notes: 'x' }, /unknown field "notes"/));

  const phi = [
    'Contact jane.doe@example.com',
    'Call (307) 555-0142',
    'A 54-year-old woman on therapy',
    'Patient A lost muscle',
    'patient #12 reported nausea',
    'Mrs Smith described fatigue',
    'DOB recorded',
    'MRN on file',
    'our patient who stopped treatment',
    'She presented with weakness',
    'user_2abcdefghijklmnopqrstuvwx',
    'record ckz1a2b3c4d5e6f7g8h9i0j1k',
  ];
  for (const s of phi) {
    t(`[safety] K. "${s}" is flagged as possible PHI`,
      violates(with_(PUBLISHED, { clinicalRelevance: s }), /possible PHI/));
  }
  t('[behaviour] K. ISO dates, DOIs and PMIDs are not mistaken for PHI',
    !violates(with_(PUBLISHED, {
      sourceCitationId: null,
      externalSource: { description: 'Published 2026-09-25', doi: '10.1056/NEJMoa2032183', pmid: '33567185', canonicalUrl: null, identifiersConfirmed: true },
    }), /possible PHI/));
}

// ── L. The register cannot alter the SRI or CDS logic ────────────────────────
section('-- L. No programmatic path to the SRI or CDS logic --');
{
  const code = src('src/data/evidenceRegister.ts');
  const imports = code.match(/^\s*import\s[^;]+;/gm) ?? [];
  t('[ordering] L. the register module has only type-only imports',
    imports.length > 0 && imports.every(i => /^\s*import type\s/.test(i)));
  t('[ordering] L. no dynamic import or require',
    !/\bimport\s*\(/.test(code) && !/\brequire\s*\(/.test(code));
  t('[ordering] L. no reference to protocolEngine, Prisma, fetch or the environment',
    !/protocolEngine|prisma|\bfetch\s*\(|process\.env/i.test(code));
  t('[ordering] L. the register does not import the Clinical Evidence Engine',
    !imports.some(i => /lib\/evidence/.test(i)));

  t('[safety] L. every entry implication is proposalOnly: true',
    EVIDENCE_REGISTER.every(e => e.myoguardImplication.proposalOnly === true));
  t('[safety] L. proposalOnly: false is a violation',
    violates(with_(PUBLISHED, { myoguardImplication: { proposalOnly: false, text: 'x' } }), /proposalOnly/));
  t('[safety] L. an entry carrying a function is a violation',
    violates({ ...clone(PUBLISHED), limitations: [() => 0] }, /plain data/));

  let threw = false;
  try { EVIDENCE_REGISTER[0].status = 'PUBLISHED'; } catch { threw = true; }
  t('[safety] L. register entries are frozen at runtime', threw && EVIDENCE_REGISTER[0].status === 'DRAFT');
  let pushThrew = false;
  try { EVIDENCE_REGISTER.push(clone(PUBLISHED)); } catch { pushThrew = true; }
  t('[safety] L. the register array is frozen at runtime', pushThrew && EVIDENCE_REGISTER.length === 1);

  // Clinical engines, patient evidence, APIs and middleware must never import the register.
  const walk = dir => readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mts)$/.test(n) ? [p] : [];
  });
  const guarded = [
    ...['src/lib/evidence', 'src/lib/intelligence', 'src/lib/clinical', 'app/api']
      .filter(d => existsSync(join(ROOT, d))).flatMap(d => walk(join(ROOT, d))),
    join(ROOT, 'src/lib/protocolEngine.ts'),
    join(ROOT, 'middleware.ts'),
  ];
  const importers = guarded.filter(f => /evidenceRegister/.test(readFileSync(f, 'utf8')));
  t(`[safety] L. none of ${guarded.length} guarded clinical/API files imports the register`, importers.length === 0);
  importers.forEach(f => console.log('        ' + f));
}

// ── M. Fail closed ───────────────────────────────────────────────────────────
section('-- M. Missing or malformed governance metadata fails closed --');
{
  for (const bad of [null, undefined, 'entry', 42, [], {}]) {
    t(`[safety] M. ${JSON.stringify(bad) ?? 'undefined'} is invalid and not publishable`,
      evidenceGovernanceViolations(bad).length > 0 && !isPubliclyPublishable(bad) && !isPubliclyExposable(bad));
  }
  t('[safety] M. an unknown status is blocked',
    blocked(with_(PUBLISHED, { status: 'LIVE' })) && violates(with_(PUBLISHED, { status: 'LIVE' }), /status is not/));
  t('[safety] M. an unknown visibility is blocked',
    blocked(with_(PUBLISHED, { visibility: 'PUBLIC' })));
  for (const key of ['visibility', 'status', 'decision', 'publicInterestRationale', 'explainerSlug', 'publishedAt']) {
    t(`[safety] M. removing "${key}" entirely blocks publication`,
      blocked(without(PUBLISHED, key)) && violates(without(PUBLISHED, key), /missing required field/));
  }
  t('[safety] M. both sources at once is invalid',
    violates(with_(PUBLISHED, { externalSource: { description: 'x', doi: null, pmid: null, canonicalUrl: null, identifiersConfirmed: true } }), /exactly one/));
  t('[safety] M. an unverified external source is not publishable',
    !isPubliclyPublishable(with_(PUBLISHED, {
      sourceCitationId: null,
      externalSource: { description: 'x', doi: null, pmid: null, canonicalUrl: null, identifiersConfirmed: false },
    })));
  t('[safety] M. unclassified or ungraded evidence is not publishable',
    !isPubliclyPublishable(with_(PUBLISHED, { evidenceType: 'PENDING_CLASSIFICATION' })) &&
    !isPubliclyPublishable(with_(PUBLISHED, { evidenceQuality: 'NOT_YET_GRADED' })));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
