import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/**
 * GET /api/admin/pending-physicians
 *
 * Returns all users with role = PHYSICIAN_PENDING, sorted by most recent
 * submission first.
 *
 * Caller must have role = ADMIN.
 */
export async function GET() {
  const { userId: callerClerkId } = await auth();
  if (!callerClerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const caller = await prisma.user.findUnique({
    where:  { clerkId: callerClerkId },
    select: { role: true },
  });
  if (!caller || caller.role !== 'ADMIN') {
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
