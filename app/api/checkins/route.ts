import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';
import { CheckinSchema } from '@/src/schemas/assessment';

/**
 * POST /api/checkins   — create a weekly check-in record
 * GET  /api/checkins   — return user's last 12 check-ins
 * Both require authentication.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Derive week boundaries (Mon–Sun of the current week)
  const now   = new Date();
  const day   = now.getDay(); // 0 = Sun
  const diff  = (day === 0 ? -6 : 1) - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const data = parsed.data;

  try {
    const checkin = await prisma.weeklyCheckin.create({
      data: {
        userId:       user.id,
        weekStart,
        weekEnd,
        avgWeightKg:  data.avgWeightKg,
        avgProteinG:  data.avgProteinG,
        totalWorkouts: data.totalWorkouts,
        avgHydration: data.avgHydration,
        highlights:   [],
        recommendations: [],
        completedAt:  new Date(),
      },
    });

    return NextResponse.json({ checkinId: checkin.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/checkins]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ checkins: [] });
  }

  try {
    const checkins = await prisma.weeklyCheckin.findMany({
      where:   { userId: user.id },
      orderBy: { weekStart: 'desc' },
      take:    12,
    });

    return NextResponse.json({ checkins });
  } catch (err) {
    console.error('[GET /api/checkins]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
