export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { eventType, metadata } = body as { eventType?: unknown; metadata?: unknown };

    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json({ ok: false, error: 'eventType required' }, { status: 400 });
    }

    // Resolve internal userId from Clerk session if authenticated
    let userId: string | undefined;
    if (clerkId) {
      const user = await prisma.user.findUnique({
        where:  { clerkId },
        select: { id: true },
      });
      userId = user?.id ?? undefined;
    }

    await prisma.analyticsEvent.create({
      data: {
        userId,
        eventType,
        metadata: metadata !== undefined ? (metadata as object) : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/analytics]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
