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
 * - `PublicReviewerRecord`: one person's public identity — a controlled
 *   honorific, a display name, an approved public title, and any approved
 *   credentials — and whether it is ACTIVE. `governanceRole` states which
 *   internal authority the person represents. Honorific and title are
 *   controlled fields, never free text typed into the name, so a byline
 *   cannot assert a qualification no record establishes. Displaying no
 *   postnominal is valid and is MyoGuard's approved patient-facing form.
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
 * Honorifics that may precede a reviewer's name. A controlled field, so the
 * name itself stays a name: "Dr." is never typed into `displayName`, where it
 * could not be validated. Anything not on this list blocks exposure.
 */
export const APPROVED_HONORIFICS = ['Dr.', 'Prof.'] as const;
export type ApprovedHonorific = (typeof APPROVED_HONORIFICS)[number];

/**
 * Credentials that MAY be displayed after a reviewer's name, if a record ever
 * carries any. An empty list is the normal, approved state: MyoGuard's patient
 * pages show no postnominal, so a reader cannot infer board certification,
 * specialty certification, fellowship or licensure jurisdiction from a byline.
 * A credential not on this list blocks exposure.
 */
export const APPROVED_CREDENTIALS = [
  'MD', 'DO', 'MBBS', 'MBChB', 'MB BCh', 'BMBS', 'PhD', 'MPH', 'MSc', 'MS',
  'FRCP', 'FRCPC', 'FRACP', 'MRCP', 'FACP', 'FACE', 'FACS', 'FRCS', 'FAAFP', 'DABOM',
  'RD', 'RDN', 'CSOWM',
] as const;
export type ApprovedCredential = (typeof APPROVED_CREDENTIALS)[number];

/**
 * Public titles a reviewer may be described by. Controlled rather than free
 * text, so a title cannot imply a certification, fellowship or jurisdiction
 * that no record establishes. Anything else blocks exposure.
 */
export const APPROVED_PUBLIC_TITLES = [
  'Family Medicine and Public Health Physician',
  'Family Medicine Physician',
  'Public Health Physician',
  'Physician',
  'Registered Dietitian',
] as const;
export type ApprovedPublicTitle = (typeof APPROVED_PUBLIC_TITLES)[number];

export interface PublicReviewerRecord {
  /** Kebab-case, unique, never reused. */
  readonly reviewerId: string;
  /** The internal governance authority this public identity represents. */
  readonly governanceRole: ManuscriptReviewer;
  /** A controlled honorific shown before the name, or null. Never part of displayName. */
  readonly honorific: ApprovedHonorific | null;
  /** The name shown publicly, e.g. "Jane Example". No title prefix, no credentials. */
  readonly displayName: string;
  /**
   * Post-nominal credentials, each from APPROVED_CREDENTIALS, in display order.
   * Empty is valid and is the approved state for MyoGuard's patient pages.
   */
  readonly credentials: readonly ApprovedCredential[];
  /** An approved public title, or null. */
  readonly publicTitle: ApprovedPublicTitle | null;
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
  'reviewerId', 'governanceRole', 'honorific', 'displayName', 'credentials', 'publicTitle', 'status', 'approvedBy', 'approvedAt',
] as const;
export const ASSIGNMENT_KEYS = ['manuscriptId', 'manuscriptVersion', 'reviewerId'] as const;

/** What the public sees. Nothing else from the record is ever copied. */
export interface PublicReviewer {
  readonly honorific: string | null;
  readonly name: string;
  /** Usually empty: MyoGuard's patient pages display no postnominal. */
  readonly credentials: readonly string[];
  readonly title: string | null;
  /** Honorific and name, e.g. "Dr. Jane Example". Credentials are appended only if a record carries any. */
  readonly byline: string;
}

// ── The controlled records (none configured in Step 4A) ────────────────────────

export const PUBLIC_REVIEWERS: readonly PublicReviewerRecord[] = deepFreeze([]);
export const PUBLIC_REVIEW_ASSIGNMENTS: readonly PublicReviewAssignment[] = deepFreeze([]);

// ── Validation ─────────────────────────────────────────────────────────────────

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A person's name: letters (any script), spaces, hyphens, apostrophes and full stops; 2–80 characters. */
const NAME = /^(?=.{2,80}$)\p{L}[\p{L}\p{M}' .-]*\p{L}\.?$/u;
/** Words that name an internal role or the organisation, never a person. */
const NOT_A_PERSON = /\b(?:founder|admin(?:istrator)?|editor|staff|team|myoguard|meridian|physician_pending|governance|reviewer|anonymous|unknown|tbd|placeholder|test)\b/i;
/** Honorific prefixes belong in the controlled `honorific` field, not the name. */
const PREFIX = /^(?:dr|prof|professor|mr|mrs|ms|miss|mx|sir|dame)\.?\s/i;
/** A postnominal typed into the name or title, where it would escape the credentials allowlist. */
const POSTNOMINAL_IN_TEXT = /(?:^|[,\s(])(?:MBBS|MBChB|MB\s?BCh|BMBS|MD|DO|PhD|MPH|MBA|MSc|MS|BSc|FRCP|FRCPC|FRACP|MRCP|FACP|FACE|FACS|FRCS|FAAFP|DABOM|RD|RDN|CSOWM)\b\.?/i;

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
  if (r.honorific !== null && !(APPROVED_HONORIFICS as readonly unknown[]).includes(r.honorific)) {
    add('honorific must be an approved honorific or null');
  }
  if (!nonEmpty(r.displayName) || !NAME.test(r.displayName) || r.displayName !== r.displayName.trim()) add('displayName must be a person\'s name');
  else {
    if (NOT_A_PERSON.test(r.displayName)) add('displayName names a role or organisation, not a person');
    if (PREFIX.test(r.displayName)) add('displayName must not carry a title prefix; use the honorific field');
    if (POSTNOMINAL_IN_TEXT.test(r.displayName)) add('displayName must not carry postnominal credentials');
    if (PHI_PATTERNS.some(p => p.test(r.displayName as string))) add('displayName matches a PHI pattern');
  }
  // An empty credentials list is valid: no postnominal is displayed.
  if (!Array.isArray(r.credentials)) add('credentials must be a list');
  else {
    if (!r.credentials.every(c => (APPROVED_CREDENTIALS as readonly unknown[]).includes(c))) add('credentials must each be approved');
    if (new Set(r.credentials).size !== r.credentials.length) add('credentials must be distinct');
  }
  if (r.publicTitle !== null && !(APPROVED_PUBLIC_TITLES as readonly unknown[]).includes(r.publicTitle)) {
    add('publicTitle must be an approved title or null');
  }
  if (typeof r.publicTitle === 'string' && POSTNOMINAL_IN_TEXT.test(r.publicTitle)) {
    add('publicTitle must not carry postnominal credentials');
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
  const named = r.honorific === null ? r.displayName : `${r.honorific} ${r.displayName}`;
  return {
    honorific: r.honorific,
    name: r.displayName,
    credentials: [...r.credentials],
    title: r.publicTitle,
    // Credentials are appended only if a record carries any; normally none.
    byline: [named, ...r.credentials].join(', '),
  };
}
