import { NextResponse }  from 'next/server';
import { requireAdmin } from '@/src/lib/requireAdmin';
import { prisma }       from '@/src/lib/prisma';

/**
 * GET /api/admin/pending-physicians
 *
 * Returns all users with role = PHYSICIAN_PENDING, sorted by most recent
 * submission first.
 *
 * Caller must have role = ADMIN.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error === 'UNAUTHENTICATED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pending = await prisma.user.findMany({
    where:   { role: 'PHYSICIAN_PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id:       true,
      fullName: true,
      email:    true,
      createdAt: true,
      physicianOnboarding: {
        select: { country: true, specialty: true, licenseNumber: true, submittedAt: true },
      },
    },
  });

  return NextResponse.json({ pending });
}
