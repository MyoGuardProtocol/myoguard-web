/**
 * app/api/guide-request/route.ts
 *
 * POST /api/guide-request — one-time requested delivery of the Protein Guide.
 *
 * WHY A SEPARATE ROUTE RATHER THAN /api/email-capture
 * That route's schema requires weightKg, myoguardScore, riskBand, leanLossEstPct
 * and medication, because it delivers a protocol derived from an assessment.
 * Someone asking for a general protein reference has completed no assessment.
 * Extending that schema would mean either fabricating clinical values or
 * loosening a contract that currently protects a clinical pathway. So this route
 * asks for an address and nothing else.
 *
 * REQUESTED DELIVERY IS NOT CONSENT — the invariant this file exists to hold.
 * Asking for a document authorises sending that document. It is not a
 * subscription, and this route creates no preference, no consent event, no
 * wording row and no account. It never calls grantConsent. Someone who wants
 * ongoing educational email will have to say so separately, in a later phase,
 * against wording they actually read.
 *
 * WHAT IT DOES CREATE is the CommunicationEvent every governed send records —
 * written by the shared gateway, not here.
 *
 * NOT AN EMAIL RELAY
 * The subject and body come from the declared Guide asset. The caller supplies
 * an address and nothing that can reach the message, so this cannot be used to
 * send arbitrary mail from the MyoGuard domain.
 *
 * Classified ESSENTIAL_SERVICE: no preference is consulted, and the absolute
 * blockers — hard bounce, repeated soft bounce, complaint, admin suppression,
 * revoked contactability — still apply.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normaliseEmail } from '@/src/lib/communications/identity';
import { consumeRecipientBudget } from '@/src/lib/emailThrottle';
import { sendServiceEmail } from '@/src/lib/communications/serviceEmail';
import { currentProteinGuide } from '@/src/lib/guide/proteinGuide';

export const dynamic = 'force-dynamic';

/**
 * Email only, and strictly so.
 *
 * `.strict()` rejects unknown keys rather than ignoring them: a request that
 * tries to pass `subject`, `html`, `template` or a clinical field is a request
 * this endpoint should refuse outright, not silently accept while dropping the
 * field. 254 is the RFC 5321 maximum, and bounds the input.
 */
const GuideRequestSchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
}).strict();

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = GuideRequestSchema.safeParse(body);
    if (!parsed.success) {
      // Neutral. The shape of the contract is not a secret, but echoing the
      // parse tree back would describe the address that failed.
      return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
    }

    const email = normaliseEmail(parsed.data.email);

    // ── Guide availability ────────────────────────────────────────────────────
    //
    // Checked before the throttle, deliberately. A request that cannot possibly
    // be delivered must not consume a real person's send allowance, and this
    // check is local, pure and free. It reveals only a global product state —
    // nothing about the address.
    const guide = currentProteinGuide();
    if (!guide) {
      console.log('[guide-request] no approved Guide asset declared — not sent');
      return NextResponse.json(
        { error: 'The Protein Guide is not yet available.' },
        { status: 503 },
      );
    }

    // ── Recipient throttle ────────────────────────────────────────────────────
    //
    // After validation so malformed input never consumes budget, and before the
    // provider so the limit governs attempts rather than deliveries. The budget
    // is shared with the other public pathways: one recipient, one allowance.
    //
    // Responses stay neutral, so the endpoint cannot be used to probe whether a
    // given address was recently mailed.
    const throttle = await consumeRecipientBudget(email);

    if (throttle.outcome === 'throttled') {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }
    if (throttle.outcome === 'unavailable') {
      // Fail closed: protecting the sending domain outranks delivering during a
      // throttle-store outage.
      return NextResponse.json(
        { error: 'Temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }

    // ── Governed send ─────────────────────────────────────────────────────────
    //
    // The shared gateway owns the sequence: decide, record, send, persist the
    // provider id, mark the outcome. No governance logic is duplicated here, and
    // the providerMessageId it persists is what lets the C3D webhook reconcile a
    // later bounce or complaint against this send.
    const sent = await sendServiceEmail({
      to:         email,
      subject:    guide.subject,
      html:       guide.renderHtml(),
      from:       'MyoGuard Health <hello@myoguard.health>',
      replyTo:    'hello@myoguard.health',
      templateId: guide.templateId,
      context:    'public:protein-guide',
    });

    // A suppressed send answers exactly as a delivered one does. The caller
    // learns nothing about this address's delivery history, and a hard-bounced
    // or complained address cannot be confirmed by asking for the Guide.
    if (sent.outcome === 'suppressed') {
      return NextResponse.json({ ok: true });
    }

    if (sent.outcome !== 'sent') {
      return NextResponse.json(
        { error: 'Temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // The error object only; never the address, key, token or provider body.
    console.error('[guide-request] unexpected error', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
