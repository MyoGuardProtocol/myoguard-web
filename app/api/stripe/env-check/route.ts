import { NextResponse }  from 'next/server';
import { auth }          from '@clerk/nextjs/server';
import { prisma }        from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/env-check
 *
 * ADMIN-only diagnostic — returns boolean flags for each required Stripe
 * environment variable. Never exposes values or key prefixes.
 *
 * Use this endpoint to confirm which env vars are visible to the Vercel
 * runtime AFTER a deployment, without exposing any credentials.
 *
 * Example response:
 *   {
 *     "hasStripeSecretKey":  true,
 *     "hasPublishableKey":   true,
 *     "hasPhysicianPriceId": true,
 *     "hasPracticePriceId":  false,
 *     "hasWebhookSecret":    true,
 *     "isLiveKey":           true,
 *     "nodeEnv":             "production"
 *   }
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { role: true },
  });

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY ?? '';

  return NextResponse.json({
    hasStripeSecretKey:  !!secretKey,
    hasPublishableKey:   !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    hasPhysicianPriceId: !!process.env.STRIPE_PHYSICIAN_PRICE_ID,
    hasPracticePriceId:  !!process.env.STRIPE_PRACTICE_PRICE_ID,
    hasWebhookSecret:    !!process.env.STRIPE_WEBHOOK_SECRET,
    // Diagnostic context — not a secret
    isLiveKey:           secretKey.startsWith('sk_live_'),
    nodeEnv:             process.env.NODE_ENV ?? 'unknown',
  });
}
