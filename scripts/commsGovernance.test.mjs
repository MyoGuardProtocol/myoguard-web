/**
 * scripts/commsGovernance.test.mjs
 *
 * Phase 1D-C3B — communications enforcement foundation validation.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/commsGovernance.test.mjs
 *
 * Imports the REAL identity primitive and the REAL pure decision function, so
 * the logic under test is the shipped logic.
 *
 * Touches no database, contacts no provider, sends no email. The async
 * `canSend` is exercised only where it can fail closed without a database
 * (missing secret); its storage paths are covered by [ordering] checks against
 * the shipped source, which is the same technique S3B/S4B use for code whose
 * dependencies must not be touched.
 *
 * Three kinds of check:
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — reads shipped route source and asserts a structural
 *                 invariant (a guard exists, or precedes what it governs).
 *   [safety]    — asserts an invariant whose violation would send email that
 *                 should not have been sent, or record what must not be stored.
 */

import { readFileSync } from 'node:fs';
import {
  normaliseEmail,
  deriveRecipientIdentity,
  COMMS_IDENTITY_SECRET_ENV,
  MIN_SECRET_LENGTH,
  CURRENT_KEY_VERSION,
} from '../src/lib/communications/identity.ts';
import { decideFromGovernanceState, canSend } from '../src/lib/communications/governance.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const stripComments = s =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const GOOD_SECRET = 'x'.repeat(MIN_SECRET_LENGTH);
const withSecret = (value, fn) => {
  const prev = process.env[COMMS_IDENTITY_SECRET_ENV];
  if (value === undefined) delete process.env[COMMS_IDENTITY_SECRET_ENV];
  else process.env[COMMS_IDENTITY_SECRET_ENV] = value;
  try { return fn(); }
  finally {
    if (prev === undefined) delete process.env[COMMS_IDENTITY_SECRET_ENV];
    else process.env[COMMS_IDENTITY_SECRET_ENV] = prev;
  }
};

/** Governance state builder — defaults to the state every existing user is in. */
const state = (o = {}) => ({
  activeSuppressionReasons: [],
  preferenceState:          null,
  recipientVerified:        undefined,
  ...o,
});
const decide = (cls, o) => decideFromGovernanceState(cls, state(o));

// ── 1-2. Deterministic normalisation and keying ──────────────────────────────
section('-- 1-2. normalisation + recipient key --');

t('[behaviour] 1. normalisation trims and lowercases',
  normaliseEmail('  Ada.Okoro@Clinic.Example  ') === 'ada.okoro@clinic.example');
t('[behaviour] 1. normalisation is idempotent',
  normaliseEmail(normaliseEmail(' A@B.C ')) === normaliseEmail(' A@B.C '));
t('[behaviour] 1. dots and +tags are NOT folded (distinct addresses stay distinct)',
  normaliseEmail('a.b+x@gmail.com') !== normaliseEmail('ab@gmail.com'));

withSecret(GOOD_SECRET, () => {
  const a = deriveRecipientIdentity('ada@clinic.example');
  const b = deriveRecipientIdentity('  ADA@Clinic.Example ');
  const c = deriveRecipientIdentity('other@clinic.example');

  t('[behaviour] 2. key is deterministic for the same address',
    a.recipientKey === deriveRecipientIdentity('ada@clinic.example').recipientKey);
  t('[behaviour] 2. key is case/whitespace insensitive', a.recipientKey === b.recipientKey);
  t('[behaviour] 2. different addresses produce different keys',
    a.recipientKey !== c.recipientKey);
  t('[behaviour] 2. key is a 64-char sha256 hex digest',
    /^[0-9a-f]{64}$/.test(a.recipientKey));
  t('[behaviour] 2. keyVersion is 1', a.keyVersion === CURRENT_KEY_VERSION && a.keyVersion === 1);
  t('[safety] 2. key does not contain the plaintext address',
    !a.recipientKey.includes('ada') && !a.recipientKey.includes('@'));

  // Key material must not be shared with the throttle: same input under a
  // different secret must not collide.
  const underOtherSecret = withSecret('y'.repeat(MIN_SECRET_LENGTH),
    () => deriveRecipientIdentity('ada@clinic.example').recipientKey);
  t('[safety] 2. key is secret-dependent (not an unkeyed hash)',
    a.recipientKey !== underOtherSecret);
});

// ── 3-4. Secret failure → fail closed ────────────────────────────────────────
section('-- 3-4. secret failure --');

t('[safety] 3. absent secret yields no identity',
  withSecret(undefined, () => deriveRecipientIdentity('a@b.co')) === null);
t('[safety] 4. empty secret yields no identity',
  withSecret('', () => deriveRecipientIdentity('a@b.co')) === null);
t('[safety] 4. whitespace-only secret yields no identity',
  withSecret('   ', () => deriveRecipientIdentity('a@b.co')) === null);
t('[safety] 4. too-short secret yields no identity',
  withSecret('x'.repeat(MIN_SECRET_LENGTH - 1), () => deriveRecipientIdentity('a@b.co')) === null);
t('[behaviour] 4. secret at the minimum length is accepted',
  withSecret('x'.repeat(MIN_SECRET_LENGTH), () => deriveRecipientIdentity('a@b.co')) !== null);

{
  const r = await withSecret(undefined, () => canSend({
    email: 'a@b.co', communicationClass: 'CLINICAL_CONTINUITY', channel: 'EMAIL',
  }));
  t('[safety] 3. canSend returns UNAVAILABLE when the secret is absent',
    r.decision === 'UNAVAILABLE');
  t('[safety] 3. UNAVAILABLE carries no recipient key', r.recipientKey === null);
}

// ── 5. No plaintext recipient logging ────────────────────────────────────────
section('-- 5. no plaintext address in logs --');
{
  const G = stripComments(src('src/lib/communications/governance.ts'));
  const I = stripComments(src('src/lib/communications/identity.ts'));
  const logCalls = [...G.matchAll(/console\.(log|warn|error)\(([\s\S]*?)\);/g)].map(m => m[2]);
  t(`[safety] 5. no console call interpolates the address (${logCalls.length} checked)`,
    logCalls.every(c => !/\bemail\b|input\.email|\${\s*email/.test(c)));
  t('[safety] 5. no console call emits the recipient key',
    logCalls.every(c => !/recipientKey/.test(c)));
  t('[safety] 5. identity module logs nothing at all',
    !/console\./.test(I));
  t('[safety] 5. the secret is never interpolated anywhere',
    !/\$\{[^}]*SECRET[^}]*\}/i.test(G) && !/\$\{[^}]*secret[^}]*\}/.test(I));
}

// ── 6-10. CLINICAL_CONTINUITY class rules ────────────────────────────────────
section('-- 6-10. CLINICAL_CONTINUITY rules --');

const VERIFIED = { recipientVerified: true };

t('[behaviour] 6. no preference row + verified -> SUPPRESS_POLICY',
  decide('CLINICAL_CONTINUITY', { ...VERIFIED, preferenceState: null }).decision === 'SUPPRESS_POLICY');
t('[behaviour] 6. ...with reason no_preference_on_record',
  decide('CLINICAL_CONTINUITY', { ...VERIFIED, preferenceState: null }).policyReason
    === 'no_preference_on_record');
t('[behaviour] 7. NEVER_SET + verified -> SUPPRESS_POLICY',
  decide('CLINICAL_CONTINUITY', { ...VERIFIED, preferenceState: 'NEVER_SET' }).decision
    === 'SUPPRESS_POLICY');
t('[behaviour] 7. ...with reason preference_never_set',
  decide('CLINICAL_CONTINUITY', { ...VERIFIED, preferenceState: 'NEVER_SET' }).policyReason
    === 'preference_never_set');
t('[behaviour] 8. UNSUBSCRIBED + verified -> SUPPRESS_PREFERENCE',
  decide('CLINICAL_CONTINUITY', { ...VERIFIED, preferenceState: 'UNSUBSCRIBED' }).decision
    === 'SUPPRESS_PREFERENCE');
t('[behaviour] 9. SUBSCRIBED + verified + no suppression -> ALLOW',
  decide('CLINICAL_CONTINUITY', { ...VERIFIED, preferenceState: 'SUBSCRIBED' }).decision === 'ALLOW');
t('[behaviour] 10. SUBSCRIBED + UNVERIFIED -> SUPPRESS_POLICY',
  decide('CLINICAL_CONTINUITY', { recipientVerified: false, preferenceState: 'SUBSCRIBED' }).decision
    === 'SUPPRESS_POLICY');
t('[behaviour] 10. ...with reason recipient_not_verified',
  decide('CLINICAL_CONTINUITY', { recipientVerified: false, preferenceState: 'SUBSCRIBED' }).policyReason
    === 'recipient_not_verified');
t('[safety] 10. verification UNKNOWN (undefined) is treated as unverified',
  decide('CLINICAL_CONTINUITY', { preferenceState: 'SUBSCRIBED' }).policyReason
    === 'recipient_not_verified');
t('[safety] 10. verification is checked BEFORE preference — SUBSCRIBED cannot unblock unverified',
  decide('CLINICAL_CONTINUITY', { recipientVerified: false, preferenceState: 'SUBSCRIBED' }).policyReason
    === 'recipient_not_verified');

// ── 11-14. Absolute suppression ──────────────────────────────────────────────
section('-- 11-14. suppression reasons --');

const supp = (reason, extra = {}) =>
  decide('CLINICAL_CONTINUITY',
    { ...VERIFIED, preferenceState: 'SUBSCRIBED', activeSuppressionReasons: [reason], ...extra });

t('[behaviour] 11. HARD_BOUNCE -> SUPPRESS_HARD_BOUNCE',
  supp('HARD_BOUNCE').decision === 'SUPPRESS_HARD_BOUNCE');
t('[behaviour] 12. SPAM_COMPLAINT -> SUPPRESS_COMPLAINT',
  supp('SPAM_COMPLAINT').decision === 'SUPPRESS_COMPLAINT');
t('[behaviour] 13. ACCOUNT_CONTACTABILITY_REVOKED -> SUPPRESS_ACCOUNT_STATE',
  supp('ACCOUNT_CONTACTABILITY_REVOKED').decision === 'SUPPRESS_ACCOUNT_STATE');
t('[behaviour] 14. ADMIN_SUPPRESSION -> SUPPRESS_POLICY',
  supp('ADMIN_SUPPRESSION').decision === 'SUPPRESS_POLICY');
t('[behaviour] 14. RECIPIENT_UNSUBSCRIBE -> SUPPRESS_PREFERENCE',
  supp('RECIPIENT_UNSUBSCRIBE').decision === 'SUPPRESS_PREFERENCE');
t('[behaviour] 14. SOFT_BOUNCE_REPEATED is honoured structurally -> SUPPRESS_POLICY',
  supp('SOFT_BOUNCE_REPEATED').decision === 'SUPPRESS_POLICY');
t('[safety] 14. every suppression reason reports its own reason back',
  supp('HARD_BOUNCE').suppressionReason === 'HARD_BOUNCE');

// Precedence: absolute blockers outrank class rules and each other, in order.
t('[safety] precedence: account state outranks hard bounce',
  decide('CLINICAL_CONTINUITY', { ...VERIFIED, preferenceState: 'SUBSCRIBED',
    activeSuppressionReasons: ['HARD_BOUNCE', 'ACCOUNT_CONTACTABILITY_REVOKED'] }).decision
    === 'SUPPRESS_ACCOUNT_STATE');
t('[safety] precedence: hard bounce outranks complaint',
  decide('CLINICAL_CONTINUITY', { ...VERIFIED, preferenceState: 'SUBSCRIBED',
    activeSuppressionReasons: ['SPAM_COMPLAINT', 'HARD_BOUNCE'] }).decision
    === 'SUPPRESS_HARD_BOUNCE');
t('[safety] precedence: a suppression row outranks the unverified policy gate',
  decide('CLINICAL_CONTINUITY', { recipientVerified: false,
    activeSuppressionReasons: ['HARD_BOUNCE'] }).decision === 'SUPPRESS_HARD_BOUNCE');
t('[safety] hard bounce blocks even ESSENTIAL_SERVICE',
  decide('ESSENTIAL_SERVICE', { activeSuppressionReasons: ['HARD_BOUNCE'] }).decision
    === 'SUPPRESS_HARD_BOUNCE');

// Prospective classes must not be activatable by accident.
//
// C3F-1B activated EDUCATIONAL in the engine, so the blanket block no longer
// holds. The safety property it was protecting is unchanged and is asserted
// directly instead: nothing sends without an affirmative row of this class.
t('[safety] EDUCATIONAL without an affirmative preference cannot send',
  decide('EDUCATIONAL', { ...VERIFIED, preferenceState: null }).decision === 'SUPPRESS_POLICY' &&
  decide('EDUCATIONAL', { ...VERIFIED, preferenceState: 'NEVER_SET' }).decision === 'SUPPRESS_POLICY' &&
  decide('EDUCATIONAL', { ...VERIFIED, preferenceState: 'UNSUBSCRIBED' }).decision === 'SUPPRESS_PREFERENCE');
t('[safety] EDUCATIONAL sends only on an affirmative preference',
  decide('EDUCATIONAL', { ...VERIFIED, preferenceState: 'SUBSCRIBED' }).decision === 'ALLOW');
t('[safety] MARKETING is not activated -> SUPPRESS_POLICY',
  decide('MARKETING', { ...VERIFIED, preferenceState: 'SUBSCRIBED' }).decision === 'SUPPRESS_POLICY');

// ── 15-16. Fail closed, and no provider contact ──────────────────────────────
section('-- 15-16. fail closed + no provider contact --');
{
  const G = src('src/lib/communications/governance.ts');
  const I = src('src/lib/communications/identity.ts');
  const GH = stripComments(G);

  t('[safety] 15. storage errors are caught and return UNAVAILABLE',
    /catch\s*\([\s\S]{0,400}?UNAVAILABLE/.test(GH));
  t('[safety] 15. UNAVAILABLE is reachable from both the secret and the store paths',
    (GH.match(/'UNAVAILABLE'/g) ?? []).length >= 2);

  const both = GH + stripComments(I);
  for (const forbidden of ['resend', 'Resend', 'twilio', 'Twilio', 'api.resend.com', 'emails.send', 'fetch(']) {
    t(`[safety] 16. governance layer never references ${forbidden}`, !both.includes(forbidden));
  }
  t('[safety] 16. canSend performs no write (no create/update/delete in its body)',
    !/canSend[\s\S]*?^}/m.test(GH) ||
    !/(communicationEvent|communicationPreference|communicationSuppression)\.(create|update|delete)/
      .test(GH.slice(GH.indexOf('export async function canSend'),
                     GH.indexOf('export type RecordEventInput'))));
}

// ── 17-21. Cron and admin route integration ──────────────────────────────────
section('-- 17-21. Layer 0 integration --');

const PATHWAYS = {
  'cron:weekly-pulse':        'app/api/cron/weekly-pulse/route.ts',
  'cron:longitudinal':        'app/api/cron/longitudinal-summary/route.ts',
  'admin:weekly-pulse':       'app/api/email/weekly-pulse/route.ts',
  'admin:longitudinal':       'app/api/email/longitudinal-summary/route.ts',
};

for (const [label, path] of Object.entries(PATHWAYS)) {
  const H = stripComments(src(path));
  const at = re => { const m = H.match(re); return m ? m.index : Infinity; };

  t(`[ordering] ${label} calls canSend`, /\bcanSend\(/.test(H));
  t(`[ordering] ${label} Layer 0 precedes the provider send`,
    at(/\bcanSend\(/) < at(/send(WeeklyPulse|LongitudinalSummary)Email\(/));
  t(`[ordering] ${label} Layer 0 precedes digest generation (expensive clinical work)`,
    at(/\bcanSend\(/) < at(/generateWeeklyDigest\(/));
  t(`[ordering] ${label} a non-ALLOW decision short-circuits before the send`,
    at(/decision !== 'ALLOW'/) < at(/send(WeeklyPulse|LongitudinalSummary)Email\(/));
  t(`[ordering] ${label} UNAVAILABLE is handled explicitly`,
    /decision === 'UNAVAILABLE'/.test(H));
  // Phase 1D-C3B.1 replaced the caller-supplied `recipientVerified` boolean
  // with a caller-supplied Clerk identity that the boundary resolves itself.
  // The assertion is inverted rather than dropped: a route regaining the
  // ability to assert verification is exactly what this must catch.
  t(`[ordering] ${label} supplies clerkUserId for boundary-side verification`,
    /clerkUserId:/.test(H));
  t(`[safety] ${label} cannot assert verification itself`,
    !/recipientVerified/.test(H));
  t(`[ordering] ${label} records an event before the send`,
    at(/recordCommunicationEvent\(/) < at(/send(WeeklyPulse|LongitudinalSummary)Email\(/));
  t(`[ordering] ${label} refuses to send when the event cannot be recorded`,
    /if\s*\(!eventId\)/.test(H));
  t(`[safety] ${label} class is CLINICAL_CONTINUITY`,
    /communicationClass:\s*'CLINICAL_CONTINUITY'/.test(H));
}

// Layers 1 and 2 must survive untouched in the crons.
{
  const W = stripComments(src(PATHWAYS['cron:weekly-pulse']));
  const L = stripComments(src(PATHWAYS['cron:longitudinal']));
  const atW = re => { const m = W.match(re); return m ? m.index : Infinity; };
  const atL = re => { const m = L.match(re); return m ? m.index : Infinity; };

  t('[ordering] 20. weekly pulse retains Layer 1 cadence suppression',
    /checkWeeklyPulseSuppression\(/.test(W));
  t('[ordering] 20. longitudinal retains Layer 1 cadence suppression',
    /checkLongitudinalSuppression\(/.test(L));
  t('[ordering] 21. weekly pulse retains Layer 2 idempotency',
    /checkIdempotency\(/.test(W));
  t('[ordering] 21. longitudinal retains Layer 2 idempotency',
    /checkIdempotency\(/.test(L));
  t('[ordering] weekly pulse layer order is 0 -> 1 -> 2',
    atW(/\bcanSend\(/) < atW(/checkWeeklyPulseSuppression\(/) &&
    atW(/checkWeeklyPulseSuppression\(/) < atW(/checkIdempotency\(/));
  t('[ordering] longitudinal layer order is 0 -> 1 -> 2',
    atL(/\bcanSend\(/) < atL(/checkLongitudinalSuppression\(/) &&
    atL(/checkLongitudinalSuppression\(/) < atL(/checkIdempotency\(/));
  t('[safety] cron schedules unchanged (vercel.json)',
    /"0 9 \* \* 1"/.test(src('vercel.json')) && /"0 9 1 \* \*"/.test(src('vercel.json')));
}

// ── 22-25. Event content and no fabricated state ─────────────────────────────
section('-- 22-25. event content + no fabricated state --');
{
  const G = stripComments(src('src/lib/communications/governance.ts'));
  const createBlock = G.slice(G.indexOf('communicationEvent.create'),
                              G.indexOf('return row.id'));

  const FORBIDDEN = ['email:', 'subject:', 'html:', 'body:', 'riskBand', 'trendStatus',
                     'sri', 'symptoms', 'medication', 'dose', 'score'];
  const leaked = FORBIDDEN.filter(f => createBlock.includes(f));
  t('[safety] 22. CommunicationEvent write contains no prohibited field', leaked.length === 0);
  if (leaked.length) console.log('        leaked: ' + leaked.join(', '));
  t('[safety] 22. clinical context is linked by id only',
    /relatedNotificationId/.test(G) && !/notification\.body/.test(G));

  t('[safety] 23. a suppressed decision produces an auditable event',
    Object.values(PATHWAYS).every(p => {
      const H = stripComments(src(p));
      const i = H.indexOf("decision !== 'ALLOW'");
      return i !== -1 && H.slice(i, i + 900).includes("state:              'SUPPRESSED'");
    }));

  // Nothing in this phase may fabricate consent or preference state.
  const ALL = Object.values(PATHWAYS).map(p => stripComments(src(p))).join('\n') + G;
  t('[safety] 24. no preference row is ever created',
    !/communicationPreference\.(create|upsert|createMany)/.test(ALL));
  t('[safety] 25. no consent row is ever created',
    !/communicationConsentEvent\.(create|upsert|createMany)/.test(ALL));
  t('[safety] no recipient row is created (no durable relationship is implied)',
    !/communicationRecipient\.(create|upsert|createMany)/.test(ALL));
  t('[safety] no suppression row is created (C3D owns provider-driven suppression)',
    !/communicationSuppression\.(create|upsert|createMany)/.test(ALL));
  t('[safety] no wording row is created',
    !/consentWording\.(create|upsert|createMany)/.test(ALL));
}

// ── O. October 1 proof ───────────────────────────────────────────────────────
section('-- O. October 1 Longitudinal Summary safety proof --');
{
  // Every one of the 24 production users is in exactly this state today:
  // no CommunicationPreference row exists (table is empty), and no PATIENT
  // has isVerified = true. Both facts independently force suppression.
  const noPref      = decide('CLINICAL_CONTINUITY', { recipientVerified: true,  preferenceState: null });
  const neverSet    = decide('CLINICAL_CONTINUITY', { recipientVerified: true,  preferenceState: 'NEVER_SET' });
  const unverified  = decide('CLINICAL_CONTINUITY', { recipientVerified: false, preferenceState: null });
  const productionToday =
    decide('CLINICAL_CONTINUITY', { recipientVerified: false, preferenceState: null });

  t('[safety] O. no preference     -> cannot receive', noPref.decision !== 'ALLOW');
  t('[safety] O. NEVER_SET         -> cannot receive', neverSet.decision !== 'ALLOW');
  t('[safety] O. unverified        -> cannot receive', unverified.decision !== 'ALLOW');
  t('[safety] O. exact production state today -> SUPPRESS_POLICY',
    productionToday.decision === 'SUPPRESS_POLICY');

  // Exhaustive: ALLOW requires verified AND SUBSCRIBED AND no suppression.
  const allCombos = [];
  for (const v of [true, false, undefined])
    for (const p of [null, 'NEVER_SET', 'UNSUBSCRIBED', 'SUBSCRIBED'])
      allCombos.push([v, p, decide('CLINICAL_CONTINUITY',
        { recipientVerified: v, preferenceState: p }).decision]);
  const allowed = allCombos.filter(([, , d]) => d === 'ALLOW');
  t(`[safety] O. exactly one of ${allCombos.length} state combinations yields ALLOW`,
    allowed.length === 1);
  t('[safety] O. the only ALLOW is verified + SUBSCRIBED',
    allowed.length === 1 && allowed[0][0] === true && allowed[0][1] === 'SUBSCRIBED');
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
