import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/**
 * GET /api/referral?slug=dr-b
 * Public. Returns physician branding info for referral slug injection.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  try {
    const physician = await prisma.physicianProfile.findFirst({
      where: { slug, isActive: true },
      select: { slug: true, displayName: true, clinicName: true, specialty: true },
    });

    if (!physician) {
      return NextResponse.json({ error: 'Physician not found' }, { status: 404 });
    }

    return NextResponse.json(physician);
  } catch (err) {
    console.error('[GET /api/referral]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
