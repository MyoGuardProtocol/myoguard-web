import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/src/lib/stripe';
import { prisma } from '@/src/lib/prisma';
import type Stripe from 'stripe';

// ─── Status mapping ────────────────────────────────────────────────────────────

/**
 * Maps a Stripe Subscription status to the MyoGuard SubscriptionStatus enum.
 *
 * Stripe statuses:
 *   active            → ACTIVE   (subscription is paid and current)
 *   trialing          → ACTIVE   (trial period — treat as full access)
 *   past_due          → PAST_DUE (payment failed, retrying)
 *   unpaid            → PAST_DUE (retries exhausted, needs update)
 *   canceled          → CANCELLED
 *   incomplete_expired→ CANCELLED
 *   incomplete        → FREE     (initial payment failed, not yet confirmed)
 *   paused            → FREE     (Stripe pause — unusual, treat as no access)
 */
function mapStripeStatus(
  status: Stripe.Subscription.Status,
): 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'FREE' {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELLED';
    default:
      // 'incomplete' | 'paused' — payment not yet confirmed
      return 'FREE';
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/stripe/webhook
 *
 * Public (raw body). Verifies Stripe signature before processing.
 * Silently returns 200 if STRIPE_WEBHOOK_SECRET is absent (graceful stub —
 * allows the platform to boot and build without Stripe configured).
 *
 * Handles:
 *   checkout.session.completed     — primary activation signal
 *   customer.subscription.created  — sets status when subscription is created
 *   customer.subscription.updated  — syncs status on all lifecycle changes
 *   customer.subscription.deleted  — marks as CANCELLED
 *   invoice.payment_failed         — marks as PAST_DUE
 *
 * Webhook endpoint URL:
 *   https://myoguard.health/api/stripe/webhook
 *
 * Required Stripe Dashboard events to subscribe:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.payment_failed
 */
export async function POST(req: NextRequest) {
  const stripe        = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Graceful stub — Stripe not yet configured
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ received: true, mode: 'stub' });
  }

  const sig     = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── checkout.session.completed ──────────────────────────────────────────
      // Primary activation event. Fires when the customer completes the Stripe
      // hosted checkout.
      //
      // payment_status values:
      //   'paid'                 — card or other payment method charged
      //   'no_payment_required'  — 100% coupon applied (e.g. FOUNDER2026); Stripe
      //                            creates an active $0 subscription and sets this
      //                            value instead of 'paid'. Both must activate.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId  = session.metadata?.userId;

        const isPaymentReceived =
          session.payment_status === 'paid' ||
          session.payment_status === 'no_payment_required';

        if (userId && session.customer && isPaymentReceived) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionStatus: 'ACTIVE',
              stripeCustomerId:   session.customer as string,
              stripeSubId:        (session.subscription as string) ?? null,
            },
          });
          console.log(
            `[stripe/webhook] checkout.session.completed userId=${userId} ` +
            `payment_status=${session.payment_status} → ACTIVE`,
          );
        }
        break;
      }

      // ── customer.subscription.created ──────────────────────────────────────
      // Fires when Stripe creates the subscription object. In subscription checkout
      // flows, this fires before checkout.session.completed. We use it to capture
      // the stripeSubId immediately, even before payment confirmation.
      case 'customer.subscription.created': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        const status = mapStripeStatus(sub.status);

        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionStatus: status,
              stripeCustomerId:   sub.customer as string,
              stripeSubId:        sub.id,
            },
          });
        } else {
          // Fallback: match by stripeCustomerId (e.g. subscriptions created outside checkout)
          await prisma.user.updateMany({
            where: { stripeCustomerId: sub.customer as string },
            data:  { subscriptionStatus: status, stripeSubId: sub.id },
          });
        }
        console.log(`[stripe/webhook] subscription.created subId=${sub.id} → ${status}`);
        break;
      }

      // ── customer.subscription.updated ──────────────────────────────────────
      // Fires on all subscription lifecycle transitions: renewal, plan change,
      // cancellation scheduling, dunning state changes, trial end, etc.
      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        const status = mapStripeStatus(sub.status);
        await prisma.user.updateMany({
          where: { stripeSubId: sub.id },
          data:  { subscriptionStatus: status },
        });
        console.log(`[stripe/webhook] subscription.updated subId=${sub.id} → ${status}`);
        break;
      }

      // ── customer.subscription.deleted ──────────────────────────────────────
      // Fires when the subscription is fully terminated (end of billing period
      // after cancellation, or immediate cancellation).
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeSubId: sub.id },
          data:  { subscriptionStatus: 'CANCELLED' },
        });
        console.log(`[stripe/webhook] subscription.deleted subId=${sub.id} → CANCELLED`);
        break;
      }

      // ── invoice.payment_failed ──────────────────────────────────────────────
      // Fires when Stripe cannot collect a recurring payment. Marks as PAST_DUE
      // so the billing UI can prompt the physician to update their payment method.
      // Stripe will also trigger subscription.updated with status='past_due'.
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await prisma.user.updateMany({
            where: { stripeSubId: invoice.subscription as string },
            data:  { subscriptionStatus: 'PAST_DUE' },
          });
          console.log(`[stripe/webhook] invoice.payment_failed subId=${invoice.subscription} → PAST_DUE`);
        }
        break;
      }

      default:
        // Unhandled event type — safely ignored
        break;
    }
  } catch (err) {
    console.error('[stripe/webhook] DB update failed', err);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// App Router provides raw body via req.text() — no bodyParser config needed.
