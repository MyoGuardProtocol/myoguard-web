/**
 * src/lib/communications/identity.ts
 *
 * Pseudonymous recipient identity for the communications governance layer.
 *
 * WHY THIS EXISTS
 * Suppression must work for addresses MyoGuard holds no other record of — an
 * address that only ever received a one-shot protocol email has no
 * CommunicationRecipient row, but a hard bounce or an unsubscribe on it must
 * still stop future sending. Keying governance on an HMAC of the address gives
 * that property without creating a plaintext list of everyone who ever used the
 * tool.
 *
 * DELIBERATELY NOT COUPLED TO emailThrottle
 * The construction is the same as `emailThrottle.recipientKeyFor()` and the
 * style is copied from it on purpose, but the SECRET is separate and must stay
 * separate. EmailSendAttempt rows are swept on a 24-hour window and that
 * secret may be rotated on the assumption that nothing durable depends on it.
 * This keyspace is permanent: a rotation here would orphan every suppression
 * record, silently, with no error raised. Sharing key material would couple a
 * routine operational action to a governance failure.
 *
 * Pure module — no Prisma, no provider, no network. Exercisable directly.
 */

import { createHmac } from 'node:crypto';

/** Name of the required server secret. The value is never logged or returned. */
export const COMMS_IDENTITY_SECRET_ENV = 'COMMS_IDENTITY_SECRET';

/**
 * Minimum accepted secret length.
 *
 * A placeholder or truncated value is worse than an absent one: it would
 * produce stable-looking keys under weak material, so suppression records
 * written under it could not be trusted. Rejecting it routes to the same
 * fail-closed path as a missing secret. This is a key-strength floor, not a
 * product threshold.
 */
export const MIN_SECRET_LENGTH = 32;

/**
 * Current key generation. Written onto every row this layer creates so the
 * secret can later be rotated without orphaning existing records — a rotation
 * would introduce version 2 and retain version 1 for matching.
 *
 * C3B implements version 1 only. No rotation machinery beyond recording the
 * version is in scope.
 */
export const CURRENT_KEY_VERSION = 1;

/**
 * Trim and lowercase only — the same rule `emailThrottle.normaliseEmail` and
 * `onboardingIdentity.normaliseEmail` apply, so the three agree on what counts
 * as the same address.
 *
 * Provider-specific canonicalisation (Gmail dot / +tag folding) is deliberately
 * NOT performed: it would merge addresses the recipient considers distinct, and
 * silently applying one person's unsubscribe to another's address is a worse
 * failure than treating two of their addresses separately.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type RecipientIdentity = {
  recipientKey: string;
  keyVersion:   number;
};

/**
 * Derives the pseudonymous recipient identity, or null when the secret is
 * absent or too weak to trust.
 *
 * Null is the fail-closed signal. Callers must NOT send when it is returned.
 * There is deliberately no fallback: not a plaintext key, not an unkeyed hash
 * (trivially reversible for an address space this guessable), not the throttle
 * secret, and not a random value — a random key would silently create a new
 * identity on every call and match no suppression record at all.
 */
export function deriveRecipientIdentity(email: string): RecipientIdentity | null {
  const secret = process.env[COMMS_IDENTITY_SECRET_ENV];

  if (!secret || secret.trim().length < MIN_SECRET_LENGTH) return null;

  return {
    recipientKey: createHmac('sha256', secret).update(normaliseEmail(email)).digest('hex'),
    keyVersion:   CURRENT_KEY_VERSION,
  };
}
