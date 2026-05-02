export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  if (!preload) {
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
