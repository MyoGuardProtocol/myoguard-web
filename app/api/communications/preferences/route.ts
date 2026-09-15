/**
 * POST /api/communications/preferences
 *
 * Authenticated communication preference changes for the CALLER only.
 *
 * Identity comes from the Clerk session, never from the request body. The body
 * carries the intent (subscribe / unsubscribe) and the programme — never who
 * the change applies to. There is therefore no parameter a client could alter
 * to reach another person's preferences.
 *
 * Subscribing additionally requires a Clerk-verified primary email that matches
 * the stored address, under the same authoritative semantics Phase 1D-C3B.1
 * established for sending. Unsubscribing deliberately does NOT require that:
 * being unable to prove an address must never trap someone into receiving mail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';
import { deriveRecipientIdentity } from '@/src/lib/communications/identity';
import { verifyRecipientEmail } from '@/src/lib/communications/recipientVerification';
import { grantConsent, withdrawConsent } from '@/src/lib/communications/preferenceService';
import { resolveCurrentWordingId, CLINICAL_CONTINUITY_SURFACE } from '@/src/lib/communications/consentWording';
import { isOptionalClass } from '@/src/lib/communications/unsubscribeToken';

export const dynamic = 'force-dynamic';

/**
 * Programmes this surface may change. CLINICAL_CONTINUITY only: EDUCATIONAL and
 * MARKETING have no sender, and offering a control for a programme that does
 * not run would be a misleading promise of its own.
 */
const SETTABLE_CLASSES = ['CLINICAL_CONTINUITY'] as const;

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, programme } = (body ?? {}) as { action?: unknown; programme?: unknown };

  if (action !== 'subscribe' && action !== 'unsubscribe') {
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 422 });
  }
  if (typeof programme !== 'string' ||
      !(SETTABLE_CLASSES as readonly string[]).includes(programme) ||
      !isOptionalClass(programme)) {
    return NextResponse.json({ ok: false, error: 'Unknown programme' }, { status: 422 });
  }

  // The caller's own record, resolved from the session. Never from the body.
  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: 'No account record found' }, { status: 404 });
  }

  const identity = deriveRecipientIdentity(user.email);
  if (!identity) {
    console.error('[comms/preferences] identity secret unavailable — refusing');
    return NextResponse.json(
      { ok: false, error: 'Temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  if (action === 'unsubscribe') {
    const result = await withdrawConsent({
      recipientKey:  identity.recipientKey,
      keyVersion:    identity.keyVersion,
      channel:       'EMAIL',
      classes:       [programme],
      sourceSurface: 'settings_page',
      actorType:     'SELF',
      actorId:       user.id,
    });
    return result.ok
      ? NextResponse.json({ ok: true, state: 'UNSUBSCRIBED' })
      : NextResponse.json(
          { ok: false, error: 'Temporarily unavailable. Please try again shortly.' },
          { status: 503 },
        );
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────
  //
  // Verified identity is required. Authorising recurring clinical mail to an
  // address nobody has proven belongs to this person would reintroduce exactly
  // the defect C3B.1 closed.
  const verification = await verifyRecipientEmail({
    clerkUserId:      clerkId,
    destinationEmail: user.email,
  });

  if (!verification.verified) {
    console.log(`[comms/preferences] subscribe refused code=${verification.code}`);
    return NextResponse.json(
      { ok: false, error: 'unverified', code: verification.code },
      { status: 409 },
    );
  }

  // Evidence must be attributable. An unattributable GRANT is worse than a
  // failed one, so no wording id means no consent recorded.
  const wordingId = await resolveCurrentWordingId();
  if (!wordingId) {
    return NextResponse.json(
      { ok: false, error: 'Temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }

  const result = await grantConsent({
    recipientKey:       identity.recipientKey,
    keyVersion:         identity.keyVersion,
    email:              user.email,
    userId:             user.id,
    channel:            'EMAIL',
    communicationClass: programme,
    sourceSurface:      CLINICAL_CONTINUITY_SURFACE,
    wordingId,
    actorType:          'SELF',
    actorId:            user.id,
  });

  return result.ok
    ? NextResponse.json({ ok: true, state: 'SUBSCRIBED' })
    : NextResponse.json(
        { ok: false, error: 'Temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
}
