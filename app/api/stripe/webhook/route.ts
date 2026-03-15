import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/src/lib/stripe';
import { prisma } from '@/src/lib/prisma';
import type Stripe from 'stripe';

/**
 * POST /api/stripe/webhook
 * Public (raw body). Verifies Stripe signature and updates subscription status in DB.
 * Silently returns 200 if STRIPE_WEBHOOK_SECRET is absent (graceful stub).
 */
export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Graceful stub — Stripe not yet configured
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ received: true, mode: 'stub' });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  const rawBody = await req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId  = session.metadata?.userId;
        if (userId && session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionStatus: 'ACTIVE',
              stripeCustomerId:   session.customer as string,
              stripeSubId:        session.subscription as string,
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        const status = sub.status === 'active' ? 'ACTIVE' : 'PAST_DUE';
        await prisma.user.updateMany({
          where: { stripeSubId: sub.id },
          data:  { subscriptionStatus: status },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeSubId: sub.id },
          data:  { subscriptionStatus: 'CANCELLED' },
        });
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    console.error('[stripe/webhook] DB update failed', err);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// App Router automatically provides raw body access via req.text() —
// no bodyParser config needed (that was a Pages Router convention).
