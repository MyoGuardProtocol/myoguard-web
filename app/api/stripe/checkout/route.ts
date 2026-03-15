import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripeClient } from '@/src/lib/stripe';
import { prisma } from '@/src/lib/prisma';

/**
 * POST /api/stripe/checkout
 * Auth required. Creates a Stripe Checkout session for the premium subscription.
 * Returns 503 gracefully if STRIPE_SECRET_KEY is not configured.
 */
export async function POST() {
  const stripe = getStripeClient();

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this server. Please add STRIPE_SECRET_KEY to your environment.' },
      { status: 503 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: 'STRIPE_PRICE_ID is not configured.' },
      { status: 503 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                'subscription',
      payment_method_types: ['card'],
      customer_email:      user.stripeCustomerId ? undefined : user.email,
      customer:            user.stripeCustomerId ?? undefined,
      line_items:          [{ price: priceId, quantity: 1 }],
      success_url:         `${appUrl}/dashboard?upgrade=success`,
      cancel_url:          `${appUrl}/dashboard?upgrade=cancelled`,
      metadata:            { userId: user.id, clerkId: userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[POST /api/stripe/checkout]', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
