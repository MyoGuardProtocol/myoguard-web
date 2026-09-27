/**
 * src/lib/learn/evidenceExplained/publicReviewers.ts
 *
 * Evidence Explained — the controlled public-reviewer records.
 *
 * WHY THIS IS SEPARATE FROM THE MANUSCRIPT
 * A manuscript's `reviewedBy` is an internal governance authority ("FOUNDER"):
 * who is accountable for the review. It is never shown to the public. What a
 * patient sees on an article's review line, and what `MedicalWebPage.reviewedBy`
 * carries, is a named person with approved credentials — and that identity is
 * configured here, deliberately and explicitly, not written as free text in a
 * manuscript.
 *
 * TWO RECORDS
 * - `PublicReviewerRecord`: one person's public identity — display name,
 *   approved credentials, optional approved title — and whether it is ACTIVE.
 *   `governanceRole` states which internal authority the person represents.
 * - `PublicReviewAssignment`: which reviewer is shown on which manuscript
 *   VERSION. A new manuscript version needs a new assignment, so a reviewer is
 *   never shown on wording they did not review.
 *
 * FAIL-CLOSED
 * An article is publicly exposable only with exactly one assignment for its
 * manuscript id and version, naming an ACTIVE, valid reviewer whose
 * governanceRole matches the manuscript's reviewedBy. Anything missing,
 * unknown, inactive or malformed blocks exposure (`publicReviewerBlockers`).
 *
 * STEP 4A
 * Both lists are empty: no public reviewer is configured, so no article —
 * including the DRAFT pilot — can be exposed. Configuring one is a Founder
 * decision for a later step.
 */

import { isValidIsoDate, PHI_PATTERNS, type IsoDate } from '@/src/data/evidenceRegister';
import { MANUSCRIPT_REVIEWERS, deepFreeze, type ManuscriptReviewer } from './manuscriptGovernance';

export const PUBLIC_REVIEWER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type PublicReviewerStatus = (typeof PUBLIC_REVIEWER_STATUSES)[number];

/**
 * Credentials that may be displayed after a reviewer's name. A credential not
 * on this list blocks exposure; adding one is a deliberate change here.
 */
export const APPROVED_CREDENTIALS = [
  'MD', 'DO', 'MBBS', 'MBChB', 'MB BCh', 'BMBS', 'PhD', 'MPH', 'MSc', 'MS',
  'FRCP', 'FRCPC', 'FRACP', 'MRCP', 'FACP', 'FACE', 'FACS', 'FRCS', 'FAAFP', 'DABOM',
  'RD', 'RDN', 'CSOWM',
] as const;
export type ApprovedCredential = (typeof APPROVED_CREDENTIALS)[number];

export interface PublicReviewerRecord {
  /** Kebab-case, unique, never reused. */
  readonly reviewerId: string;
  /** The internal governance authority this public identity represents. */
  readonly governanceRole: ManuscriptReviewer;
  /** The name shown publicly, e.g. "Jane Example". No title prefix, no credentials. */
  readonly displayName: string;
  /** Post-nominal credentials, each from APPROVED_CREDENTIALS, in display order. */
  readonly credentials: readonly ApprovedCredential[];
  /** An approved public title, e.g. "Consultant physician", or null. */
  readonly publicTitle: string | null;
  readonly status: PublicReviewerStatus;
  /** The Founder approves every public reviewer identity. */
  readonly approvedBy: 'FOUNDER';
  readonly approvedAt: IsoDate;
}

export interface PublicReviewAssignment {
  readonly manuscriptId: string;
  /** The exact manuscript version the reviewer reviewed. */
  readonly manuscriptVersion: string;
  readonly reviewerId: string;
}

export const REVIEWER_KEYS = [
  'reviewerId', 'governanceRole', 'displayName', 'credentials', 'publicTitle', 'status', 'approvedBy', 'approvedAt',
] as const;
export const ASSIGNMENT_KEYS = ['manuscriptId', 'manuscriptVersion', 'reviewerId'] as const;

/** What the public sees. Nothing else from the record is ever copied. */
export interface PublicReviewer {
  readonly name: string;
  readonly credentials: readonly string[];
  readonly title: string | null;
  /** "Jane Example, MD, FACP" */
  readonly byline: string;
}

// ── The controlled records (none configured in Step 4A) ────────────────────────

export const PUBLIC_REVIEWERS: readonly PublicReviewerRecord[] = deepFreeze([]);
export const PUBLIC_REVIEW_ASSIGNMENTS: readonly PublicReviewAssignment[] = deepFreeze([]);

// ── Validation ─────────────────────────────────────────────────────────────────

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A person's name: letters (any script), spaces, hyphens, apostrophes and full stops; 2–80 characters. */
const NAME = /^(?=.{2,80}$)\p{L}[\p{L}\p{M}' .-]*\p{L}\.?$/u;
const TITLE = /^(?=.{2,80}$)[\p{L}][\p{L}\p{M}' ,&()-]*$/u;
/** Words that name an internal role or the organisation, never a person. */
const NOT_A_PERSON = /\b(?:founder|admin(?:istrator)?|editor|staff|team|myoguard|meridian|physician_pending|governance|reviewer|anonymous|unknown|tbd|placeholder|test)\b/i;
/** Honorific prefixes belong in credentials, not the name. */
const PREFIX = /^(?:dr|prof|professor|mr|mrs|ms|miss|mx|sir|dame)\.?\s/i;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function exactKeys(obj: Record<string, unknown>, allowed: readonly string[], label: string): string[] {
  const out: string[] = [];
  for (const k of allowed) if (!(k in obj)) out.push(`${label}: missing "${k}"`);
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) out.push(`${label}: unknown field "${k}"`);
  return out;
}

/** Every reason a reviewer record may not be shown publicly on `today`. */
export function reviewerRecordViolations(record: unknown, today: IsoDate): string[] {
  if (!isRecord(record)) return ['reviewer record is not an object'];
  const r = record;
  const label = typeof r.reviewerId === 'string' ? r.reviewerId : '(no reviewerId)';
  const v = exactKeys(r, REVIEWER_KEYS, label);
  const add = (m: string) => v.push(`${label}: ${m}`);
  if (!nonEmpty(r.reviewerId) || !KEBAB.test(r.reviewerId)) add('reviewerId must be kebab-case');
  if (!(MANUSCRIPT_REVIEWERS as readonly unknown[]).includes(r.governanceRole)) add('governanceRole is not a manuscript reviewer role');
  if (!nonEmpty(r.displayName) || !NAME.test(r.displayName) || r.displayName !== r.displayName.trim()) add('displayName must be a person\'s name');
  else {
    if (NOT_A_PERSON.test(r.displayName)) add('displayName names a role or organisation, not a person');
    if (PREFIX.test(r.displayName)) add('displayName must not carry a title prefix; use credentials');
    if (PHI_PATTERNS.some(p => p.test(r.displayName as string))) add('displayName matches a PHI pattern');
  }
  if (!Array.isArray(r.credentials) || r.credentials.length === 0) add('at least one approved credential is required');
  else {
    if (!r.credentials.every(c => (APPROVED_CREDENTIALS as readonly unknown[]).includes(c))) add('credentials must each be approved');
    if (new Set(r.credentials).size !== r.credentials.length) add('credentials must be distinct');
  }
  if (r.publicTitle !== null && !(nonEmpty(r.publicTitle) && TITLE.test(r.publicTitle) && !/\bfounder\b/i.test(r.publicTitle))) {
    add('publicTitle must be an approved title or null, never an internal role');
  }
  if (!(PUBLIC_REVIEWER_STATUSES as readonly unknown[]).includes(r.status)) add('status must be ACTIVE or INACTIVE');
  if (r.approvedBy !== 'FOUNDER') add('approvedBy must be FOUNDER');
  if (!isValidIsoDate(r.approvedAt)) add('approvedAt must be an ISO date');
  else if (r.approvedAt > today) add('approvedAt is in the future');
  return v;
}

/**
 * Every reason no public reviewer can be shown for this manuscript. Empty
 * means exactly one ACTIVE, valid reviewer is assigned to this exact version.
 */
export function publicReviewerBlockers(
  manuscript: { manuscriptId: unknown; version: unknown; reviewedBy: unknown },
  reviewers: readonly unknown[],
  assignments: readonly unknown[],
  today: IsoDate,
): string[] {
  const matches = assignments.filter(a => isRecord(a) && a.manuscriptId === manuscript.manuscriptId && a.manuscriptVersion === manuscript.version);
  if (matches.length !== 1) return [`${matches.length} public reviewer assignments for this manuscript version`];
  const a = matches[0] as Record<string, unknown>;
  const b = exactKeys(a, ASSIGNMENT_KEYS, 'assignment');
  const records = reviewers.filter(r => isRecord(r) && r.reviewerId === a.reviewerId);
  if (records.length !== 1) return [...b, `${records.length} reviewer records for "${String(a.reviewerId)}"`];
  const r = records[0] as Record<string, unknown>;
  b.push(...reviewerRecordViolations(r, today));
  if (r.status !== 'ACTIVE') b.push('public reviewer is not ACTIVE');
  if (r.governanceRole !== manuscript.reviewedBy) b.push('public reviewer does not represent the manuscript\'s reviewing authority');
  return b;
}

/** The public reviewer for this manuscript, or null. Only name, credentials and title are copied. */
export function resolvePublicReviewer(
  manuscript: { manuscriptId: unknown; version: unknown; reviewedBy: unknown },
  reviewers: readonly unknown[],
  assignments: readonly unknown[],
  today: IsoDate,
): PublicReviewer | null {
  if (publicReviewerBlockers(manuscript, reviewers, assignments, today).length > 0) return null;
  const a = assignments.find(x => isRecord(x) && x.manuscriptId === manuscript.manuscriptId && x.manuscriptVersion === manuscript.version) as PublicReviewAssignment;
  const r = reviewers.find(x => isRecord(x) && x.reviewerId === a.reviewerId) as PublicReviewerRecord;
  return {
    name: r.displayName,
    credentials: [...r.credentials],
    title: r.publicTitle,
    byline: [r.displayName, ...r.credentials].join(', '),
  };
}
