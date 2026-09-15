/**
 * src/lib/communications/preferenceService.ts
 *
 * The single place recipient choice is recorded. Both the public token
 * unsubscribe and the authenticated settings surface call these functions —
 * there must not be two governance systems that can disagree.
 *
 * THREE LEDGERS, THREE JOBS
 *   CommunicationConsentEvent — append-only evidence. Never updated, never
 *                               deleted. Keyed by recipientKey, so it survives
 *                               deletion of the plaintext recipient.
 *   CommunicationPreference   — current-state projection. Requires a
 *                               CommunicationRecipient row (FK), so it only
 *                               exists where a durable relationship does.
 *   CommunicationSuppression  — what canSend actually enforces. Pseudonymous,
 *                               needs no recipient row.
 *
 * CommunicationEvent is deliberately NOT written here. That ledger records
 * outbound attempts; a preference change is not one. Blurring them would make
 * "how many emails did we try to send?" unanswerable.
 *
 * WHY WITHDRAWAL DOES NOT REQUIRE A RECIPIENT ROW
 * An address that only ever received a one-shot email has no
 * CommunicationRecipient. It must still be able to opt out. So withdrawal
 * writes suppression + evidence (both keyed by recipientKey) and updates the
 * preference projection only if a recipient row already exists. The
 * pseudonymous architecture is not weakened to support unsubscribe.
 */

import type {
  CommunicationClassName,
  CommunicationChannelName,
} from './governance';
import { OPTIONAL_CLASSES, type OptionalClass } from './unsubscribeToken';

/** Recipient choice is the ONLY suppression these functions may create or clear. */
const RECIPIENT_CHOICE_REASON = 'RECIPIENT_UNSUBSCRIBE' as const;

export type ActorType = 'SELF' | 'ADMIN' | 'SYSTEM';

export type WithdrawInput = {
  recipientKey:  string;
  keyVersion:    number;
  channel:       CommunicationChannelName;
  /** Must be optional classes. Callers pass an allowlisted set; see below. */
  classes:       readonly OptionalClass[];
  sourceSurface: string;
  actorType:     ActorType;
  actorId?:      string | null;
};

export type WithdrawResult = {
  ok:               boolean;
  /** Classes newly withdrawn in this call. */
  changed:          OptionalClass[];
  /** Classes already withdrawn — no duplicate evidence was written for these. */
  alreadyWithdrawn: OptionalClass[];
};

/**
 * Records withdrawal of consent for one or more optional classes.
 *
 * IDEMPOTENT BY DESIGN. A repeated withdrawal detects the existing active
 * suppression and returns success WITHOUT appending another event. The ledger
 * should hold meaningful evidence, not a row per click — a recipient who clicks
 * the same link five times made one decision.
 *
 * ESSENTIAL_SERVICE and OPERATIONAL_INTERNAL are unreachable here: the input
 * type admits only optional classes, and the runtime filter below re-checks
 * against the allowlist rather than trusting the caller.
 */
export async function withdrawConsent(input: WithdrawInput): Promise<WithdrawResult> {
  // Allowlist re-check. Types are not a trust boundary.
  const classes = input.classes.filter(c =>
    (OPTIONAL_CLASSES as readonly string[]).includes(c),
  ) as OptionalClass[];

  if (classes.length === 0) return { ok: false, changed: [], alreadyWithdrawn: [] };

  const changed:          OptionalClass[] = [];
  const alreadyWithdrawn: OptionalClass[] = [];

  try {
    const { prisma } = await import('@/src/lib/prisma');
    const now = new Date();

    // A recipient row may legitimately not exist. Resolved once, used only to
    // keep the projection in step where there is one.
    const recipient = await prisma.communicationRecipient.findUnique({
      where:  { recipientKey: input.recipientKey },
      select: { id: true },
    });

    for (const communicationClass of classes) {
      const existing = await prisma.communicationSuppression.findFirst({
        where: {
          recipientKey: input.recipientKey,
          channel:      input.channel,
          reason:       RECIPIENT_CHOICE_REASON,
          clearedAt:    null,
          AND: [
            { OR: [{ communicationClass: null }, { communicationClass }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
        select: { id: true },
      });

      if (existing) { alreadyWithdrawn.push(communicationClass); continue; }

      // Evidence first — the record of the decision must exist even if a later
      // write in this loop fails.
      await prisma.communicationConsentEvent.create({
        data: {
          recipientKey:       input.recipientKey,
          keyVersion:         input.keyVersion,
          recipientId:        recipient?.id ?? null,
          channel:            input.channel,
          communicationClass,
          action:             'WITHDRAW',
          sourceSurface:      input.sourceSurface,
          actorType:          input.actorType,
          actorId:            input.actorId ?? null,
        },
      });

      // What canSend enforces. Pseudonymous — no recipient row required.
      await prisma.communicationSuppression.create({
        data: {
          recipientKey:       input.recipientKey,
          keyVersion:         input.keyVersion,
          channel:            input.channel,
          communicationClass,
          reason:             RECIPIENT_CHOICE_REASON,
          source:             'RECIPIENT',
          recipientId:        recipient?.id ?? null,
        },
      });

      // Projection, only where a durable relationship already exists.
      if (recipient) {
        await prisma.communicationPreference.upsert({
          where: {
            recipientId_channel_communicationClass: {
              recipientId: recipient.id,
              channel:     input.channel,
              communicationClass,
            },
          },
          create: {
            recipientId: recipient.id,
            channel:     input.channel,
            communicationClass,
            state:       'UNSUBSCRIBED',
          },
          update: { state: 'UNSUBSCRIBED' },
        });
      }

      changed.push(communicationClass);
    }

    return { ok: true, changed, alreadyWithdrawn };
  } catch (err) {
    console.error(
      '[comms/preference] withdrawal failed:',
      err instanceof Error ? err.message : String(err),
    );
    return { ok: false, changed, alreadyWithdrawn };
  }
}

// ─── Grant ────────────────────────────────────────────────────────────────────

export type GrantInput = {
  recipientKey:       string;
  keyVersion:         number;
  /** Plaintext address — a subscription IS the durable relationship. */
  email:              string;
  userId?:            string | null;
  channel:            CommunicationChannelName;
  communicationClass: OptionalClass;
  sourceSurface:      string;
  wordingId:          string;
  actorType:          ActorType;
  actorId?:           string | null;
};

/**
 * Records an affirmative, deliberate subscription.
 *
 * Only reachable from the authenticated surface. There is no public path to
 * this function — a token can withdraw, never grant.
 *
 * Clears ONLY the recipient's own RECIPIENT_UNSUBSCRIBE suppression for this
 * class and channel. A hard bounce, a spam complaint, an admin hold or a
 * revoked-contactability record all survive, because none of them is the
 * recipient's choice to reverse: subscribing says "I want this", not "that
 * bounce never happened".
 */
export async function grantConsent(input: GrantInput): Promise<{ ok: boolean }> {
  if (!(OPTIONAL_CLASSES as readonly string[]).includes(input.communicationClass)) {
    return { ok: false };
  }

  try {
    const { prisma } = await import('@/src/lib/prisma');

    // A subscription is a durable relationship, so the plaintext row is
    // legitimate here — unlike the withdrawal path.
    const recipient = await prisma.communicationRecipient.upsert({
      where:  { recipientKey: input.recipientKey },
      create: {
        recipientKey: input.recipientKey,
        keyVersion:   input.keyVersion,
        email:        input.email,
        userId:       input.userId ?? null,
      },
      update: { userId: input.userId ?? undefined },
      select: { id: true },
    });

    const event = await prisma.communicationConsentEvent.create({
      data: {
        recipientKey:       input.recipientKey,
        keyVersion:         input.keyVersion,
        recipientId:        recipient.id,
        channel:            input.channel,
        communicationClass: input.communicationClass,
        action:             'GRANT',
        sourceSurface:      input.sourceSurface,
        actorType:          input.actorType,
        actorId:            input.actorId ?? null,
        wordingId:          input.wordingId,
      },
      select: { id: true },
    });

    await prisma.communicationPreference.upsert({
      where: {
        recipientId_channel_communicationClass: {
          recipientId:        recipient.id,
          channel:            input.channel,
          communicationClass: input.communicationClass,
        },
      },
      create: {
        recipientId:        recipient.id,
        channel:            input.channel,
        communicationClass: input.communicationClass,
        state:              'SUBSCRIBED',
        lastEventId:        event.id,
      },
      update: { state: 'SUBSCRIBED', lastEventId: event.id },
    });

    // Narrow by design: reason is pinned to RECIPIENT_UNSUBSCRIBE, so no other
    // suppression can be cleared by this path even accidentally.
    await prisma.communicationSuppression.updateMany({
      where: {
        recipientKey:       input.recipientKey,
        channel:            input.channel,
        communicationClass: input.communicationClass,
        reason:             RECIPIENT_CHOICE_REASON,
        clearedAt:          null,
      },
      data: { clearedAt: new Date() },
    });

    return { ok: true };
  } catch (err) {
    console.error(
      '[comms/preference] grant failed:',
      err instanceof Error ? err.message : String(err),
    );
    return { ok: false };
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export type PreferenceView = {
  /** What the recipient will actually experience, after suppression. */
  effective: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'NEVER_SET' | 'BLOCKED';
  /** The stored projection, if any. */
  stored:    'SUBSCRIBED' | 'UNSUBSCRIBED' | 'NEVER_SET' | null;
  /** True when a non-recipient-choice suppression is in force. */
  blocked:   boolean;
};

/**
 * Current state for display. Read-only.
 *
 * `BLOCKED` is surfaced separately because "you are subscribed but we cannot
 * reach you" is a real and materially different state from "you unsubscribed" —
 * a patient waiting on a clinical summary should not be told they opted out.
 */
export async function readPreference(args: {
  recipientKey:       string;
  channel:            CommunicationChannelName;
  communicationClass: CommunicationClassName;
}): Promise<PreferenceView> {
  try {
    const { prisma } = await import('@/src/lib/prisma');
    const now = new Date();

    const suppressions = await prisma.communicationSuppression.findMany({
      where: {
        recipientKey: args.recipientKey,
        channel:      args.channel,
        clearedAt:    null,
        AND: [
          { OR: [{ communicationClass: null }, { communicationClass: args.communicationClass }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      select: { reason: true },
    });

    const preference = await prisma.communicationPreference.findFirst({
      where: {
        channel:            args.channel,
        communicationClass: args.communicationClass,
        recipient:          { recipientKey: args.recipientKey },
      },
      select: { state: true },
    });

    const stored  = (preference?.state as PreferenceView['stored']) ?? null;
    const blocked = suppressions.some(s => s.reason !== RECIPIENT_CHOICE_REASON);
    const optedOut = suppressions.some(s => s.reason === RECIPIENT_CHOICE_REASON);

    if (blocked)  return { effective: 'BLOCKED',      stored, blocked: true };
    if (optedOut) return { effective: 'UNSUBSCRIBED', stored, blocked: false };

    return { effective: stored ?? 'NEVER_SET', stored, blocked: false };
  } catch (err) {
    console.error(
      '[comms/preference] read failed:',
      err instanceof Error ? err.message : String(err),
    );
    // Fail safe for display: never imply someone is subscribed when unsure.
    return { effective: 'NEVER_SET', stored: null, blocked: false };
  }
}
