/**
 * src/lib/communications/recipientVerification.ts
 *
 * Authoritative verification of a CLINICAL_CONTINUITY recipient's email address.
 *
 * WHY THIS EXISTS
 * Phase 1D-C3B passed `User.isVerified` as the verification signal. Phase
 * 1D-C3B.1's audit reconfirmed what C3B reported: that column is written in
 * five places, every one of them alongside `role: PHYSICIAN`, and it is true
 * for six PHYSICIAN rows and nothing else. It is a physician credential
 * approval flag. It has never meant "this email address was verified", and no
 * patient can satisfy it.
 *
 * The authoritative source is Clerk's verified PRIMARY email address, which is
 * the same concept `onboardingIdentity.resolveVerifiedPrimaryEmail` already
 * resolves for physician identity. That function and `verifiedEmailMatchesBody`
 * are REUSED here rather than reimplemented — Clerk verification logic must
 * exist in exactly one place, or the two copies will drift.
 *
 * WHAT "VERIFIED" MEANS HERE
 * Not "the account has some verified address somewhere". The verified PRIMARY
 * address must be the address we are about to send to. An account whose primary
 * is unverified, or whose verified primary is a different address from the
 * destination, is NOT verified for that destination — otherwise clinical mail
 * could be sent to an unproven address on the strength of a proven one.
 *
 * Fails closed on every ambiguity.
 */

import {
  resolveVerifiedPrimaryEmail,
  verifiedEmailMatchesBody,
  type ClerkUserLike,
} from '@/src/lib/onboardingIdentity';

/**
 * Bounded governance reason codes. These are the only values that reach
 * CommunicationEvent.policyReason from this module. Finer Clerk detail stays in
 * logs: the stored vocabulary must be small enough to reason about, and must
 * never carry an address or a provider error body.
 */
export type VerificationFailureCode =
  | 'recipient_identity_unavailable'
  | 'recipient_not_verified';

export type RecipientVerification =
  | { verified: true }
  | { verified: false; code: VerificationFailureCode; detail: string };

/**
 * Is the destination address a Clerk-verified primary email belonging to this
 * identity?
 *
 * `identity_unavailable` is kept distinct from `not_verified` because the two
 * mean different things operationally: the first is an outage or a missing
 * identity that may resolve on the next run, the second is a real statement
 * about the recipient. Both suppress.
 */
export async function verifyRecipientEmail(args: {
  clerkUserId:      string | null | undefined;
  destinationEmail: string;
}): Promise<RecipientVerification> {
  const { clerkUserId, destinationEmail } = args;

  if (!clerkUserId) {
    return {
      verified: false,
      code:     'recipient_identity_unavailable',
      detail:   'no_clerk_user_id',
    };
  }

  let clerkUser: ClerkUserLike;

  try {
    // Dynamic import, matching the pattern already used in
    // app/api/assessment/save/route.ts — keeps the Clerk backend SDK out of the
    // module graph of anything that merely imports the governance layer.
    const { clerkClient } = await import('@clerk/nextjs/server');
    const client = await clerkClient();
    clerkUser = (await client.users.getUser(clerkUserId)) as unknown as ClerkUserLike;
  } catch (err) {
    // Clerk unreachable, identity deleted, key invalid — all fail closed.
    // Neither the address nor the Clerk id is logged.
    console.error(
      '[comms/verification] Clerk identity lookup failed — treating as unverified:',
      err instanceof Error ? err.message : String(err),
    );
    return {
      verified: false,
      code:     'recipient_identity_unavailable',
      detail:   'clerk_lookup_failed',
    };
  }

  // Reused verbatim from the physician identity path: resolves by
  // primaryEmailAddressId rather than emailAddresses[0], and requires
  // verification.status === 'verified'.
  const primary = resolveVerifiedPrimaryEmail(clerkUser);

  if (!primary.ok) {
    return { verified: false, code: 'recipient_not_verified', detail: primary.reason };
  }

  // The verified primary must BE the destination. Both sides are normalised by
  // the shared helper, so casing and stray whitespace are not a mismatch.
  if (!verifiedEmailMatchesBody(destinationEmail, primary.email)) {
    return { verified: false, code: 'recipient_not_verified', detail: 'primary_mismatch' };
  }

  return { verified: true };
}
