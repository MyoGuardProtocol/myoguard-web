/**
 * POST /api/webhooks/resend
 *
 * Provider delivery lifecycle ingestion for governed communications.
 *
 * PUBLIC BY NECESSITY, AUTHENTICATED BY SIGNATURE.
 * Resend cannot present a Clerk session, so this endpoint takes no session and
 * checks none. Its sole authentication is the Svix HMAC signature over the raw
 * body, verified before anything is read out of the payload and before any
 * database call. An unsigned or mis-signed request is refused having touched
 * nothing.
 *
 * WHY svix DIRECTLY RATHER THAN resend.webhooks.verify()
 * They are the same operation. The Resend SDK's `webhooks.verify()` is a
 * wrapper that constructs `new Webhook(secret)` from the `svix` package and
 * calls `.verify(payload, { 'svix-id', 'svix-timestamp', 'svix-signature' })` —
 * verbatim what happens below, and verbatim what /api/webhooks/clerk has done
 * since it was written. Calling svix directly keeps one webhook idiom in the
 * repository and avoids constructing a Resend API client, which carries the
 * send key, merely to check a signature. The SDK's payload types are still used
 * so the shape is not hand-rolled.
 *
 * WHAT THIS ENDPOINT MAY DO
 * Update CommunicationEvent state, and create CommunicationSuppression where
 * the provider evidence is strong enough. It may not touch
 * CommunicationPreference and may not write CommunicationConsentEvent: a
 * provider cannot consent, withdraw consent, or resubscribe anyone.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { isHandledEventType } from '@/src/lib/communications/providerEvents';
import { applyProviderEvent } from '@/src/lib/communications/deliveryLifecycle';

export const dynamic = 'force-dynamic';

/** Dedicated secret. Never shared with Clerk, identity, throttle or unsubscribe. */
const WEBHOOK_SECRET_ENV = 'RESEND_WEBHOOK_SECRET';

export async function POST(req: NextRequest) {
  const secret = process.env[WEBHOOK_SECRET_ENV];

  // Fail closed. An unconfigured verifier must never fall back to trusting the
  // caller — that would turn a public endpoint into an unauthenticated writer.
  if (!secret) {
    console.error(`[resend/webhook] ${WEBHOOK_SECRET_ENV} is not set — rejecting unverified event`);
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Raw text, never req.json(): the signature covers the exact bytes sent, and
  // parsing first would verify a re-serialisation rather than the payload.
  const rawBody = await req.text();

  let payload: unknown;
  try {
    payload = new Webhook(secret).verify(rawBody, {
      'svix-id':        req.headers.get('svix-id')        ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    });
  } catch {
    // The svix error can carry payload detail; only the fact of failure is
    // logged. Missing headers and a forged signature are the same refusal.
    console.error('[resend/webhook] signature verification failed — rejected');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ── Everything below this line is authenticated provider evidence ──────────

  const event = payload as { type?: unknown; data?: { email_id?: unknown; bounce?: unknown } };
  const eventType = event?.type;

  if (typeof eventType !== 'string') {
    console.error('[resend/webhook] malformed payload — no event type');
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  // Subscribed-to-handled is configured at the provider, but an unexpected type
  // must be inert rather than an error: a 4xx would make Resend retry something
  // that will never succeed.
  if (!isHandledEventType(eventType)) {
    console.log(`[resend/webhook] unhandled event type=${eventType} — ignored`);
    return NextResponse.json({ received: true, handled: false });
  }

  const providerMessageId = event.data?.email_id;

  if (typeof providerMessageId !== 'string' || providerMessageId.length === 0) {
    console.error(`[resend/webhook] malformed payload type=${eventType} — no email_id`);
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  const result = await applyProviderEvent({
    eventType,
    providerMessageId,
    // Present only on email.bounced. Passed through untouched; classification
    // happens in one place, against the structured field only.
    bounce: event.data?.bounce,
  });

  // Storage failure is the one case worth a retry, so it is the one case that
  // answers non-2xx.
  if (result.outcome === 'error') {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  // Orphans, duplicates and out-of-order events are all acknowledged. None of
  // them is a transient condition, so asking Resend to send them again would
  // only produce the same outcome indefinitely.
  return NextResponse.json({ received: true, handled: true, outcome: result.outcome });
}
