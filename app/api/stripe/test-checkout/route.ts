import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripeClient } from '@/src/lib/stripe';
import { prisma } from '@/src/lib/prisma';

/**
 * POST /api/stripe/test-checkout
 *
 * INTERNAL VERIFICATION ROUTE — restricted to ADMIN role.
 * Do not link from any public UI. Remove or keep admin-gated after verification.
 *
 * Purpose: creates a $1 one-time payment checkout to verify that the full
 * Stripe → Mercury payout pipeline is correctly wired before launching
 * physician subscription billing.
 *
 * Setup in Stripe Dashboard:
 *   1. Products → Add product → Name: "Pipeline Verification" → $1.00 one-time
 *   2. Copy the Price ID (price_...) → set as STRIPE_TEST_PRICE_ID in Vercel env
 *
 * After verifying payout receipt in Mercury:
 *   - Mark the payment as refunded in the Stripe Dashboard if desired
 *   - This route can remain in place (admin-only) or be deleted
 */
export async function POST() {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this server.' },
      { status: 503 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // ADMIN-only gate — prevents accidental use by physicians
  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Admin access required for payment pipeline verification.' },
      { status: 403 },
    );
  }

  const testPriceId = process.env.STRIPE_TEST_PRICE_ID;
  if (!testPriceId) {
    return NextResponse.json(
      {
        error:    'STRIPE_TEST_PRICE_ID is not configured.',
        guidance: 'Create a $1 one-time product in the Stripe Dashboard, copy the Price ID, and add it as STRIPE_TEST_PRICE_ID in Vercel environment variables.',
      },
      { status: 503 },
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health').replace(/\/$/, '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      customer_email:       user.email,
      line_items:           [{ price: testPriceId, quantity: 1 }],
      success_url:          `${appUrl}/admin/physicians?payment_test=success`,
      cancel_url:           `${appUrl}/admin/physicians?payment_test=cancelled`,
      metadata: {
        userId:  user.id,
        purpose: 'payout_pipeline_verification',
      },
    });

    console.log(`[stripe/test-checkout] session created: ${session.id} for adminId=${user.id}`);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[POST /api/stripe/test-checkout]', err);
    return NextResponse.json({ error: 'Failed to create test checkout session.' }, { status: 500 });
  }
}
