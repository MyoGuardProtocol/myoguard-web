/**
 * src/lib/communications/deliveryLifecycle.ts
 *
 * Applies authenticated provider evidence to governance state.
 *
 * THE SEPARATION THIS MODULE EXISTS TO HOLD
 * Recipient choice and deliverability are different dimensions. Someone may
 * want a clinical summary and still be unreachable. So nothing here touches
 * CommunicationPreference and nothing here writes CommunicationConsentEvent — a
 * provider cannot consent on a recipient's behalf, and a bounce is not a
 * withdrawal. Provider evidence updates the outbound ledger
 * (CommunicationEvent) and, where the evidence is strong enough, creates a
 * CommunicationSuppression. Those are the only two things it may do.
 *
 * WHY CORRELATION IS BY PROVIDER MESSAGE ID ALONE
 * `CommunicationEvent.providerMessageId` is unique, so a Resend message maps to
 * at most one governed attempt. Correlating by address would require holding
 * the plaintext recipient the pseudonymous architecture exists to avoid, and
 * correlating by subject or timestamp would be guesswork. If the id is unknown
 * the event is an orphan and is acknowledged without inventing a record — see
 * `applyProviderEvent`.
 */

import {
  type HandledEventType,
  type LifecycleState,
  classifyBounce,
  nextState,
  targetStateFor,
  softBounceWindowStart,
  SOFT_BOUNCE_THRESHOLD,
} from './providerEvents';

/** Documented `CommunicationSuppression.source` vocabulary member for this path. */
const PROVIDER_SOURCE = 'PROVIDER_WEBHOOK' as const;

export type ProviderEventInput = {
  eventType:         HandledEventType;
  /** Resend's `data.email_id`. The sole correlation key. */
  providerMessageId: string;
  /** Present only on `email.bounced`. Structured; never free text. */
  bounce?:           unknown;
};

export type ProviderEventOutcome =
  /** No governed attempt carries this provider id. Nothing was written. */
  | { outcome: 'orphan' }
  /** Correlated, but precedence declined the transition (duplicate/late/out-of-order). */
  | { outcome: 'no_change'; eventId: string; state: LifecycleState }
  /** Correlated and advanced. */
  | {
      outcome:     'transitioned';
      eventId:     string;
      from:        LifecycleState;
      to:          LifecycleState;
      suppression: 'created' | 'existing' | 'none';
    }
  /** Storage unavailable. The webhook must not report success. */
  | { outcome: 'error' };

/** Opaque provider ids are not PII, but they are not needed in full to debug. */
function short(id: string): string {
  return id.slice(0, 8);
}

// ─── Suppression ──────────────────────────────────────────────────────────────

type SuppressionReason = 'HARD_BOUNCE' | 'SPAM_COMPLAINT' | 'SOFT_BOUNCE_REPEATED';

/**
 * Creates an all-class EMAIL suppression unless an equivalent one is already
 * active. Idempotent by lookup rather than by unique constraint, because the
 * model deliberately keeps historical rows: a cleared suppression is still
 * evidence, so uniqueness cannot be enforced on (recipientKey, channel, reason)
 * without destroying the audit trail (§O).
 *
 * The existence check pins `communicationClass: null` exactly rather than
 * matching "null OR this class". These rows ARE the all-class scope; an active
 * class-scoped row with the same reason does not cover the other classes, so it
 * must not satisfy the check and suppress creation of the global one.
 *
 * `expiresAt` is left null for every reason including SOFT_BOUNCE_REPEATED. The
 * C3A schema comment anticipated an expiring soft-bounce hold, but Founder rule
 * M is explicit that C3D performs no automatic timed clearing; clearing is a
 * future authorised administrative workflow. The schema still permits it.
 */
async function ensureSuppression(
  prisma: typeof import('@/src/lib/prisma').prisma,
  args: {
    recipientKey: string;
    keyVersion:   number;
    reason:       SuppressionReason;
    recipientId:  string | null;
  },
): Promise<'created' | 'existing'> {
  const now = new Date();

  const existing = await prisma.communicationSuppression.findFirst({
    where: {
      recipientKey:       args.recipientKey,
      channel:            'EMAIL',
      communicationClass: null,
      reason:             args.reason,
      clearedAt:          null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });

  if (existing) return 'existing';

  await prisma.communicationSuppression.create({
    data: {
      recipientKey:       args.recipientKey,
      keyVersion:         args.keyVersion,
      channel:            'EMAIL',
      communicationClass: null,
      reason:             args.reason,
      source:             PROVIDER_SOURCE,
      recipientId:        args.recipientId,
    },
  });

  return 'created';
}

/**
 * Counts DISTINCT bounced send attempts, not webhook deliveries.
 *
 * This is what makes the threshold immune to duplicate delivery without any
 * per-event bookkeeping: one outbound attempt is one CommunicationEvent row, a
 * repeated webhook for the same provider id lands on that same row, and the row
 * is already BOUNCED_SOFT so precedence refuses the transition before the
 * threshold is ever evaluated. Two deliveries of one bounce can therefore only
 * ever contribute one to this count.
 *
 * The window is anchored on `requestedAt`, which is non-null on every row,
 * rather than `sentAt`, which is nullable.
 */
async function softBounceCount(
  prisma: typeof import('@/src/lib/prisma').prisma,
  recipientKey: string,
): Promise<number> {
  return prisma.communicationEvent.count({
    where: {
      recipientKey,
      channel:     'EMAIL',
      state:       'BOUNCED_SOFT',
      requestedAt: { gte: softBounceWindowStart() },
    },
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Applies one authenticated provider event.
 *
 * The caller MUST have verified the webhook signature first. This function
 * assumes the evidence is genuine and acts on it; it performs no authentication
 * of its own.
 */
export async function applyProviderEvent(
  input: ProviderEventInput,
): Promise<ProviderEventOutcome> {
  try {
    const { prisma } = await import('@/src/lib/prisma');

    const event = await prisma.communicationEvent.findUnique({
      where:  { providerMessageId: input.providerMessageId },
      select: {
        id:           true,
        state:        true,
        recipientKey: true,
        keyVersion:   true,
        recipientId:  true,
      },
    });

    // Orphan. Acknowledged by the caller, never fabricated into a record.
    if (!event) {
      console.log(
        `[comms/lifecycle] orphan provider event type=${input.eventType} ` +
        `msg=${short(input.providerMessageId)} — no governed attempt, nothing written`,
      );
      return { outcome: 'orphan' };
    }

    const from   = event.state as LifecycleState;
    const target = targetStateFor(input.eventType, input.bounce);
    const to     = nextState(from, target);

    if (to === null) {
      console.log(
        `[comms/lifecycle] no-op type=${input.eventType} event=${event.id} ` +
        `state=${from} target=${target}`,
      );
      return { outcome: 'no_change', eventId: event.id, state: from };
    }

    await prisma.communicationEvent.update({
      where: { id: event.id },
      data:  { state: to },
    });

    // Suppression follows the TRANSITION, never the raw event. A duplicate that
    // precedence refused has already returned above, so this runs at most once
    // per outbound attempt per outcome.
    let suppression: 'created' | 'existing' | 'none' = 'none';

    if (to === 'BOUNCED_HARD') {
      // Absolute blocker across every class MyoGuard controls (§K).
      suppression = await ensureSuppression(prisma, {
        recipientKey: event.recipientKey,
        keyVersion:   event.keyVersion,
        reason:       'HARD_BOUNCE',
        recipientId:  event.recipientId,
      });
    } else if (to === 'COMPLAINED') {
      // Founder interim rule L: absolute for EMAIL across all classes. No
      // ESSENTIAL_SERVICE override is attempted in C3D.
      suppression = await ensureSuppression(prisma, {
        recipientKey: event.recipientKey,
        keyVersion:   event.keyVersion,
        reason:       'SPAM_COMPLAINT',
        recipientId:  event.recipientId,
      });
    } else if (to === 'BOUNCED_SOFT') {
      const count = await softBounceCount(prisma, event.recipientKey);
      if (count >= SOFT_BOUNCE_THRESHOLD) {
        suppression = await ensureSuppression(prisma, {
          recipientKey: event.recipientKey,
          keyVersion:   event.keyVersion,
          reason:       'SOFT_BOUNCE_REPEATED',
          recipientId:  event.recipientId,
        });
      }
      console.log(
        `[comms/lifecycle] soft bounce event=${event.id} ` +
        `count30d=${count} threshold=${SOFT_BOUNCE_THRESHOLD} suppression=${suppression}`,
      );
    }

    console.log(
      `[comms/lifecycle] type=${input.eventType} event=${event.id} ` +
      `${from} -> ${to} suppression=${suppression}` +
      (input.eventType === 'email.bounced'
        ? ` bounce=${classifyBounce(input.bounce)}`
        : ''),
    );

    return { outcome: 'transitioned', eventId: event.id, from, to, suppression };
  } catch (err) {
    console.error(
      '[comms/lifecycle] provider event processing failed:',
      err instanceof Error ? err.message : String(err),
    );
    return { outcome: 'error' };
  }
}
