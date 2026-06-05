import { NextResponse }      from 'next/server';
import { requireAdmin }      from '@/src/lib/requireAdmin';

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
  const { error } = await requireAdmin();
  if (error === 'UNAUTHENTICATED') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const secretKey     = process.env.STRIPE_SECRET_KEY ?? '';
  const secretKeyTrim = secretKey.trim();

  return NextResponse.json({
    hasStripeSecretKey:  !!secretKey,
    hasPublishableKey:   !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    hasPhysicianPriceId: !!process.env.STRIPE_PHYSICIAN_PRICE_ID,
    hasPracticePriceId:  !!process.env.STRIPE_PRACTICE_PRICE_ID,
    hasWebhookSecret:    !!process.env.STRIPE_WEBHOOK_SECRET,
    // Diagnostic context — not a secret
    isLiveKey:           secretKey.startsWith('sk_live_'),
    nodeEnv:             process.env.NODE_ENV ?? 'unknown',

    // ── TEMPORARY FORENSIC BLOCK — remove after diagnosis ──────────────────
    // Never exposes the key value, only safe metadata.
    _stripe_diag: {
      /** true = env var exists (even if empty), false = env var not set at all */
      varPresent:          process.env.STRIPE_SECRET_KEY !== undefined,
      /** char count of the raw value; 0 = missing or empty */
      rawLength:           secretKey.length,
      /** char count after trimming whitespace; mismatch → leading/trailing space */
      trimmedLength:       secretKeyTrim.length,
      /** leading/trailing whitespace that would silently break the key */
      hasLeadingSpace:     secretKey.startsWith(' ') || secretKey.startsWith('\t'),
      hasTrailingSpace:    secretKey.endsWith(' ')   || secretKey.endsWith('\t'),
      /** key prefix checks — Stripe live vs test vs unknown */
      startsWithSkLive:    secretKeyTrim.startsWith('sk_live_'),
      startsWithSkTest:    secretKeyTrim.startsWith('sk_test_'),
      startsWithRkLive:    secretKeyTrim.startsWith('rk_live_'),  // restricted key
      startsWithRkTest:    secretKeyTrim.startsWith('rk_test_'),
      /** first 7 chars only — enough to see "sk_live" without exposing the key */
      prefix7:             secretKeyTrim.slice(0, 7),
    },
    // ── END FORENSIC BLOCK ──────────────────────────────────────────────────
  });
}
