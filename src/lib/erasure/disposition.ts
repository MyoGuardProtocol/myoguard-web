/**
 * src/lib/erasure/disposition.ts
 *
 * What an erasure WOULD do to each persistent model, and the vocabulary the
 * eventual workflow will use to record itself.
 *
 * Declarative and free of I/O — no Prisma import, nothing to execute. This is
 * the approved R2B target architecture written down where it can be tested and
 * where a future implementation has one place to read it from, rather than the
 * rules being rediscovered per model at the point someone writes the executing
 * transaction.
 *
 * THE RULE THAT SHAPES EVERYTHING ELSE
 * `User` is the cascade root for ten clinical models. Erasure ANONYMIZES that
 * row in place and never deletes it: deleting it would destroy the longitudinal
 * clinical record in a single statement. Every other disposition below follows
 * from the row surviving as an opaque subject key.
 *
 * NOTHING HERE EXECUTES. No routine in this phase writes, deletes, anonymizes,
 * revokes a ShareCard, touches suppression, or calls a provider.
 */

/** The six target treatments from the approved R2B matrix. */
export const TREATMENTS = [
  'DELETE',
  'ANONYMIZE',
  'PSEUDONYMIZE_RETAIN',
  'RETAIN_FOR_DEFINED_PERIOD',
  'COUNSEL_DEPENDENT',
  'DORMANT_NO_ACTION',
] as const;

export type Treatment = (typeof TREATMENTS)[number];

export interface Disposition {
  /** Target treatment for this model. */
  treatment: Treatment;
  /**
   * How rows for a subject are found. `null` means the model holds no
   * per-subject rows (dormant, or not personal data), so a dry run counts
   * nothing for it.
   */
  subjectKey:
    | 'userId'            // scalar or relation column naming the subject
    | 'patientUserId'
    | 'patientId'
    | 'actorId'
    | 'email'             // plaintext address — see `linkageNote`
    | 'clerkId'
    | null;
  /** Short statement of WHY, so a future implementer inherits the reasoning. */
  reason: string;
  /** Present when the model cannot be handled without work deferred elsewhere. */
  carryForward?: 'R2-CF1' | 'R2-CF2';
  /** Present when the linkage itself is a hazard worth naming at the call site. */
  linkageNote?: string;
}

/**
 * Every persistent model, with no gaps. A model absent from this map is a model
 * nobody decided about, which is exactly the failure this table prevents — the
 * suite asserts the key set matches the schema.
 */
export const ERASURE_DISPOSITION: Readonly<Record<string, Disposition>> = {
  // ── Identity ───────────────────────────────────────────────────────────────
  User: {
    treatment:  'ANONYMIZE',
    subjectKey: 'clerkId',
    reason:
      'Cascade root for ten clinical models. Anonymized in place — never ' +
      'deleted — so clinical history survives while the person does not.',
  },
  PhysicianProfile: {
    treatment:  'COUNSEL_DEPENDENT',
    subjectKey: null,
    reason:
      'Physician identity, but the model has no userId column at all; it is ' +
      'reachable only via User.referralSlug -> PhysicianProfile.slug.',
    carryForward: 'R2-CF2',
  },

  // ── Clinical — retained, never cascade-deleted ─────────────────────────────
  Assessment:     { treatment: 'RETAIN_FOR_DEFINED_PERIOD', subjectKey: 'userId', reason: 'Authoritative clinical record. Period is counsel-dependent.' },
  MuscleScore:    { treatment: 'RETAIN_FOR_DEFINED_PERIOD', subjectKey: 'userId', reason: 'SRI output and longitudinal series.' },
  ProtocolPlan:   { treatment: 'RETAIN_FOR_DEFINED_PERIOD', subjectKey: 'userId', reason: 'Prescribed clinical targets.' },
  ProgressLog:    { treatment: 'RETAIN_FOR_DEFINED_PERIOD', subjectKey: 'userId', reason: 'Patient-generated monitoring; free-text notes need counsel (Q10).' },
  WeeklyCheckin:  { treatment: 'RETAIN_FOR_DEFINED_PERIOD', subjectKey: 'userId', reason: 'Patient-generated monitoring and adherence.' },
  UserProfile:    { treatment: 'RETAIN_FOR_DEFINED_PERIOD', subjectKey: 'userId', reason: 'Holds glp1Medication, dose and weight — clinical inputs, not decoration.' },
  PhysicianReview:{ treatment: 'RETAIN_FOR_DEFINED_PERIOD', subjectKey: 'userId', reason: 'Clinical record. userId is the PATIENT; the model records no author.' },

  // ── Physician workflow artifacts ───────────────────────────────────────────
  StartSheetProtocol: {
    treatment:  'ANONYMIZE',
    subjectKey: 'email',
    reason:     'Workflow artifact pending CF-2; direct identifiers removable.',
    linkageNote:
      'The only handle is plaintext patientEmail — the very field being ' +
      'removed. Anonymization is therefore irreversible and unverifiable ' +
      'afterwards. Counts must be recorded as evidence before it runs.',
  },
  PreloadedAssessment: {
    treatment:  'DELETE',
    subjectKey: 'email',
    reason:     'Transient by design (used, expiresAt); holds name, email and payload.',
    linkageNote: 'Linked only by plaintext patientEmail.',
  },
  PhysicianApplication: {
    treatment:  'COUNSEL_DEPENDENT',
    subjectKey: 'email',
    reason:     'Credentialing evidence (licence, NPI) may need to outlive erasure — counsel Q6.',
  },

  // ── Bearer access and linkage ──────────────────────────────────────────────
  ShareCard: {
    treatment:  'DELETE',
    subjectKey: 'userId',
    reason:
      'A live bearer token to an erased record is the worst residue erasure ' +
      'could leave. Revoked, then deleted.',
  },
  PhysicianPatientInvitation: {
    treatment:  'PSEUDONYMIZE_RETAIN',
    subjectKey: 'patientUserId',
    reason:     'Linkage history retained; shareToken cleared.',
  },
  ReferralInvite: { treatment: 'DELETE', subjectKey: null, reason: 'Invitation tokens; scalar refs, no FK.' },

  // ── Evidence classes — survive pseudonymously ──────────────────────────────
  AuditLog: {
    treatment:  'PSEUDONYMIZE_RETAIN',
    subjectKey: 'actorId',
    reason:
      'Security evidence. actorId/targetId are opaque ids that BECOME ' +
      'pseudonymous the moment User is anonymized — no action required on ' +
      'the rows themselves. Duration is counsel-dependent.',
  },
  PhysicianReviewSession:   { treatment: 'RETAIN_FOR_DEFINED_PERIOD', subjectKey: 'patientId', reason: 'CPT 99470 billing evidence; already id-only.' },
  CommunicationSuppression: {
    treatment:  'PSEUDONYMIZE_RETAIN',
    subjectKey: null,
    reason:
      'MUST SURVIVE. Keyed by recipientKey and deliberately independent of ' +
      'the recipient row: deleting it would silently re-permit contact.',
  },
  CommunicationConsentEvent:{ treatment: 'PSEUDONYMIZE_RETAIN', subjectKey: null, reason: 'Append-only consent ledger, already keyed pseudonymously.' },
  CommunicationEvent:       { treatment: 'PSEUDONYMIZE_RETAIN', subjectKey: 'userId', reason: 'Send history retained; the userId scalar is cleared.' },
  ConsentWording:           { treatment: 'PSEUDONYMIZE_RETAIN', subjectKey: null, reason: 'Versioned wording — not personal data.' },

  // ── Delete ─────────────────────────────────────────────────────────────────
  CommunicationRecipient: { treatment: 'DELETE', subjectKey: 'userId', reason: 'The only plaintext-email store in the communications layer.' },
  CommunicationPreference:{ treatment: 'DELETE', subjectKey: null,     reason: 'A projection, rebuildable from the ledger — which is what makes deleting it safe.' },
  Notification:           { treatment: 'DELETE', subjectKey: 'userId', reason: 'body holds clinical JSON, but it is a message copy; the record of truth is Assessment/MuscleScore.' },
  PhysicianOnboarding:    { treatment: 'DELETE', subjectKey: 'userId', reason: "Physician's own onboarding detail (country, specialty, licence)." },

  // ── Analytics ──────────────────────────────────────────────────────────────
  AnalyticsEvent: {
    treatment:  'ANONYMIZE',
    subjectKey: 'userId',
    reason:
      'Current-format events are anonymized on erasure by clearing userId. ' +
      'The five legacy SRI-bearing rows are a separate bounded deletion: at ' +
      'two distinct subjects, stripping userId would not de-identify them.',
  },

  // ── No action ──────────────────────────────────────────────────────────────
  EmailSendAttempt:   { treatment: 'DORMANT_NO_ACTION', subjectKey: null, reason: 'HMAC only, self-pruning; no subject to erase.' },
  Study:              { treatment: 'DORMANT_NO_ACTION', subjectKey: null, reason: 'Research is dormant and is not being activated.' },
  StudyEnrollment:    { treatment: 'DORMANT_NO_ACTION', subjectKey: null, reason: 'Research is dormant; patientId is a scalar with no relation.' },
  StudyConsent:       { treatment: 'DORMANT_NO_ACTION', subjectKey: null, reason: 'Research is dormant; holds ipAddress and an immutable consent snapshot.' },
  AssessmentSnapshot: { treatment: 'DORMANT_NO_ACTION', subjectKey: null, reason: 'Research is dormant; immutability contract untouched.' },
  StudyEventLog:      { treatment: 'DORMANT_NO_ACTION', subjectKey: null, reason: 'Research is dormant; append-only research audit trail.' },
} as const;

// ── The erasure audit vocabulary ─────────────────────────────────────────────
//
// The lifecycle records itself through the EXISTING AuditLog, which already has
// the {actorId, action, targetType, targetId, metadata} shape used at eight
// sites. No ErasureRequest table: the pilot workflow is assisted and low
// volume, and a dedicated model would be the first brick of an architecture
// nobody has asked for.
//
// Defined here so the vocabulary is fixed before anything emits it. Nothing in
// this phase writes any of these.

export const ERASURE_REQUESTED         = 'ERASURE_REQUESTED';
export const ERASURE_IDENTITY_VERIFIED = 'ERASURE_IDENTITY_VERIFIED';
export const ERASURE_CLASSIFIED        = 'ERASURE_CLASSIFIED';
export const ERASURE_PROVIDER_ACTIONED = 'ERASURE_PROVIDER_ACTIONED';
export const ERASURE_COMPLETED         = 'ERASURE_COMPLETED';
export const ERASURE_MANUAL_REVIEW     = 'ERASURE_MANUAL_REVIEW';

/**
 * The lifecycle in order. Two orderings are non-negotiable and are the reason
 * this is a sequence rather than a set:
 *
 *   1. Identity verification precedes every mutation. An unverified erasure
 *      destroys someone else's identity.
 *   2. Database classification precedes provider actions. Clerk deletion is
 *      neither reversible nor idempotent, so running it first and then failing
 *      leaves an account unreachable and half-erased.
 */
export const ERASURE_LIFECYCLE = [
  ERASURE_REQUESTED,
  ERASURE_IDENTITY_VERIFIED,
  ERASURE_CLASSIFIED,
  ERASURE_PROVIDER_ACTIONED,
  ERASURE_COMPLETED,
  ERASURE_MANUAL_REVIEW,
] as const;

export type ErasureAction = (typeof ERASURE_LIFECYCLE)[number];

/** AuditLog.targetType for every erasure event. Matches the existing convention. */
export const ERASURE_AUDIT_TARGET = 'User';

/** Groups models by treatment — the shape a dry-run report is built from. */
export function modelsByTreatment(): Record<Treatment, string[]> {
  const out = Object.fromEntries(TREATMENTS.map(t => [t, [] as string[]])) as Record<Treatment, string[]>;
  for (const [model, d] of Object.entries(ERASURE_DISPOSITION)) out[d.treatment].push(model);
  for (const t of TREATMENTS) out[t].sort();
  return out;
}
