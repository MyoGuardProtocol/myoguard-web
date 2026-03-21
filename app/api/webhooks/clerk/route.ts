import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
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
 * All requests are verified via svix HMAC signature before processing.
 * Requests without a valid signature are rejected with 400.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  // Reject immediately if the secret is not configured — do not process unverified payloads.
  if (!webhookSecret) {
    console.error('[clerk/webhook] CLERK_WEBHOOK_SECRET is not set — rejecting request');
    return NextResponse.json(
      { error: 'Webhook not configured on this server' },
      { status: 500 },
    );
  }

  // Read the raw body (required for HMAC verification — must not be parsed first).
  const rawBody = await req.text();

  const svixId        = req.headers.get('svix-id')        ?? '';
  const svixTimestamp = req.headers.get('svix-timestamp') ?? '';
  const svixSignature = req.headers.get('svix-signature') ?? '';

  let payload: Record<string, unknown>;
  try {
    const wh = new Webhook(webhookSecret);
    payload = wh.verify(rawBody, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as Record<string, unknown>;
  } catch (err) {
    console.error('[clerk/webhook] Signature verification failed', err);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
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
