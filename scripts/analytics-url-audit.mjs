/**
 * scripts/analytics-url-audit.mjs
 *
 * Privacy regression guard for the PostHog URL sanitiser (Build 8C-1).
 *
 * MyoGuard uses dynamic routes whose segments are bearer tokens or database
 * identifiers. PostHog attaches the full URL to every event as $current_url and
 * carries the previous page forward as $referrer, so an unredacted pageview
 * would transmit a report share token or a patient ID to a third party.
 *
 * This script asserts that src/lib/posthog.ts still redacts every known
 * sensitive route, and — just as important — that it does NOT over-redact
 * public content slugs, which would silently destroy SEO landing-page reporting.
 *
 * Usage:
 *   npm run audit:analytics
 *
 * Requires Node >= 22.18 (native TypeScript type stripping). Verified on v24.
 * Pure static analysis: no network, no database, no PostHog key needed.
 */

import {
  redactAnalyticsPath,
  sanitizeAnalyticsProperties,
} from '../src/lib/posthog.ts';

// ANSI colour helpers
const GREEN = s => `\x1b[32m${s}\x1b[0m`;
const RED   = s => `\x1b[31m${s}\x1b[0m`;
const DIM   = s => `\x1b[2m${s}\x1b[0m`;
const BOLD  = s => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log(`  ${GREEN('✓')} ${label} ${DIM(`→ ${actual}`)}`);
  } else {
    failures.push({ label, actual, expected });
    console.log(`  ${RED('✗')} ${label}`);
    console.log(`      ${DIM('expected:')} ${expected}`);
    console.log(`      ${RED('actual:  ')} ${actual}`);
  }
}

/** Asserts the redacted output retains no trace of a sensitive value. */
function checkNoLeak(label, actual, secret) {
  if (!actual.includes(secret)) {
    passed++;
    console.log(`  ${GREEN('✓')} ${label} ${DIM('— secret absent')}`);
  } else {
    failures.push({ label, actual, expected: `must not contain "${secret}"` });
    console.log(`  ${RED('✗')} ${label} ${RED('— SECRET PRESENT')}`);
    console.log(`      ${RED('actual: ')} ${actual}`);
  }
}

console.log('');
console.log(BOLD('MyoGuard Protocol — Analytics URL Privacy Audit'));
console.log(DIM('Source: src/lib/posthog.ts'));
console.log('');

// ─── 1. Sensitive dynamic routes must be redacted ────────────────────────────

const SHARE_TOKEN  = 'a7f3c9e14b2d806fbe51community';
const PATIENT_ID   = 'clx8f3k29000012ab34cd';
const ASSESSMENT_ID = 'clx9m2p71000045ef67gh';
const DOCTOR_ID    = 'clx7a1b52000078ij90kl';
const SHEET_ID     = 'clx6z9y83000011mn22op';

console.log(BOLD('1. Sensitive routes'));
check('report share token',
  redactAnalyticsPath(`/report/${SHARE_TOKEN}`),
  '/report/[token]');
check('patient detail',
  redactAnalyticsPath(`/doctor/patients/${PATIENT_ID}`),
  '/doctor/patients/[userId]');
check('patient evidence',
  redactAnalyticsPath(`/doctor/patients/${PATIENT_ID}/evidence`),
  '/doctor/patients/[userId]/evidence');
check('patient print',
  redactAnalyticsPath(`/doctor/patients/${PATIENT_ID}/print`),
  '/doctor/patients/[userId]/print');
check('patient nested result',
  redactAnalyticsPath(`/doctor/patients/${PATIENT_ID}/results/${ASSESSMENT_ID}`),
  '/doctor/patients/[userId]/results/[assessmentId]');
check('patient own result',
  redactAnalyticsPath(`/dashboard/results/${ASSESSMENT_ID}`),
  '/dashboard/results/[id]');
check('start sheet',
  redactAnalyticsPath(`/doctor/start-sheet/${SHEET_ID}`),
  '/doctor/start-sheet/[id]');
check('physician invite',
  redactAnalyticsPath(`/invite/${DOCTOR_ID}`),
  '/invite/[doctorId]');
console.log('');

// ─── 2. Static and content routes must survive untouched ─────────────────────
//
// Over-redaction is a real failure mode: collapsing content slugs would destroy
// SEO landing-page analytics, which is one of the reasons to run PostHog at all.

console.log(BOLD('2. Public routes preserved'));
for (const path of [
  '/',
  '/get-started',
  '/research',
  '/research/muscle-preservation',
  '/research/protein-requirements',
  '/research/sarcopenia-risk',
  '/research/glp1-therapy',
  '/doctor/patients',        // list page — must NOT collapse to [userId]
  '/doctor/start-sheet',     // list page — must NOT collapse to [id]
  '/doctor/practice-intelligence',
  '/dashboard',
  '/sign-in-new',
  '/privacy',
  '/terms',
  // ── Patient education (C-FUNNEL-2) ────────────────────────────────────────
  //
  // `/learn/protein-on-glp-1` is the hard case and the reason the exact-path
  // exemption exists. The slug is exactly 16 characters and contains a digit —
  // the "1" of GLP-1 — so the generic identifier heuristic classified it as a
  // token and reported the article as `/learn/[id]`. That silently merged the
  // first measured step of the acquisition funnel with every future page under
  // the same parent. If this check ever fails again, funnel reporting is
  // broken even though every event still fires.
  '/learn',
  '/learn/protein-on-glp-1',
]) {
  check(`preserved ${path}`, redactAnalyticsPath(path), path);
}

// The exemption is by exact path, so a token under the same parent must still
// be scrubbed. This is the assertion that stops the exemption widening.
check(
  'still redacts an identifier-shaped path under /learn',
  redactAnalyticsPath('/learn/c9f2a41be77d4e0a8b15'),
  '/learn/[id]',
);
check(
  'trailing slash resolves to the same public page',
  redactAnalyticsPath('/learn/protein-on-glp-1/'),
  '/learn/protein-on-glp-1/',
);
console.log('');

// ─── 3. Full-URL properties, query strings, and referrers ────────────────────

console.log(BOLD('3. Event property sanitisation'));

const props = sanitizeAnalyticsProperties({
  $current_url: `https://myoguard.health/report/${SHARE_TOKEN}?utm_source=linkedin&session=SECRETVAL#frag`,
  $pathname:    `/report/${SHARE_TOKEN}`,
  $referrer:    `https://myoguard.health/doctor/patients/${PATIENT_ID}`,
  $initial_referrer: '$direct',
  risk_band:    'MODERATE',
});

checkNoLeak('$current_url drops share token', props.$current_url, SHARE_TOKEN);
checkNoLeak('$current_url drops unknown query param', props.$current_url, 'SECRETVAL');
check('$current_url keeps utm_source',
  props.$current_url,
  'https://myoguard.health/report/[token]?utm_source=linkedin');
check('$pathname redacted',
  props.$pathname,
  '/report/[token]');
checkNoLeak('$referrer drops patient ID', props.$referrer, PATIENT_ID);
check('$direct sentinel preserved', props.$initial_referrer, '$direct');
check('non-URL properties untouched', props.risk_band, 'MODERATE');
console.log('');

// ─── 4. Query-parameter allowlist ────────────────────────────────────────────
//
// The allowlist is minimum-necessary acquisition only: utm_*, gclid, fbclid.
//
// `ref` is the physician referral code (/join?ref=DR-OKPALA-472). Its format is
// DR-LASTNAME-NNN, so the value embeds a physician's SURNAME — a direct personal
// identifier. `via` is read only as `via === 'qr'`, but its value space is
// unconstrained, so it is not a safe categorical. Both must be dropped.

console.log(BOLD('4. Query-parameter allowlist'));

const REFERRAL_CODE = 'DR-OKPALA-472';

const joinProps = sanitizeAnalyticsProperties({
  $current_url: `https://myoguard.health/join?ref=${REFERRAL_CODE}&preload=${SHEET_ID}&via=qr`,
});
checkNoLeak('ref dropped — physician surname must not reach analytics',
  joinProps.$current_url, REFERRAL_CODE);
checkNoLeak('ref dropped — surname substring absent',
  joinProps.$current_url, 'OKPALA');
checkNoLeak('via dropped — value space is unconstrained',
  joinProps.$current_url, 'via');
checkNoLeak('preload ID dropped',
  joinProps.$current_url, SHEET_ID);
check('join URL reduced to bare path',
  joinProps.$current_url,
  'https://myoguard.health/join');

const campaignProps = sanitizeAnalyticsProperties({
  $current_url:
    'https://myoguard.health/?utm_source=linkedin&utm_medium=social' +
    '&utm_campaign=glp1&utm_term=sarcopenia&utm_content=hero&utm_id=42' +
    '&gclid=GCL123&fbclid=FB456&ref=DR-SMITH-001&via=qr&session=SECRET',
});
check('all utm_* + gclid + fbclid retained, everything else dropped',
  campaignProps.$current_url,
  'https://myoguard.health/?utm_source=linkedin&utm_medium=social' +
  '&utm_campaign=glp1&utm_term=sarcopenia&utm_content=hero&utm_id=42' +
  '&gclid=GCL123&fbclid=FB456');

// Referrer carries the same risk: a physician who lands on /join?ref=... and
// then navigates onward would otherwise leak the code via $referrer.
const refReferrer = sanitizeAnalyticsProperties({
  $referrer: `https://myoguard.health/join?ref=${REFERRAL_CODE}`,
});
checkNoLeak('$referrer drops referral code', refReferrer.$referrer, REFERRAL_CODE);
console.log('');

// ─── 5. Catch-all for routes added after Build 8C-1 ──────────────────────────

console.log(BOLD('5. Unknown-route safety net'));
check('future route with cuid',
  redactAnalyticsPath(`/some/future/route/${PATIENT_ID}`),
  '/some/future/route/[id]');
check('future route with uuid',
  redactAnalyticsPath('/x/3f2504e0-4f89-11d3-9a0c-0305e82c3301'),
  '/x/[id]');
console.log('');

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(BOLD('Results'));
console.log(`  ${GREEN(`${passed} passed`)}  ${failures.length > 0 ? RED(`${failures.length} failed`) : DIM('0 failed')}`);

if (failures.length > 0) {
  console.log('');
  console.log(RED('PRIVACY REGRESSION — analytics URL redaction is incomplete.'));
  console.log(RED('Do not enable PostHog until these pass.'));
  console.log('');
  process.exit(1);
}

console.log('');
console.log(GREEN('All analytics URL redaction checks passed.'));
console.log('');
process.exit(0);
