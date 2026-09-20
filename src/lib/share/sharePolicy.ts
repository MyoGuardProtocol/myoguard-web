/**
 * src/lib/share/sharePolicy.ts
 *
 * The share-link rules, with no I/O.
 *
 * Split out from `shareAccess.ts` deliberately: that module reaches the
 * database, so importing it requires a live DATABASE_URL and the rules could
 * only ever be asserted by reading the source. Here they are ordinary
 * functions, so the suite exercises the real predicate — expiry boundaries,
 * revocation precedence, token entropy — rather than a regex that believes the
 * code says what it means.
 */

import { randomBytes } from 'node:crypto';
import { SHARE_LINK_TTL_DAYS } from './shareNotice';

export interface ShareLifetime {
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/**
 * May this link still be honoured?
 *
 *   revokedAt == null  AND  (expiresAt == null OR expiresAt > now)
 *
 * Revocation is checked first and is absolute: a revoked link is dead whatever
 * its expiry says.
 *
 * The null-expiry branch is the legacy transition, not a loophole. Rows created
 * before Phase 1D-R1 carry no expiry until the backfill stamps them, and
 * treating null as active keeps enforcement independent of that backfill — a
 * partial or failed backfill degrades to the previous behaviour rather than
 * locking patients out of their own links.
 */
export function isShareCardActive(card: ShareLifetime, now: Date = new Date()): boolean {
  if (card.revokedAt !== null) return false;
  if (card.expiresAt === null) return true;
  return card.expiresAt.getTime() > now.getTime();
}

/**
 * Mints a share credential.
 *
 * 32 bytes from the CSPRNG, base64url so it is URL- and QR-safe. The previous
 * `@default(cuid())` produced a sortable identifier with a predictable
 * timestamp prefix and a small random block — adequate as a primary key,
 * inadequate as the sole credential guarding an identifiable clinical record.
 * The schema no longer carries a default, so a future create site cannot
 * silently fall back to the weaker form.
 */
export function mintShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Absolute expiry for a newly minted link. Never recomputed on access. */
export function shareExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
}
