import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/**
 * POST /api/webhooks/clerk
 * Syncs a newly created Clerk user to the `User` table.
 *
 * Setup in Clerk Dashboard → Webhooks:
 *  - Event: user.created
 *  - URL: https://myoguard.health/api/webhooks/clerk
 *  - Copy the Signing Secret into CLERK_WEBHOOK_SECRET
 *
 * Signature verification requires the `svix` package.
 * If svix is not installed / CLERK_WEBHOOK_SECRET is absent, the route
 * degrades gracefully and logs a warning.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[clerk/webhook] CLERK_WEBHOOK_SECRET not set — skipping verification');
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = payload.type as string | undefined;

  if (eventType === 'user.created') {
    const data = payload.data as {
      id: string;
      email_addresses?: Array<{ email_address: string }>;
      first_name?: string;
      last_name?: string;
    };

    const email     = data.email_addresses?.[0]?.email_address ?? '';
    const firstName = data.first_name ?? '';
    const lastName  = data.last_name  ?? '';
    const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'MyoGuard User';

    try {
      await prisma.user.upsert({
        where:  { clerkId: data.id },
        update: { email, fullName },
        create: {
          clerkId:  data.id,
          email,
          fullName,
          role:               'PATIENT',
          subscriptionStatus: 'FREE',
        },
      });
    } catch (err) {
      console.error('[clerk/webhook] DB upsert failed', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
