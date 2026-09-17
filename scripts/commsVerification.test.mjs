/**
 * scripts/commsVerification.test.mjs
 *
 * Phase 1D-C3B.1 — verified recipient semantics + durable policy reason.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/commsVerification.test.mjs
 *
 * Imports the REAL resolver primitives and the REAL pure decision function.
 * Clerk is never contacted: `verifyRecipientEmail`'s Clerk-dependent branch is
 * covered by exercising the two shipped pure functions it composes
 * (resolveVerifiedPrimaryEmail, verifiedEmailMatchesBody) against synthetic
 * Clerk-shaped objects, plus [ordering] checks on the shipped source.
 *
 * Touches no database, contacts no provider, sends no email, creates no
 * Clerk identity.
 */

import { readFileSync } from 'node:fs';
import {
  resolveVerifiedPrimaryEmail,
  verifiedEmailMatchesBody,
} from '../src/lib/onboardingIdentity.ts';
import { verifyRecipientEmail } from '../src/lib/communications/recipientVerification.ts';
import { decideFromGovernanceState } from '../src/lib/communications/governance.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const stripComments = s =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

/** Clerk-shaped user builder. */
const clerkUser = ({ primaryId = 'e1', addresses = [] } = {}) => ({
  primaryEmailAddressId: primaryId,
  emailAddresses:        addresses,
});
const addr = (id, email, status) => ({
  id, emailAddress: email, verification: status ? { status } : null,
});

const DEST = 'patient@clinic.example';

const state = (o = {}) => ({
  activeSuppressionReasons: [],
  preferenceState:          null,
  recipientVerified:        undefined,
  ...o,
});
const decide = (cls, o) => decideFromGovernanceState(cls, state(o));

// ── 1. User.isVerified is not the verification source ────────────────────────
section('-- 1. User.isVerified removed from email-verification semantics --');
{
  const GOV   = stripComments(src('src/lib/communications/governance.ts'));
  const VER   = stripComments(src('src/lib/communications/recipientVerification.ts'));
  const CRONS = [
    'app/api/cron/weekly-pulse/route.ts',
    'app/api/cron/longitudinal-summary/route.ts',
    'app/api/email/weekly-pulse/route.ts',
    'app/api/email/longitudinal-summary/route.ts',
  ];

  t('[safety] 1. governance layer never references isVerified',
    !/isVerified/.test(GOV) && !/isVerified/.test(VER));
  t('[safety] 1. canSend no longer accepts a recipientVerified input',
    !/recipientVerified\?:/.test(GOV));

  for (const p of CRONS) {
    const H = stripComments(src(p));
    t(`[safety] 1. ${p.split('/').slice(-2)[0]} does not pass isVerified to canSend`,
      !/recipientVerified/.test(H));
    t(`[safety] 1. ${p.split('/').slice(-2)[0]} supplies clerkUserId instead`,
      /clerkUserId:\s*patient\.clerkId/.test(H));
  }

  // The physician credential use must survive untouched.
  const REVIEW = src('app/api/admin/physician-review/route.ts');
  const VERIFY = src('app/api/admin/verify-physician/route.ts');
  t('[safety] 1. physician credential writers of isVerified are unchanged',
    /role: "PHYSICIAN", isVerified: true/.test(REVIEW) &&
    /role: "PHYSICIAN", isVerified: true/.test(VERIFY));

  // Layer 1 keeps its pre-existing contract — preserved, not cleaned up.
  const WP = stripComments(src('app/api/cron/weekly-pulse/route.ts'));
  t('[safety] 1. Layer 1 still receives isVerified (pre-existing contract preserved)',
    /checkWeeklyPulseSuppression\([\s\S]{0,120}?patient\.isVerified/.test(WP));
}

// ── 2-6. Clerk primary-email resolution semantics ────────────────────────────
section('-- 2-6. verified primary email resolution --');
{
  const verifiedPrimary = clerkUser({
    primaryId: 'e1', addresses: [addr('e1', DEST, 'verified')],
  });
  const r1 = resolveVerifiedPrimaryEmail(verifiedPrimary);
  t('[behaviour] 2. verified primary resolves', r1.ok === true && r1.email === DEST);
  t('[behaviour] 2. resolved primary matches the destination',
    verifiedEmailMatchesBody(DEST, r1.email));
  t('[behaviour] 2. matching is case/whitespace insensitive',
    verifiedEmailMatchesBody('  PATIENT@Clinic.Example ', r1.email));

  // 3. A verified NON-primary address must not rescue an unverified primary.
  const verifiedSecondaryOnly = clerkUser({
    primaryId: 'e1',
    addresses: [
      addr('e1', DEST, 'unverified'),
      addr('e2', 'other@clinic.example', 'verified'),
    ],
  });
  const r3 = resolveVerifiedPrimaryEmail(verifiedSecondaryOnly);
  t('[safety] 3. verified secondary + unverified primary -> not verified',
    r3.ok === false && r3.reason === 'primary_not_verified');

  // 4. Verified primary that is a DIFFERENT address from the destination.
  const differentPrimary = clerkUser({
    primaryId: 'e1', addresses: [addr('e1', 'someone.else@clinic.example', 'verified')],
  });
  const r4 = resolveVerifiedPrimaryEmail(differentPrimary);
  t('[behaviour] 4. a different verified primary still resolves ok', r4.ok === true);
  t('[safety] 4. ...but does NOT match the destination',
    r4.ok && !verifiedEmailMatchesBody(DEST, r4.email));

  // 5. Primary present but unverified.
  const unverifiedPrimary = clerkUser({
    primaryId: 'e1', addresses: [addr('e1', DEST, 'unverified')],
  });
  t('[safety] 5. unverified primary -> not verified',
    resolveVerifiedPrimaryEmail(unverifiedPrimary).reason === 'primary_not_verified');
  t('[safety] 5. primary with null verification -> not verified',
    resolveVerifiedPrimaryEmail(
      clerkUser({ primaryId: 'e1', addresses: [addr('e1', DEST, null)] }),
    ).reason === 'primary_not_verified');

  // 6. No primary designated, or designated id absent from the array.
  t('[safety] 6. no primary designated -> not verified',
    resolveVerifiedPrimaryEmail(clerkUser({ primaryId: null, addresses: [] })).reason
      === 'no_primary_designated');
  t('[safety] 6. primary id not present in addresses -> not verified',
    resolveVerifiedPrimaryEmail(
      clerkUser({ primaryId: 'missing', addresses: [addr('e1', DEST, 'verified')] }),
    ).reason === 'primary_not_found');
  t('[safety] 6. null clerk user -> not verified',
    resolveVerifiedPrimaryEmail(null).ok === false);
}

// ── 7-8. Identity unavailable / Clerk failure fail closed ────────────────────
section('-- 7-8. identity unavailable + Clerk failure --');
{
  for (const missing of [null, undefined, '']) {
    const r = await verifyRecipientEmail({ clerkUserId: missing, destinationEmail: DEST });
    t(`[safety] 7. clerkUserId=${JSON.stringify(missing)} -> fails closed`,
      r.verified === false && r.code === 'recipient_identity_unavailable');
  }

  const VER = stripComments(src('src/lib/communications/recipientVerification.ts'));
  t('[safety] 8. Clerk lookup is wrapped in try/catch',
    /try\s*\{[\s\S]*?clerkClient[\s\S]*?\}\s*catch/.test(VER));
  t('[safety] 8. a Clerk failure returns recipient_identity_unavailable',
    /catch[\s\S]{0,600}?recipient_identity_unavailable/.test(VER));
  t('[safety] 8. no code path returns verified:true from the catch',
    !/catch[\s\S]{0,600}?verified:\s*true/.test(VER));
  t('[safety] 8. verification logs neither the address nor the Clerk id',
    [...VER.matchAll(/console\.\w+\(([\s\S]*?)\);/g)]
      .every(m => !/destinationEmail|clerkUserId|\bemail\b/.test(m[1])));

  // Reuse, not reimplementation.
  t('[safety] 8. resolver reuses the shipped Clerk primitives',
    /from '@\/src\/lib\/onboardingIdentity'/.test(src('src/lib/communications/recipientVerification.ts')) &&
    /resolveVerifiedPrimaryEmail/.test(VER) && /verifiedEmailMatchesBody/.test(VER));
  t('[safety] 8. resolver does not reimplement primary-email selection',
    !/primaryEmailAddressId/.test(VER));
}

// ── 9. Caller cannot bypass ──────────────────────────────────────────────────
section('-- 9. caller-bypass prevention --');
{
  const GOV = stripComments(src('src/lib/communications/governance.ts'));
  t('[safety] 9. CanSendInput exposes no verification assertion',
    !/recipientVerified/.test(GOV.slice(GOV.indexOf('export type CanSendInput'),
                                        GOV.indexOf('export type CanSendResult'))));
  t('[safety] 9. canSend resolves verification itself',
    /verifyRecipientEmail\(/.test(GOV));
  t('[safety] 9. the only recipientVerified:true in canSend is the resolver result',
    (GOV.match(/recipientVerified:\s*true/g) ?? []).length === 1);

  // No route may import the resolver to pre-compute and pass a verdict.
  for (const p of ['app/api/cron/weekly-pulse/route.ts',
                   'app/api/cron/longitudinal-summary/route.ts',
                   'app/api/email/weekly-pulse/route.ts',
                   'app/api/email/longitudinal-summary/route.ts']) {
    t(`[safety] 9. ${p.split('/').slice(-2)[0]} does not import the verifier directly`,
      !/recipientVerification/.test(src(p)));
  }
}

// ── 10-13. Combined decision outcomes ────────────────────────────────────────
section('-- 10-13. decision outcomes --');

const V = { recipientVerified: true };
t('[behaviour] 10. verified + SUBSCRIBED + no suppression -> ALLOW',
  decide('CLINICAL_CONTINUITY', { ...V, preferenceState: 'SUBSCRIBED' }).decision === 'ALLOW');
t('[behaviour] 11. verified + NEVER_SET -> SUPPRESS_POLICY / preference_never_set',
  decide('CLINICAL_CONTINUITY', { ...V, preferenceState: 'NEVER_SET' }).policyReason
    === 'preference_never_set');
t('[behaviour] 12. verified + no preference -> SUPPRESS_POLICY / no_preference_on_record',
  decide('CLINICAL_CONTINUITY', { ...V, preferenceState: null }).policyReason
    === 'no_preference_on_record');
t('[behaviour] 13. unverified + SUBSCRIBED -> SUPPRESS_POLICY / recipient_not_verified',
  decide('CLINICAL_CONTINUITY',
    { recipientVerified: false, preferenceState: 'SUBSCRIBED' }).policyReason
    === 'recipient_not_verified');
t('[safety] 13. unresolved verification + SUBSCRIBED -> recipient_not_verified',
  decide('CLINICAL_CONTINUITY', { preferenceState: 'SUBSCRIBED' }).policyReason
    === 'recipient_not_verified');

// Exhaustive: ALLOW still requires verified AND SUBSCRIBED.
{
  const combos = [];
  for (const v of [true, false, undefined])
    for (const p of [null, 'NEVER_SET', 'UNSUBSCRIBED', 'SUBSCRIBED'])
      combos.push([v, p, decide('CLINICAL_CONTINUITY',
        { recipientVerified: v, preferenceState: p }).decision]);
  const allowed = combos.filter(([, , d]) => d === 'ALLOW');
  t(`[safety] exactly one of ${combos.length} combinations yields ALLOW`, allowed.length === 1);
  t('[safety] the only ALLOW is verified + SUBSCRIBED',
    allowed[0][0] === true && allowed[0][1] === 'SUBSCRIBED');
}

// Ordering change: preference is now evaluated before verification, so the
// Clerk call is only reached when it can change the outcome.
t('[behaviour] unverified + no preference reports the preference reason first',
  decide('CLINICAL_CONTINUITY',
    { recipientVerified: false, preferenceState: null }).policyReason
    === 'no_preference_on_record');
{
  const GOV = stripComments(src('src/lib/communications/governance.ts'));
  const body = GOV.slice(GOV.indexOf('export async function canSend'));
  t('[safety] verification is resolved only when nothing else suppressed',
    body.indexOf("policyReason !== 'recipient_not_verified'") <
    body.indexOf('verifyRecipientEmail('));
}

// ── 14-17. policyReason persistence ──────────────────────────────────────────
section('-- 14-17. durable policyReason --');
{
  const GOV = stripComments(src('src/lib/communications/governance.ts'));
  const SCHEMA = src('prisma/schema.prisma');

  t('[shape] policyReason exists on CommunicationEvent and is nullable',
    /policyReason\s+String\?/.test(SCHEMA));
  t('[shape] RecordEventInput accepts policyReason',
    /policyReason\?:\s*PolicyReason/.test(GOV));
  t('[safety] 14-16. the event write persists policyReason',
    /policyReason:\s*input\.policyReason \?\? null/.test(GOV));

  for (const p of ['app/api/cron/weekly-pulse/route.ts',
                   'app/api/cron/longitudinal-summary/route.ts',
                   'app/api/email/weekly-pulse/route.ts',
                   'app/api/email/longitudinal-summary/route.ts']) {
    const H = stripComments(src(p));
    const i = H.indexOf("decision !== 'ALLOW'");
    t(`[safety] 14-16. ${p.split('/').slice(-2)[0]} persists policyReason on suppression`,
      i !== -1 && /policyReason:\s+gate\.policyReason/.test(H.slice(i, i + 1100)));
  }

  // 17. Non-policy decisions must not invent one.
  t('[safety] 17. a suppression-row decision carries no policyReason',
    decide('CLINICAL_CONTINUITY',
      { ...V, preferenceState: 'SUBSCRIBED',
        activeSuppressionReasons: ['HARD_BOUNCE'] }).policyReason === undefined);
  t('[safety] 17. UNSUBSCRIBED carries no policyReason',
    decide('CLINICAL_CONTINUITY',
      { ...V, preferenceState: 'UNSUBSCRIBED' }).policyReason === undefined);
  t('[safety] 17. ALLOW carries no policyReason',
    decide('CLINICAL_CONTINUITY', { ...V, preferenceState: 'SUBSCRIBED' }).policyReason
      === undefined);

  // Bounded vocabulary — no free text can reach the column.
  const VOCAB = ['recipient_not_verified', 'recipient_identity_unavailable',
                 'no_preference_on_record', 'preference_never_set',
                 'class_not_activated', 'deliverability_hold'];
  const declared = GOV.slice(GOV.indexOf('export type PolicyReason'),
                             GOV.indexOf('export type CanSendInput'));
  const found = [...declared.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
  t(`[safety] PolicyReason is a closed union of exactly ${VOCAB.length} codes`,
    found.length === VOCAB.length && VOCAB.every(v => found.includes(v)));
}

// ── 18. Still no prohibited content ──────────────────────────────────────────
section('-- 18. data minimisation unchanged --');
{
  const GOV = stripComments(src('src/lib/communications/governance.ts'));
  const createBlock = GOV.slice(GOV.indexOf('communicationEvent.create'),
                                GOV.indexOf('return row.id'));
  const FORBIDDEN = ['email:', 'subject:', 'html:', 'body:', 'riskBand', 'trendStatus',
                     'sri', 'symptoms', 'medication', 'dose', 'score'];
  const leaked = FORBIDDEN.filter(f => createBlock.includes(f));
  t('[safety] 18. event write still contains no prohibited field', leaked.length === 0);
  if (leaked.length) console.log('        leaked: ' + leaked.join(', '));

  const SCHEMA = src('prisma/schema.prisma');
  const model = SCHEMA.match(/^model CommunicationEvent \{([\s\S]*?)^\}/m)[1];
  const fields = model.split('\n').map(l => l.trim())
    .filter(l => l && !l.startsWith('@@') && !l.startsWith('///'))
    .map(l => l.split(/\s+/)[0]);
  t(`[safety] 18. CommunicationEvent has no clinical column (${fields.length} fields)`,
    !fields.some(f => ['body','html','subject','riskBand','symptoms','medication',
                       'dose','score','text','payload'].includes(f)));
}

// ── 19-23. Pathways + preserved C3B rules ────────────────────────────────────
section('-- 19-23. pathways + preserved C3B behaviour --');
{
  const PATHS = {
    'cron:weekly-pulse':  'app/api/cron/weekly-pulse/route.ts',
    'cron:longitudinal':  'app/api/cron/longitudinal-summary/route.ts',
    'admin:weekly-pulse': 'app/api/email/weekly-pulse/route.ts',
    'admin:longitudinal': 'app/api/email/longitudinal-summary/route.ts',
  };
  for (const [label, p] of Object.entries(PATHS)) {
    const H = stripComments(src(p));
    const at = re => { const m = H.match(re); return m ? m.index : Infinity; };
    t(`[ordering] 19-21. ${label} routes verification through canSend`,
      /\bcanSend\(/.test(H) && /clerkUserId:/.test(H));
    t(`[ordering] 23. ${label} still records the event before the send`,
      at(/recordCommunicationEvent\(/) < at(/send(WeeklyPulse|LongitudinalSummary)Email\(/));
    t(`[ordering] 23. ${label} still refuses to send with no event`, /if\s*\(!eventId\)/.test(H));
    t(`[ordering] ${label} still handles UNAVAILABLE`, /decision === 'UNAVAILABLE'/.test(H));
  }

  // 22. Precedence unchanged from C3B.
  const s = (r) => decide('CLINICAL_CONTINUITY',
    { ...V, preferenceState: 'SUBSCRIBED', activeSuppressionReasons: [r] }).decision;
  t('[behaviour] 22. ACCOUNT_CONTACTABILITY_REVOKED -> SUPPRESS_ACCOUNT_STATE',
    s('ACCOUNT_CONTACTABILITY_REVOKED') === 'SUPPRESS_ACCOUNT_STATE');
  t('[behaviour] 22. HARD_BOUNCE -> SUPPRESS_HARD_BOUNCE', s('HARD_BOUNCE') === 'SUPPRESS_HARD_BOUNCE');
  t('[behaviour] 22. SPAM_COMPLAINT -> SUPPRESS_COMPLAINT', s('SPAM_COMPLAINT') === 'SUPPRESS_COMPLAINT');
  t('[behaviour] 22. ADMIN_SUPPRESSION -> SUPPRESS_POLICY', s('ADMIN_SUPPRESSION') === 'SUPPRESS_POLICY');
  t('[behaviour] 22. RECIPIENT_UNSUBSCRIBE -> SUPPRESS_PREFERENCE',
    s('RECIPIENT_UNSUBSCRIBE') === 'SUPPRESS_PREFERENCE');
  t('[safety] 22. a suppression row outranks the verification gate',
    decide('CLINICAL_CONTINUITY',
      { recipientVerified: false, preferenceState: 'SUBSCRIBED',
        activeSuppressionReasons: ['HARD_BOUNCE'] }).decision === 'SUPPRESS_HARD_BOUNCE');
  // C3F-1B: EDUCATIONAL is preference-governed and deliberately NOT
  // verification-gated — its subscribers are anonymous and have no Clerk
  // identity to verify, so the gate could only ever block them.
  t('[safety] 22. EDUCATIONAL is governed by preference, not the verification gate',
    decide('EDUCATIONAL', { ...V, preferenceState: 'SUBSCRIBED' }).decision === 'ALLOW' &&
    decide('EDUCATIONAL',
      { recipientVerified: false, preferenceState: 'SUBSCRIBED',
        activeSuppressionReasons: [] }).decision === 'ALLOW' &&
    decide('EDUCATIONAL', { ...V, preferenceState: 'NEVER_SET' }).policyReason
      === 'preference_never_set');
  t('[safety] 22. MARKETING still inactive',
    decide('MARKETING', { ...V, preferenceState: 'SUBSCRIBED' }).policyReason
      === 'class_not_activated');
  t('[safety] 22. cron schedules unchanged',
    /"0 9 \* \* 1"/.test(src('vercel.json')) && /"0 9 1 \* \*"/.test(src('vercel.json')));
}

// ── 24. No backfill, no fabricated state ─────────────────────────────────────
section('-- 24. no backfill --');
{
  const ALL = ['app/api/cron/weekly-pulse/route.ts',
               'app/api/cron/longitudinal-summary/route.ts',
               'app/api/email/weekly-pulse/route.ts',
               'app/api/email/longitudinal-summary/route.ts',
               'src/lib/communications/governance.ts',
               'src/lib/communications/recipientVerification.ts']
    .map(p => stripComments(src(p))).join('\n');

  for (const m of ['communicationPreference', 'communicationConsentEvent',
                   'communicationRecipient', 'communicationSuppression', 'consentWording']) {
    t(`[safety] 24. no ${m} row is created`,
      !new RegExp(`${m}\\.(create|upsert|createMany|update|updateMany)`).test(ALL));
  }
  t('[safety] 24. no Clerk identity is modified',
    !/users\.(update|create|delete)/.test(ALL));
  t('[safety] 24. Clerk is read-only (getUser only)',
    !/users\./.test(ALL) || /users\.getUser/.test(ALL));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
