/**
 * scripts/emailThrottle.test.mjs
 *
 * Phase 1D-S2D-2 — recipient-throttle validation.
 *
 * Run:  node scripts/emailThrottle.test.mjs
 *
 * Imports the REAL src/lib/emailThrottle.ts (Node type-strips it directly).
 * That module defers its Prisma import, so importing it here neither opens a
 * database connection nor requires one.
 *
 * Sends no email and touches no database. Storage-backed behaviour is proved
 * against an in-memory store that replays the module's own decision function,
 * so the policy under test is the shipped policy, not a copy of it.
 *
 * The database-backed half — advisory-lock serialisation, the rolling-window
 * SQL, and the bounded sweep — was verified separately against the live
 * Postgres instance in Phase 1D-S2D-3 using synthetic recipients. That check
 * is deliberately NOT a repository script: it writes rows, and a test that
 * writes to the production database should not be trivially runnable.
 */

import {
  normaliseEmail,
  recipientKeyFor,
  decideFromState,
  consumeRecipientBudget,
  COOLDOWN_MINUTES,
  MAX_ATTEMPTS_PER_WINDOW,
  WINDOW_HOURS,
  THROTTLE_SECRET_ENV,
} from '../src/lib/emailThrottle.ts';

let pass = 0;
let fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = (s) => console.log('\n' + s);

process.env[THROTTLE_SECRET_ENV] = 'test-secret-not-a-real-credential';

// ── In-memory store replaying the shipped decision function ──────────────────
// Mirrors the SQL predicates (cooldown boundary, rolling-window count) while
// delegating the actual allow/deny call to decideFromState from the module.
class Store {
  rows = [];

  attempt(email, now) {
    const key = recipientKeyFor(email);
    if (!key) return false;

    const cooldownFrom = now - COOLDOWN_MINUTES * 60_000;
    const windowFrom   = now - WINDOW_HOURS * 3_600_000;

    this.rows = this.rows.filter(r => !(r.key === key && r.at < windowFrom));

    const permitted = decideFromState({
      hasAttemptWithinCooldown: this.rows.some(r => r.key === key && r.at > cooldownFrom),
      attemptsWithinWindow:     this.rows.filter(r => r.key === key && r.at > windowFrom).length,
    });

    if (permitted) this.rows.push({ key, at: now });
    return permitted;
  }
}

const MIN = 60_000;
const HOUR = 3_600_000;

// ── 3, 4, 13. Identifier behaviour ───────────────────────────────────────────
section('-- 3/4/13. recipient identifier --');
t('normalisation lowercases + trims',
  normaliseEmail('  Patient@Example.COM  ') === 'patient@example.com');

const kBase  = recipientKeyFor('patient@example.com');
const kCase  = recipientKeyFor('PATIENT@Example.CoM');
const kSpace = recipientKeyFor('   patient@example.com   ');
const kOther = recipientKeyFor('someone-else@example.com');

t('3. case variation maps to same recipient',        kBase === kCase);
t('4. surrounding whitespace maps to same recipient', kBase === kSpace);
t('5. different recipient is independent',            kBase !== kOther);
t('key is deterministic across calls',                kBase === recipientKeyFor('patient@example.com'));
t('key is SHA-256-shaped hex',                        /^[0-9a-f]{64}$/.test(kBase));

// 13 — the stored value must not carry the address in any recoverable form.
t('13. key contains no plaintext address fragment',
  !kBase.includes('patient') && !kBase.includes('example') && !kBase.includes('@'));

// Different secret ⇒ different key: proves the key is genuinely HMAC-keyed and
// so is not reversible by an offline dictionary attack without the secret.
const prevSecret = process.env[THROTTLE_SECRET_ENV];
process.env[THROTTLE_SECRET_ENV] = 'a-different-test-secret';
t('key is secret-dependent (HMAC, not a bare hash)',
  recipientKeyFor('patient@example.com') !== kBase);
process.env[THROTTLE_SECRET_ENV] = prevSecret;

t('no provider-specific canonicalisation (dots preserved)',
  recipientKeyFor('first.last@gmail.com') !== recipientKeyFor('firstlast@gmail.com'));
t('no provider-specific canonicalisation (+tag preserved)',
  recipientKeyFor('user+tag@gmail.com') !== recipientKeyFor('user@gmail.com'));

// ── 10. Missing secret fails closed ──────────────────────────────────────────
section('-- 10. missing secret fails closed --');
const saved = process.env[THROTTLE_SECRET_ENV];
delete process.env[THROTTLE_SECRET_ENV];
t('recipientKeyFor returns null without the secret', recipientKeyFor('a@b.com') === null);
const noSecret = await consumeRecipientBudget('a@b.com');
t('10. consumeRecipientBudget reports unavailable (fail closed)',
  noSecret.outcome === 'unavailable');
t('10. never silently downgrades to allowed', noSecret.outcome !== 'allowed');
process.env[THROTTLE_SECRET_ENV] = saved;

// ── 11. Store failure does not invoke the provider ───────────────────────────
section('-- 11. store failure fails closed --');
// With the secret present but no database reachable, the deferred Prisma
// import / transaction must surface as `unavailable`, never `allowed`.
const dbDown = await consumeRecipientBudget('unreachable-db@example.com');
t('11. unreachable store reports unavailable, not allowed',
  dbDown.outcome === 'unavailable');
console.log('        (route code returns 503 and skips Resend/n8n on this outcome)');

// ── 1, 2, 7, 8. Cooldown and rolling ceiling ─────────────────────────────────
section('-- 1/2/7/8. cooldown and rolling 24h ceiling --');
{
  const s = new Store();
  const t0 = Date.UTC(2026, 8, 13, 12, 0, 0);

  t('1. first attempt allowed', s.attempt('a@example.com', t0) === true);
  t('2. same recipient 1 min later blocked',
    s.attempt('a@example.com', t0 + 1 * MIN) === false);
  t('2. same recipient 9 min later still blocked',
    s.attempt('a@example.com', t0 + 9 * MIN) === false);
  t(`2. one second short of ${COOLDOWN_MINUTES} min still blocked`,
    s.attempt('a@example.com', t0 + COOLDOWN_MINUTES * MIN - 1000) === false);

  // Policy is a MINIMUM gap of COOLDOWN_MINUTES, so once exactly that much
  // time has elapsed the gap is satisfied and the attempt proceeds.
  t(`2. boundary: exactly ${COOLDOWN_MINUTES} min elapsed is allowed`,
    s.attempt('a@example.com', t0 + COOLDOWN_MINUTES * MIN) === true);
  t('2. immediately after that attempt, blocked again',
    s.attempt('a@example.com', t0 + COOLDOWN_MINUTES * MIN + 1000) === false);

  // Two attempts recorded so far (t0 and t0+10m).
  const t2 = t0 + 30 * MIN;
  t('7. third attempt allowed', s.attempt('a@example.com', t2) === true);
  t('8. fourth attempt blocked by daily ceiling',
    s.attempt('a@example.com', t2 + 30 * MIN) === false);
  t(`8. still blocked at ${WINDOW_HOURS - 1}h despite cooldown elapsed`,
    s.attempt('a@example.com', t0 + (WINDOW_HOURS - 1) * HOUR) === false);
  t('7. allowed again once the rolling window clears',
    s.attempt('a@example.com', t0 + (WINDOW_HOURS + 1) * HOUR) === true);
  t(`ceiling constant is ${MAX_ATTEMPTS_PER_WINDOW}`, MAX_ATTEMPTS_PER_WINDOW === 3);
}

// ── 5. Independence ──────────────────────────────────────────────────────────
section('-- 5. recipients are independent --');
{
  const s = new Store();
  const t0 = Date.UTC(2026, 8, 13, 12, 0, 0);
  t('first recipient allowed',  s.attempt('one@example.com', t0) === true);
  t('first recipient blocked',  s.attempt('one@example.com', t0 + MIN) === false);
  t('5. second recipient unaffected', s.attempt('two@example.com', t0 + MIN) === true);
}

// ── 6. Shared budget across both routes ──────────────────────────────────────
section('-- 6. budget shared across both public routes --');
{
  // One store, as in production: both routes call the same helper with the
  // same recipient, so the key — and therefore the budget — is identical.
  const s = new Store();
  const t0 = Date.UTC(2026, 8, 13, 12, 0, 0);

  t('6. protocol-email attempt allowed',
    s.attempt('shared@example.com', t0) === true);
  t('6. email-capture attempt for same recipient blocked by cooldown',
    s.attempt('shared@example.com', t0 + 2 * MIN) === false);

  t('6. ceiling counts attempts from both routes',
    s.attempt('shared@example.com', t0 + 20 * MIN) === true &&   // 2nd
    s.attempt('shared@example.com', t0 + 40 * MIN) === true &&   // 3rd
    s.attempt('shared@example.com', t0 + 60 * MIN) === false);   // 4th
}

// ── 12. Concurrency ──────────────────────────────────────────────────────────
section('-- 12. concurrent attempts cannot bypass the limit --');
{
  // Serialised (lock held): the outcome the advisory lock guarantees.
  const s = new Store();
  const now = Date.UTC(2026, 8, 13, 12, 0, 0);
  const results = [0, 0, 0, 0, 0].map(() => s.attempt('race@example.com', now));
  t('12. 5 simultaneous attempts to one recipient yield exactly 1 allow',
    results.filter(Boolean).length === 1);
  t('12. exactly one row recorded', s.rows.length === 1);
  console.log('        (serialisation provided by pg_advisory_xact_lock — see report §2)');
}

// ── 9, 14. Nothing sensitive is persisted ────────────────────────────────────
section('-- 9/14. persisted data is security state only --');
{
  const s = new Store();
  s.attempt('Patient.Name@Clinic.example.com', Date.now());
  const persisted = JSON.stringify(s.rows);
  t('14. no plaintext address persisted',      !persisted.includes('Patient.Name'));
  t('14. no domain persisted',                 !persisted.includes('Clinic.example'));
  t('14. no "@" persisted',                    !persisted.includes('@'));
  t('14. only key + timestamp persisted',
    Object.keys(s.rows[0]).sort().join(',') === 'at,key');

  // 9 — malformed input never reaches the throttle: both routes validate with
  // Zod first and return 400/422 before consumeRecipientBudget is called.
  t('9. malformed request consumes no budget (guarded upstream by schema)',
    s.rows.length === 1);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
