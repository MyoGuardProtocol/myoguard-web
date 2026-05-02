export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, referralSlug: true },
  }).catch(() => null);

  if (!physician || physician.role !== 'PHYSICIAN') {
    return NextResponse.json({ error: 'Forbidden — physician role required' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { patientName, patientEmail, payload } = body as {
    patientName?:  string;
    patientEmail?: string;
    payload:       unknown;
  };

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'payload is required' }, { status: 400 });
  }

  // Resolve physician's referral code for the activation URL
  const profile = physician.referralSlug
    ? await prisma.physicianProfile.findFirst({
        where:  { slug: physician.referralSlug, isActive: true },
        select: { referralCode: true },
      }).catch(() => null)
    : null;

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const preload = await prisma.preloadedAssessment.create({
    data: {
      physicianId:  physician.id,
      patientName:  patientName  ?? null,
      patientEmail: patientEmail ?? null,
      payload:      payload as object,
      expiresAt,
    },
    select: { id: true },
  });

  const ref = profile?.referralCode;
  const activationUrl = ref
    ? `${APP_URL}/join?ref=${encodeURIComponent(ref)}&preload=${preload.id}`
    : `${APP_URL}/join?preload=${preload.id}`;

  return NextResponse.json({ preloadId: preload.id, activationUrl });
}
