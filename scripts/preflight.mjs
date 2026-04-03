#!/usr/bin/env node
/**
 * MyoGuard Preflight Check
 * Run before deploy or after environment changes to verify the system
 * is correctly configured.
 *
 * Usage:
 *   node scripts/preflight.mjs           # exit 0 if all required vars set
 *   node scripts/preflight.mjs --strict  # exit 1 on any warning too
 *   node scripts/preflight.mjs --ci      # same as --strict, machine-readable
 *
 * Checks:
 *   1. All required/optional env vars
 *   2. Clerk instance type (test vs live)
 *   3. Prisma schema validation
 */

import { readFileSync, existsSync } from 'fs';
import { execSync }                 from 'child_process';
import { resolve, dirname }         from 'path';
import { fileURLToPath }            from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const isStrict  = process.argv.includes('--strict') || process.argv.includes('--ci');
const isCI      = process.argv.includes('--ci');

// ─── ANSI colours (disabled in CI) ───────────────────────────────────────────
const c = isCI ? { ok: '', warn: '', error: '', reset: '', bold: '', dim: '' } : {
  ok:    '\x1b[32m',
  warn:  '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
};

// ─── .env loader (no external dependencies) ──────────────────────────────────
function loadDotenv(path) {
  if (!existsSync(path)) {
    console.warn(`${c.warn}⚠  ${path} not found — relying on environment variables already set${c.reset}`);
    return;
  }
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/\r$/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let   val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding single or double quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// ─── Result tracking ─────────────────────────────────────────────────────────
let errors   = 0;
let warnings = 0;

function pass(label, note = '') {
  console.log(`  ${c.ok}✓${c.reset} ${label}${note ? `  ${c.dim}${note}${c.reset}` : ''}`);
}

function warn(label, note = '') {
  warnings++;
  console.log(`  ${c.warn}⚠${c.reset} ${label}${note ? `\n      ${c.dim}${note}${c.reset}` : ''}`);
}

function fail(label, note = '') {
  errors++;
  console.log(`  ${c.error}✗${c.reset} ${label}${note ? `\n      ${c.dim}${note}${c.reset}` : ''}`);
}

function section(title) {
  console.log(`\n${c.bold}${title}${c.reset}`);
}

// ─── Var definitions ─────────────────────────────────────────────────────────
const REQUIRED = [
  { key: 'DATABASE_URL',                      note: 'Supabase PgBouncer pooled URL (port 6543, include ?pgbouncer=true)' },
  { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', note: 'Clerk publishable key (pk_test_ for dev, pk_live_ for prod)' },
  { key: 'CLERK_SECRET_KEY',                  note: 'Clerk secret key (sk_test_ for dev, sk_live_ for prod)' },
];

const WARNED = [
  { key: 'DIRECT_URL',              note: 'Direct Supabase URL (port 5432) — required for prisma db push' },
  { key: 'CLERK_WEBHOOK_SECRET',    note: 'Clerk webhook signing secret — user sync on new sign-ups' },
  { key: 'RESEND_API_KEY',          note: 'Resend API key — required for email delivery' },
  { key: 'NEXT_PUBLIC_APP_URL',     note: 'App base URL — used in email templates' },
  { key: 'STRIPE_SECRET_KEY',       note: 'Stripe secret key — required for payments' },
  { key: 'STRIPE_PRICE_ID',         note: 'Stripe Price ID for premium subscription' },
  { key: 'STRIPE_WEBHOOK_SECRET',   note: 'Stripe webhook secret — subscription sync' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log(`${c.bold}MyoGuard Preflight Check${c.reset}  ${c.dim}${new Date().toISOString()}${c.reset}`);
console.log(`${c.dim}Root: ${ROOT}${c.reset}`);

loadDotenv(resolve(ROOT, '.env'));

// ─── 1. Required vars ─────────────────────────────────────────────────────────
section('Required env vars');

for (const { key, note } of REQUIRED) {
  const val = process.env[key];
  if (!val) {
    fail(key, note);
  } else {
    pass(key);
  }
}

// ─── 2. Warned vars ───────────────────────────────────────────────────────────
section('Optional / integration vars');

for (const { key, note } of WARNED) {
  const val = process.env[key];
  const isPlaceholder = val && (val.includes('xxxxxx') || val === 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  if (!val || isPlaceholder) {
    warn(key, note);
  } else {
    pass(key);
  }
}

// ─── 3. Clerk instance check ──────────────────────────────────────────────────
section('Clerk instance');

const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (pubKey) {
  const isTest = pubKey.startsWith('pk_test_');
  const isLive = pubKey.startsWith('pk_live_');
  let instanceName = '(unknown)';
  try {
    const encoded = pubKey.replace(/^pk_(test|live)_/, '');
    instanceName = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$+$/, '');
  } catch {}

  if (isTest) {
    warn(`Test instance active: ${instanceName}`, 'Acceptable for local dev. Switch to pk_live_ before going live in production.');
  } else if (isLive) {
    pass(`Live instance: ${instanceName}`);
  } else {
    fail('Unrecognised key format', `Expected pk_test_ or pk_live_ prefix. Got: ${pubKey.slice(0, 12)}...`);
  }
} else {
  fail('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set — cannot check instance');
}

// ─── 4. Prisma schema validation ──────────────────────────────────────────────
section('Prisma schema');

try {
  execSync('npx prisma validate', {
    cwd:    ROOT,
    stdio:  'pipe',
    env:    process.env,
  });
  pass('prisma validate', 'schema.prisma is valid');
} catch (err) {
  const output = err.stdout?.toString() || err.message || '';
  fail('prisma validate failed', output.trim().slice(0, 200));
}

// ─── 5. Resend placeholder check ─────────────────────────────────────────────
section('Integration key quality');

const resendKey = process.env.RESEND_API_KEY;
if (resendKey && resendKey !== 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' && !resendKey.includes('xxxxx')) {
  pass('RESEND_API_KEY looks real (not a placeholder)');
} else if (resendKey) {
  warn('RESEND_API_KEY appears to be a placeholder', 'Replace with a real key from resend.com/api-keys');
} else {
  warn('RESEND_API_KEY not set', 'Email delivery will be disabled');
}

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (stripeKey && !stripeKey.includes('xxxxx')) {
  pass(`STRIPE_SECRET_KEY looks real (${stripeKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'} mode)`);
} else if (stripeKey) {
  warn('STRIPE_SECRET_KEY appears to be a placeholder');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);

if (errors === 0 && warnings === 0) {
  console.log(`${c.ok}${c.bold}All checks passed.${c.reset}`);
} else {
  if (errors > 0) {
    console.log(`${c.error}${c.bold}${errors} error(s)${c.reset}  ${errors > 0 ? '— app will not function correctly' : ''}`);
  }
  if (warnings > 0) {
    console.log(`${c.warn}${warnings} warning(s)${c.reset}  — features will be degraded`);
  }
}

// Exit codes:
//   0 = no errors (warnings allowed unless --strict)
//   1 = errors present, OR --strict with warnings
const shouldFail = errors > 0 || (isStrict && warnings > 0);
process.exit(shouldFail ? 1 : 0);
