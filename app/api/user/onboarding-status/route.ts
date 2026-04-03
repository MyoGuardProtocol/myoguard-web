export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/**
 * GET /api/user/onboarding-status
 *
 * Returns whether the authenticated user has a completed UserProfile.
 * Used by OnboardingRedirect to confirm onboarding status client-side
 * before redirecting, avoiding stale server-render race conditions.
 */
export async function GET() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ hasCompletedOnboarding: false }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where:  { clerkId },
      select: { profile: { select: { userId: true } } },
    });

    return NextResponse.json({ hasCompletedOnboarding: !!user?.profile });
  } catch (err) {
    console.error('[onboarding-status] DB error — failing safe (hasCompletedOnboarding: true)', err);
    return NextResponse.json({ hasCompletedOnboarding: true }, { status: 200 });
  }
}
