/**
 * src/lib/communications/serviceEmail.ts
 *
 * The governed send sequence for ESSENTIAL_SERVICE email.
 *
 * WHY THIS EXISTS RATHER THAN TEN COPIES
 * Phase 1D-C3E brings ten external pathways under the governance boundary that
 * C3B and C3D built. Each one needs the same five steps in the same order:
 * decide, record, send, persist the provider id, mark the outcome. Written out
 * ten times, the ordering becomes a convention that ten call sites have to
 * remember — and the one that forgets is the one that emails a hard-bounced
 * address. Written once, it is structural.
 *
 * This is NOT a new provider abstraction. It composes the existing primitives
 * (`canSend`, `recordCommunicationEvent`, `sendEmail`, `markEventSent`,
 * `markEventFailed`) and adds no capability to any of them: no retries, no
 * attachments, no scheduling, no batching, no queue. Every field it accepts is
 * one the canonical gateway already had.
 *
 * WHAT ESSENTIAL_SERVICE MEANS HERE
 * No preference is consulted and none is created. A recipient cannot opt out of
 * the email that tells them their account is active. What DOES apply is the set
 * of absolute blockers — hard bounce, repeated soft bounce, spam complaint,
 * admin suppression, revoked contactability — which `decideFromGovernanceState`
 * already evaluates before any class rule. That is the whole point of C3E: the
 * rule was already correct in the engine; these pathways simply never asked.
 *
 * A recipient's own CLINICAL_CONTINUITY unsubscribe cannot reach this code.
 * C3C scopes recipient-choice suppressions to a specific optional class, never
 * to the all-class NULL scope, so opting out of clinical summaries leaves
 * service mail untouched — by construction, not by convention.
 */

import {
  canSend,
  recordCommunicationEvent,
  markEventSent,
  markEventFailed,
  type CommsDecision,
  type SuppressionReasonName,
  type PolicyReason,
} from './governance';
// Explicit '/index': the bare specifier '@/src/lib/email' resolves to the
// legacy src/lib/email.ts FILE, not the src/lib/email/ directory. The two are
// one character apart and only one of them is the canonical gateway.
import { sendEmail } from '@/src/lib/email/index';

/** Provider vocabulary member, matching the governed CLINICAL_CONTINUITY paths. */
const PROVIDER = 'RESEND' as const;

export type ServiceEmailInput = {
  /** Destination address. Never logged. */
  to:       string;
  subject:  string;
  html:     string;
  from?:    string;
  replyTo?: string;

  /**
   * Template identity recorded on CommunicationEvent — never the rendered
   * output, and never the subject, several of which carry a person's name.
   */
  templateId: string;

  /** Internal User.id where the pathway knows one. Optional by design: the */
  /** public requested-delivery paths have no account and must not invent one. */
  userId?: string;

  /** Free-form tracing label. Never logged alongside the address. */
  context: string;
};

export type ServiceEmailResult =
  /** Provider accepted it. `providerMessageId` is absent only if Resend omitted one. */
  | { outcome: 'sent'; eventId: string; providerMessageId?: string }
  /** An absolute blocker applied. Resend was NOT called. */
  | { outcome: 'suppressed'; decision: CommsDecision;
      suppressionReason?: SuppressionReasonName; policyReason?: PolicyReason }
  /** Governance could not be determined, or the attempt could not be recorded. */
  | { outcome: 'unavailable' }
  /** Provider refused it synchronously. */
  | { outcome: 'failed'; eventId: string; error: Error };

/**
 * Runs one governed ESSENTIAL_SERVICE send.
 *
 * Ordering is the contract, and it is the same boundary C3B established:
 *
 *   1. decide      — canSend, before the provider is contacted
 *   2. record      — CommunicationEvent exists before the send, never after
 *   3. send        — only on ALLOW
 *   4. persist     — the provider's own message id, never a fabricated one
 *   5. mark        — SENT or FAILED
 *
 * FAIL-CLOSED ON UNAVAILABLE. A governance outage is not permission to send.
 * The alternative — sending ungoverned whenever the store hiccups — would mean
 * a complained or hard-bounced address could be mailed during any blip, which
 * is the exact bypass C3E exists to close. In practice this is near-unreachable
 * for these pathways: every one of them has already written to the same
 * database before reaching the email, so a store outage fails upstream first.
 *
 * NEVER RESENDS. If Resend accepts and the local write then fails,
 * `markEventSent` handles it: one narrow retry of the correlation key alone, so
 * a later provider event can repair the row, then a reconcilable log line. The
 * provider is not called twice. A duplicate clinical or service email is worse
 * than an imperfect record.
 */
export async function sendServiceEmail(
  input: ServiceEmailInput,
): Promise<ServiceEmailResult> {
  // ── 1. Decide ───────────────────────────────────────────────────────────────
  //
  // ESSENTIAL_SERVICE consults no preference and resolves no Clerk identity:
  // `decideFromGovernanceState` reaches ALLOW for this class unless an absolute
  // blocker is on record, so no verification lookup is made and no network call
  // leaves the process.
  const gate = await canSend({
    email:              input.to,
    communicationClass: 'ESSENTIAL_SERVICE',
    channel:            'EMAIL',
    userId:             input.userId,
    context:            input.context,
  });

  if (gate.decision === 'UNAVAILABLE' || !gate.recipientKey) {
    console.error(
      `[comms/service-email] governance unavailable context=${input.context} — not sent`,
    );
    return { outcome: 'unavailable' };
  }

  // ── 2. Suppressed ───────────────────────────────────────────────────────────
  //
  // Recorded so the refusal is auditable, then abandoned. Resend is not called.
  if (gate.decision !== 'ALLOW') {
    await recordCommunicationEvent({
      recipientKey:       gate.recipientKey,
      keyVersion:         gate.keyVersion,
      userId:             input.userId,
      communicationClass: 'ESSENTIAL_SERVICE',
      channel:            'EMAIL',
      templateId:         input.templateId,
      provider:           PROVIDER,
      state:              'SUPPRESSED',
      suppressionReason:  gate.suppressionReason,
      policyReason:       gate.policyReason,
    });

    console.log(
      `[comms/service-email] suppressed context=${input.context} ` +
      `decision=${gate.decision} reason=${gate.suppressionReason ?? gate.policyReason ?? 'n/a'}`,
    );

    return {
      outcome:           'suppressed',
      decision:          gate.decision,
      suppressionReason: gate.suppressionReason,
      policyReason:      gate.policyReason,
    };
  }

  // ── 3. Record before sending ────────────────────────────────────────────────
  //
  // No record, no send — the same rule the CLINICAL_CONTINUITY pathways follow.
  // An email the ledger has never heard of cannot be reconciled by the webhook,
  // and an untraceable send is the condition C3E was commissioned to end.
  const eventId = await recordCommunicationEvent({
    recipientKey:       gate.recipientKey,
    keyVersion:         gate.keyVersion,
    userId:             input.userId,
    communicationClass: 'ESSENTIAL_SERVICE',
    channel:            'EMAIL',
    templateId:         input.templateId,
    provider:           PROVIDER,
    state:              'REQUESTED',
  });

  if (!eventId) {
    console.error(
      `[comms/service-email] could not record attempt context=${input.context} — not sent`,
    );
    return { outcome: 'unavailable' };
  }

  // ── 4. Send ─────────────────────────────────────────────────────────────────
  //
  // No List-Unsubscribe headers: ESSENTIAL_SERVICE carries no opt-out, and
  // offering one would promise a control that does not exist.
  const { id: providerMessageId, error } = await sendEmail({
    to:      input.to,
    subject: input.subject,
    html:    input.html,
    ...(input.from    ? { from:    input.from    } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });

  if (error) {
    await markEventFailed(eventId);
    console.error(
      `[comms/service-email] provider refused context=${input.context} event=${eventId}`,
    );
    return { outcome: 'failed', eventId, error };
  }

  // ── 5. Persist the provider's id ────────────────────────────────────────────
  //
  // This is what lets the C3D webhook find this row when the delivery, bounce
  // or complaint arrives.
  await markEventSent(eventId, providerMessageId);

  return { outcome: 'sent', eventId, providerMessageId };
}
