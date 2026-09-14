/**
 * src/lib/onboardingIdentity.ts
 *
 * Identity-binding and ownership decisions for POST /api/doctor/onboarding.
 *
 * WHY THIS EXISTS
 * Phase 1D-S3A found that the onboarding route called auth() but never
 * enforced the result, and treated the caller-supplied body email as the
 * authoritative identity. That made it possible, unauthenticated, to create
 * or overwrite any PhysicianApplication by email and to trigger MyoGuard
 * email to an arbitrary recipient.
 *
 * The pure decisions are isolated here — separate from Prisma, Clerk and
 * Resend — so each one can be exercised directly without a database, a
 * session or a mail provider. The route composes them; it does not restate
 * them. Same split as `decideFromState` in `emailThrottle.ts`.
 */

import { z } from 'zod';

/**
 * Trim + lowercase — deliberately the same rule `emailThrottle.normaliseEmail`
 * applies, and deliberately NOT imported from it. This module is pure identity
 * logic and stays free of the abuse-control module so it can be exercised
 * without pulling the throttle (and its Prisma-backed enforcement) into scope.
 *
 * The two are safe to hold independently because the route hands this module's
 * already-normalised output to the throttle, and the throttle normalises again
 * idempotently. No provider-specific canonicalisation in either.
 */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─── Request contract ─────────────────────────────────────────────────────────

/**
 * Length ceilings are generous enough for real credentials and names
 * (including non-Latin scripts and long institutional specialties) while
 * still bounding what reaches the database and the email templates.
 *
 * `email` remains part of the contract because both existing callers send it,
 * but it is NOT the identity — see `verifiedEmailMatchesBody`. It is accepted
 * only so it can be checked against the Clerk-verified address and rejected
 * on mismatch.
 */
export const OnboardingSchema = z.object({
  fullName:      z.string().trim().min(2, 'Full name required').max(120),
  email:         z.string().trim().email('Valid email required').max(254),
  country:       z.string().trim().min(1, 'Country required').max(80),
  specialty:     z.string().trim().min(1, 'Specialty required').max(120),
  npiNumber:     z.string().trim().max(20).optional(),
  licenseNumber: z.string().trim().max(60).optional(),
  inviteToken:   z.string().trim().max(200).optional(),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;

// ─── Verified primary email ───────────────────────────────────────────────────

/**
 * Minimal structural shapes matching Clerk's backend `User` / `EmailAddress`.
 * Declared structurally rather than importing Clerk's classes so this module
 * stays testable without constructing Clerk resources.
 */
export type ClerkEmailLike = {
  id:           string;
  emailAddress: string;
  verification: { status: string } | null;
};

export type ClerkUserLike = {
  primaryEmailAddressId: string | null;
  emailAddresses:        ClerkEmailLike[];
};

export type PrimaryEmailResult =
  | { ok: true;  email: string }
  | { ok: false; reason: 'no_primary_designated' | 'primary_not_found' | 'primary_not_verified' };

/**
 * Resolves the caller's Clerk-verified PRIMARY email address.
 *
 * Deliberately resolves by `primaryEmailAddressId` rather than taking
 * `emailAddresses[0]`. The array is every address on the account — including
 * unverified ones — and its order is not a contract. Index 0 happens to be
 * the right answer under the current Clerk configuration; this asks the
 * question the application actually means.
 *
 * Fails closed on every ambiguity: no primary designated, primary missing
 * from the array, or primary not in `verified` state.
 */
export function resolveVerifiedPrimaryEmail(user: ClerkUserLike | null): PrimaryEmailResult {
  if (!user?.primaryEmailAddressId) return { ok: false, reason: 'no_primary_designated' };

  const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
  if (!primary) return { ok: false, reason: 'primary_not_found' };

  if (primary.verification?.status !== 'verified') {
    return { ok: false, reason: 'primary_not_verified' };
  }

  return { ok: true, email: normaliseEmail(primary.emailAddress) };
}

/**
 * Does the caller-supplied body email name the same address as the verified
 * primary? Both sides are normalised (trim + lowercase) using the same helper
 * the throttle uses, so casing and stray whitespace are not treated as an
 * identity mismatch.
 *
 * A mismatch means the caller is asserting an identity that is not theirs, so
 * the route refuses rather than quietly preferring one side.
 */
export function verifiedEmailMatchesBody(bodyEmail: string, verifiedEmail: string): boolean {
  return normaliseEmail(bodyEmail) === normaliseEmail(verifiedEmail);
}

// ─── Role transition ──────────────────────────────────────────────────────────

export const ONBOARDING_ROLE = 'PHYSICIAN_PENDING' as const;

/**
 * Narrow literal union rather than `string`, so the value stays assignable to
 * Prisma's generated `Role` enum without a cast at the call site.
 */
export type OnboardingRole = 'ADMIN' | 'PHYSICIAN' | 'PHYSICIAN_PENDING';

/**
 * Which role should the caller's own User row hold after onboarding?
 *
 * Submitting this form must never cost someone standing they already have:
 * an approved PHYSICIAN or an ADMIN who revisits onboarding keeps their role.
 *
 * PATIENT → PHYSICIAN_PENDING is PRESERVED as the pre-existing workflow
 * (a patient-role account completing physician onboarding). It is reported
 * rather than silently changed — narrowing it is a role-policy decision, not
 * containment, and is out of scope for this phase.
 */
export function decideRoleTransition(existingRole: string | null): OnboardingRole {
  if (existingRole === 'ADMIN')     return 'ADMIN';
  if (existingRole === 'PHYSICIAN') return 'PHYSICIAN';
  return ONBOARDING_ROLE; // null (new row), PATIENT, or already PHYSICIAN_PENDING
}

// ─── PhysicianApplication ownership ───────────────────────────────────────────

export type OwnershipDecision =
  | { allowed: true;  kind: 'create' | 'update' | 'claim' }
  | { allowed: false; reason: 'owned_by_another_identity' };

/**
 * May this caller write the application row for their verified email?
 *
 *   no existing row                    → create
 *   existing row, same clerkUserId     → update  (the caller's own)
 *   existing row, clerkUserId === null → claim   (unclaimed; legacy rows only)
 *   existing row, different clerkUserId→ REFUSE
 *
 * The refusal is what stops one identity overwriting another's application —
 * resetting its status, replacing its credentials, or regenerating the admin
 * review token. Because the email is now the Clerk-verified primary, reaching
 * the `claim` branch means the caller genuinely owns that address.
 */
export function decideApplicationOwnership(args: {
  existing:      { clerkUserId: string | null } | null;
  callerClerkId: string;
}): OwnershipDecision {
  const { existing, callerClerkId } = args;

  if (!existing) return { allowed: true, kind: 'create' };

  if (existing.clerkUserId === null)          return { allowed: true, kind: 'claim' };
  if (existing.clerkUserId === callerClerkId) return { allowed: true, kind: 'update' };

  return { allowed: false, reason: 'owned_by_another_identity' };
}

// ─── Application status + admin token ─────────────────────────────────────────

export const DEFAULT_APPLICATION_STATUS = 'PENDING';

/**
 * Resubmitting onboarding must not re-open a decision an admin already made.
 *
 * Any existing status is preserved: APPROVED stays APPROVED (the previous
 * behaviour reset it to PENDING on every resubmission), and FLAGGED stays
 * FLAGGED so a flag cannot be cleared by simply submitting the form again.
 * Only a genuinely new application starts at PENDING.
 *
 * No re-review rule is invented here — there is none in the product today.
 */
export function decideApplicationStatus(existingStatus: string | null): string {
  return existingStatus ?? DEFAULT_APPLICATION_STATUS;
}

/**
 * The admin review token should only be minted or refreshed when a review is
 * genuinely outstanding. Refreshing it on an APPROVED or FLAGGED row would
 * invalidate nothing useful and would hand out a live approval link for an
 * application that is no longer awaiting a decision.
 */
export function shouldRefreshAdminToken(existingStatus: string | null): boolean {
  return existingStatus === null || existingStatus === DEFAULT_APPLICATION_STATUS;
}
