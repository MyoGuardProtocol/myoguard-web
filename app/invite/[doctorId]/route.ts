import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

const APP_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '') ||
  'https://myoguard.health';

/**
 * GET /invite/[doctorId]
 *
 * Public entry point for physician-generated patient invites.
 * Validates the doctorId, sets a 7-day httpOnly referral cookie,
 * then redirects the patient to the Clerk sign-up page.
 *
 * The cookie is later read by POST /api/referral/link (fired by
 * <ReferralSync /> on the patient dashboard after sign-up) to
 * stamp physicianId on the patient's User row.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doctorId: string }> },
) {
  const { doctorId } = await params;

  // Verify the referenced physician is real and active.
  const doctor = await prisma.user
    .findFirst({
      where:  { id: doctorId, role: 'PHYSICIAN' },
      select: { id: true },
    })
    .catch(() => null);

  if (!doctor) {
    // Unknown or invalid doctor — send to root rather than 404ing
    return NextResponse.redirect(new URL('/', APP_URL));
  }

  const response = NextResponse.redirect(new URL('/sign-in-new', APP_URL));

  response.cookies.set('mgReferredBy', doctorId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7, // 7 days
    path:     '/',
  });

  return response;
}
