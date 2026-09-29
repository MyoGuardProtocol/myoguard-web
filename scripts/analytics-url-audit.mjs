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
// Evidence Explained: every article URL reports as the route pattern, so an
// unpublished or guessed slug never reaches analytics. Synthetic slugs only.
check('evidence article',
  redactAnalyticsPath('/learn/evidence/synthetic-article-slug'),
  '/learn/evidence/[slug]');
check('evidence article, digit-free guess',
  redactAnalyticsPath('/learn/evidence/unpublished'),
  '/learn/evidence/[slug]');
check('evidence article, full URL',
  sanitizeAnalyticsProperties({ $current_url: 'https://myoguard.health/learn/evidence/synthetic-article-slug?utm_source=x&ref=DR-X-1' }).$current_url,
  'https://myoguard.health/learn/evidence/[slug]?utm_source=x');
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

// ─── 6. P0 2026-09-29 — every URL-bearing property, whole payloads ───────────
//
// The sanitiser covered six property names; posthog-js also sent
// $prev_pageview_pathname and $session_entry_url/_pathname raw, carrying share
// tokens and patient/result IDs to PostHog. These checks enumerate every
// property the SDK is known to emit, exercise the unlisted-property safety net,
// and scan whole sanitised event payloads recursively for any raw identifier.
// Synthetic identifiers only.

console.log(BOLD('6. P0 — all URL-bearing properties and whole payloads'));

const { readFileSync } = await import('node:fs');

const SYN = {
  token:  'FAKE_PROBE_TOKEN',
  user:   'FAKE_USER_ID',
  result: 'FAKE_RESULT_ID',
  slug:   'fake-evidence-slug',
  query:  'FAKE_QUERY_SECRET',
  frag:   'FAKE_FRAGMENT_SECRET',
};
const SENSITIVE = [
  [`/report/${SYN.token}`,              '/report/[token]'],
  [`/doctor/patients/${SYN.user}`,      '/doctor/patients/[userId]'],
  [`/dashboard/results/${SYN.result}`,  '/dashboard/results/[id]'],
  [`/learn/evidence/${SYN.slug}`,       '/learn/evidence/[slug]'],
];
const ORIGIN = 'https://www.myoguard.health';
const URL_KEYS  = ['$current_url', '$initial_current_url', '$referrer', '$initial_referrer',
                   '$session_entry_url', '$session_entry_referrer'];
const PATH_KEYS = ['$pathname', '$initial_pathname', '$prev_pageview_pathname', '$session_entry_pathname'];

/** Every string anywhere in `value`, however deeply nested. */
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}
function checkPayloadClean(label, payload) {
  const found = Object.values(SYN).filter(secret => strings(payload).some(s => s.includes(secret)));
  if (found.length === 0) {
    passed++;
    console.log(`  ${GREEN('✓')} ${label} ${DIM('— no raw identifier anywhere in payload')}`);
  } else {
    failures.push({ label, actual: found.join(', '), expected: 'no raw synthetic identifier' });
    console.log(`  ${RED('✗')} ${label} ${RED('— RAW IDENTIFIER PRESENT:')} ${found.join(', ')}`);
  }
}

// 6a. Each listed property, each sensitive route, full URL and bare path.
for (const [raw, pattern] of SENSITIVE) {
  const full = `${ORIGIN}${raw}?session=${SYN.query}&utm_source=newsletter#${SYN.frag}`;
  for (const key of URL_KEYS) {
    check(`${key} normalises ${pattern} (full URL, query + fragment)`,
      sanitizeAnalyticsProperties({ [key]: full })[key],
      `${ORIGIN}${pattern}?utm_source=newsletter`);
  }
  for (const key of PATH_KEYS) {
    check(`${key} normalises ${pattern} (bare path)`,
      sanitizeAnalyticsProperties({ [key]: raw })[key],
      pattern);
  }
  // A bare path in a URL property, and a full URL in a path property.
  check(`$session_entry_url normalises a bare ${pattern}`,
    sanitizeAnalyticsProperties({ $session_entry_url: raw }).$session_entry_url, pattern);
}

// 6b. Clerk's sign-in redirect carries the protected path in its query string.
const redirect = `${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/doctor/patients/${SYN.user}`)}`;
check('$session_entry_url drops Clerk redirect_url carrying a patient ID',
  sanitizeAnalyticsProperties({ $session_entry_url: redirect }).$session_entry_url,
  `${ORIGIN}/sign-in`);

// 6c. Safety net: unlisted `$` properties named like a URL or a path.
check('unlisted $…_url is redacted by the safety net',
  sanitizeAnalyticsProperties({ $future_entry_url: `${ORIGIN}/report/${SYN.token}` }).$future_entry_url,
  `${ORIGIN}/report/[token]`);
check('unlisted $…_referrer is redacted by the safety net',
  sanitizeAnalyticsProperties({ $future_referrer: `${ORIGIN}/dashboard/results/${SYN.result}` }).$future_referrer,
  `${ORIGIN}/dashboard/results/[id]`);
check('unlisted $…_pathname is redacted by the safety net',
  sanitizeAnalyticsProperties({ $future_pathname: `/doctor/patients/${SYN.user}` }).$future_pathname,
  '/doctor/patients/[userId]');

// 6d. Whole event payloads, as posthog-js builds them, scanned recursively.
function bag(extra) {
  const [reportPath] = SENSITIVE[0];
  return {
    $current_url: `${ORIGIN}${reportPath}?session=${SYN.query}#${SYN.frag}`,
    $pathname: reportPath,
    $host: 'www.myoguard.health',
    $referrer: `${ORIGIN}/doctor/patients/${SYN.user}`,
    $referring_domain: 'www.myoguard.health',
    $initial_current_url: `${ORIGIN}/dashboard/results/${SYN.result}`,
    $initial_pathname: `/learn/evidence/${SYN.slug}`,
    $initial_referrer: '$direct',
    $session_entry_url: `${ORIGIN}${reportPath}?x=${SYN.query}#${SYN.frag}`,
    $session_entry_pathname: reportPath,
    $session_entry_referrer: `${ORIGIN}/learn/evidence/${SYN.slug}`,
    $prev_pageview_pathname: `/dashboard/results/${SYN.result}`,
    $prev_pageview_id: 'b0e7a1f0-0000-4000-8000-000000000000',
    $prev_pageview_duration: 12.5,
    ...extra,
  };
}
checkPayloadClean('$pageview payload',  sanitizeAnalyticsProperties(bag({})));
checkPayloadClean('$pageleave payload', sanitizeAnalyticsProperties(bag({})));
checkPayloadClean('custom MyoGuard event payload',
  sanitizeAnalyticsProperties(bag({ source: 'evidence_export_panel', flow: 'authenticated_assessment' })));

// 6e. Non-sensitive values are not altered unnecessarily.
check('ordinary public path survives in $prev_pageview_pathname',
  sanitizeAnalyticsProperties({ $prev_pageview_pathname: '/learn/protein-on-glp-1' }).$prev_pageview_pathname,
  '/learn/protein-on-glp-1');
check('ordinary public URL survives in $session_entry_url',
  sanitizeAnalyticsProperties({ $session_entry_url: `${ORIGIN}/research/muscle-preservation` }).$session_entry_url,
  `${ORIGIN}/research/muscle-preservation`);
check('custom categorical property is untouched',
  sanitizeAnalyticsProperties({ source: 'evidence_export_panel' }).source,
  'evidence_export_panel');
check('non-string $prev_pageview_duration is untouched',
  sanitizeAnalyticsProperties({ $prev_pageview_duration: 12.5 }).$prev_pageview_duration,
  12.5);
{
  // The safety net rewrites strings only. A non-string under a URL- or
  // path-shaped key must come back as the very same value.
  const arr = ['/report/x'], obj = { u: '/report/x' };
  const nonStrings = sanitizeAnalyticsProperties({
    $future_flag_url: true, $future_list_url: arr, $future_obj_pathname: obj, $future_count_referrer: 7,
  });
  check('safety net leaves a boolean untouched', nonStrings.$future_flag_url, true);
  check('safety net leaves an array untouched (same reference)', nonStrings.$future_list_url === arr && arr[0] === '/report/x', true);
  check('safety net leaves an object untouched (same reference)', nonStrings.$future_obj_pathname === obj && obj.u === '/report/x', true);
  check('safety net leaves a number untouched', nonStrings.$future_count_referrer, 7);
}
check('$direct sentinel preserved in $session_entry_referrer',
  sanitizeAnalyticsProperties({ $session_entry_referrer: '$direct' }).$session_entry_referrer,
  '$direct');

// 6f. Page-leave capture is disabled in the production configuration.
const PROVIDER_SRC = readFileSync(new URL('../src/components/analytics/PostHogProvider.tsx', import.meta.url), 'utf8');
check('capture_pageleave is false in the PostHog init options',
  /capture_pageleave:\s*false/.test(PROVIDER_SRC) && !/capture_pageleave:\s*true/.test(PROVIDER_SRC), true);
check('advanced_disable_flags is true — the flags request carried raw $initial_* URLs',
  /advanced_disable_flags:\s*true/.test(PROVIDER_SRC), true);
check('sanitize_properties is still wired into init',
  /sanitize_properties:\s*sanitizeAnalyticsProperties/.test(PROVIDER_SRC), true);
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
