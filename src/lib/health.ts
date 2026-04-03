import { prisma } from './prisma';

export type CheckStatus = 'ok' | 'warn' | 'error';

export type HealthCheck = {
  name:    string;
  status:  CheckStatus;
  message: string;
  detail?: string; // non-secret contextual info only
};

export type HealthReport = {
  overall:     CheckStatus;
  environment: string;
  timestamp:   string;
  checks:      HealthCheck[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Show only the hostname:port of a connection URL. Never shows credentials. */
function safeHost(url: string | undefined): string {
  if (!url) return '(not set)';
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return '(invalid URL format)';
  }
}

/** Show key prefix + last 4 chars. Never shows the full key. */
function maskKey(key: string, prefix?: string): string {
  if (prefix && key.startsWith(prefix)) {
    return `${prefix}…${key.slice(-4)}`;
  }
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

/** Decode a Clerk publishable key to find which instance it belongs to. */
function decodeClerkInstance(pubKey: string): string {
  try {
    const encoded = pubKey.replace(/^pk_(test|live)_/, '');
    return Buffer.from(encoded, 'base64').toString('utf8').replace(/\$+$/, '');
  } catch {
    return '(could not decode)';
  }
}

function worst(...statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('warn'))  return 'warn';
  return 'ok';
}

// ─── Health checks ────────────────────────────────────────────────────────────

async function checkDatabase(): Promise<HealthCheck[]> {
  const results: HealthCheck[] = [];

  if (!process.env.DATABASE_URL) {
    results.push({
      name:    'Database (runtime)',
      status:  'error',
      message: 'DATABASE_URL is not set — app cannot connect to Supabase',
    });
    return results;
  }

  try {
    const start = Date.now();
    await (prisma.$queryRaw`SELECT 1`);
    const ms = Date.now() - start;
    results.push({
      name:    'Database (runtime)',
      status:  'ok',
      message: `Connected and responsive (${ms} ms)`,
      detail:  `Pooler: ${safeHost(process.env.DATABASE_URL)}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Identify common failure modes
    const isTimeout  = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('etimedout');
    const isPaused   = msg.toLowerCase().includes('enotfound');
    const hint = isTimeout
      ? 'Connection timed out. Supabase free-tier projects auto-pause after inactivity.'
      : isPaused
      ? 'Host not found. Check DATABASE_URL hostname matches your Supabase project.'
      : 'Check DATABASE_URL credentials and that the Supabase project is active.';

    results.push({
      name:    'Database (runtime)',
      status:  'error',
      message: isTimeout ? 'Connection timed out' : 'Connection failed',
      detail:  `${hint} | ${msg.slice(0, 100)}`,
    });
  }

  if (!process.env.DIRECT_URL) {
    results.push({
      name:    'Database (migrations)',
      status:  'warn',
      message: 'DIRECT_URL is not set — prisma db push will fall back to DATABASE_URL (may fail via PgBouncer)',
    });
  } else {
    results.push({
      name:    'Database (migrations)',
      status:  'ok',
      message: 'Direct connection URL configured',
      detail:  `Direct: ${safeHost(process.env.DIRECT_URL)}`,
    });
  }

  return results;
}

function checkClerk(): HealthCheck[] {
  const results: HealthCheck[] = [];
  const isProd   = process.env.NODE_ENV === 'production';
  const pubKey   = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secKey   = process.env.CLERK_SECRET_KEY;
  const webhook  = process.env.CLERK_WEBHOOK_SECRET;

  if (!pubKey || !secKey) {
    results.push({
      name:    'Clerk',
      status:  'error',
      message: `Missing: ${[!pubKey && 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', !secKey && 'CLERK_SECRET_KEY'].filter(Boolean).join(', ')} — authentication is disabled`,
    });
    return results;
  }

  const isTest  = pubKey.startsWith('pk_test_');
  const isLive  = pubKey.startsWith('pk_live_');
  const instance = decodeClerkInstance(pubKey);

  if (isProd && isTest) {
    results.push({
      name:    'Clerk',
      status:  'warn',
      message: 'TEST instance active in production — existing users created in a different instance will not be found',
      detail:  `Instance: ${instance} | Switch to pk_live_ keys in Vercel env vars`,
    });
  } else {
    results.push({
      name:    'Clerk',
      status:  'ok',
      message: isLive
        ? 'Live instance configured'
        : `Test instance configured${!isProd ? ' (expected for local dev)' : ''}`,
      detail:  `Instance: ${instance}`,
    });
  }

  if (!webhook) {
    results.push({
      name:    'Clerk Webhook',
      status:  'warn',
      message: 'CLERK_WEBHOOK_SECRET not set — user.created events from Clerk will not sync new users to the database',
      detail:  'Clerk Dashboard → Webhooks → copy Signing Secret → add to env',
    });
  } else {
    results.push({
      name:    'Clerk Webhook',
      status:  'ok',
      message: 'Webhook secret configured',
    });
  }

  return results;
}

function checkResend(): HealthCheck[] {
  const key = process.env.RESEND_API_KEY;
  const isPlaceholder = !key || key === 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' || key.includes('xxx');

  if (isPlaceholder) {
    return [{
      name:    'Resend (email)',
      status:  'warn',
      message: 'RESEND_API_KEY not set — protocol emails and welcome emails are disabled',
      detail:  'resend.com → API Keys → create key → also verify myoguard.health domain in Resend',
    }];
  }

  return [{
    name:    'Resend (email)',
    status:  'ok',
    message: 'API key configured',
    detail:  maskKey(key, 're_'),
  }];
}

function checkStripe(): HealthCheck[] {
  const results: HealthCheck[] = [];
  const isProd     = process.env.NODE_ENV === 'production';
  const secretKey  = process.env.STRIPE_SECRET_KEY;
  const priceId    = process.env.STRIPE_PRICE_ID;
  const webhookSec = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) {
    results.push({
      name:    'Stripe',
      status:  'warn',
      message: 'STRIPE_SECRET_KEY not set — premium subscriptions and payments are disabled',
    });
    return results;
  }

  const isTestStripe = secretKey.startsWith('sk_test_');
  if (isProd && isTestStripe) {
    results.push({
      name:    'Stripe',
      status:  'warn',
      message: 'Test key active in production — payments will use Stripe test mode',
      detail:  maskKey(secretKey, 'sk_test_'),
    });
  } else {
    results.push({
      name:    'Stripe',
      status:  'ok',
      message: isTestStripe ? 'Test key configured (local dev)' : 'Live key configured',
      detail:  maskKey(secretKey),
    });
  }

  if (!priceId) {
    results.push({
      name:    'Stripe Price ID',
      status:  'warn',
      message: 'STRIPE_PRICE_ID not set — checkout will fail for premium upgrades',
    });
  }

  if (!webhookSec) {
    results.push({
      name:    'Stripe Webhook',
      status:  'warn',
      message: 'STRIPE_WEBHOOK_SECRET not set — subscription status changes will not sync',
    });
  }

  return results;
}

function checkAppConfig(): HealthCheck[] {
  const results: HealthCheck[] = [];
  const isProd  = process.env.NODE_ENV === 'production';
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    results.push({
      name:    'App URL',
      status:  'warn',
      message: 'NEXT_PUBLIC_APP_URL not set — email CTAs will use fallback https://myoguard.health',
    });
  } else if (isProd && (appUrl.includes('localhost') || appUrl.includes('127.0.0.1'))) {
    results.push({
      name:    'App URL',
      status:  'warn',
      message: 'NEXT_PUBLIC_APP_URL points to localhost in production — email links will be broken',
      detail:  appUrl,
    });
  } else {
    results.push({
      name:    'App URL',
      status:  'ok',
      message: appUrl,
    });
  }

  return results;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runHealthChecks(): Promise<HealthReport> {
  const [dbChecks, clerkChecks, resendChecks, stripeChecks, appChecks] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkClerk()),
    Promise.resolve(checkResend()),
    Promise.resolve(checkStripe()),
    Promise.resolve(checkAppConfig()),
  ]);

  const checks = [
    ...dbChecks,
    ...clerkChecks,
    ...resendChecks,
    ...stripeChecks,
    ...appChecks,
  ];

  const overall = worst(...checks.map(c => c.status));

  return {
    overall,
    environment: process.env.NODE_ENV ?? 'unknown',
    timestamp:   new Date().toISOString(),
    checks,
  };
}
