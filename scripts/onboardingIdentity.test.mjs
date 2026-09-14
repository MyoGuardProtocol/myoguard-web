/**
 * scripts/onboardingIdentity.test.mjs
 *
 * Phase 1D-S3B — physician onboarding containment validation.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/onboardingIdentity.test.mjs
 *
 * The resolver shim only teaches Node how to FIND the project's TypeScript
 * modules (the "@/" alias and extensionless relative imports). It transforms
 * nothing, so the code under test is the shipped code.
 *
 * Imports the REAL src/lib/onboardingIdentity.ts and the REAL escapeHtml, so
 * the logic under test is the shipped logic rather than a copy.
 *
 * Sends no email, touches no database, creates no Clerk user and no physician
 * application.
 *
 * Two kinds of check appear below and are labelled distinctly:
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — reads the shipped route source and asserts that a guard
 *                 exists and appears BEFORE the side effect it governs.
 *                 Route-level guards (401, 429, 503) depend on Clerk, Prisma
 *                 and Resend, so their placement is proved structurally
 *                 against the real file rather than by an HTTP request.
 */

import { readFileSync } from 'node:fs';
import {
  OnboardingSchema,
  resolveVerifiedPrimaryEmail,
  verifiedEmailMatchesBody,
  decideRoleTransition,
  decideApplicationOwnership,
  decideApplicationStatus,
  shouldRefreshAdminToken,
  ONBOARDING_ROLE,
} from '../src/lib/onboardingIdentity.ts';
import { escapeHtml } from '../src/lib/email/templates/BaseEmail.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const ROUTE = readFileSync(
  new URL('../app/api/doctor/onboarding/route.ts', import.meta.url), 'utf8',
);

/**
 * Ordering assertions must look at executable code only. Comments mention the
 * very patterns being forbidden ("never emailAddresses[0]"), and the import
 * block names every helper before the handler runs — both would produce
 * meaningless matches. So strip comments and start at the handler.
 */
const stripComments = s =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
   .replace(/(?<!:)\/\/[^\n]*/g, '');    // line comments, but not "https://"

const HANDLER = stripComments(ROUTE.slice(ROUTE.indexOf('export async function POST')));

/** Index of the first match within the handler body, or Infinity when absent. */
const at = re => { const m = HANDLER.match(re); return m ? m.index : Infinity; };

/**
 * The two email templates, extracted by their `html: ` markers. The HTML
 * bodies contain no backticks, so slicing to the next one is exact.
 */
const HTML_BLOCKS = ROUTE.split('html: `').slice(1).map(s => s.slice(0, s.indexOf('`')));

const verifiedPrimary = (address, id = 'idp') => ({
  primaryEmailAddressId: id,
  emailAddresses: [{ id, emailAddress: address, verification: { status: 'verified' } }],
});

// ── 1 & 2. Unauthenticated request rejected, and creates nothing ─────────────
section('-- 1/2. unauthenticated request --');
{
  const guard   = at(/if \(!userId\)/);
  const status401 = at(/status: 401/);
  const firstDb = at(/prisma\./);
  const firstMail = at(/resend\.emails\.send/);
  const firstThrottle = at(/consumeRecipientBudget/);

  t('[ordering] 1. route has an explicit !userId guard', guard !== Infinity);
  t('[ordering] 1. guard returns 401', status401 !== Infinity && status401 > guard);
  t('[ordering] 2. guard precedes every prisma call',    guard < firstDb);
  t('[ordering] 2. guard precedes every resend call',    guard < firstMail);
  t('[ordering] 2. guard precedes throttle consumption', guard < firstThrottle);
  t('[ordering] auth() is the first statement of the handler',
    at(/await auth\(\)/) < firstDb);
}

// ── 3. Body-email mismatch rejected ──────────────────────────────────────────
section('-- 3. body email must match the verified primary --');
t('[behaviour] 3. exact match accepted',
  verifiedEmailMatchesBody('doc@clinic.example', 'doc@clinic.example') === true);
t('[behaviour] 3. case difference is NOT a mismatch',
  verifiedEmailMatchesBody('DOC@Clinic.Example', 'doc@clinic.example') === true);
t('[behaviour] 3. surrounding whitespace is NOT a mismatch',
  verifiedEmailMatchesBody('  doc@clinic.example  ', 'doc@clinic.example') === true);
t('[behaviour] 3. different address IS a mismatch',
  verifiedEmailMatchesBody('attacker@evil.example', 'doc@clinic.example') === false);
t('[behaviour] 3. sub-addressing is not folded into a match',
  verifiedEmailMatchesBody('doc+x@clinic.example', 'doc@clinic.example') === false);
t('[ordering] 3. mismatch is refused before any application write',
  at(/verifiedEmailMatchesBody/) < at(/physicianApplication\.upsert/));

// ── 4. Unverified / missing primary email rejected ───────────────────────────
section('-- 4. verified PRIMARY email required (fail closed) --');
t('[behaviour] 4. verified primary resolves',
  resolveVerifiedPrimaryEmail(verifiedPrimary('doc@clinic.example')).email === 'doc@clinic.example');
t('[behaviour] 4. resolved primary is normalised',
  resolveVerifiedPrimaryEmail(verifiedPrimary('  DOC@Clinic.Example ')).email === 'doc@clinic.example');
t('[behaviour] 4. unverified primary rejected', (() => {
  const r = resolveVerifiedPrimaryEmail({
    primaryEmailAddressId: 'a',
    emailAddresses: [{ id: 'a', emailAddress: 'x@y.example', verification: { status: 'unverified' } }],
  });
  return r.ok === false && r.reason === 'primary_not_verified';
})());
t('[behaviour] 4. null verification object rejected', (() => {
  const r = resolveVerifiedPrimaryEmail({
    primaryEmailAddressId: 'a',
    emailAddresses: [{ id: 'a', emailAddress: 'x@y.example', verification: null }],
  });
  return r.ok === false;
})());
t('[behaviour] 4. no primary designated rejected', (() => {
  const r = resolveVerifiedPrimaryEmail({
    primaryEmailAddressId: null,
    emailAddresses: [{ id: 'a', emailAddress: 'x@y.example', verification: { status: 'verified' } }],
  });
  return r.ok === false && r.reason === 'no_primary_designated';
})());
t('[behaviour] 4. null clerk user rejected', resolveVerifiedPrimaryEmail(null).ok === false);

// The A-4 defect this replaces: never take an arbitrary array entry.
t('[behaviour] 4. an unverified address at index 0 is NOT selected', (() => {
  const r = resolveVerifiedPrimaryEmail({
    primaryEmailAddressId: 'second',
    emailAddresses: [
      { id: 'first',  emailAddress: 'attacker@evil.example', verification: { status: 'unverified' } },
      { id: 'second', emailAddress: 'doc@clinic.example',    verification: { status: 'verified' } },
    ],
  });
  return r.ok === true && r.email === 'doc@clinic.example';
})());
t('[ordering] 4. handler code never reads emailAddresses[0]',
  !/emailAddresses\s*\[\s*0\s*\]/.test(HANDLER));

// ── 5. Legitimate authenticated submission succeeds ──────────────────────────
section('-- 5. legitimate submission --');
{
  const body = {
    fullName: 'Dr. Ada Okoro', email: 'Ada.Okoro@Clinic.Example',
    country: 'Nigeria', specialty: 'Endocrinology', npiNumber: '1234567890',
  };
  const parsed = OnboardingSchema.safeParse(body);
  t('[behaviour] 5. valid payload passes the schema', parsed.success === true);
  const primary = resolveVerifiedPrimaryEmail(verifiedPrimary('ada.okoro@clinic.example'));
  t('[behaviour] 5. verified primary resolves for the caller', primary.ok === true);
  t('[behaviour] 5. body email matches the verified primary',
    parsed.success && verifiedEmailMatchesBody(parsed.data.email, primary.email) === true);
  t('[behaviour] 5. new caller becomes PHYSICIAN_PENDING',
    decideRoleTransition(null) === 'PHYSICIAN_PENDING');
  t('[behaviour] 5. new application is created and starts PENDING',
    decideApplicationOwnership({ existing: null, callerClerkId: 'user_a' }).kind === 'create' &&
    decideApplicationStatus(null) === 'PENDING');
  t('[behaviour] 5. optional fields may be omitted',
    OnboardingSchema.safeParse({
      fullName: 'Dr. B', email: 'b@c.example', country: 'UK', specialty: 'GP',
    }).success === true);
}

// ── 6. Foreign-owned application cannot be overwritten ───────────────────────
section('-- 6. application ownership --');
t('[behaviour] 6. application owned by another identity is REFUSED', (() => {
  const d = decideApplicationOwnership({
    existing: { clerkUserId: 'user_victim' }, callerClerkId: 'user_attacker',
  });
  return d.allowed === false && d.reason === 'owned_by_another_identity';
})());
t('[behaviour] 6. own application may be updated',
  decideApplicationOwnership({
    existing: { clerkUserId: 'user_me' }, callerClerkId: 'user_me',
  }).kind === 'update');
t('[behaviour] 6. unclaimed (null clerkUserId) application may be claimed',
  decideApplicationOwnership({
    existing: { clerkUserId: null }, callerClerkId: 'user_me',
  }).kind === 'claim');
t('[ordering] 6. ownership is decided before the application write',
  at(/decideApplicationOwnership/) < at(/physicianApplication\.upsert/));
t('[ordering] 6. refusal returns 409', /status: 409/.test(HANDLER));

// ── 7. APPROVED is never reset by resubmission ───────────────────────────────
section('-- 7. admin decisions survive resubmission --');
t('[behaviour] 7. APPROVED stays APPROVED',   decideApplicationStatus('APPROVED') === 'APPROVED');
t('[behaviour] 7. FLAGGED stays FLAGGED',     decideApplicationStatus('FLAGGED')  === 'FLAGGED');
t('[behaviour] 7. PENDING stays PENDING',     decideApplicationStatus('PENDING')  === 'PENDING');
t('[behaviour] 7. brand-new application is PENDING', decideApplicationStatus(null) === 'PENDING');
t('[behaviour] 7. admin token NOT refreshed for APPROVED', shouldRefreshAdminToken('APPROVED') === false);
t('[behaviour] 7. admin token NOT refreshed for FLAGGED',  shouldRefreshAdminToken('FLAGGED')  === false);
t('[behaviour] 7. admin token refreshed while PENDING',    shouldRefreshAdminToken('PENDING')  === true);
t('[behaviour] 7. admin token minted for a new application', shouldRefreshAdminToken(null)     === true);
t('[ordering] 7. route no longer hard-codes status on update',
  !/update:[\s\S]{0,400}?status:\s*["']PENDING["']/.test(HANDLER));

// ── 8/9/10. Role transitions ─────────────────────────────────────────────────
section('-- 8/9/10. role transition policy --');
t('[behaviour] 8. PATIENT -> PHYSICIAN_PENDING preserved (existing workflow)',
  decideRoleTransition('PATIENT') === 'PHYSICIAN_PENDING');
t('[behaviour] 9. PHYSICIAN is NOT downgraded', decideRoleTransition('PHYSICIAN') === 'PHYSICIAN');
t('[behaviour] 10. ADMIN is NOT downgraded',    decideRoleTransition('ADMIN')     === 'ADMIN');
t('[behaviour] PHYSICIAN_PENDING stays PHYSICIAN_PENDING',
  decideRoleTransition('PHYSICIAN_PENDING') === 'PHYSICIAN_PENDING');
t('[behaviour] onboarding role constant is PHYSICIAN_PENDING',
  ONBOARDING_ROLE === 'PHYSICIAN_PENDING');
t('[ordering] 10. route no longer hard-codes the role on update',
  !/update:[\s\S]{0,300}?role:\s*["']PHYSICIAN_PENDING["']/.test(HANDLER));

// ── 11. Malformed input rejected before the throttle ─────────────────────────
section('-- 11. schema rejects before any side effect --');
t('[behaviour] 11. missing fullName rejected',
  OnboardingSchema.safeParse({ email: 'a@b.example', country: 'UK', specialty: 'GP' }).success === false);
t('[behaviour] 11. one-character fullName rejected',
  OnboardingSchema.safeParse({ fullName: 'A', email: 'a@b.example', country: 'UK', specialty: 'GP' }).success === false);
t('[behaviour] 11. non-email string rejected',
  OnboardingSchema.safeParse({ fullName: 'Dr B', email: 'not-an-email', country: 'UK', specialty: 'GP' }).success === false);
t('[behaviour] 11. over-long fullName rejected',
  OnboardingSchema.safeParse({ fullName: 'x'.repeat(121), email: 'a@b.example', country: 'UK', specialty: 'GP' }).success === false);
t('[behaviour] 11. over-long specialty rejected',
  OnboardingSchema.safeParse({ fullName: 'Dr B', email: 'a@b.example', country: 'UK', specialty: 'x'.repeat(121) }).success === false);
t('[behaviour] 11. over-long npi rejected',
  OnboardingSchema.safeParse({ fullName: 'Dr B', email: 'a@b.example', country: 'UK', specialty: 'GP', npiNumber: '9'.repeat(21) }).success === false);
t('[behaviour] 11. over-long inviteToken rejected',
  OnboardingSchema.safeParse({ fullName: 'Dr B', email: 'a@b.example', country: 'UK', specialty: 'GP', inviteToken: 'x'.repeat(201) }).success === false);
t('[behaviour] 11. empty country rejected',
  OnboardingSchema.safeParse({ fullName: 'Dr B', email: 'a@b.example', country: '', specialty: 'GP' }).success === false);
t('[ordering] 11. schema parse precedes throttle consumption',
  at(/OnboardingSchema\.safeParse/) < at(/consumeRecipientBudget/));
t('[ordering] 11. schema parse precedes every prisma call',
  at(/OnboardingSchema\.safeParse/) < at(/prisma\./));

// ── 12/13. Throttle outcomes cannot reach Resend ─────────────────────────────
section('-- 12/13. throttle gates the provider --');
{
  const throttleIdx = at(/consumeRecipientBudget/);
  const mailIdx     = at(/resend\.emails\.send/);
  t('[ordering] 12/13. throttle is consulted before any resend call', throttleIdx < mailIdx);
  t('[ordering] 12. throttled outcome returns 429',
    /outcome === 'throttled'[\s\S]{0,240}?status: 429/.test(HANDLER));
  t('[ordering] 13. unavailable outcome returns 503',
    /outcome === 'unavailable'[\s\S]{0,240}?status: 503/.test(HANDLER));
  // Both branches must return before reaching the mail section.
  const t429 = at(/status: 429/), t503 = at(/status: 503/);
  t('[ordering] 12. the 429 return precedes every resend call', t429 < mailIdx);
  t('[ordering] 13. the 503 return precedes every resend call', t503 < mailIdx);
  t('[ordering] throttle uses the verified email, not the body email',
    /consumeRecipientBudget\(verifiedEmail\)/.test(HANDLER));
}

// ── 14/15. Email HTML encoding ───────────────────────────────────────────────
section('-- 14/15. output encoding --');
{
  const payload = '<script>alert(1)</script>';
  const out = escapeHtml(payload);
  t('[behaviour] 14. angle brackets encoded', !out.includes('<') && !out.includes('>'));
  t('[behaviour] 14. script tag neutralised', out === '&lt;script&gt;alert(1)&lt;/script&gt;');
  t('[behaviour] 14. double quotes encoded (attribute safety)',
    escapeHtml('" onload="x') === '&quot; onload=&quot;x');
  t('[behaviour] 14. ampersand encoded first (no double-encoding artefact)',
    escapeHtml('&lt;') === '&amp;lt;');
  t('[behaviour] 14. benign clinical text unchanged',
    escapeHtml('Endocrinology (GLP-1)') === 'Endocrinology (GLP-1)');

  // 15 — scope the check to the actual HTML bodies, so a console.error or an
  // HMAC input cannot mask a genuinely unescaped value (or vice versa).
  t('[ordering] 15. both email templates were located', HTML_BLOCKS.length === 2);

  // Only pre-escaped locals and the two hex-token URLs may appear in HTML.
  const allowedInHtml = new Set([
    'eName', 'eEmail', 'eCountry', 'eSpecialty', 'eNpi', 'eLicence',
    'eCredential', 'eGreeting', 'approveUrl', 'flagUrl',
  ]);
  const htmlInterpolations = HTML_BLOCKS.flatMap(
    b => [...b.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1].trim()),
  );
  const unexpected = [...new Set(htmlInterpolations.filter(v => !allowedInHtml.has(v)))];
  if (unexpected.length) console.log('        unexpected in HTML:', JSON.stringify(unexpected));
  console.log(`        ${htmlInterpolations.length} interpolations across both templates, all reviewed`);

  t('[ordering] 15. every HTML interpolation is a pre-escaped local or a token URL',
    unexpected.length === 0);
  t('[ordering] 15. both templates actually interpolate something (check is live)',
    HTML_BLOCKS.every(b => /\$\{/.test(b)));

  // No raw caller field may reach an HTML body under its original name.
  const rawNames = /\$\{\s*(fullName|bodyEmail|country|specialty|npiNumber|licenseNumber|verifiedEmail)\s*\}/;
  t('[ordering] 15. no raw caller-controlled field is interpolated into HTML',
    HTML_BLOCKS.every(b => !rawNames.test(b)));
  t('[ordering] 15. escapeHtml is imported and used', /escapeHtml\(/.test(HANDLER));
  t('[ordering] 15. every e* local is produced by escapeHtml',
    ['eName','eEmail','eCountry','eSpecialty','eNpi','eLicence','eCredential','eGreeting']
      .every(v => new RegExp(`const\\s+${v}\\s*=\\s*escapeHtml\\(`).test(HANDLER)));
}

// ── Side-effect ordering as a whole ──────────────────────────────────────────
section('-- side-effect ordering --');
{
  const order = [
    ['auth()',            at(/await auth\(\)/)],
    ['schema',            at(/OnboardingSchema\.safeParse/)],
    ['verified primary',  at(/resolveVerifiedPrimaryEmail/)],
    ['email match',       at(/verifiedEmailMatchesBody/)],
    ['ownership',         at(/decideApplicationOwnership/)],
    ['application write', at(/physicianApplication\.upsert/)],
    ['throttle',          at(/consumeRecipientBudget/)],
    ['resend',            at(/resend\.emails\.send/)],
  ];
  let monotonic = true;
  for (let i = 1; i < order.length; i++) if (order[i][1] < order[i - 1][1]) monotonic = false;
  console.log('        ' + order.map(([n]) => n).join(' -> '));
  t('[ordering] pipeline is strictly ordered auth -> ... -> resend', monotonic);
  t('[ordering] no email is sent before the application write',
    at(/physicianApplication\.upsert/) < at(/resend\.emails\.send/));
  t('[ordering] an empty applicationId aborts before any email',
    at(/if \(!applicationId\)/) < at(/resend\.emails\.send/));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
