/**
 * src/lib/emailThrottle.ts
 *
 * Recipient-side abuse control for the two public, unauthenticated email
 * routes: /api/protocol-email and /api/email-capture.
 *
 * WHY THIS EXISTS
 * The Vercel WAF rule "Email Abuse Protection" already rate-limits these two
 * paths by source IP. That protects infrastructure and cost, but it cannot
 * protect a *recipient*: the address lives in the request body, which edge
 * rules cannot key on, and an attacker rotating IPs can still direct mail at
 * one victim. This module supplies the dimension the edge cannot.
 *
 * POLICY (Founder-set — do not change without authorisation)
 *   - one shared budget per recipient ACROSS both routes
 *   - >= 10 minutes between attempts to the same recipient
 *   - at most 3 attempts to the same recipient per rolling 24 hours
 *
 * An ATTEMPT is counted before the provider is called, so the limit governs
 * mail MyoGuard is asked to originate — not merely what was delivered.
 *
 * PRIVACY
 * Nothing identifying is persisted. The stored key is
 * HMAC-SHA256(normalised address) under a server-only secret, so the table
 * cannot be reversed into an address list, and — unlike a plain hash — cannot
 * be dictionary-attacked offline without the secret. No plaintext address, no
 * name, no IP, no user id and no clinical value is written.
 *
 * FAIL CLOSED
 * If the secret is absent or the store cannot be consulted, callers must NOT
 * send. Protecting the clinical sending domain outranks delivering during an
 * outage.
 */

import { createHmac } from 'crypto';

// Prisma is imported lazily inside the enforcement functions rather than at
// module scope. Importing it here would construct a PrismaClient (and its pg
// Pool) merely by importing this module, and would make the pure identifier
// logic below untestable without a live database. The repository already uses
// this deferred-import pattern elsewhere.

// ─── Policy constants ─────────────────────────────────────────────────────────

/** Minimum gap between attempts to the same recipient. */
export const COOLDOWN_MINUTES = 10;

/** Maximum attempts to the same recipient within the rolling window. */
export const MAX_ATTEMPTS_PER_WINDOW = 3;

/**
 * Rolling ceiling window, and the retention target for these rows. Actual
 * retention is this window plus the gap until the next request sweeps — see
 * `sweepExpired`. There is no scheduled job by design.
 */
export const WINDOW_HOURS = 24;

/** Name of the required server secret. Never read into logs or responses. */
export const THROTTLE_SECRET_ENV = 'EMAIL_THROTTLE_SECRET';

/**
 * Upper bound on rows removed by one housekeeping sweep.
 *
 * The sweep runs on every request that reached the store, so the delete must
 * be capped: an uncapped `DELETE ... WHERE createdAt < x` would put an
 * unbounded amount of work on a user-facing request during a backlog. Since
 * each allowed request writes at most one row and each sweep removes up to
 * this many, expired rows drain far faster than they form.
 */
const SWEEP_BATCH_SIZE = 200;

/** Guard so a contended advisory lock cannot hang the request. */
const TRANSACTION_TIMEOUT_MS = 5_000;

// ─── Result type ──────────────────────────────────────────────────────────────

/**
 * `throttled` and `unavailable` are deliberately distinct: the first is a
 * policy decision (429), the second is the fail-closed path (503). Neither
 * discloses which limit was hit or anything about the recipient's history.
 */
export type ThrottleResult =
  | { outcome: 'allowed' }
  | { outcome: 'throttled' }
  | { outcome: 'unavailable' };

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Trim and lowercase only.
 *
 * Provider-specific canonicalisation (Gmail dot/+tag folding) is deliberately
 * NOT performed: it would silently merge addresses the user considers
 * distinct, and that is a product decision rather than a security one.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─── Recipient key ────────────────────────────────────────────────────────────

/**
 * Returns the HMAC recipient key, or null when the secret is not configured.
 * Null is the fail-closed signal — never fall back to an unkeyed hash, which
 * would be trivially reversible for an address space this guessable.
 */
export function recipientKeyFor(email: string): string | null {
  const secret = process.env[THROTTLE_SECRET_ENV];
  if (!secret) return null;

  return createHmac('sha256', secret).update(normaliseEmail(email)).digest('hex');
}

/**
 * Derives the Postgres advisory-lock id from the recipient key.
 *
 * 60 bits taken from the HMAC — always positive and always inside int8. A
 * collision between two different recipients would only make them serialise
 * against each other briefly; it cannot produce a wrong allow/deny decision,
 * because every predicate below still filters on the full recipientKey.
 */
function advisoryLockId(recipientKey: string): bigint {
  return BigInt('0x' + recipientKey.slice(0, 15));
}

// ─── Policy decision ──────────────────────────────────────────────────────────

/**
 * The policy itself, isolated from storage so it can be exercised directly.
 *
 * Given what the store observed for one recipient, may another attempt proceed?
 */
export function decideFromState(state: {
  /** An attempt exists newer than the cooldown boundary. */
  hasAttemptWithinCooldown: boolean;
  /** Attempts recorded inside the rolling ceiling window. */
  attemptsWithinWindow: number;
}): boolean {
  if (state.hasAttemptWithinCooldown) return false;
  if (state.attemptsWithinWindow >= MAX_ATTEMPTS_PER_WINDOW) return false;
  return true;
}

// ─── Enforcement ──────────────────────────────────────────────────────────────

/**
 * Records an attempt for `email` if policy allows, and reports the decision.
 *
 * CONCURRENCY
 * The decision is a read-then-write, so it is wrapped in a transaction that
 * first takes `pg_advisory_xact_lock` on the recipient's derived id. Parallel
 * requests for the same recipient serialise on that lock and therefore cannot
 * all observe the pre-write state; requests for different recipients take
 * different lock ids and never contend.
 *
 * The lock is transaction-scoped by design. Prisma's interactive transaction
 * holds a single pooled connection for its duration, and Postgres releases an
 * xact lock at COMMIT or ROLLBACK, so it cannot outlive the request under
 * either of Supabase's pooling modes — session (5432) or transaction (6543).
 * A session-scoped `pg_advisory_lock` would survive the request and leak onto
 * whichever caller next reuses that pooled connection; it must not be
 * substituted here.
 */
export async function consumeRecipientBudget(email: string): Promise<ThrottleResult> {
  const recipientKey = recipientKeyFor(email);

  // Secret missing → fail closed. No send, no silent downgrade.
  if (!recipientKey) {
    console.error(
      `[emailThrottle] ${THROTTLE_SECRET_ENV} is not set — refusing to send.`,
    );
    return { outcome: 'unavailable' };
  }

  const now          = Date.now();
  const cooldownFrom = new Date(now - COOLDOWN_MINUTES * 60_000);
  const windowFrom   = new Date(now - WINDOW_HOURS * 3_600_000);

  let allowed: boolean;

  try {
    const { prisma } = await import('@/src/lib/prisma');

    allowed = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockId(recipientKey)}::bigint)`;

        // Purge this recipient's expired rows while holding the lock. Cheap,
        // index-covered, and bounded — it keeps a returning recipient's own
        // history from lingering past the enforcement window.
        await tx.emailSendAttempt.deleteMany({
          where: { recipientKey, createdAt: { lt: windowFrom } },
        });

        const withinCooldown = await tx.emailSendAttempt.findFirst({
          where:  { recipientKey, createdAt: { gt: cooldownFrom } },
          select: { id: true },
        });

        const attemptsWithinWindow = await tx.emailSendAttempt.count({
          where: { recipientKey, createdAt: { gt: windowFrom } },
        });

        const permitted = decideFromState({
          hasAttemptWithinCooldown: withinCooldown !== null,
          attemptsWithinWindow,
        });
        if (!permitted) return false;

        // Counted before the caller contacts the provider.
        await tx.emailSendAttempt.create({ data: { recipientKey } });
        return true;
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  } catch (err) {
    // Store unreachable, lock contention timeout, migration not yet applied —
    // all fail closed. The recipient key is never logged.
    console.error(
      '[emailThrottle] throttle store unavailable — refusing to send:',
      err instanceof Error ? err.message : String(err),
    );
    return { outcome: 'unavailable' };
  }

  // Housekeeping runs on both decisions: each reached the store successfully,
  // and throttled traffic is exactly when the table is growing fastest. It is
  // deliberately outside the transaction above so that it neither extends the
  // advisory-lock hold nor lets a housekeeping failure roll back the recorded
  // attempt.
  await sweepExpired(windowFrom);

  return allowed ? { outcome: 'allowed' } : { outcome: 'throttled' };
}

/**
 * Deterministic, bounded removal of rows past the enforcement window.
 *
 * WHY NOT PROBABILISTIC
 * An earlier revision swept globally on a random 2% of requests. That is
 * cheap on average but gives no guarantee on any individual request, and the
 * one time it fires it may face an arbitrarily large backlog. Running a
 * capped delete every time is both predictable and strictly bounded.
 *
 * WHY IT KEEPS UP
 * A request adds at most one row and removes up to SWEEP_BATCH_SIZE, so the
 * table cannot grow without bound while traffic continues. The in-transaction
 * purge above only reaches recipients who return; this reaches everyone else.
 *
 * WHY THE SUBQUERY
 * Prisma's `deleteMany` cannot express a LIMIT, so the cap needs raw SQL.
 * `FOR UPDATE SKIP LOCKED` means two concurrent sweeps claim disjoint rows
 * instead of blocking on each other — no request waits on another's cleanup.
 *
 * Never throws: a housekeeping miss must not fail a request whose throttle
 * decision already succeeded. Returns the number of rows removed, which the
 * integration test asserts against.
 */
async function sweepExpired(windowFrom: Date): Promise<number> {
  try {
    const { prisma } = await import('@/src/lib/prisma');

    return await prisma.$executeRaw`
      DELETE FROM "EmailSendAttempt"
      WHERE "id" IN (
        SELECT "id" FROM "EmailSendAttempt"
        WHERE "createdAt" < ${windowFrom}
        ORDER BY "createdAt" ASC
        LIMIT ${SWEEP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
    `;
  } catch (err) {
    console.error(
      '[emailThrottle] expired-row sweep failed (non-fatal):',
      err instanceof Error ? err.message : String(err),
    );
    return 0;
  }
}
