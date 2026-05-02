export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/**
 * POST /api/preload/inject
 *
 * Auth required — patient session.
 * Reads the mgPreloadId cookie, validates the PreloadedAssessment, then
 * forwards the stored payload to /api/assessment using the patient's own
 * auth cookies (preserves all existing assessment logic unchanged).
 *
 * On success: marks used=true, clears cookie, returns { ok, assessmentId }.
 * On failure: does NOT mark used so the patient can retry.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const preloadId = req.cookies.get('mgPreloadId')?.value;
  if (!preloadId) {
    return NextResponse.json({ ok: false, reason: 'no_preload' });
  }

  const clearCookie = (res: NextResponse) => {
    res.cookies.set('mgPreloadId', '', { maxAge: 0, path: '/' });
    return res;
  };

  const preload = await prisma.preloadedAssessment.findUnique({
    where: { id: preloadId },
  }).catch(() => null);

  if (!preload) {
    return clearCookie(NextResponse.json({ ok: false, reason: 'not_found' }));
  }
  if (preload.used) {
    return clearCookie(NextResponse.json({ ok: false, reason: 'already_used' }));
  }
  if (new Date() > preload.expiresAt) {
    return clearCookie(NextResponse.json({ ok: false, reason: 'expired' }));
  }

  // Forward the stored payload to /api/assessment, carrying the patient's
  // Clerk session cookies so existing auth + user-provisioning logic fires.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://${req.headers.get('host')}`;
  const cookieHeader = req.headers.get('cookie') ?? '';

  let assessmentId: string | null = null;
  try {
    const assessmentRes = await fetch(`${appUrl}/api/assessment`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie':        cookieHeader,
      },
      body: JSON.stringify(preload.payload),
    });

    if (assessmentRes.ok) {
      const data = await assessmentRes.json() as { assessmentId?: string };
      assessmentId = data.assessmentId ?? null;
    } else {
      const errBody = await assessmentRes.text().catch(() => '');
      console.error('[preload/inject] /api/assessment failed', assessmentRes.status, errBody);
      return NextResponse.json({ ok: false, error: 'assessment_failed' });
    }
  } catch (err) {
    console.error('[preload/inject] network error calling /api/assessment', err);
    return NextResponse.json({ ok: false, error: 'network_error' });
  }

  await prisma.preloadedAssessment.update({
    where: { id: preloadId },
    data:  { used: true },
  }).catch((err) => console.error('[preload/inject] failed to mark used', err));

  return clearCookie(NextResponse.json({ ok: true, assessmentId }));
}
