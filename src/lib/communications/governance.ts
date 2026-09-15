/**
 * src/lib/communications/governance.ts
 *
 * The communications governance boundary — Layer 0.
 *
 * WHY THIS EXISTS
 * Phase 1D-C1 found that MyoGuard had no preference check, no suppression
 * check, and no durable record on any of its twelve email pathways, while two
 * public surfaces promised "Unsubscribe anytime". This module is the single
 * decision point that makes that promise enforceable. Phase 1D-C3B wires only
 * the two CLINICAL_CONTINUITY pathways to it; the rest migrate later.
 *
 * `canSend` is DECISION-ONLY. It never calls Resend, never calls Twilio, never
 * touches provider state, and never sends anything. It reads governance state
 * and returns a verdict. Recording and sending are the caller's job.
 *
 * Same split as `emailThrottle`: the pure decision (`decideFromGovernanceState`)
 * is isolated from storage so it can be exercised without a database, and
 * Prisma is imported lazily so importing this module does not construct a
 * client or a connection pool.
 */

import { deriveRecipientIdentity, normaliseEmail } from './identity';
import { verifyRecipientEmail } from './recipientVerification';

// ─── Contract ─────────────────────────────────────────────────────────────────

export type CommunicationClassName =
  | 'ESSENTIAL_SERVICE'
  | 'CLINICAL_CONTINUITY'
  | 'EDUCATIONAL'
  | 'MARKETING'
  | 'OPERATIONAL_INTERNAL';

export type CommunicationChannelName = 'EMAIL' | 'SMS';

export type SuppressionReasonName =
  | 'RECIPIENT_UNSUBSCRIBE'
  | 'HARD_BOUNCE'
  | 'SOFT_BOUNCE_REPEATED'
  | 'SPAM_COMPLAINT'
  | 'ADMIN_SUPPRESSION'
  | 'ACCOUNT_CONTACTABILITY_REVOKED';

export type PreferenceStateName = 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'NEVER_SET';

/**
 * `UNAVAILABLE` is not optional. Governance storage can be unreachable and the
 * secret can be absent. Without a distinct outcome for "cannot determine", a
 * failure would have to collapse into either ALLOW (sending ungoverned) or a
 * suppression reason that misrepresents why. The institutional answer is the
 * one `emailThrottle` already set: protecting the clinical sending domain
 * outranks delivering during an outage.
 */
export type CommsDecision =
  | 'ALLOW'
  | 'SUPPRESS_PREFERENCE'
  | 'SUPPRESS_HARD_BOUNCE'
  | 'SUPPRESS_COMPLAINT'
  | 'SUPPRESS_ACCOUNT_STATE'
  | 'SUPPRESS_POLICY'
  | 'UNAVAILABLE';

/**
 * Sub-code for the three distinct causes that all surface as SUPPRESS_POLICY.
 *
 * CommunicationSuppressionReason has no POLICY member, so a policy suppression
 * writes NULL to CommunicationEvent.suppressionReason — correct, since no
 * suppression ROW caused it. This sub-code preserves the distinction in logs.
 * Promoting it to a stored column is a later, separately authorised change.
 */
export type PolicyReason =
  | 'no_preference_on_record'
  | 'preference_never_set'
  | 'recipient_not_verified'
  | 'recipient_identity_unavailable'
  | 'class_not_activated'
  | 'deliverability_hold';

export type CanSendInput = {
  email:              string;
  communicationClass: CommunicationClassName;
  channel:            CommunicationChannelName;
  userId?:            string;
  /**
   * The recipient's Clerk identity, used to resolve verification INSIDE this
   * boundary.
   *
   * Phase 1D-C3B.1 removed the previous `recipientVerified: boolean` input.
   * A caller-supplied boolean made verification an assertion any route could
   * make, which is not a trust boundary — TypeScript does not constrain what a
   * future call site chooses to pass. Callers may now only identify the
   * recipient; whether that identity is verified is decided here, by the
   * authoritative server-side resolver, and cannot be overridden.
   *
   * Absent or unresolvable is treated as NOT verified — fail closed.
   */
  clerkUserId?:       string | null;
  /** Free-form tracing label. Never logged with the address. */
  context?:           string;
};

export type CanSendResult = {
  decision:     CommsDecision;
  /** Null only when the identity secret is unusable — nothing can be keyed. */
  recipientKey: string | null;
  keyVersion:   number;
  /** Set when `decision` came from a stored CommunicationSuppression row. */
  suppressionReason?: SuppressionReasonName;
  /** Set when `decision` is SUPPRESS_POLICY. */
  policyReason?: PolicyReason;
};

// ─── Precedence ───────────────────────────────────────────────────────────────

/**
 * Order in which an active suppression is reported when several apply.
 *
 * All of them block, so the order does not change whether the send happens —
 * it decides which reason is recorded, and that drives support, audit and
 * whether the suppression is reversible at all. Absolute, least-reversible
 * causes are reported first.
 *
 * ADMIN_SUPPRESSION and SOFT_BOUNCE_REPEATED both surface as SUPPRESS_POLICY:
 * the outcome vocabulary has no member for either, and both are policy holds
 * rather than recipient choices. SOFT_BOUNCE_REPEATED is honoured structurally
 * if a row exists; C3B creates no such row and invents no escalation
 * threshold — that is C3D's decision.
 */
const SUPPRESSION_PRECEDENCE: ReadonlyArray<{
  reason:   SuppressionReasonName;
  decision: CommsDecision;
  policy?:  PolicyReason;
}> = [
  { reason: 'ACCOUNT_CONTACTABILITY_REVOKED', decision: 'SUPPRESS_ACCOUNT_STATE' },
  { reason: 'HARD_BOUNCE',                    decision: 'SUPPRESS_HARD_BOUNCE'   },
  { reason: 'ADMIN_SUPPRESSION',              decision: 'SUPPRESS_POLICY', policy: 'class_not_activated' },
  { reason: 'SPAM_COMPLAINT',                 decision: 'SUPPRESS_COMPLAINT'     },
  { reason: 'SOFT_BOUNCE_REPEATED',           decision: 'SUPPRESS_POLICY', policy: 'deliverability_hold' },
  { reason: 'RECIPIENT_UNSUBSCRIBE',          decision: 'SUPPRESS_PREFERENCE'    },
];

// ─── Pure decision ────────────────────────────────────────────────────────────

export type GovernanceState = {
  /** Reasons of suppression rows that are active NOW for this class + channel. */
  activeSuppressionReasons: SuppressionReasonName[];
  /** Null when no preference row exists for this recipient + channel + class. */
  preferenceState: PreferenceStateName | null;
  /**
   * Resolved by the authoritative server-side verifier, never by a caller.
   * `undefined` means "not yet resolved" and is treated as unverified, so the
   * pure function is total and fails closed on the unknown.
   */
  recipientVerified: boolean | undefined;
};

/**
 * The policy itself, isolated from storage.
 *
 * Given what the store observed for one recipient, may this class of message
 * proceed? No I/O, so every branch is directly exercisable.
 */
export function decideFromGovernanceState(
  communicationClass: CommunicationClassName,
  state: GovernanceState,
): { decision: CommsDecision; suppressionReason?: SuppressionReasonName; policyReason?: PolicyReason } {

  // 1. Absolute blockers first. A recorded suppression outranks any class rule:
  //    a hard-bounced address cannot receive even essential service mail.
  for (const rule of SUPPRESSION_PRECEDENCE) {
    if (state.activeSuppressionReasons.includes(rule.reason)) {
      return { decision: rule.decision, suppressionReason: rule.reason, policyReason: rule.policy };
    }
  }

  // 2. Class rules.
  switch (communicationClass) {

    case 'CLINICAL_CONTINUITY': {
      // Founder decision 3: NEVER_SET — and the absence of any row, which is
      // the same fact — suppress until a default is approved. Existing users
      // are NOT silently subscribed.
      //
      // Evaluated BEFORE verification, which reverses the C3B ordering. Both
      // must still pass for ALLOW, so the guarantee is unchanged: no one can be
      // sent to on the strength of a preference alone. What changes is which
      // reason is reported when both fail, and — the reason for the change —
      // that the locally-answerable question is asked first, so the Clerk
      // network lookup is only made when it can actually change the outcome.
      // In production today that is zero Clerk calls per batch.
      if (state.preferenceState === null) {
        return { decision: 'SUPPRESS_POLICY', policyReason: 'no_preference_on_record' };
      }
      if (state.preferenceState === 'NEVER_SET') {
        return { decision: 'SUPPRESS_POLICY', policyReason: 'preference_never_set' };
      }
      if (state.preferenceState === 'UNSUBSCRIBED') {
        return { decision: 'SUPPRESS_PREFERENCE' };
      }

      // Founder decision 5: no recurring clinically loaded patient
      // communication to an unverified email identity. Reaching here means
      // everything else passed, so `canSend` treats this outcome as its signal
      // to resolve verification for real and re-decide.
      if (state.recipientVerified !== true) {
        return { decision: 'SUPPRESS_POLICY', policyReason: 'recipient_not_verified' };
      }

      return { decision: 'ALLOW' };
    }

    // No production sender exists for either class. Fail closed so that wiring
    // one up without the consent capture it requires cannot silently send.
    case 'EDUCATIONAL':
    case 'MARKETING':
      return { decision: 'SUPPRESS_POLICY', policyReason: 'class_not_activated' };

    // Not preference-suppressible by design — only the absolute blockers above
    // apply. No pathway is wired to this module for these classes in C3B.
    case 'ESSENTIAL_SERVICE':
    case 'OPERATIONAL_INTERNAL':
      return { decision: 'ALLOW' };
  }
}

// ─── Enforcement ──────────────────────────────────────────────────────────────

/**
 * Resolves the governance verdict for one prospective send.
 *
 * Never contacts a provider. Never writes. Fails closed on every path where the
 * answer cannot be established: missing or weak secret, and storage errors both
 * return UNAVAILABLE, and the caller must not send on UNAVAILABLE.
 *
 * The recipient address is never logged.
 */
export async function canSend(input: CanSendInput): Promise<CanSendResult> {
  const identity = deriveRecipientIdentity(input.email);

  if (!identity) {
    console.error(
      '[comms/governance] COMMS_IDENTITY_SECRET is missing or too weak — refusing to send.',
    );
    return { decision: 'UNAVAILABLE', recipientKey: null, keyVersion: 0 };
  }

  const { recipientKey, keyVersion } = identity;

  let state: GovernanceState;

  try {
    const { prisma } = await import('@/src/lib/prisma');
    const now = new Date();

    // A suppression with a NULL communicationClass covers ALL classes; one with
    // a class value is scoped to that class alone. Cleared and expired rows are
    // excluded here rather than in the pure decision, so the decision never has
    // to reason about time.
    const suppressions = await prisma.communicationSuppression.findMany({
      where: {
        recipientKey,
        channel:   input.channel,
        clearedAt: null,
        AND: [
          { OR: [{ communicationClass: null }, { communicationClass: input.communicationClass }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      select: { reason: true },
    });

    // Preference is keyed on the recipient row, which may legitimately not
    // exist — an address with no durable relationship has no preferences.
    const preference = await prisma.communicationPreference.findFirst({
      where: {
        channel:            input.channel,
        communicationClass: input.communicationClass,
        recipient:          { recipientKey },
      },
      select: { state: true },
    });

    state = {
      activeSuppressionReasons: suppressions.map(s => s.reason as SuppressionReasonName),
      preferenceState:          (preference?.state as PreferenceStateName | undefined) ?? null,
      // Left unresolved on purpose. Stage 1 below decides everything answerable
      // without a network call; verification is resolved only if it becomes the
      // deciding question.
      recipientVerified:        undefined,
    };
  } catch (err) {
    // Store unreachable, schema not yet applied, pool exhausted — all fail
    // closed. Neither the address nor the recipient key is logged.
    console.error(
      '[comms/governance] governance store unavailable — refusing to send:',
      err instanceof Error ? err.message : String(err),
    );
    return { decision: 'UNAVAILABLE', recipientKey, keyVersion };
  }

  // Stage 1 — decide everything answerable from local state, with verification
  // deliberately left unresolved.
  const provisional = decideFromGovernanceState(input.communicationClass, state);

  // Because preference is evaluated before verification, `recipient_not_verified`
  // is returned ONLY when every other gate passed. That makes it an unambiguous
  // signal that verification is now the deciding question — and the only point
  // at which a Clerk lookup is worth making.
  if (provisional.policyReason !== 'recipient_not_verified') {
    return { recipientKey, keyVersion, ...provisional };
  }

  // Stage 2 — resolve verification authoritatively and re-decide.
  const verification = await verifyRecipientEmail({
    clerkUserId:      input.clerkUserId,
    destinationEmail: input.email,
  });

  if (!verification.verified) {
    console.log(
      `[comms/governance] recipient verification failed ` +
      `code=${verification.code} detail=${verification.detail}`,
    );
    return {
      recipientKey,
      keyVersion,
      decision:     'SUPPRESS_POLICY',
      policyReason: verification.code,
    };
  }

  const verdict = decideFromGovernanceState(input.communicationClass, {
    ...state,
    recipientVerified: true,
  });

  return { recipientKey, keyVersion, ...verdict };
}

// ─── Communication record ─────────────────────────────────────────────────────

export type RecordEventInput = {
  recipientKey:       string;
  keyVersion:         number;
  userId?:            string;
  communicationClass: CommunicationClassName;
  channel:            CommunicationChannelName;
  templateId:         string;
  provider:           string;
  state:              'REQUESTED' | 'SUPPRESSED' | 'SENT' | 'FAILED';
  suppressionReason?: SuppressionReasonName;
  /**
   * Bounded governance reason code for SUPPRESS_POLICY decisions, which have no
   * CommunicationSuppressionReason member because no suppression ROW caused
   * them. Phase 1D-C3B recorded these to the console only, which meant the
   * durable record could not distinguish "unverified" from "no preference".
   * Never an address, never clinical content, never a provider error body.
   */
  policyReason?:      PolicyReason;
};

/**
 * Writes the durable record of one governed decision.
 *
 * Deliberately narrow: no address, no subject, no body, no clinical value. The
 * template is named by id, and clinical context is linked by id afterwards.
 *
 * Returns the row id, or null if the write failed. The caller decides what a
 * failure means — see `markEventSent` and the call sites. Never throws, so a
 * recording failure cannot itself become an unhandled error mid-batch.
 */
export async function recordCommunicationEvent(input: RecordEventInput): Promise<string | null> {
  try {
    const { prisma } = await import('@/src/lib/prisma');
    const row = await prisma.communicationEvent.create({
      data: {
        recipientKey:       input.recipientKey,
        keyVersion:         input.keyVersion,
        userId:             input.userId ?? null,
        communicationClass: input.communicationClass,
        channel:            input.channel,
        templateId:         input.templateId,
        provider:           input.provider,
        state:              input.state,
        suppressionReason:  input.suppressionReason ?? null,
        policyReason:       input.policyReason ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error(
      '[comms/governance] CommunicationEvent write failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Promotes a REQUESTED event to SENT once the provider has accepted it.
 *
 * Best-effort by necessity: the message has already left, so a failure here
 * cannot be undone and must not fail the batch. It is logged loudly instead —
 * the resulting row sits in REQUESTED, which is exactly what the
 * (state, requestedAt) index added in C3A exists to find.
 */
export async function markEventSent(
  eventId: string,
  providerMessageId: string | undefined,
  relatedNotificationId?: string,
): Promise<void> {
  try {
    const { prisma } = await import('@/src/lib/prisma');
    await prisma.communicationEvent.update({
      where: { id: eventId },
      data: {
        state:                 'SENT',
        sentAt:                new Date(),
        providerMessageId:     providerMessageId ?? null,
        relatedNotificationId: relatedNotificationId ?? null,
      },
    });
  } catch (err) {
    console.error(
      `[comms/governance] CommunicationEvent ${eventId} left in REQUESTED — update failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Re-exported so callers need only one import for the governance boundary. */
export { normaliseEmail };
