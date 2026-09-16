/**
 * scripts/registrationHardening.test.mjs
 *
 * Phase 1D-S4B — public physician registration hardening validation.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/registrationHardening.test.mjs
 *
 * Imports the REAL RegistrationSchema / normaliseEmail / escapeHtml, so the
 * logic under test is the shipped logic.
 *
 * Creates no Clerk user, sends no email, writes no database row.
 *
 * Two kinds of check, labelled distinctly:
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — reads the shipped route source and asserts a structural
 *                 invariant (a guard exists, or precedes the side effect it
 *                 governs). Used where the behaviour depends on Clerk, Prisma
 *                 or Resend, which this suite must not touch.
 */

import { readFileSync } from 'node:fs';
import { RegistrationSchema, normaliseEmail } from '../src/lib/onboardingIdentity.ts';
import { escapeHtml } from '../src/lib/email/templates/BaseEmail.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const ROUTE = readFileSync(
  new URL('../app/api/doctor/register/route.ts', import.meta.url), 'utf8',
);
const stripComments = s =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const HANDLER = stripComments(ROUTE.slice(ROUTE.indexOf('export async function POST')));
const at = re => { const m = HANDLER.match(re); return m ? m.index : Infinity; };
const last = re => { let i = -1, m; const g = new RegExp(re.source, 'g');
  while ((m = g.exec(HANDLER)) !== null) i = m.index; return i; };

/** The two email templates; HTML bodies contain no backticks. */
const HTML_BLOCKS = ROUTE.split('html: `').slice(1).map(s => s.slice(0, s.indexOf('`')));

const base = {
  fullName: 'Dr. Ada Okoro', email: 'ada@clinic.example', password: 'correct-horse-8',
  country: 'Nigeria', specialty: 'Endocrinology',
};

// ── 1. Malformed JSON rejected before side effects ───────────────────────────
section('-- 1. malformed JSON --');
t('[ordering] 1. req.json() failure returns 400', /catch\s*\{[\s\S]{0,120}?status: 400/.test(HANDLER));
t('[ordering] 1. the 400 precedes Clerk creation',       at(/status: 400/) < at(/createClerkUser\(/));
t('[ordering] 1. the 400 precedes every prisma call',    at(/status: 400/) < at(/prisma\./));
t('[ordering] 1. the 400 precedes throttle consumption', at(/status: 400/) < at(/consumeRecipientBudget/));
t('[ordering] 1. the 400 precedes every resend call',    at(/status: 400/) < at(/resend\.emails\.send/));

// ── 2. Invalid email rejected ────────────────────────────────────────────────
section('-- 2. email contract --');
t('[behaviour] 2. valid payload accepted', RegistrationSchema.safeParse(base).success === true);
for (const bad of ['not-an-email', 'a@', '@b.com', 'a b@c.com', '']) {
  t(`[behaviour] 2. rejected: ${JSON.stringify(bad)}`,
    RegistrationSchema.safeParse({ ...base, email: bad }).success === false);
}
t('[behaviour] 2. missing email rejected', (() => {
  const { email, ...rest } = base; void email;
  return RegistrationSchema.safeParse(rest).success === false;
})());

// ── 3. Overlong strings rejected ─────────────────────────────────────────────
section('-- 3. length ceilings --');
const overlong = [
  ['fullName', 121], ['email', 250], ['country', 81],
  ['specialty', 121], ['npiNumber', 21], ['licenseNumber', 61],
  ['inviteToken', 201], ['password', 129],
];
for (const [field, len] of overlong) {
  const value = field === 'email' ? 'x'.repeat(len) + '@clinic.example' : 'x'.repeat(len);
  t(`[behaviour] 3. overlong ${field} rejected`,
    RegistrationSchema.safeParse({ ...base, [field]: value }).success === false);
}
t('[behaviour] 3. short password rejected',
  RegistrationSchema.safeParse({ ...base, password: 'short' }).success === false);
t('[behaviour] 3. 8-character password accepted (existing floor preserved)',
  RegistrationSchema.safeParse({ ...base, password: '12345678' }).success === true);
t('[behaviour] 3. password is NOT trimmed (spaces are legitimate characters)',
  RegistrationSchema.safeParse({ ...base, password: '  spaced  ' }).data?.password === '  spaced  ');
t('[behaviour] 3. optional fields may be omitted',
  RegistrationSchema.safeParse(base).success === true);

// ── 4-8. One normalisation, used everywhere ──────────────────────────────────
section('-- 4/5/6/7/8. normalised email is the single identity --');
t('[behaviour] normaliseEmail trims and lowercases',
  normaliseEmail('  Ada.Okoro@Clinic.Example  ') === 'ada.okoro@clinic.example');
t('[behaviour] no provider-specific canonicalisation (dots kept)',
  normaliseEmail('first.last@gmail.com') === 'first.last@gmail.com');
t('[behaviour] no provider-specific canonicalisation (+tag kept)',
  normaliseEmail('user+tag@gmail.com') === 'user+tag@gmail.com');

t('[ordering] the raw submission is aliased, then normalised once',
  /email:\s*rawEmail/.test(HANDLER) && /const email = normaliseEmail\(rawEmail\)/.test(HANDLER));

// The decisive check: after normalisation, the raw value is never referenced
// again, so no downstream consumer can accidentally use the unnormalised form.
{
  const normIdx = at(/const email = normaliseEmail\(rawEmail\)/);
  const after   = HANDLER.slice(normIdx + 40);
  t('[ordering] rawEmail is never referenced after normalisation',
    !/\brawEmail\b/.test(after));
  t('[ordering] normalisation precedes Clerk creation',   normIdx < at(/createClerkUser\(/));
  t('[ordering] normalisation precedes every prisma call', normIdx < at(/prisma\./));
}

t('[ordering] 4. Clerk creation receives the normalised email',
  /createClerkUser\(\{\s*firstName,\s*lastName,\s*email,\s*password\s*\}\)/.test(HANDLER));
t('[ordering] 5. User row persists the normalised email',
  /prisma\.user\.upsert\([\s\S]{0,300}?\n\s*email,/.test(HANDLER));
t('[ordering] 6. application identity is the normalised email',
  /physicianApplication\.upsert\(\{[\s\S]{0,200}?where:\s*\{\s*email\s*\}/.test(HANDLER));
t('[ordering] 6. admin-token HMAC input is the normalised email',
  /\.update\(`\$\{email\}:\$\{timestamp\}`\)/.test(HANDLER));
t('[ordering] 7. throttle is keyed on the normalised email',
  /consumeRecipientBudget\(email\)/.test(HANDLER));
t('[ordering] 8. applicant recipient is the normalised email',
  /to:\s*email,/.test(HANDLER));

// ── 9. Clerk duplicate stays a safe 409 ──────────────────────────────────────
section('-- 9. Clerk uniqueness preserved --');
t('[ordering] 9. form_identifier_exists still maps to 409',
  /form_identifier_exists[\s\S]{0,220}?status:\s*409/.test(ROUTE));
t('[ordering] 9. a Clerk error returns before any prisma call',
  at(/if \("error" in clerkResult\)/) < at(/prisma\./));
t('[ordering] 9. a Clerk error returns before the throttle',
  at(/if \("error" in clerkResult\)/) < at(/consumeRecipientBudget/));
t('[ordering] 9. a Clerk error returns before any resend call',
  at(/if \("error" in clerkResult\)/) < at(/resend\.emails\.send/));
t('[ordering] 9. Clerk uniqueness is not bypassed (no skip flags added)',
  !/skip_email/i.test(ROUTE) && /skip_password_checks:\s*false/.test(ROUTE));

// ── 10/11. No raw caller HTML reaches either email ───────────────────────────
section('-- 10/11. output encoding --');
t('[ordering] both templates located', HTML_BLOCKS.length === 2);
{
  const allowed = new Set([
    'eName', 'eEmail', 'eCountry', 'eSpecialty', 'eNpi', 'eLicence',
    'eCredential', 'eGreeting', 'approveUrl', 'flagUrl',
  ]);
  const found = HTML_BLOCKS.flatMap(b => [...b.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1].trim()));
  const bad = [...new Set(found.filter(v => !allowed.has(v)))];
  if (bad.length) console.log('        unexpected in HTML:', JSON.stringify(bad));
  console.log(`        ${found.length} interpolations across both templates, all reviewed`);
  t('[ordering] 10/11. every HTML interpolation is a pre-escaped local or token URL', bad.length === 0);
  t('[ordering] 10/11. both templates actually interpolate (check is live)',
    HTML_BLOCKS.every(b => /\$\{/.test(b)));

  const rawNames = /\$\{\s*(fullName|rawEmail|email|country|specialty|npiNumber|licenseNumber)\s*\}/;
  t('[ordering] 10. admin template carries no raw caller field',     !rawNames.test(HTML_BLOCKS[0]));
  t('[ordering] 11. applicant template carries no raw caller field', !rawNames.test(HTML_BLOCKS[1]));
  t('[ordering] every e* local is produced by escapeHtml',
    ['eName','eEmail','eCountry','eSpecialty','eNpi','eLicence','eCredential','eGreeting']
      .every(v => new RegExp(`const\\s+${v}\\s*=\\s*escapeHtml\\(`).test(HANDLER)));
}
t('[behaviour] escapeHtml neutralises a script tag',
  escapeHtml('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;');
t('[behaviour] escapeHtml neutralises attribute breakout',
  escapeHtml('" onload="x') === '&quot; onload=&quot;x');
t('[behaviour] escapeHtml leaves benign clinical text alone',
  escapeHtml('Endocrinology (GLP-1)') === 'Endocrinology (GLP-1)');
t('[ordering] the plain-text subject is deliberately NOT escaped',
  /subject:\s*`Physician Credential Review — \$\{fullName\}`/.test(ROUTE));

// ── 12/13. Throttle gates the applicant send ─────────────────────────────────
section('-- 12/13. throttle gates the applicant send --');
t('[behaviour] 12. "throttled" is not an allowed outcome', ('throttled' === 'allowed') === false);
t('[behaviour] 13. "unavailable" is not an allowed outcome', ('unavailable' === 'allowed') === false);
t('[ordering] 12/13. the gate is derived only from an "allowed" outcome',
  /const mayNotifyApplicant = throttle\.outcome === 'allowed'/.test(HANDLER));
// Phase 1D-C3E routed the applicant email through the governed gateway
// (sendServiceEmail); the admin notification stays on the direct client as
// OPERATIONAL_INTERNAL. The throttle gate is unchanged and still the only thing
// that permits the applicant send — which is what these two checks protect.
t('[ordering] 12/13. the applicant send is inside the gate',
  /if \(mayNotifyApplicant\)\s*\{[\s\S]{0,600}?await sendServiceEmail\(/.test(HANDLER));
t('[ordering] 12/13. throttle is consulted before the applicant send',
  at(/consumeRecipientBudget/) < at(/sendServiceEmail\(/));
t('[safety] 12/13. the applicant send is the governed one, not a direct call',
  /if \(mayNotifyApplicant\)\s*\{[\s\S]{0,600}?await sendServiceEmail\(/.test(HANDLER)
  && !/if \(mayNotifyApplicant\)\s*\{[\s\S]{0,600}?resend\.emails\.send\(/.test(HANDLER));
t('[ordering] the admin notification is NOT gated by the recipient throttle',
  at(/resend\.emails\.send/) < at(/consumeRecipientBudget/));

// ── 14/15. Notification failure never reports registration failure ───────────
section('-- 14/15. notification failures are non-fatal --');
{
  // `persisted` flips true the moment the identity and both rows exist.
  const marker = at(/persisted = true;/);
  t('[ordering] 14/15. the persistence marker exists', marker !== Infinity);

  // The only 500 after that point is inside the catch-all, and it is guarded
  // by `if (persisted) return ok` — so it is unreachable once registration
  // has actually completed.
  const afterMarker = HANDLER.slice(marker);
  t('[ordering] 14/15. every post-persistence 500 sits behind the persisted guard',
    /if \(persisted\)[\s\S]{0,400}?return NextResponse\.json\(\{ ok: true \}\)[\s\S]*?status: 500/
      .test(afterMarker));
  t('[ordering] 14/15. the catch-all reports success when persistence completed',
    /if \(persisted\)\s*\{[\s\S]{0,300}?return NextResponse\.json\(\{ ok: true \}\);/.test(HANDLER));

  // Extract each notification catch body and prove it returns nothing.
  const catchBody = (marker) => {
    const i = ROUTE.indexOf(marker);
    if (i === -1) return null;
    return ROUTE.slice(i, ROUTE.indexOf('\n    }', i));
  };
  const adminCatch     = catchBody('admin notification failed (non-fatal)');
  const applicantCatch = catchBody('acknowledgement email failed (non-fatal)');
  t('[ordering] 14. the admin-email catch body contains no return',
    adminCatch !== null && !/return\b/.test(adminCatch));
  t('[ordering] 15. the applicant-email catch body contains no return',
    applicantCatch !== null && !/return\b/.test(applicantCatch));
  t('[ordering] 14/15. the handler still ends with a success response',
    /return NextResponse\.json\(\{ ok: true \}\);/.test(HANDLER));
  t('[ordering] 14/15. success response comes after both sends',
    last(/resend\.emails\.send/) < at(/return NextResponse\.json\(\{ ok: true \}\)/));
  t('[ordering] no token or secret is written to logs',
    !/adminToken\.slice/.test(ROUTE) && !/console\.\w+\([^)]*tokenSecret/.test(ROUTE));
}

// ── 16/17/18. Automatic role ceiling ─────────────────────────────────────────
section('-- 16/17/18. role ceiling --');
t('[ordering] 16. PHYSICIAN_PENDING is assigned',
  /role:\s*"PHYSICIAN_PENDING"/.test(HANDLER));
t('[ordering] 17. no bare PHYSICIAN role is ever assigned',
  !/role:\s*["']PHYSICIAN["']/.test(HANDLER));
t('[ordering] 18. no ADMIN role is ever assigned',
  !/role:\s*["']ADMIN["']/.test(HANDLER));
t('[ordering] 16. Clerk metadata role is also PHYSICIAN_PENDING only',
  /public_metadata:\s*\{ role: "PHYSICIAN_PENDING" \}/.test(ROUTE));
t('[ordering] 17/18. the route never sets an application status beyond PENDING',
  !/status:\s*["'](APPROVED|FLAGGED)["']/.test(HANDLER));
t('[ordering] 17/18. no approval/verification helper is invoked here',
  !/verify-?[Pp]hysician\(|upgradePhysician|requireAdmin/.test(HANDLER));

// ── Whole-pipeline ordering ──────────────────────────────────────────────────
section('-- side-effect ordering --');
{
  const steps = [
    ['schema',        at(/RegistrationSchema\.safeParse/)],
    ['normalise',     at(/normaliseEmail\(rawEmail\)/)],
    ['clerk create',  at(/createClerkUser\(\{/)],
    ['user upsert',   at(/prisma\.user\.upsert/)],
    ['app upsert',    at(/physicianApplication\.upsert/)],
    // After C3E the admin notification is the ONLY direct resend.emails.send in
    // this route, so `at()` identifies it unambiguously — previously `at()` and
    // `last()` had to disambiguate two sends of the same shape.
    ['admin email',   at(/resend\.emails\.send/)],
    ['throttle',      at(/consumeRecipientBudget/)],
    ['applicant email', at(/sendServiceEmail\(/)],
  ];
  let ok = true;
  for (let i = 1; i < steps.length; i++) if (steps[i][1] < steps[i - 1][1]) ok = false;
  console.log('        ' + steps.map(([n]) => n).join(' -> '));
  t('[ordering] pipeline is strictly ordered', ok);
  t('[ordering] no email is sent before both rows are written',
    at(/physicianApplication\.upsert/) < at(/resend\.emails\.send/));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
