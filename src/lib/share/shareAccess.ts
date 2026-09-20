/**
 * src/lib/share/shareAccess.ts
 *
 * The single place a share token becomes patient data.
 *
 * WHY THIS MODULE EXISTS
 * The token is resolved at five call sites, only one of which is the report
 * page: the public report, the physician preview, the accept-patient linkage
 * write, and the two physician-registration paths. Before Phase 1D-R1 each one
 * called `prisma.shareCard.findUnique` directly, so "has this link expired?"
 * was a rule five files would each have had to remember — and a sixth consumer
 * would have inherited nothing.
 *
 * Routing every site through `resolveActiveShareCard` makes enforcement
 * structural rather than remembered. A new consumer that wants a ShareCard has
 * to come through here, and arrives with expiry and revocation already applied.
 *
 * WHAT "ACTIVE" MEANS
 *   revokedAt == null  AND  (expiresAt == null OR expiresAt > now)
 *
 * The null-expiry branch is the legacy transition, not a loophole: rows created
 * before this phase have no expiry until the backfill stamps them. Treating
 * null as active keeps enforcement and backfill independent, so a partial or
 * failed backfill degrades to the previous behaviour instead of locking every
 * patient out of their own link.
 *
 * WHAT THIS MODULE DOES NOT DO
 * It does not decide what a caller may then read. Scope is each caller's
 * business — the physician preview takes far less than the report page. This
 * answers one question: may this bearer credential be honoured at all?
 */

import { prisma } from '@/src/lib/prisma';
import { isShareCardActive } from './sharePolicy';

// The rules live in `sharePolicy` (no I/O, directly testable). Re-exported here
// so every consumer has one import for share access and cannot end up holding
// the resolver without the predicate it depends on.
export {
  isShareCardActive,
  mintShareToken,
  selectActiveShareCard,
  shareExpiryFrom,
  type ShareLifetime,
} from './sharePolicy';

/**
 * Why a resolution failed.
 *
 * Callers MUST NOT vary their response by reason. It is returned for server
 * logging and for choosing whether to record an event — never for the body,
 * the status code or the timing of what the holder of the token sees. See
 * `SHARE_UNAVAILABLE_*` below.
 */
export type ShareAccessFailure = 'unknown' | 'expired' | 'revoked';

export type ShareAccessResult =
  | { ok: true;  card: ActiveShareCard }
  | { ok: false; reason: ShareAccessFailure };

export interface ActiveShareCard {
  id:        string;
  userId:    string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

// ── The single failure surface ───────────────────────────────────────────────
//
// Unknown, expired and revoked are answered identically. Distinguishing them
// would turn the public report route into an oracle: a caller probing tokens
// could tell "no such link" from "that link existed and has lapsed", which
// confirms a patient record behind a guessed value. That mattered more than
// usual while legacy tokens were `cuid()` — a collision-resistant identifier,
// not a secret — and it still matters for the ones now in transition.
//
// The message is written for the clinician who followed a dead link, and tells
// them what to do without confirming that anything was ever there.
export const SHARE_UNAVAILABLE_TITLE = 'This link is no longer available';
export const SHARE_UNAVAILABLE_BODY =
  'If a patient sent you this link, please ask them to share a new one.';

/**
 * Resolves a share token to a card, or to the reason it may not be honoured.
 *
 * Every token consumer calls this. None of them should call
 * `prisma.shareCard.findUnique` directly again.
 */
export async function resolveActiveShareCard(
  token: string | null | undefined,
  now: Date = new Date(),
): Promise<ShareAccessResult> {
  if (!token) return { ok: false, reason: 'unknown' };

  const card = await prisma.shareCard.findUnique({
    where:  { shareToken: token },
    select: { id: true, userId: true, createdAt: true, expiresAt: true, revokedAt: true },
  });

  if (!card) return { ok: false, reason: 'unknown' };
  if (card.revokedAt !== null) return { ok: false, reason: 'revoked' };
  if (!isShareCardActive(card, now)) return { ok: false, reason: 'expired' };

  return { ok: true, card };
}

// ── Evidence of the patient's share action ───────────────────────────────────
//
// Narrowly scoped, and deliberately an EVENT rather than a consent record.
//
// What it asserts: at this moment, this authenticated patient deliberately
// generated (or revoked) a share link, with the notice text at this version in
// front of them. What it does not assert: any standing permission. It grants
// no physician access, authorises no future sharing, and is not a consent
// primitive for anything else to build on. The broader patient-physician
// authorisation doctrine is a separate, still-open workstream and this must
// not be mistaken for it.
//
// It reuses AuditLog rather than introducing a consent table, which would be
// the first brick of exactly the general-purpose consent architecture this
// phase was told not to build.

export const SHARE_AUDIT_TARGET = 'ShareCard';
export const SHARE_AUDIT_CREATED = 'SHARE_LINK_CREATED';
export const SHARE_AUDIT_REVOKED = 'SHARE_LINK_REVOKED';

interface ShareAuthorizationInput {
  action:         typeof SHARE_AUDIT_CREATED | typeof SHARE_AUDIT_REVOKED;
  /** The acting patient's internal User.id. Never a Clerk id. */
  actorUserId:    string;
  shareCardId:    string;
  /** Version of the notice the patient was shown. Null when revoking. */
  noticeVersion?: string | null;
}

/**
 * Records the share action.
 *
 * The token itself is never written here. It is a bearer credential, and an
 * audit table is a far broader read surface than the credential it would be
 * describing — the card id identifies the row without being able to open it.
 *
 * Failures are swallowed. Evidence is important, but a patient must not be
 * unable to withdraw access because an audit insert failed; the alternative
 * would make the logging a denial-of-revocation vector.
 */
export async function recordShareAuthorization(
  input: ShareAuthorizationInput,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId:    input.actorUserId,
        action:     input.action,
        targetType: SHARE_AUDIT_TARGET,
        targetId:   input.shareCardId,
        metadata:   {
          acknowledged:  input.action === SHARE_AUDIT_CREATED,
          noticeVersion: input.noticeVersion ?? null,
        },
      },
    });
  } catch (err) {
    console.error('[shareAccess] authorization event not recorded', err);
  }
}
