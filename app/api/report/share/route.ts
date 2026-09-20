import { NextResponse }  from 'next/server';
import { auth }          from '@clerk/nextjs/server';
import { prisma }        from '@/src/lib/prisma';
import {
  SHARE_AUDIT_CREATED,
  SHARE_AUDIT_REVOKED,
  mintShareToken,
  recordShareAuthorization,
  selectActiveShareCard,
  shareExpiryFrom,
} from '@/src/lib/share/shareAccess';
import { SHARE_NOTICE_VERSION } from '@/src/lib/share/shareNotice';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

/**
 * POST /api/report/share
 *
 * Issues the patient's share link.
 *
 * WHAT CHANGED IN 1D-R1, AND WHY
 * This route used to return the oldest ShareCard forever — "one stable share
 * link per user", permanent by design. A link that cannot lapse and cannot be
 * withdrawn is not something a patient controls, so the rule is now: reuse the
 * link while it is ACTIVE, and mint a fresh one once it has expired or been
 * revoked. Rotation is not a separate feature; it falls out of expiry.
 *
 * Reuse is still the common case, so a physician's bookmark keeps working for
 * the life of the link rather than changing under them on every visit.
 *
 * WHY ISSUANCE REQUIRES AN ACKNOWLEDGEMENT
 * Generating this link hands an unauthenticated reader a clinical record, so
 * the act has to be the patient's own and has to be evidenced. The client sends
 * `acknowledged: true` only after the patient has ticked the notice, and the
 * server records the act against the notice version they were shown.
 *
 * The acknowledgement is evidence of THIS action and nothing more. It grants no
 * physician any standing permission and is not a consent primitive.
 */
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // The body is optional only so a malformed/absent one fails the check below
  // rather than throwing — it can never be treated as an acknowledgement.
  let acknowledged = false;
  try {
    const body = await req.json();
    acknowledged = (body as { acknowledged?: unknown })?.acknowledged === true;
  } catch { /* no body — acknowledged stays false */ }

  if (!acknowledged) {
    return NextResponse.json(
      { error: 'Share notice must be acknowledged' },
      { status: 422 },
    );
  }

  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: {
      id:          true,
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take:    1,
        include: { muscleScore: { select: { score: true, riskBand: true } } },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const latest   = user.assessments[0];
  const score    = latest?.muscleScore?.score    ?? 0;
  const riskBand = latest?.muscleScore?.riskBand ?? 'HIGH';

  // Oldest first, so an existing active link stays the stable one rather than
  // the newest of several. Revoked and expired rows are skipped in the filter
  // below rather than in SQL, so the active predicate has exactly one home.
  const existing = await prisma.shareCard.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select:  { id: true, shareToken: true, expiresAt: true, revokedAt: true },
  });

  const active = selectActiveShareCard(existing);

  let token:  string;
  let cardId: string;

  if (active) {
    token  = active.shareToken;
    cardId = active.id;
    // Refresh the cached snapshot so the link reflects current data.
    await prisma.shareCard.update({
      where: { id: active.id },
      data:  { score, riskBand },
    });
  } else {
    const card = await prisma.shareCard.create({
      data: {
        userId:     user.id,
        score,
        riskBand,
        shareToken: mintShareToken(),
        expiresAt:  shareExpiryFrom(),
      },
      select: { id: true, shareToken: true },
    });
    token  = card.shareToken;
    cardId = card.id;
  }

  await recordShareAuthorization({
    action:        SHARE_AUDIT_CREATED,
    actorUserId:   user.id,
    shareCardId:   cardId,
    noticeVersion: SHARE_NOTICE_VERSION,
  });

  const card = await prisma.shareCard.findUnique({
    where:  { id: cardId },
    select: { expiresAt: true },
  });

  return NextResponse.json({
    url:       `${APP_URL}/report/${token}`,
    expiresAt: card?.expiresAt?.toISOString() ?? null,
  });
}

/**
 * DELETE /api/report/share
 *
 * The patient withdraws the share channel.
 *
 * Revokes every one of their share cards, not just the newest: the patient's
 * intent is "stop sharing", and leaving an older link alive would mean the
 * control did not do what it says.
 *
 * WHAT REVOCATION DOES NOT DO
 * It closes the bearer channel only. A physician already linked to this patient
 * keeps full access through the authenticated, ownership-checked routes — they
 * do not depend on this token. Revocation must never look like withdrawing from
 * a treating clinician's care, and it does not.
 *
 * Authorised to the owning patient alone. Admin revocation was deliberately
 * deferred in this phase.
 */
export async function DELETE() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const now = new Date();

  // Scoped by userId, so this can only ever reach the caller's own cards. There
  // is no card id in the request — nothing to tamper with, and no way to name
  // another patient's link.
  const target = await prisma.shareCard.findMany({
    where:  { userId: user.id, revokedAt: null },
    select: { id: true },
  });

  if (target.length > 0) {
    await prisma.shareCard.updateMany({
      where: { userId: user.id, revokedAt: null },
      data:  { revokedAt: now },
    });

    for (const card of target) {
      await recordShareAuthorization({
        action:      SHARE_AUDIT_REVOKED,
        actorUserId: user.id,
        shareCardId: card.id,
      });
    }
  }

  return NextResponse.json({ revoked: target.length });
}
