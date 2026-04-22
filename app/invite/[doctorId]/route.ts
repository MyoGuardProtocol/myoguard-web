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

  // Accept either a User.id or a PhysicianProfile slug (referralSlug).
  const doctor = await prisma.user
    .findFirst({
      where: {
        OR:   [{ id: doctorId }, { referralSlug: doctorId }],
        role: 'PHYSICIAN',
      },
      select: { id: true },
    })
    .catch(() => null);

  if (!doctor) {
    // Unknown or invalid doctor — send to root rather than 404ing
    return NextResponse.redirect(new URL('/', APP_URL));
  }

  // Always store the canonical User.id in the cookie, regardless of
  // whether a slug or id was passed in the URL.
  const response = NextResponse.redirect(new URL('/sign-up', APP_URL));

  response.cookies.set('mgReferredBy', doctor.id, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7, // 7 days
    path:     '/',
  });

  return response;
}
