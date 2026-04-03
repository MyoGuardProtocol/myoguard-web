/**
 * config-check.ts
 *
 * Runs at server startup via instrumentation.ts (Next.js).
 * Emits clear, structured warnings to the server log when obvious
 * misconfigurations are detected. Does NOT throw — always allows the
 * app to boot so health checks and diagnostics pages remain accessible.
 *
 * Log lines are prefixed with [config] so they are grep-able in Vercel
 * and other structured logging systems.
 */

const TAG = '[config]';

function warn(msg: string, detail?: string) {
  console.warn(`${TAG} ⚠  ${msg}${detail ? ` — ${detail}` : ''}`);
}

function error(msg: string, detail?: string) {
  console.error(`${TAG} ✗  ${msg}${detail ? ` — ${detail}` : ''}`);
}

function ok(msg: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${TAG} ✓  ${msg}`);
  }
}

/** Decode a Clerk publishable key to show which instance is active. */
function clerkInstanceName(pubKey: string): string {
  try {
    const encoded = pubKey.replace(/^pk_(test|live)_/, '');
    return Buffer.from(encoded, 'base64').toString('utf8').replace(/\$+$/, '');
  } catch {
    return '(unknown)';
  }
}

export function checkConfig(): void {
  const isProd  = process.env.NODE_ENV === 'production';
  const prefix  = isProd ? 'PRODUCTION' : 'development';

  // ── Database ──────────────────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    error('DATABASE_URL is not set', 'app will fail on all database operations');
  }
  if (!process.env.DIRECT_URL) {
    warn('DIRECT_URL is not set', 'prisma db push will fail (required for schema migrations)');
  }

  // ── Clerk ─────────────────────────────────────────────────────────────────
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secKey = process.env.CLERK_SECRET_KEY;

  if (!pubKey || !secKey) {
    error('Clerk keys missing', 'authentication is disabled');
  } else {
    const isTest     = pubKey.startsWith('pk_test_');
    const instanceId = clerkInstanceName(pubKey);

    if (isProd && isTest) {
      error(
        `Clerk TEST instance is active in PRODUCTION (${instanceId})`,
        'users created in a live instance will not be found — update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to pk_live_ / sk_live_ keys',
      );
    } else {
      ok(`Clerk: ${isTest ? 'test' : 'live'} instance — ${instanceId}`);
    }

    if (!process.env.CLERK_WEBHOOK_SECRET) {
      warn(
        'CLERK_WEBHOOK_SECRET is not set',
        'user.created events from Clerk will not create database rows — new sign-ups will only get a DB row on first dashboard visit (three-phase provisioning handles this, but webhook sync is preferred)',
      );
    }
  }

  // ── Resend ────────────────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  const isPlaceholder = !resendKey
    || resendKey.includes('xxx')
    || resendKey === 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  if (isPlaceholder) {
    warn(
      'RESEND_API_KEY is not set',
      '/api/email-capture and /api/email will return delivered:false — no emails will be sent',
    );
  }

  // ── Stripe ────────────────────────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    warn('STRIPE_SECRET_KEY is not set', 'payments and premium subscriptions are disabled');
  } else if (isProd && process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    warn('STRIPE_SECRET_KEY is a test key in production', 'payments will run in test mode');
  }

  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_PRICE_ID) {
    warn('STRIPE_PRICE_ID is not set', '/api/stripe/checkout will fail');
  }

  // ── App URL ───────────────────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    warn('NEXT_PUBLIC_APP_URL is not set', 'email templates will use fallback https://myoguard.health');
  } else if (isProd && (appUrl.includes('localhost') || appUrl.includes('127.0.0.1'))) {
    warn('NEXT_PUBLIC_APP_URL points to localhost in production', 'email CTA links will be broken');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`${TAG} Configuration check complete (${prefix})`);
  }
}
