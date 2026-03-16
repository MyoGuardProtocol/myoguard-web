import { NextResponse }  from 'next/server';
import { auth }          from '@clerk/nextjs/server';
import { prisma }        from '@/src/lib/prisma';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

/**
 * POST /api/report/share
 *
 * Creates (or returns the existing) ShareCard token for the authenticated
 * user. The token is used to generate a public physician-report URL that
 * does not require the physician to have an account.
 *
 * One stable share link per user — subsequent calls return the same token
 * so physicians can bookmark the URL.
 */
export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Resolve internal user + latest score
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

  // Return existing card if one exists (stable URL), otherwise create
  const existing = await prisma.shareCard.findFirst({
    where:   { userId: user.id },
    orderBy: { createdAt: 'asc' },          // oldest = stable primary link
    select:  { shareToken: true },
  });

  let token: string;

  if (existing) {
    token = existing.shareToken;
    // Refresh the score snapshot so the link reflects current data
    await prisma.shareCard.updateMany({
      where: { userId: user.id, shareToken: token },
      data:  { score, riskBand },
    });
  } else {
    const card = await prisma.shareCard.create({
      data:   { userId: user.id, score, riskBand },
      select: { shareToken: true },
    });
    token = card.shareToken;
  }

  return NextResponse.json({ url: `${APP_URL}/report/${token}` });
}
