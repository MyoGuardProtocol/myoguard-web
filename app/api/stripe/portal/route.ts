import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripeClient } from '@/src/lib/stripe';
import { prisma } from '@/src/lib/prisma';

/**
 * POST /api/stripe/portal
 *
 * Auth required. Creates a Stripe Customer Portal session so a physician
 * can manage their subscription, update payment details, or view invoices.
 *
 * Returns 503 if Stripe is not configured.
 * Returns 404 if no stripeCustomerId is found for this user.
 *
 * Note: The Stripe Customer Portal must be configured in the Stripe Dashboard
 * (Stripe Dashboard → Billing → Customer portal) before this endpoint will work.
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
    select: { id: true, stripeCustomerId: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.role !== 'PHYSICIAN' && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Physician account required.' },
      { status: 403 },
    );
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing account found. Please contact support@myoguard.health' },
      { status: 404 },
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health').replace(/\/$/, '');

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   user.stripeCustomerId,
      return_url: `${appUrl}/doctor/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[POST /api/stripe/portal]', err);
    return NextResponse.json({ error: 'Failed to open billing portal.' }, { status: 500 });
  }
}
