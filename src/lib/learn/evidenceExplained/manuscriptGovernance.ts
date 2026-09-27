/**
 * src/lib/learn/evidenceExplained/manuscriptGovernance.ts
 *
 * Evidence Explained — manuscript schema and editorial governance.
 *
 * WHAT THIS IS
 * The typed shape of a patient-facing Evidence Explained manuscript, and the
 * rules a manuscript must satisfy before anyone may treat it as fit to show.
 * A manuscript explains one Evidence Register entry
 * (src/data/evidenceRegister.ts) to patients and the public.
 *
 * WHAT THIS IS NOT
 * It is not a page. Nothing in app/ imports this folder, no route renders a
 * manuscript, and `isManuscriptPubliclyExposable` answers no for every
 * manuscript until a separately approved public route exists
 * (`PUBLIC_ROUTE_IMPLEMENTED`). scripts/evidenceExplainedManuscripts.test.mjs
 * fails if a route, sitemap entry, analytics path or CCC import appears.
 *
 * WHAT A MANUSCRIPT NEVER DOES
 * It explains evidence. It never changes the Sarcopenia Risk Index (SRI),
 * Clinical Decision Support (CDS) logic, thresholds, nutrition
 * recommendations, medication guidance or alerts, and it never advises a
 * patient to start, continue, adjust or stop a medicine.
 *
 * FAIL-CLOSED
 * Every validator accepts `unknown` and reports rather than assumes. Anything
 * missing, unknown or malformed is a violation, and a violation blocks
 * publication. Validation is pure: the review clock is passed in as `today`.
 */

import {
  PHI_PATTERNS,
  PROHIBITED_FIELD_NAMES,
  PUBLIC_VISIBILITIES,
  BRAND_OR_MANUFACTURER,
  DOI_PATTERN,
  PMID_PATTERN,
  canonicalUrlProblems,
  endorsementFindings,
  evidenceGovernanceViolations,
  isPubliclyPublishable,
  isValidIsoDate,
  persistenceFindings,
  terminologyFindings,
  type EvidenceRegisterEntry,
  type IsoDate,
} from '@/src/data/evidenceRegister';

// ── Controlled vocabularies ────────────────────────────────────────────────────

export const MANUSCRIPT_STATUSES = ['DRAFT', 'FOUNDER_REVIEW', 'APPROVED', 'WITHDRAWN'] as const;
export type ManuscriptStatus = (typeof MANUSCRIPT_STATUSES)[number];

export const READING_AUDIENCES = ['PATIENTS_AND_PUBLIC'] as const;
export type ReadingAudience = (typeof READING_AUDIENCES)[number];

/** Who may be recorded as a manuscript's reviewer. The Founder is the final clinical authority. */
export const MANUSCRIPT_REVIEWERS = ['FOUNDER'] as const;
export type ManuscriptReviewer = (typeof MANUSCRIPT_REVIEWERS)[number];

/**
 * The required sections, in reading order, with their exact headings. Every
 * manuscript has all ten and no others.
 */
export const REQUIRED_SECTIONS = [
  { id: 'what-is-being-reported', heading: 'What is being reported?' },
  { id: 'what-researchers-examined', heading: 'What did the researchers examine?' },
  { id: 'what-they-found', heading: 'What did they find?' },
  { id: 'meaning-for-patients', heading: 'What might this mean for patients?' },
  { id: 'what-it-does-not-prove', heading: 'What does this study not prove?' },
  { id: 'why-transition-plan', heading: 'Why does a transition plan matter?' },
  { id: 'discuss-with-clinician', heading: 'What should you discuss with your clinician?' },
  { id: 'myoguard-perspective', heading: 'MyoGuard perspective' },
  { id: 'sources', heading: 'Sources' },
  { id: 'educational-disclaimer', heading: 'Educational disclaimer' },
] as const;
export type SectionId = (typeof REQUIRED_SECTIONS)[number]['id'];

/**
 * No public Evidence Explained route exists. A future step that implements one
 * changes this deliberately, together with its own tests. Until then no
 * manuscript is publicly exposable, whatever its status.
 */
export const PUBLIC_ROUTE_IMPLEMENTED = false as const;

// ── Shape ──────────────────────────────────────────────────────────────────────

/** A paragraph or a list. `k` names a presentation role, never a clinical claim. */
export type ManuscriptBlock =
  | { readonly k: 'p'; readonly text: string }
  | { readonly k: 'ul'; readonly items: readonly string[] };

export interface ManuscriptSection {
  readonly id: SectionId;
  readonly heading: string;
  readonly blocks: readonly ManuscriptBlock[];
}

/**
 * A number the manuscript states, tied to the sentence of the source that
 * supports it. `tokens` are the forms the manuscript uses ("7,938", "three");
 * each must equal a number in `sourceStatement`, which is quoted verbatim from
 * the source.
 */
export interface SourceFact {
  readonly id: string;
  readonly tokens: readonly string[];
  readonly sourceStatement: string;
}

export interface SourceReference {
  /** The Evidence Register entry this reference verifies. */
  readonly evidenceId: string;
  /** The citation shown under Sources. */
  readonly citation: string;
  readonly doi: string | null;
  readonly pmid: string | null;
  readonly canonicalUrl: string | null;
  readonly facts: readonly SourceFact[];
}

export interface EvidenceExplainedManuscript {
  readonly manuscriptId: string;
  readonly linkedEvidenceId: string;
  /**
   * The slug a future public article would use. Internal until the linked
   * register entry records it as `explainerSlug` under a Founder decision.
   */
  readonly internalWorkingSlug: string;
  readonly manuscriptStatus: ManuscriptStatus;
  readonly headline: string;
  readonly standfirst: string;
  readonly reviewedBy: ManuscriptReviewer;
  readonly draftedAt: IsoDate;
  readonly lastReviewedAt: IsoDate;
  readonly reviewDueAt: IsoDate;
  readonly readingAudience: ReadingAudience;
  readonly sections: readonly ManuscriptSection[];
  readonly sourceReferences: readonly SourceReference[];
  readonly educationalDisclaimer: string;
  /** "vMAJOR.MINOR". A wording change is a new version with a new locked fixture. */
  readonly version: string;
}

export const MANUSCRIPT_KEYS = [
  'manuscriptId',
  'linkedEvidenceId',
  'internalWorkingSlug',
  'manuscriptStatus',
  'headline',
  'standfirst',
  'reviewedBy',
  'draftedAt',
  'lastReviewedAt',
  'reviewDueAt',
  'readingAudience',
  'sections',
  'sourceReferences',
  'educationalDisclaimer',
  'version',
] as const;

const SECTION_KEYS = ['id', 'heading', 'blocks'] as const;
const REFERENCE_KEYS = ['evidenceId', 'citation', 'doi', 'pmid', 'canonicalUrl', 'facts'] as const;
const FACT_KEYS = ['id', 'tokens', 'sourceStatement'] as const;

// ── Editorial rules ────────────────────────────────────────────────────────────

/**
 * Numbers written as words that count as numerical claims. "one" is left out:
 * it is too often not a quantity ("one possible explanation"); a claim such as
 * "one in five" is still caught by "five".
 */
const NUMBER_WORDS: Readonly<Record<string, string>> = {
  two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15',
  sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20', thirty: '30',
  forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
  hundred: '100', thousand: '1000', million: '1000000', half: '0.5', twice: '2', dozen: '12',
  third: '1/3', thirds: '1/3', quarter: '1/4', quarters: '1/4',
};
const NUMBER_WORD = new RegExp(String.raw`\b(?:${Object.keys(NUMBER_WORDS).join('|')})\b`, 'gi');
const DIGIT_NUMBER = /\d[\d,]*(?:\.\d+)?%?/g;
/** Names that contain digits but are not claims. */
const NON_CLAIM_NUMERALS = /\bGLP-1\b/gi;

/** A manuscript token's numeric value: "7,938" → "7938", "19.6%" → "19.6", "three" → "3". */
export function numericValue(token: string): string {
  const word = NUMBER_WORDS[token.toLowerCase()];
  if (word) return word;
  return token.replace(/%$/, '').replace(/,(?=\d{3}\b)/g, '');
}

/** Every numerical claim token in a patient-facing text. */
export function numericalClaims(text: string): string[] {
  const s = text.replace(NON_CLAIM_NUMERALS, '');
  return [...(s.match(DIGIT_NUMBER) ?? []), ...(s.match(NUMBER_WORD) ?? [])];
}

/** The numbers in a source sentence, as values. */
function statementValues(statement: string): Set<string> {
  return new Set((statement.replace(/(\d),(\d{3})\b/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? []));
}

/** Words that signal a sentence denies or disclaims its claim. */
const NEGATION = /\b(?:not|cannot|can't|never|no|nor|doesn't|didn't|isn't|won't)\b/i;

/** Association presented as causation. A negated sentence ("does not prove that …") is a limitation and passes. */
export const CAUSAL_CLAIM =
  /\b(?:causes?|caused|causing|leads? to|led to|results? in|resulted in|prevents?|prevented|proves?|proved|proven|is responsible for|guarantees?|reduces?|reduced)\b/i;

/** The oversight a patient manuscript must name: supervised care and the treating clinician. */
export const PHYSICIAN_OVERSIGHT =
  /\b(?:clinically supervised|physician-led|treating clinician|your clinician|with (?:your|the treating) (?:clinician|physician|doctor))\b/i;

/** A study-limitations section must say what the study cannot show, and why. */
const LIMITATION_DENIAL = /\b(?:does not|cannot|did not|do not) (?:prove|establish|show)\b/i;
const LIMITATION_REASON =
  /\b(?:observational|health records|may have been missed|may have differed|confound\w*|bias|not captured|selection)\b/i;

const MEDICATION_VERBS = String.raw`(?:start|stop|continue|restart|resume|switch|come off|increase|decrease|reduce|adjust|taper|skip|double|halve|keep taking|stay on|remain on)`;

/** Advice to begin, continue, adjust or stop a medicine. Educational description does not match. */
export const MEDICATION_DIRECTIVES: readonly RegExp[] = [
  // Sentence-initial imperative: "Stop your injections.", "Continue treatment."
  new RegExp(String.raw`^\s*${MEDICATION_VERBS}\b`, 'i'),
  // Directive voice: "you should stop", "everyone should continue", "we recommend that you restart"
  new RegExp(String.raw`\b(?:you|everyone|patients|people)\s+(?:should|must|need to|have to|ought to|are advised to)\s+(?:not\s+)?${MEDICATION_VERBS}\b`, 'i'),
  new RegExp(String.raw`\b(?:we|MyoGuard)\s+(?:recommends?|advises?|suggests?|urges?)\b[^.]*\b${MEDICATION_VERBS}\b`, 'i'),
  new RegExp(String.raw`\bit is (?:best|safest|better|important|essential) to\s+${MEDICATION_VERBS}\b`, 'i'),
  // Dose adjustment
  /\b(?:increase|decrease|reduce|adjust|double|halve|skip|change) (?:your |the )?(?:dose|dosage|injections?)\b/i,
];

/** Commercial promotion: products, offers and sales language. */
export const PROMOTIONAL_PATTERNS: readonly RegExp[] = [
  /\b(?:supplements?|whey|protein powders?|protein shakes?|meal replacements?)\b/i,
  /\b(?:coupons?|discounts?|savings? cards?|co-?pay cards?|promo(?:tional)? codes?|free trial|special offer|limited[- ]time|affiliate|sponsored)\b/i,
  /\b(?:buy|order|shop|subscribe) (?:now|today|online|here)\b/i,
  /\b(?:miracle|breakthrough|revolutionary|game[- ]chang\w*|wonder drug)\b/i,
];

/** MyoGuard (or "we") backing a therapy. A negated sentence ("not to favour a particular medicine") passes. */
const THERAPY_ENDORSEMENT =
  /\b(?:MyoGuard|we|our)\b[^.]*\b(?:endorse[sd]?|recommend(?:s|ed)?|prefer(?:s|red)?|favou?r(?:s|ed)?|backs?|champions?)\b[^.]*\b(?:medicines?|medications?|drugs?|treatments?|therapy|therapies|semaglutide|tirzepatide|manufacturers?|brands?)\b/i;

/** Prohibited descriptions of MyoGuard and the SRI anywhere in a patient manuscript (CLAUDE.md). */
const PROHIBITED_TERMS = /\b(?:calculators?|calculat(?:e|es|ed|ing|ion)|scores?|scoring)\b/i;

/** An instruction to change the product, or a claim that publication changed it. */
export const PRODUCT_CHANGE_PATTERNS: readonly RegExp[] = [
  /\b(?:update|change|adjust|modify|recalibrate|revise|add to|remove from)\s+(?:the\s+)?(?:MyoGuard\s+)?(?:SRI|Sarcopenia Risk Index|CDS|Clinical Decision Support|thresholds?|algorithm|alerts?|dashboard|protocol engine)\b/i,
  /\b(?:MyoGuard|SRI|Sarcopenia Risk Index|Clinical Decision Support|CDS|thresholds?|alerts?)\b[^.]*\b(?:now|has been|have been|will be|is being|are being)\s+(?:updated|changed|adjusted|recalibrated|revised|modified)\b/i,
  /\b(?:this|the) (?:study|article|evidence|research|finding|publication)\b[^.]*\b(?:changes|updates|alters|modifies|recalibrates)\b[^.]*\b(?:SRI|Sarcopenia Risk Index|CDS|Clinical Decision Support|MyoGuard)\b/i,
  /\bMyoGuard (?:will|should|must) (?:now )?(?:flag|alert|recommend|change|adjust)\b/i,
];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^v\d+\.\d+$/;

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);
const straighten = (s: string) => s.replace(/[‘’ʼ]/g, "'");
const sentencesOf = (s: string): string[] => straighten(s).split(/(?<=[.!?])\s+/).filter(x => x.trim().length > 0);

function exactKeys(obj: Record<string, unknown>, allowed: readonly string[], label: string): string[] {
  const out: string[] = [];
  for (const k of allowed) if (!(k in obj)) out.push(`${label}: missing required field "${k}"`);
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) out.push(`${label}: unknown field "${k}"`);
  return out;
}

function keysIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysIn);
  if (isRecord(value)) return Object.entries(value).flatMap(([k, v]) => [k, ...keysIn(v)]);
  return [];
}

function hasFunction(value: unknown): boolean {
  if (typeof value === 'function') return true;
  if (Array.isArray(value)) return value.some(hasFunction);
  if (isRecord(value)) return Object.values(value).some(hasFunction);
  return false;
}

/** Visible text of a block list. */
function blockTexts(blocks: unknown): string[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.flatMap(b => {
    if (!isRecord(b)) return [];
    if (b.k === 'p' && typeof b.text === 'string') return [b.text];
    if (b.k === 'ul' && Array.isArray(b.items)) return b.items.filter((i): i is string => typeof i === 'string');
    return [];
  });
}

function sectionText(m: Record<string, unknown>, id: SectionId): string[] {
  const s = Array.isArray(m.sections) ? m.sections.find(x => isRecord(x) && x.id === id) : undefined;
  return isRecord(s) ? blockTexts(s.blocks) : [];
}

/**
 * The patient-facing prose that editorial rules read: headline, standfirst and
 * every section except Sources, whose citations are third-party bibliographic
 * data validated separately. The disclaimer section is included.
 */
export function patientFacingText(m: unknown): string[] {
  if (!isRecord(m)) return [];
  const out = [m.headline, m.standfirst].filter(nonEmpty);
  if (Array.isArray(m.sections)) {
    for (const s of m.sections) {
      if (!isRecord(s) || s.id === 'sources') continue;
      if (nonEmpty(s.heading)) out.push(s.heading);
      out.push(...blockTexts(s.blocks));
    }
  }
  return out;
}

/** Every sentence-level editorial finding for one patient-facing text. */
export function editorialFindings(text: string): string[] {
  const out: string[] = [];
  for (const m of terminologyFindings(text)) out.push(m);
  if (PROHIBITED_TERMS.test(text)) out.push(`prohibited terminology ("${PROHIBITED_TERMS.exec(text)?.[0]}")`);
  for (const m of persistenceFindings(text)) out.push(m);
  for (const m of endorsementFindings(text)) out.push(m);
  if (BRAND_OR_MANUFACTURER.test(text)) out.push(`brand or manufacturer name in patient text ("${BRAND_OR_MANUFACTURER.exec(text)?.[0]}")`);
  for (const p of PROMOTIONAL_PATTERNS) if (p.test(text)) out.push(`promotional wording (${p.source})`);
  for (const p of PRODUCT_CHANGE_PATTERNS) if (p.test(text)) out.push(`product-change or SRI/CDS-change wording (${p.source})`);
  for (const p of PHI_PATTERNS) if (p.test(straighten(text))) out.push(`possible PHI or patient case (${p.source})`);
  for (const sentence of sentencesOf(text)) {
    const causal = CAUSAL_CLAIM.exec(sentence);
    if (causal && !NEGATION.test(sentence)) out.push(`association presented as causation ("${sentence.slice(0, 80)}")`);
    for (const p of MEDICATION_DIRECTIVES) {
      const d = p.exec(sentence);
      // A directive denied earlier in its sentence ("The message is not that everyone should continue") is not advice.
      if (d && !NEGATION.test(sentence.slice(0, d.index))) out.push(`medication directive ("${d[0]}")`);
    }
    if (THERAPY_ENDORSEMENT.test(sentence) && !NEGATION.test(sentence)) out.push(`implies MyoGuard endorses a therapy ("${sentence.slice(0, 80)}")`);
  }
  return out;
}

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Every governance violation for one manuscript, judged against the Evidence
 * Register and the review clock. Empty means the manuscript is a valid record
 * at its status — a valid DRAFT is still unpublished.
 */
export function manuscriptViolations(
  manuscript: unknown,
  register: readonly EvidenceRegisterEntry[],
  today: IsoDate,
): string[] {
  if (!isRecord(manuscript)) return ['manuscript is not an object'];
  if (!isValidIsoDate(today)) return ['validation requires today as an ISO date'];
  const m = manuscript;
  const label = typeof m.manuscriptId === 'string' ? m.manuscriptId : '(no manuscriptId)';
  const v: string[] = [];
  const add = (msg: string) => v.push(`${label}: ${msg}`);

  v.push(...exactKeys(m, MANUSCRIPT_KEYS, label));

  // Identity
  if (!nonEmpty(m.manuscriptId) || !KEBAB.test(m.manuscriptId)) add('manuscriptId must be kebab-case');
  if (!nonEmpty(m.internalWorkingSlug) || !KEBAB.test(m.internalWorkingSlug)) add('internalWorkingSlug must be kebab-case');
  if (!oneOf(MANUSCRIPT_STATUSES, m.manuscriptStatus)) add('manuscriptStatus is not a permitted value');
  if (!oneOf(READING_AUDIENCES, m.readingAudience)) add('readingAudience is not a permitted value');
  if (!nonEmpty(m.version) || !VERSION.test(m.version)) add('version must be vMAJOR.MINOR');
  if (!nonEmpty(m.headline)) add('headline is required');
  if (!nonEmpty(m.standfirst)) add('standfirst is required');

  // Review
  if (!oneOf(MANUSCRIPT_REVIEWERS, m.reviewedBy)) add('reviewedBy must identify the reviewer (FOUNDER)');
  for (const k of ['draftedAt', 'lastReviewedAt', 'reviewDueAt'] as const) {
    if (!isValidIsoDate(m[k])) add(`${k} must be an ISO date`);
  }
  if (isValidIsoDate(m.draftedAt) && isValidIsoDate(m.lastReviewedAt) && m.lastReviewedAt < m.draftedAt) {
    add('lastReviewedAt cannot precede draftedAt');
  }
  if (isValidIsoDate(m.lastReviewedAt) && isValidIsoDate(m.reviewDueAt) && !(m.reviewDueAt > m.lastReviewedAt)) {
    add('reviewDueAt must be after lastReviewedAt');
  }
  if (isValidIsoDate(m.reviewDueAt) && m.reviewDueAt < today) add(`review overdue: reviewDueAt ${m.reviewDueAt} is before ${today}`);
  if (isValidIsoDate(m.lastReviewedAt) && m.lastReviewedAt > today) add('lastReviewedAt is in the future');

  // Sections: all ten, in order, exact headings, non-empty
  const sections = Array.isArray(m.sections) ? m.sections : [];
  if (!Array.isArray(m.sections)) add('sections must be a list');
  const ids = sections.map(s => (isRecord(s) ? s.id : undefined));
  for (const req of REQUIRED_SECTIONS) if (!ids.includes(req.id)) add(`missing required section "${req.heading}"`);
  if (ids.length !== REQUIRED_SECTIONS.length || REQUIRED_SECTIONS.some((r, i) => ids[i] !== r.id)) {
    add('sections must be exactly the required sections, in order');
  }
  for (const s of sections) {
    if (!isRecord(s)) { add('section is not an object'); continue; }
    v.push(...exactKeys(s, SECTION_KEYS, `${label}.${String(s.id)}`));
    const req = REQUIRED_SECTIONS.find(r => r.id === s.id);
    if (req && s.heading !== req.heading) add(`section "${String(s.id)}" must be headed "${req.heading}"`);
    if (!Array.isArray(s.blocks) || blockTexts(s.blocks).length === 0 || !blockTexts(s.blocks).every(nonEmpty)) {
      add(`section "${String(s.id)}" must have content`);
    }
    if (Array.isArray(s.blocks) && !s.blocks.every(b => isRecord(b) && (b.k === 'p' || b.k === 'ul'))) {
      add(`section "${String(s.id)}" has an unknown block kind`);
    }
  }

  // Disclaimer: present, educational, deferring to the clinician, and identical in its section
  if (!nonEmpty(m.educationalDisclaimer)) add('educationalDisclaimer is required');
  else {
    if (!/\beducation(?:al)?\b/i.test(m.educationalDisclaimer)) add('educationalDisclaimer must say the material is educational');
    if (!/\b(?:does not replace|not a substitute for|is not medical advice)\b/i.test(m.educationalDisclaimer)) {
      add('educationalDisclaimer must say it does not replace individual medical advice');
    }
    if (!/\bclinician\b/i.test(m.educationalDisclaimer)) add('educationalDisclaimer must defer decisions to the clinician');
    const section = sectionText(m, 'educational-disclaimer');
    if (section.length !== 1 || section[0] !== m.educationalDisclaimer) add('the Educational disclaimer section must state educationalDisclaimer exactly');
  }

  // Limitations
  const limits = sectionText(m, 'what-it-does-not-prove').join(' ');
  if (!LIMITATION_DENIAL.test(limits) || !LIMITATION_REASON.test(limits)) {
    add('the study limitations are missing: "What does this study not prove?" must say what the study cannot show, and why');
  }

  // Physician oversight
  const body = sections
    .filter(s => isRecord(s) && s.id !== 'sources' && s.id !== 'educational-disclaimer')
    .flatMap(s => blockTexts(isRecord(s) ? s.blocks : []));
  if (!body.some(t => PHYSICIAN_OVERSIGHT.test(t))) add('physician-oversight language is missing');

  // Linked evidence
  const evidence = register.find(e => e.id === m.linkedEvidenceId);
  if (!nonEmpty(m.linkedEvidenceId)) add('linkedEvidenceId is required');
  else if (!evidence) add(`linked Evidence Register entry "${m.linkedEvidenceId}" does not exist`);
  else {
    if (evidenceGovernanceViolations(evidence).length > 0) add('linked Evidence Register entry is invalid');
    if (!(PUBLIC_VISIBILITIES as readonly string[]).includes(evidence.visibility)) {
      add(`linked evidence visibility ${evidence.visibility} never permits a public explainer`);
    }
    if (evidence.externalSource !== null) {
      if (evidence.externalSource.identifiersConfirmed !== true) add('linked evidence source is not verified');
      if (!evidence.externalSource.doi && !evidence.externalSource.pmid && !evidence.externalSource.canonicalUrl) {
        add('linked evidence has no DOI, PMID or canonical source');
      }
    }
    if (evidence.explainerSlug !== null && evidence.explainerSlug !== m.internalWorkingSlug) {
      add('linked evidence names a different explainerSlug');
    }
  }

  // Sources and structured facts
  const refs = Array.isArray(m.sourceReferences) ? m.sourceReferences : [];
  if (refs.length === 0) add('sourceReferences must list the verified source');
  const allowedValues = new Set<string>();
  for (const r of refs) {
    if (!isRecord(r)) { add('source reference is not an object'); continue; }
    v.push(...exactKeys(r, REFERENCE_KEYS, `${label}.sourceReferences`));
    if (!nonEmpty(r.citation)) add('source reference needs a citation');
    const hasDoi = typeof r.doi === 'string' && DOI_PATTERN.test(r.doi);
    const hasPmid = typeof r.pmid === 'string' && PMID_PATTERN.test(r.pmid);
    const hasUrl = r.canonicalUrl !== null && canonicalUrlProblems(r.canonicalUrl).length === 0;
    if (r.doi !== null && !hasDoi) add('source reference doi is malformed');
    if (r.pmid !== null && !hasPmid) add('source reference pmid is malformed');
    if (r.canonicalUrl !== null && !hasUrl) add('source reference canonicalUrl is not acceptable');
    if (!hasDoi && !hasPmid && !hasUrl) add('source reference lacks a DOI, PMID or verified canonical source');
    if (evidence && r.evidenceId === evidence.id && evidence.externalSource !== null) {
      if (r.doi !== evidence.externalSource.doi || r.pmid !== evidence.externalSource.pmid) {
        add('source reference identifiers do not match the linked Evidence Register entry');
      }
    }
    if (!register.some(e => e.id === r.evidenceId)) add(`source reference names unknown evidence "${String(r.evidenceId)}"`);
    if (nonEmpty(r.citation)) {
      if (hasDoi && !r.citation.includes(String(r.doi))) add('citation must show the DOI');
      if (hasPmid && !r.citation.includes(String(r.pmid))) add('citation must show the PMID');
    }
    for (const f of Array.isArray(r.facts) ? r.facts : []) {
      if (!isRecord(f)) { add('source fact is not an object'); continue; }
      v.push(...exactKeys(f, FACT_KEYS, `${label}.fact`));
      if (!nonEmpty(f.sourceStatement) || !Array.isArray(f.tokens) || f.tokens.length === 0) { add('source fact needs tokens and a source statement'); continue; }
      const supported = statementValues(f.sourceStatement);
      for (const tok of f.tokens) {
        if (typeof tok !== 'string' || !supported.has(numericValue(tok))) {
          add(`source fact "${String(f.id)}" token "${String(tok)}" is not in its source statement`);
        } else allowedValues.add(numericValue(tok));
      }
    }
    if (!Array.isArray(r.facts)) add('source reference facts must be a list');
  }
  if (Array.isArray(m.sections)) {
    const sourcesSection = sectionText(m, 'sources');
    for (const r of refs) {
      if (isRecord(r) && nonEmpty(r.citation) && !sourcesSection.includes(r.citation)) add('the Sources section must list every source reference');
    }
  }

  // Numbers: every numerical claim is a structured source fact
  for (const text of patientFacingText(m)) {
    for (const tok of numericalClaims(text)) {
      if (!allowedValues.has(numericValue(tok))) add(`unsupported numerical claim "${tok}"`);
    }
  }

  // Editorial language
  for (const text of patientFacingText(m)) for (const f of editorialFindings(text)) add(f);

  // PHI and plain data, everywhere except structured identifiers
  if (hasFunction(m)) add('manuscripts must be plain data (no functions)');
  for (const key of keysIn(m)) if (PROHIBITED_FIELD_NAMES.includes(key)) add(`patient-level field "${key}" is prohibited`);
  const citations = refs.flatMap(r => (isRecord(r) ? [r.citation] : [])).filter(nonEmpty);
  for (const c of citations) for (const p of PHI_PATTERNS) if (p.test(c)) add(`possible PHI in citation (${p.source})`);

  // Status: approval is a Founder decision recorded on the Evidence Register
  if (m.manuscriptStatus === 'APPROVED') {
    if (!evidence || !(evidence.status === 'APPROVED' || evidence.status === 'PUBLISHED')) {
      add('APPROVED requires the linked evidence to be APPROVED or PUBLISHED');
    }
    if (!evidence || evidence.decision === null || evidence.decision.by !== 'FOUNDER') {
      add('APPROVED requires a completed Founder decision on the linked evidence');
    }
    if (!evidence || evidence.explainerSlug !== m.internalWorkingSlug) {
      add('APPROVED requires the linked evidence explainerSlug to equal internalWorkingSlug');
    }
    if (evidence?.decision && isValidIsoDate(m.lastReviewedAt) && m.lastReviewedAt < evidence.decision.at) {
      add('APPROVED requires a review on or after the Founder decision');
    }
  }
  return v;
}

/**
 * Every reason a manuscript may not be shown publicly. Empty means exposable —
 * which cannot happen while `PUBLIC_ROUTE_IMPLEMENTED` is false.
 */
export function manuscriptPublicationBlockers(
  manuscript: unknown,
  register: readonly EvidenceRegisterEntry[],
  today: IsoDate,
): string[] {
  const b = [...manuscriptViolations(manuscript, register, today)];
  if (!isRecord(manuscript)) return b;
  if (manuscript.manuscriptStatus !== 'APPROVED') b.push(`manuscript status ${String(manuscript.manuscriptStatus)} is not publishable`);
  const evidence = register.find(e => e.id === manuscript.linkedEvidenceId);
  if (!evidence) b.push('no linked evidence');
  else {
    if (!(evidence.status === 'APPROVED' || evidence.status === 'PUBLISHED')) b.push(`linked evidence status ${evidence.status} is not publishable`);
    if (evidence.decision === null) b.push('linked evidence has no Founder decision');
    if (evidence.explainerSlug !== manuscript.internalWorkingSlug) b.push('linked evidence explainerSlug does not name this manuscript');
    if (!isPubliclyPublishable(evidence)) b.push('linked evidence fails public governance');
  }
  if (!PUBLIC_ROUTE_IMPLEMENTED) b.push('no public Evidence Explained route exists');
  return b;
}

export function isManuscriptPubliclyExposable(
  manuscript: unknown,
  register: readonly EvidenceRegisterEntry[],
  today: IsoDate,
): boolean {
  return manuscriptPublicationBlockers(manuscript, register, today).length === 0;
}

/** Violations across a set of manuscripts, plus uniqueness of ids, slugs and linked evidence. */
export function manuscriptRegistryViolations(
  manuscripts: readonly unknown[],
  register: readonly EvidenceRegisterEntry[],
  today: IsoDate,
): string[] {
  const v = manuscripts.flatMap(m => manuscriptViolations(m, register, today));
  for (const key of ['manuscriptId', 'internalWorkingSlug', 'linkedEvidenceId'] as const) {
    const seen = new Set<unknown>();
    for (const m of manuscripts) {
      if (!isRecord(m)) continue;
      if (seen.has(m[key])) v.push(`duplicate ${key} "${String(m[key])}"`);
      seen.add(m[key]);
    }
  }
  return v;
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
