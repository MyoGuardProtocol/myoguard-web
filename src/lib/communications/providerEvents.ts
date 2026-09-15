/**
 * src/lib/communications/providerEvents.ts
 *
 * The provider lifecycle policy, isolated from storage.
 *
 * Same split as `governance.ts`: the decisions live here as pure functions with
 * no I/O, so every branch — including the ones that are hard to provoke against
 * a real provider, like an out-of-order complaint — is directly exercisable.
 * `deliveryLifecycle.ts` owns the database side.
 *
 * WHAT THIS MODULE REFUSES TO DO
 * It never infers a deliverability classification from provider free text.
 * Resend supplies a structured `bounce.type`; that field, and only that field,
 * decides hard versus soft. `bounce.message` is a human-readable string whose
 * wording is not a contract, and parsing it would mean inventing provider
 * semantics. An unrecognised `bounce.type` is reported as AMBIGUOUS rather than
 * guessed in either direction.
 */

// ─── Provider event contract ──────────────────────────────────────────────────

/**
 * The Resend events C3D subscribes to and handles. Deliberately narrow.
 *
 * Not subscribed: `email.opened` and `email.clicked` (engagement surveillance
 * this platform has no governance need for), `email.scheduled` (nothing here
 * schedules through Resend), `email.received` (inbound), `email.suppressed`
 * (Resend's own list, not MyoGuard's governance state), and every `contact.*`
 * and `domain.*` event.
 *
 * Names are taken verbatim from the installed SDK's `WebhookEvent` union
 * (resend@6.10.0) — none is invented.
 */
export const HANDLED_EVENT_TYPES = [
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.failed',
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(value: unknown): value is HandledEventType {
  return typeof value === 'string'
    && (HANDLED_EVENT_TYPES as readonly string[]).includes(value);
}

// ─── Lifecycle states ─────────────────────────────────────────────────────────

/** Mirrors the Prisma `CommunicationState` enum. */
export type LifecycleState =
  | 'REQUESTED'
  | 'SUPPRESSED'
  | 'SENT'
  | 'DELAYED'
  | 'DELIVERED'
  | 'BOUNCED_SOFT'
  | 'BOUNCED_HARD'
  | 'COMPLAINED'
  | 'FAILED';

/**
 * Monotonic precedence. A transition is applied only when the incoming state
 * ranks strictly higher than the stored one, which is what makes duplicate,
 * late and out-of-order webhook delivery safe without any per-event bookkeeping.
 *
 * Why the negative outcomes outrank DELIVERED: a spam complaint always arrives
 * after a delivery, and a bounce can follow a provider's optimistic delivery
 * signal. If DELIVERED outranked them, the more consequential fact would be
 * erased by the less consequential one that legitimately preceded it.
 *
 * Why FAILED sits between the two bounces: `email.failed` carries no bounce
 * evidence at all, so it must not displace a classified permanent failure, but
 * it is more definitive than a transient deferral. It can still be superseded
 * by a hard bounce or a complaint, both of which carry stronger evidence.
 *
 * SUPPRESSED is absent on purpose — see `nextState`.
 */
export const STATE_RANK: Readonly<Record<Exclude<LifecycleState, 'SUPPRESSED'>, number>> = {
  REQUESTED:    0,
  SENT:         1,
  DELAYED:      2,
  DELIVERED:    3,
  BOUNCED_SOFT: 4,
  FAILED:       5,
  BOUNCED_HARD: 6,
  COMPLAINED:   7,
};

// ─── Bounce classification ────────────────────────────────────────────────────

export type BounceClassification = 'HARD' | 'SOFT' | 'AMBIGUOUS';

/**
 * Resend's bounce payload is `{ message, subType, type }`. The SDK types `type`
 * as a bare `string` rather than a union, so the values below are treated as an
 * allowlist rather than an exhaustive enum: anything not recognised — including
 * the provider's own `Undetermined`, an empty string, or a value added after
 * this was written — classifies as AMBIGUOUS.
 *
 * AMBIGUOUS is a real outcome, not an error. Per Founder rule M, it must not
 * create a HARD_BOUNCE suppression and must not count toward the soft-bounce
 * threshold. Provider truth outranks our preferred taxonomy.
 *
 * `message` and `subType` are never consulted. `message` is free text, and
 * `subType` only refines a `type` we have already had to recognise.
 */
export function classifyBounce(bounce: unknown): BounceClassification {
  const raw = (bounce as { type?: unknown } | null | undefined)?.type;
  if (typeof raw !== 'string') return 'AMBIGUOUS';

  switch (raw.trim().toLowerCase()) {
    case 'permanent': return 'HARD';
    case 'transient': return 'SOFT';
    default:          return 'AMBIGUOUS';
  }
}

// ─── Event → state ────────────────────────────────────────────────────────────

/**
 * The state an event asks the record to move to, before precedence is applied.
 *
 * An ambiguous bounce maps to FAILED: something went wrong and the record must
 * say so, but nothing about the address has been established.
 */
export function targetStateFor(
  eventType: HandledEventType,
  bounce?: unknown,
): LifecycleState {
  switch (eventType) {
    case 'email.sent':             return 'SENT';
    case 'email.delivered':        return 'DELIVERED';
    case 'email.delivery_delayed': return 'DELAYED';
    case 'email.complained':       return 'COMPLAINED';
    case 'email.failed':           return 'FAILED';
    case 'email.bounced': {
      const classification = classifyBounce(bounce);
      if (classification === 'HARD') return 'BOUNCED_HARD';
      if (classification === 'SOFT') return 'BOUNCED_SOFT';
      return 'FAILED';
    }
  }
}

/**
 * Applies precedence. Returns the state to write, or null for "leave it alone".
 *
 * Null is returned for a duplicate (equal rank), for a late or out-of-order
 * event (lower rank), and for any record already in SUPPRESSED.
 *
 * SUPPRESSED is refused outright rather than ranked. It is a pre-send terminal:
 * the message was never handed to a provider, so such a row has no
 * providerMessageId and correlation can never reach it. The guard is defence in
 * depth — if one is ever reached, the governance decision not to send must not
 * be overwritten by provider chatter.
 */
export function nextState(
  current: LifecycleState,
  target: LifecycleState,
): LifecycleState | null {
  if (current === 'SUPPRESSED') return null;
  if (target === 'SUPPRESSED')  return null;

  const currentRank = STATE_RANK[current];
  const targetRank  = STATE_RANK[target];

  if (currentRank === undefined || targetRank === undefined) return null;
  return targetRank > currentRank ? target : null;
}

// ─── Soft-bounce threshold ────────────────────────────────────────────────────

/**
 * Founder-authorised interim deliverability policy (C3D §M): three correlated
 * soft bounces for the same recipient and channel inside a rolling 30 days.
 *
 * An operational deliverability rule, not a clinical or legal determination.
 * C2 deliberately left this unset and C3B declined to invent it; these are the
 * numbers the Founder authorised, and they are named here rather than inlined
 * so the policy is visible in one place.
 */
export const SOFT_BOUNCE_THRESHOLD    = 3;
export const SOFT_BOUNCE_WINDOW_DAYS  = 30;

export function softBounceWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - SOFT_BOUNCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
