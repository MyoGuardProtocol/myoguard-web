import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripeClient } from '@/src/lib/stripe';
import { prisma } from '@/src/lib/prisma';

/**
 * POST /api/stripe/checkout
 *
 * Auth required. Creates a Stripe Checkout session for a physician subscription.
 * Returns 503 gracefully if STRIPE_SECRET_KEY is not configured.
 *
 * Body:
 *   planType?: 'physician' | 'practice'   (default: 'physician')
 *
 * Price ID resolution (server-side only — never exposed to the client):
 *   physician → STRIPE_PHYSICIAN_PRICE_ID  (falls back to STRIPE_PRICE_ID for legacy env)
 *   practice  → STRIPE_PRACTICE_PRICE_ID
 *
 * Metadata passed to webhooks:
 *   userId, clerkId, planType
 */
export async function POST(req: NextRequest) {
  const stripe = getStripeClient();

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this server. Please add STRIPE_SECRET_KEY to your environment.' },
      { status: 503 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { id: true, email: true, stripeCustomerId: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.role !== 'PHYSICIAN' && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'A verified physician account is required to subscribe.' },
      { status: 403 },
    );
  }

  // ── Plan → Price ID resolution ──────────────────────────────────────────────
  let planType: string;
  try {
    const body = (await req.json()) as { planType?: string };
    planType = body.planType ?? 'physician';
  } catch {
    planType = 'physician';
  }

  let priceId: string | undefined;
  switch (planType) {
    case 'practice':
      priceId = process.env.STRIPE_PRACTICE_PRICE_ID;
      break;
    case 'physician':
    default:
      // STRIPE_PHYSICIAN_PRICE_ID is preferred; STRIPE_PRICE_ID is the legacy fallback
      priceId = process.env.STRIPE_PHYSICIAN_PRICE_ID ?? process.env.STRIPE_PRICE_ID;
      planType = 'physician'; // normalise unknown values
      break;
  }

  if (!priceId) {
    return NextResponse.json(
      { error: `Price ID for plan '${planType}' is not configured. Please add STRIPE_PHYSICIAN_PRICE_ID or STRIPE_PRACTICE_PRICE_ID to your environment.` },
      { status: 503 },
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health').replace(/\/$/, '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      payment_method_types: ['card'],
      // Use existing Stripe customer if one exists; otherwise pass email for new customer creation
      customer_email: user.stripeCustomerId ? undefined : user.email,
      customer:       user.stripeCustomerId ?? undefined,
      line_items:     [{ price: priceId, quantity: 1 }],
      success_url:    `${appUrl}/doctor/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:     `${appUrl}/doctor/billing?status=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        userId:   user.id,
        clerkId:  userId,
        planType,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[POST /api/stripe/checkout]', err);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}
