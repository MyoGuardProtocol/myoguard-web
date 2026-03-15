import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { PHYSICIAN_DIRECTORY } from '@/src/lib/physicianDirectory';

/**
 * GET /api/referral?slug=dr-b
 * Public. Returns physician branding info for a referral code.
 *
 * Resolution order:
 *   1. PhysicianProfile row in the database (isActive = true)
 *   2. Static entry in PHYSICIAN_DIRECTORY (src/lib/physicianDirectory.ts)
 *   3. 404 if neither source has a match
 *
 * This means referral links work immediately via the directory without
 * requiring a database record, while fully onboarded physicians (with a DB
 * row) automatically take precedence.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  try {
    // 1. Database lookup (takes precedence for registered physicians)
    const dbPhysician = await prisma.physicianProfile.findFirst({
      where: { slug, isActive: true },
      select: { slug: true, displayName: true, clinicName: true, specialty: true },
    });

    if (dbPhysician) {
      return NextResponse.json(dbPhysician);
    }

    // 2. Static directory fallback
    const directoryEntry = PHYSICIAN_DIRECTORY[slug];

    if (directoryEntry) {
      return NextResponse.json(directoryEntry);
    }

    // 3. Unknown slug
    return NextResponse.json({ error: 'Physician not found' }, { status: 404 });

  } catch (err) {
    console.error('[GET /api/referral]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
