/**
 * src/data/evidenceRegister.ts
 *
 * The Evidence Register — MyoGuard Protocol
 *
 * WHAT THIS IS
 * The typed, repository-based record of findings selected from the weekly
 * MyoGuard Evidence Brief, and of what the Founder decided to do with each:
 * show it to physicians in the CCC Clinical Practice Updates, also explain it
 * publicly under Learn → Evidence Explained, correct a public myth with it,
 * watch it, or publish nothing. Git is its version history; a Founder decision
 * recorded here is its approval.
 *
 * WHAT THIS IS NOT
 * It is not the Clinical Evidence Engine (`src/lib/evidence/`). That engine
 * builds per-patient documentation from PHI. This register holds published
 * literature and editorial decisions only, and must never contain a patient
 * identifier, a patient narrative or any other PHI. The two never import each
 * other — scripts/evidenceRegister.test.mjs fails if either does.
 *
 * WHAT APPROVAL DOES NOT AUTHORISE
 * Approving an entry authorises showing or explaining evidence. It never
 * authorises a change to the Sarcopenia Risk Index (SRI), Clinical Decision
 * Support (CDS) logic, clinical thresholds, nutrition recommendations,
 * medication guidance, or alerts and escalation pathways. `myoguardImplication`
 * is therefore a proposal by type (`proposalOnly: true`), and this module
 * imports nothing at runtime, so no entry can reach those engines.
 *
 * POSITIONING
 * MyoGuard is physician-led, therapy-agnostic CDS. Public wording must not
 * promote indefinite treatment or continued medication use. The permitted
 * framing is `PERMITTED_POSITIONING` below.
 *
 * FAIL-CLOSED
 * Every field is required and nullable rather than optional, so a missing value
 * is an explicit null and an absent key is a violation. `isPubliclyPublishable`
 * answers yes only when every public-publication requirement is positively
 * present; anything missing, unknown or malformed answers no.
 *
 * AMENDING THIS FILE
 * Add entries; never rewrite a Founder decision in place. A changed decision is
 * a new decision with a new date and rationale.
 */

import type { EvidenceType } from '@/src/data/citations';

// ── Controlled vocabularies ────────────────────────────────────────────────────

export const VISIBILITIES = [
  'CCC_ONLY',
  'PUBLIC_AND_CCC',
  'PUBLIC_MYTH_CORRECTION',
  'WATCHLIST',
  'NO_PUBLICATION',
] as const;
export type EvidenceVisibility = (typeof VISIBILITIES)[number];

export const STATUSES = [
  'DRAFT',
  'HELD',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type EvidenceStatus = (typeof STATUSES)[number];

export const PRACTICE_CLASSIFICATIONS = [
  'PRACTICE_NOW',
  'CONSIDER',
  'MONITOR',
  'NOT_READY',
] as const;
export type PracticeClassification = (typeof PRACTICE_CLASSIFICATIONS)[number];

export const PERSISTENCE_THEMES = [
  'EXPECTATION_SETTING',
  'TOLERABILITY',
  'NUTRITION',
  'HYDRATION',
  'MUSCLE_PRESERVATION',
  'FUNCTIONAL_HEALTH',
  'RESPONSE_ADEQUACY',
  'TREATMENT_INTERRUPTION',
  'STRUCTURED_TRANSITION',
] as const;
export type PersistenceTheme = (typeof PERSISTENCE_THEMES)[number];

/** The citation library's evidence types, plus an explicit not-yet-classified state. */
export const REGISTER_EVIDENCE_TYPES = [
  'RCT',
  'Meta-Analysis',
  'Observational',
  'Guideline',
  'Consensus',
  'Review',
  'PENDING_CLASSIFICATION',
] as const satisfies readonly (EvidenceType | 'PENDING_CLASSIFICATION')[];
export type RegisterEvidenceType = (typeof REGISTER_EVIDENCE_TYPES)[number];

/** Certainty of the evidence, GRADE-style, plus an explicit not-yet-graded state. */
export const EVIDENCE_QUALITIES = [
  'HIGH',
  'MODERATE',
  'LOW',
  'VERY_LOW',
  'NOT_YET_GRADED',
] as const;
export type EvidenceQuality = (typeof EVIDENCE_QUALITIES)[number];

/** Visibilities that lead to a public Evidence Explained article. */
export const PUBLIC_VISIBILITIES: readonly EvidenceVisibility[] = [
  'PUBLIC_AND_CCC',
  'PUBLIC_MYTH_CORRECTION',
];

/** Visibilities that can never produce a public article. */
export const NEVER_PUBLIC_VISIBILITIES: readonly EvidenceVisibility[] = [
  'CCC_ONLY',
  'WATCHLIST',
  'NO_PUBLICATION',
];

/** Statuses from which nothing may be treated as publicly publishable. */
export const NON_PUBLISHABLE_STATUSES: readonly EvidenceStatus[] = [
  'DRAFT',
  'HELD',
  'REJECTED',
  'WITHDRAWN',
];

/** Statuses that record a Founder decision, and so require one. */
export const DECIDED_STATUSES: readonly EvidenceStatus[] = [
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'WITHDRAWN',
];

// ── Governance statements ──────────────────────────────────────────────────────

export const PERMITTED_POSITIONING =
  'Reduce avoidable treatment interruption and support clinically supervised continuation, switching or structured discontinuation.';

/** What approving an entry never authorises. */
export const APPROVAL_DOES_NOT_AUTHORISE = [
  'the Sarcopenia Risk Index (SRI)',
  'Clinical Decision Support (CDS) logic',
  'clinical thresholds',
  'nutrition recommendations',
  'medication guidance',
  'alerts or escalation pathways',
] as const;

// ── Entry shape ────────────────────────────────────────────────────────────────

/** ISO 8601 week, e.g. "2026-W39". */
export type IsoWeek = `${number}-W${number}`;

/** ISO 8601 calendar date, e.g. "2026-09-25". */
export type IsoDate = string;

export interface FounderDecision {
  /** The Founder is the final clinical authority and sole approver. */
  readonly by: 'FOUNDER';
  readonly at: IsoDate;
  readonly rationale: string;
}

export interface ExternalSource {
  /** Where the evidence came from, in words. Never a patient case. */
  readonly description: string;
  /** Include only when confirmed against the publisher. */
  readonly doi: string | null;
  /** Include only when confirmed against PubMed. */
  readonly pmid: string | null;
  /** True only once the primary publication has been verified. */
  readonly identifiersConfirmed: boolean;
}

export interface MyoGuardImplication {
  /** Always true. An implication is a proposal for Founder consideration, never a change. */
  readonly proposalOnly: true;
  readonly text: string;
}

/** Exactly one source: a Clinical Evidence Library citation, or an external source. */
export type EvidenceSource =
  | { readonly sourceCitationId: string; readonly externalSource: null }
  | { readonly sourceCitationId: null; readonly externalSource: ExternalSource };

export type EvidenceRegisterEntry = EvidenceSource & {
  /** Kebab-case, unique, never changes once assigned. */
  readonly id: string;
  readonly title: string;
  /** The Evidence Brief issue the finding arrived in. */
  readonly briefIssue: IsoWeek;
  readonly evidenceType: RegisterEvidenceType;
  readonly evidenceQuality: EvidenceQuality;
  readonly clinicalRelevance: string;
  readonly limitations: readonly string[];
  readonly myoguardImplication: MyoGuardImplication;
  readonly visibility: EvidenceVisibility;
  readonly status: EvidenceStatus;
  readonly practiceClassification: PracticeClassification;
  readonly persistenceThemes: readonly PersistenceTheme[];
  /** Why the public should hear about this. Required before public approval. */
  readonly publicInterestRationale: string | null;
  readonly decision: FounderDecision | null;
  /** Slug of the Evidence Explained article. Public visibilities only. */
  readonly explainerSlug: string | null;
  readonly publishedAt: IsoDate | null;
  readonly lastReviewedAt: IsoDate | null;
  readonly reviewDueAt: IsoDate | null;
};

/** The complete key set of an entry. Any other key is a violation. */
export const ENTRY_KEYS = [
  'id',
  'title',
  'briefIssue',
  'sourceCitationId',
  'externalSource',
  'evidenceType',
  'evidenceQuality',
  'clinicalRelevance',
  'limitations',
  'myoguardImplication',
  'visibility',
  'status',
  'practiceClassification',
  'persistenceThemes',
  'publicInterestRationale',
  'decision',
  'explainerSlug',
  'publishedAt',
  'lastReviewedAt',
  'reviewDueAt',
] as const;

const DECISION_KEYS = ['by', 'at', 'rationale'] as const;
const EXTERNAL_SOURCE_KEYS = ['description', 'doi', 'pmid', 'identifiersConfirmed'] as const;
const IMPLICATION_KEYS = ['proposalOnly', 'text'] as const;

// ── Prohibited content ─────────────────────────────────────────────────────────

/** Platform terminology rules (CLAUDE.md). Checked on every entry. */
export const PROHIBITED_TERMINOLOGY_PATTERNS: readonly RegExp[] = [
  /\bcalculators?\b/i,
  /\bscores?\b/i,
];

/**
 * The fields that speak in MyoGuard's own voice: its public positioning and its
 * proposed patient-facing rationale. Persistence and brand-promotion wording is
 * checked here, on every entry whatever its visibility.
 *
 * Deliberately NOT checked: `title`, `externalSource` (source metadata and
 * study titles), `clinicalRelevance` (findings and technical CCC
 * interpretation), `limitations` and `decision.rationale`. Those describe the
 * evidence accurately, and accurate description — "participants who remained on
 * treatment", "long-term follow-up", a branded trial name — is permitted.
 *
 * The Register is not the last gate. A future Evidence Explained manuscript
 * receives the full patient-facing language test separately.
 */
export const POSITIONING_FIELDS = ['publicInterestRationale', 'myoguardImplication.text'] as const;

/**
 * A directive or promotional persistence rule. `unlessSameSentence` names the
 * qualification that makes an otherwise-prohibited sentence acceptable — "do not
 * stop" is directive alone, and appropriate when it defers to the clinician.
 */
export interface PersistenceRule {
  readonly pattern: RegExp;
  readonly unlessSameSentence?: RegExp;
}

const CLINICIAN_QUALIFIER =
  /\b(?:clinician|doctor|prescriber|physician|care team|healthcare professional|medical supervision|clinically supervised)\b/i;

/**
 * Directive or promotional wording that encourages continued or indefinite
 * medication use. Descriptive evidence language does not match: past-tense
 * exposure ("remained on treatment"), associations ("continuous treatment was
 * associated with"), and nouns ("treatment discontinuation", "long-term
 * follow-up") are all outside these patterns.
 */
export const PROHIBITED_PERSISTENCE_RULES: readonly PersistenceRule[] = [
  // "you should stay on treatment", "you must continue"
  { pattern: /\byou(?:'ll)? (?:should|must|need to|have to|ought to) (?:stay|remain|keep|continue)\b/i },
  // Sentence-initial imperatives: "Stay on your medication.", "Keep taking it."
  { pattern: /^\s*(?:stay|remain|keep) on\b/i },
  { pattern: /^\s*(?:keep|continue) (?:taking|using|injecting)\b/i },
  // "do not stop" / "never stop" without clinician qualification
  { pattern: /\b(?:do(?:n't| not)|never) stop\b/i, unlessSameSentence: CLINICIAN_QUALIFIER },
  // "remain on treatment indefinitely"
  { pattern: /\b(?:stay|remain|continue|keep)\b[^.]*\bindefinitely\b/i },
  // "long-term use is necessary"
  { pattern: /\blong[- ]term use is (?:necessary|required|essential)\b/i },
  // "you will need it for life", "must be lifelong"
  { pattern: /\b(?:need|needs|must|should|will have to)\b[^.]*\b(?:for life|life-?long)\b/i },
  // Continuation urged for commercial reasons
  { pattern: /\b(?:refill|reorder|renew) (?:now|today)\b/i },
  { pattern: /\b(?:savings? card|co-?pay card|coupons?|discount|special offer|limited[- ]time)\b/i },
];

/** Trade and manufacturer names. Permitted in accurate description; never promoted. */
export const BRAND_OR_MANUFACTURER =
  /\b(?:ozempic|wegovy|rybelsus|mounjaro|zepbound|saxenda|victoza|trulicity|novo nordisk|eli lilly|lilly)\b/i;

/**
 * Promotion, when it shares a sentence with a brand or manufacturer name in a
 * positioning field: promotional claims, comparative marketing, and brand-led
 * calls to action. An evidence-supported comparison belongs in
 * `clinicalRelevance`, where it is description, not positioning.
 */
export const BRAND_PROMOTION_PATTERNS: readonly RegExp[] = [
  /\b(?:best|leading|breakthrough|miracle|revolutionary|game[- ]chang\w*|#1|number one|gold standard)\b/i,
  /\b(?:superior|better than|outperforms?|beats|most effective|more effective)\b/i,
  /\b(?:ask (?:your )?(?:doctor|clinician|prescriber|physician) (?:about|for)|switch to|try|buy|order|get|start on|available now)\b/i,
];

/**
 * MyoGuard endorsing a branded medicine or manufacturer. Checked in every field
 * of every entry: endorsement is never accurate description. A sponsorship or
 * conflict-of-interest disclosure, a regulatory status ("FDA-approved") and a
 * disclaimer ("MyoGuard does not endorse …") are not endorsement and do not match.
 */
export const ENDORSEMENT_PATTERN =
  /\bMyoGuard\b[^.]*\b(?:endorse[sd]?|recommend(?:s|ed)?|prefer(?:s|red)?|favou?r(?:s|ed)?)\b/i;
const ENDORSEMENT_NEGATION = /\bMyoGuard\b[^.]*\b(?:does not|doesn't|do not|never|not)\b/i;

const sentences = (s: string): string[] => s.split(/(?<=[.!?])\s+/).filter(x => x.trim().length > 0);

/** Directive or promotional persistence wording in a positioning text. Empty means none. */
export function persistenceFindings(text: string): string[] {
  const out: string[] = [];
  for (const sentence of sentences(straighten(text))) {
    for (const r of PROHIBITED_PERSISTENCE_RULES) {
      if (r.pattern.test(sentence) && !(r.unlessSameSentence && r.unlessSameSentence.test(sentence))) {
        out.push(`prohibited treatment-persistence wording (${r.pattern.source})`);
      }
    }
  }
  return out;
}

/** A sentence implying MyoGuard endorses a brand or manufacturer. Applies to any field. */
export function endorsementFindings(text: string): string[] {
  return sentences(straighten(text))
    .filter(s => BRAND_OR_MANUFACTURER.test(s) && ENDORSEMENT_PATTERN.test(s) && !ENDORSEMENT_NEGATION.test(s))
    .map(() => 'wording implies MyoGuard endorses a brand or manufacturer');
}

/** Promotion beside a brand or manufacturer name. Applies to positioning fields only. */
export function brandPromotionFindings(text: string): string[] {
  const out: string[] = [];
  for (const sentence of sentences(straighten(text))) {
    if (!BRAND_OR_MANUFACTURER.test(sentence)) continue;
    for (const p of BRAND_PROMOTION_PATTERNS) {
      if (p.test(sentence)) out.push(`promotional brand wording in positioning (${p.source})`);
    }
  }
  return out;
}

/** Shapes of patient identifiers and patient narratives. Checked on every entry. */
export const PHI_PATTERNS: readonly RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/,                                        // email address
  /(?:\d[\s().-]{0,2}){9,}\d/,                                       // 10+ digit number (phone, record no.); ISO dates and PMIDs are shorter
  /\b\d{1,3}[- ]?(?:year|yr)s?[- ]old\b/i,                           // "54-year-old"
  /\b(?:date of birth|DOB|MRN|medical record (?:number|no)|NHS number|social security|SSN)\b/i,
  /\b(?:Mr|Mrs|Ms|Miss)\.?\s+[A-Z]/,                                 // named individual
  /\b[Pp]atient\s+(?:[A-Z](?:\b|\.)|#?\d+)/,                         // "Patient A", "patient #12"
  /\b(?:my|our|a|the) patient (?:who|with|presented|reported)\b/i,   // case narrative
  /\bpresented with\b/i,                                             // case narrative
  /\buser_[A-Za-z0-9]{20,}\b/,                                        // Clerk user id
  /\bc[a-z0-9]{24}\b/,                                               // cuid (User.id etc.)
];

/** Patient-level field names that may never appear as a key anywhere in an entry. */
export const PROHIBITED_FIELD_NAMES: readonly string[] = [
  'patientId', 'patientName', 'patient', 'userId', 'clerkId', 'email',
  'dateOfBirth', 'dob', 'mrn', 'assessmentId', 'physicianId', 'shareToken',
  'sriValue', 'riskBand', 'weight', 'symptoms',
];

// ── Primitive validators ───────────────────────────────────────────────────────

const ISO_WEEK = /^(\d{4})-W(\d{2})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Number of ISO weeks in a year: 53 when 1 January is a Thursday, or a Wednesday in a leap year. */
function isoWeeksInYear(year: number): number {
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay(); // 0 = Sunday
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return jan1 === 4 || (leap && jan1 === 3) ? 53 : 52;
}

export function isValidIsoWeek(value: unknown): value is IsoWeek {
  if (typeof value !== 'string') return false;
  const m = ISO_WEEK.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const week = Number(m[2]);
  return week >= 1 && week <= isoWeeksInYear(year);
}

export function isValidIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every string anywhere inside a value, for content scanning. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (isRecord(value)) return Object.values(value).flatMap(stringsIn);
  return [];
}

/** Every key anywhere inside a value, for field-name scanning. */
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

function exactKeys(obj: Record<string, unknown>, allowed: readonly string[], label: string): string[] {
  const out: string[] = [];
  for (const k of allowed) if (!(k in obj)) out.push(`${label}: missing required field "${k}"`);
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) out.push(`${label}: unknown field "${k}"`);
  return out;
}

const straighten = (s: string) => s.replace(/[‘’ʼ]/g, "'");

// ── Entry validation ───────────────────────────────────────────────────────────

/**
 * Integrity violations for one entry, whatever its status. An entry with any
 * violation is invalid and must not be rendered anywhere. A valid DRAFT is not
 * a violation; whether an entry may go public is `publicationBlockers`.
 *
 * Accepts `unknown` so that a malformed or partial record is reported rather
 * than assumed well-formed.
 */
export function evidenceGovernanceViolations(entry: unknown): string[] {
  if (!isRecord(entry)) return ['entry is not an object'];
  const e = entry;
  const label = typeof e.id === 'string' ? e.id : '(no id)';
  const v: string[] = [];
  const add = (msg: string) => v.push(`${label}: ${msg}`);

  v.push(...exactKeys(e, ENTRY_KEYS, label));

  // Identity and classification
  if (!nonEmpty(e.id) || !KEBAB.test(e.id)) add('id must be non-empty kebab-case');
  if (!nonEmpty(e.title)) add('title is required');
  if (!isValidIsoWeek(e.briefIssue)) add('briefIssue must be a valid ISO week (YYYY-Www)');
  if (!oneOf(REGISTER_EVIDENCE_TYPES, e.evidenceType)) add('evidenceType is not a permitted value');
  if (!oneOf(EVIDENCE_QUALITIES, e.evidenceQuality)) add('evidenceQuality is not a permitted value');
  if (!nonEmpty(e.clinicalRelevance)) add('clinicalRelevance is required');
  if (!Array.isArray(e.limitations) || e.limitations.length === 0 || !e.limitations.every(nonEmpty)) {
    add('limitations must be a non-empty list of statements');
  }
  if (!oneOf(VISIBILITIES, e.visibility)) add('visibility is not a permitted value');
  if (!oneOf(STATUSES, e.status)) add('status is not a permitted value');
  if (!oneOf(PRACTICE_CLASSIFICATIONS, e.practiceClassification)) {
    add('practiceClassification is not a permitted value');
  }
  if (
    !Array.isArray(e.persistenceThemes) ||
    !e.persistenceThemes.every(t => oneOf(PERSISTENCE_THEMES, t)) ||
    new Set(e.persistenceThemes).size !== e.persistenceThemes.length
  ) {
    add('persistenceThemes must be distinct permitted values');
  }

  // Source: exactly one
  const hasCitation = e.sourceCitationId !== null && e.sourceCitationId !== undefined;
  const hasExternal = e.externalSource !== null && e.externalSource !== undefined;
  if (hasCitation === hasExternal) add('exactly one of sourceCitationId or externalSource is required');
  if (hasCitation && !(nonEmpty(e.sourceCitationId) && KEBAB.test(e.sourceCitationId))) {
    add('sourceCitationId must be a kebab-case citation id');
  }
  if (hasExternal) {
    if (!isRecord(e.externalSource)) add('externalSource must be an object');
    else {
      const s = e.externalSource;
      v.push(...exactKeys(s, EXTERNAL_SOURCE_KEYS, `${label}.externalSource`));
      if (!nonEmpty(s.description)) add('externalSource.description is required');
      if (s.doi !== null && !nonEmpty(s.doi)) add('externalSource.doi must be a string or null');
      if (s.pmid !== null && !(typeof s.pmid === 'string' && /^\d+$/.test(s.pmid))) {
        add('externalSource.pmid must be digits or null');
      }
      if (typeof s.identifiersConfirmed !== 'boolean') add('externalSource.identifiersConfirmed must be boolean');
    }
  }

  // Implication: proposal only
  if (!isRecord(e.myoguardImplication)) add('myoguardImplication is required');
  else {
    v.push(...exactKeys(e.myoguardImplication, IMPLICATION_KEYS, `${label}.myoguardImplication`));
    if (e.myoguardImplication.proposalOnly !== true) add('myoguardImplication must be proposalOnly: true');
    if (!nonEmpty(e.myoguardImplication.text)) add('myoguardImplication.text is required');
  }

  // Decision
  if (e.decision !== null) {
    if (!isRecord(e.decision)) add('decision must be an object or null');
    else {
      v.push(...exactKeys(e.decision, DECISION_KEYS, `${label}.decision`));
      if (e.decision.by !== 'FOUNDER') add('decision.by must be FOUNDER');
      if (!isValidIsoDate(e.decision.at)) add('decision.at must be an ISO date');
      if (!nonEmpty(e.decision.rationale)) add('decision.rationale is required');
    }
  }
  if (oneOf(DECIDED_STATUSES, e.status) && e.decision === null) {
    add(`status ${e.status} requires a Founder decision`);
  }

  // Nullable scalars
  if (e.publicInterestRationale !== null && !nonEmpty(e.publicInterestRationale)) {
    add('publicInterestRationale must be non-empty or null');
  }
  if (e.explainerSlug !== null && !(nonEmpty(e.explainerSlug) && KEBAB.test(e.explainerSlug))) {
    add('explainerSlug must be kebab-case or null');
  }
  for (const k of ['publishedAt', 'lastReviewedAt', 'reviewDueAt'] as const) {
    if (e[k] !== null && !isValidIsoDate(e[k])) add(`${k} must be an ISO date or null`);
  }

  // Review window
  if ((e.lastReviewedAt === null) !== (e.reviewDueAt === null)) {
    add('lastReviewedAt and reviewDueAt must be set together');
  }
  if (isValidIsoDate(e.lastReviewedAt) && isValidIsoDate(e.reviewDueAt) && !(e.reviewDueAt > e.lastReviewedAt)) {
    add('reviewDueAt must be after lastReviewedAt');
  }

  // Visibility / status combinations
  if (oneOf(NEVER_PUBLIC_VISIBILITIES, e.visibility)) {
    if (e.explainerSlug !== null) add(`${e.visibility} items cannot have an explainerSlug`);
  }
  if (e.visibility === 'WATCHLIST' || e.visibility === 'NO_PUBLICATION') {
    if (e.publishedAt !== null) add(`${e.visibility} items cannot have publishedAt`);
    if (e.status === 'PUBLISHED' || e.status === 'APPROVED') {
      add(`${e.visibility} items cannot be ${e.status}`);
    }
  }
  if (e.status === 'PUBLISHED') {
    if (e.publishedAt === null) add('PUBLISHED items require publishedAt');
    if (e.lastReviewedAt === null) add('PUBLISHED items require review dates');
  }
  if (
    isRecord(e.decision) && isValidIsoDate(e.decision.at) &&
    isValidIsoDate(e.publishedAt) && e.publishedAt < e.decision.at
  ) {
    add('publishedAt cannot precede the Founder decision');
  }

  // A public item that claims approval must carry everything approval requires.
  if (oneOf(PUBLIC_VISIBILITIES, e.visibility) && (e.status === 'APPROVED' || e.status === 'PUBLISHED')) {
    if (e.decision === null) add('public approval requires a Founder decision');
    if (e.publicInterestRationale === null) add('public approval requires publicInterestRationale');
    if (e.explainerSlug === null) add('public approval requires explainerSlug');
    if (e.lastReviewedAt === null || e.reviewDueAt === null) add('public approval requires review dates');
  }

  // Content: never PHI, never a function, never platform-prohibited terms
  if (hasFunction(e)) add('entries must be plain data (no functions)');
  for (const key of keysIn(e)) {
    if (PROHIBITED_FIELD_NAMES.includes(key)) add(`patient-level field "${key}" is prohibited`);
  }
  const text = stringsIn(e).map(straighten);
  for (const s of text) {
    for (const p of PHI_PATTERNS) if (p.test(s)) add(`possible PHI (${p.source}) in "${s.slice(0, 60)}"`);
    for (const p of PROHIBITED_TERMINOLOGY_PATTERNS) if (p.test(s)) add(`prohibited terminology (${p.source})`);
  }

  // MyoGuard's own voice: never urge continued or indefinite use, never promote a brand.
  const positioning = [
    e.publicInterestRationale,
    isRecord(e.myoguardImplication) ? e.myoguardImplication.text : null,
  ].filter((s): s is string => typeof s === 'string');
  for (const s of positioning) {
    for (const m of persistenceFindings(s)) add(m);
    for (const m of brandPromotionFindings(s)) add(m);
  }
  // Endorsement is never accurate description, so it is checked in every field.
  for (const s of text) {
    for (const m of endorsementFindings(s)) add(m);
  }

  return v;
}

/**
 * Every reason an entry may not be treated as publicly publishable. Empty means
 * publishable. Fails closed: an unknown shape, a missing field or any integrity
 * violation is a blocker.
 */
export function publicationBlockers(entry: unknown): string[] {
  const b = [...evidenceGovernanceViolations(entry)];
  if (!isRecord(entry)) return b;
  const e = entry;
  if (!oneOf(PUBLIC_VISIBILITIES, e.visibility)) b.push(`visibility ${String(e.visibility)} is never public`);
  if (!(e.status === 'APPROVED' || e.status === 'PUBLISHED')) b.push(`status ${String(e.status)} is not publishable`);
  if (!isRecord(e.decision) || e.decision.by !== 'FOUNDER' || !nonEmpty(e.decision.rationale) || !isValidIsoDate(e.decision.at)) {
    b.push('no completed Founder decision');
  }
  if (!nonEmpty(e.publicInterestRationale)) b.push('no publicInterestRationale');
  if (!nonEmpty(e.explainerSlug)) b.push('no explainerSlug');
  if (!isValidIsoDate(e.lastReviewedAt)) b.push('no lastReviewedAt');
  if (!isValidIsoDate(e.reviewDueAt)) b.push('no reviewDueAt');
  if (e.evidenceType === 'PENDING_CLASSIFICATION') b.push('evidence type not yet classified');
  if (e.evidenceQuality === 'NOT_YET_GRADED') b.push('evidence quality not yet graded');
  if (isRecord(e.externalSource) && e.externalSource.identifiersConfirmed !== true) {
    b.push('primary source not verified');
  }
  return b;
}

/** True only when nothing blocks public publication. */
export function isPubliclyPublishable(entry: unknown): boolean {
  return publicationBlockers(entry).length === 0;
}

/** True only for a publishable entry that has actually been PUBLISHED. What a public page may render. */
export function isPubliclyExposable(entry: unknown): boolean {
  return isPubliclyPublishable(entry) && isRecord(entry) && entry.status === 'PUBLISHED' && isValidIsoDate(entry.publishedAt);
}

/** Register-wide violations: each entry's, plus uniqueness of ids and explainer slugs. */
export function registerViolations(entries: readonly unknown[]): string[] {
  const v = entries.flatMap(evidenceGovernanceViolations);
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const e of entries) {
    if (!isRecord(e)) continue;
    if (typeof e.id === 'string') {
      if (seenIds.has(e.id)) v.push(`duplicate id "${e.id}"`);
      seenIds.add(e.id);
    }
    if (typeof e.explainerSlug === 'string') {
      if (seenSlugs.has(e.explainerSlug)) v.push(`duplicate explainerSlug "${e.explainerSlug}"`);
      seenSlugs.add(e.explainerSlug);
    }
  }
  return v;
}

// ── Register ───────────────────────────────────────────────────────────────────

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const EVIDENCE_REGISTER: readonly EvidenceRegisterEntry[] = deepFreeze([
  // Validation sample. Public-intended but DRAFT, with no decision, slug or
  // publication date, so it is deliberately not publishable. The primary
  // publication behind the Brief item has not been verified, so no finding from
  // it is recorded here.
  {
    id: 'ev-2026-w39-treatment-discontinuation',
    title: 'Treatment interruption and discontinuation during GLP-1 and related therapy',
    briefIssue: '2026-W39',
    sourceCitationId: null,
    externalSource: {
      description:
        'MyoGuard Evidence Brief, 25 September 2026: treatment-discontinuation evidence concept. Primary publication not yet identified or verified against PubMed or DOI.',
      doi: null,
      pmid: null,
      identifiersConfirmed: false,
    },
    evidenceType: 'PENDING_CLASSIFICATION',
    evidenceQuality: 'NOT_YET_GRADED',
    clinicalRelevance:
      'Concerns treatment interruption and discontinuation, and the clinical planning around supervised continuation, switching or structured discontinuation.',
    limitations: [
      'Primary source not yet verified; no finding from it is recorded in this entry.',
      'Evidence type and quality not yet assessed.',
    ],
    myoguardImplication: {
      proposalOnly: true,
      text:
        'Proposal only: consider a future patient explainer on structured transition, to help reduce avoidable treatment interruption. No change to the Sarcopenia Risk Index (SRI), CDS logic, thresholds, nutrition recommendations, medication guidance or alerts is proposed or authorised.',
    },
    visibility: 'PUBLIC_AND_CCC',
    status: 'DRAFT',
    practiceClassification: 'NOT_READY',
    persistenceThemes: ['TREATMENT_INTERRUPTION', 'STRUCTURED_TRANSITION'],
    publicInterestRationale: null,
    decision: null,
    explainerSlug: null,
    publishedAt: null,
    lastReviewedAt: null,
    reviewDueAt: null,
  },
] as const satisfies readonly EvidenceRegisterEntry[]);
