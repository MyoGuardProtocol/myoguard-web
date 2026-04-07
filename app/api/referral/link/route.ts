import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';

/**
 * POST /api/referral/link
 *
 * Called by <ReferralSync /> immediately after the patient first
 * reaches their dashboard. Reads the mgReferredBy cookie (set when
 * they scanned the physician's QR code), links them to that physician
 * in the DB, then clears the cookie.
 *
 * Idempotent: if the patient already has a physicianId the existing
 * link is preserved and the cookie is cleared without error.
 *
 * Returns: { ok: true, linked: boolean }
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doctorId = req.cookies.get('mgReferredBy')?.value;

  // No cookie — nothing to do, respond quickly
  if (!doctorId) {
    return NextResponse.json({ ok: true, linked: false });
  }

  const [patient, doctor] = await Promise.all([
    prisma.user
      .findUnique({ where: { clerkId }, select: { id: true, physicianId: true } })
      .catch(() => null),
    prisma.user
      .findFirst({ where: { id: doctorId, role: 'PHYSICIAN' }, select: { id: true } })
      .catch(() => null),
  ]);

  // Always clear the cookie even if we can't complete the link
  const clearCookie = (res: NextResponse) => {
    res.cookies.set('mgReferredBy', '', { maxAge: 0, path: '/' });
    return res;
  };

  if (!patient || !doctor) {
    return clearCookie(NextResponse.json({ ok: true, linked: false }));
  }

  if (!patient.physicianId) {
    await prisma.user
      .update({ where: { id: patient.id }, data: { physicianId: doctor.id } })
      .catch((err) => console.error('[referral/link] DB update failed', err));
  }

  return clearCookie(NextResponse.json({ ok: true, linked: !patient.physicianId }));
}
