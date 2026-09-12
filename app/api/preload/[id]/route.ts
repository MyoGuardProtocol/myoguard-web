export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/**
 * GET /api/preload/[id]
 *
 * Returns a PreloadedAssessment to the physician who created it.
 *
 * Previously unauthenticated: anyone holding or guessing a preload id received
 * the patient's name and full clinical payload. The preload id was never
 * designed or validated as a bearer credential for clinical information.
 *
 * This does NOT affect patient activation. That flow never reads this route —
 * it is create → /api/preload/accept (sets the mgPreloadId cookie, returns no
 * data) → /api/preload/inject (authenticated, reads the cookie). This endpoint
 * has no callers in the application.
 *
 * Role check mirrors /api/preload/create (PHYSICIAN only), plus an ownership
 * check. A preload belonging to another physician returns 404 rather than 403
 * so the response does not confirm that the id exists.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true },
  }).catch(() => null);

  if (!physician || physician.role !== 'PHYSICIAN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const preload = await prisma.preloadedAssessment.findUnique({
    where:  { id },
    select: {
      id:          true,
      physicianId: true,
      patientName: true,
      used:        true,
      expiresAt:   true,
      payload:     true,
    },
  }).catch(() => null);

  if (!preload || preload.physicianId !== physician.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (preload.used) {
    return NextResponse.json({ error: 'already_used' }, { status: 410 });
  }
  if (new Date() > preload.expiresAt) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  return NextResponse.json({
    payload:     preload.payload,
    patientName: preload.patientName,
    physicianId: preload.physicianId,
  });
}
