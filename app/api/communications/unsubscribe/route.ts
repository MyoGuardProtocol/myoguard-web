/**
 * POST /api/communications/unsubscribe
 *
 * Public, no login. The recipient exercises the link they were given.
 *
 * POST ONLY. There is deliberately no GET handler: corporate mail scanners and
 * link prefetchers follow links, and a mutating GET would unsubscribe people
 * who never clicked. The human-facing confirmation lives at /unsubscribe, which
 * renders and mutates nothing.
 *
 * This endpoint can only ever REDUCE what MyoGuard sends. There is no path here
 * that subscribes, re-subscribes, reads an address, or reveals anything about
 * the recipient — which is what makes a non-expiring bearer token acceptable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken, OPTIONAL_CLASSES } from '@/src/lib/communications/unsubscribeToken';
import { withdrawConsent } from '@/src/lib/communications/preferenceService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Body parsing is best-effort. RFC 8058 fixes the one-click body as the
  // literal `List-Unsubscribe=One-Click` and carries no token at all, so a body
  // that yields nothing usable is not by itself an error — the query string is
  // checked before anything is refused.
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    try {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    } catch {
      // Leave body empty and fall through to the query string.
    }
  }

  const { token: bodyToken, scope } = (body ?? {}) as { token?: unknown; scope?: unknown };

  // Phase 1D-C3D: `?t=` is where the RFC 8058 List-Unsubscribe header puts the
  // capability, because the body is spoken for. Same signed token, same
  // verification, same allowlist — not a second, weaker entry path.
  const queryToken = req.nextUrl.searchParams.get('t');

  const token = typeof bodyToken === 'string' && bodyToken ? bodyToken : queryToken;

  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
  }

  const verified = verifyUnsubscribeToken(token);

  if (!verified.ok) {
    // Fail closed on a missing secret: this is an outage, not a bad link, and
    // must be distinguishable so a recipient is told to try again rather than
    // being told their link is invalid.
    if (verified.reason === 'secret_unavailable') {
      return NextResponse.json(
        { ok: false, error: 'Temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }
    console.log(`[unsubscribe] token rejected reason=${verified.reason}`);
    return NextResponse.json({ ok: false, error: 'This link is not valid.' }, { status: 400 });
  }

  const { k: recipientKey, kv: keyVersion, ch: channel, cl: tokenClass } = verified.payload;

  // `scope` decides breadth, never which classes are eligible. Both branches
  // draw from the optional allowlist, so ESSENTIAL_SERVICE and
  // OPERATIONAL_INTERNAL are unreachable regardless of what is posted.
  const allOptional = scope === 'all_optional';
  const classes = allOptional ? OPTIONAL_CLASSES : [tokenClass];

  const result = await withdrawConsent({
    recipientKey,
    keyVersion,
    channel,
    classes,
    sourceSurface: allOptional ? 'email_unsubscribe_all_optional' : 'email_unsubscribe_link',
    actorType:     'SELF',
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: 'Temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }

  // Idempotent: a repeat click reports success with nothing changed rather than
  // an error or a duplicate ledger entry.
  return NextResponse.json({
    ok:               true,
    scope:            allOptional ? 'all_optional' : 'class',
    changed:          result.changed,
    alreadyWithdrawn: result.alreadyWithdrawn,
  });
}
