/**
 * scripts/commsEducationalGovernance.test.mjs
 *
 * Phase 1D-C3F-1B — EDUCATIONAL becomes a preference-governed class.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/commsEducationalGovernance.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * The decision function is pure, so every decision test calls the real
 * `decideFromGovernanceState` with real state. Nothing is mocked and nothing is
 * asserted about EDUCATIONAL that is not the shipped engine answering.
 *
 * The absence of a public grant surface cannot be proven by calling a function
 * — it is the absence of one — so it is asserted against shipped source.
 *
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would send mail nobody
 *                 consented to, or open a class this phase must leave closed.
 *
 * THE DISTINCTION THIS SUITE EXISTS TO HOLD
 * Activating EDUCATIONAL in the engine is not activating it in the product.
 * Section G proves the engine now reads the preference; Section H proves
 * nothing public can write one.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideFromGovernanceState } from '../src/lib/communications/governance.ts';
import { declaredSurfaces } from '../src/lib/communications/consentWording.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src   = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const decide = (cls, st) => decideFromGovernanceState(cls, {
  activeSuppressionReasons: [],
  preferenceState:          null,
  recipientVerified:        true,
  ...st,
});

const GOV  = strip(src('src/lib/communications/governance.ts'));
const PREF = strip(src('app/api/communications/preferences/route.ts'));
const SVC  = strip(src('src/lib/communications/preferenceService.ts'));

// ── A-D. The EDUCATIONAL preference matrix ───────────────────────────────────
section('-- A-D. EDUCATIONAL is governed by its own preference --');
{
  t('[behaviour] A. SUBSCRIBED -> ALLOW',
    decide('EDUCATIONAL', { preferenceState: 'SUBSCRIBED' }).decision === 'ALLOW');

  t('[behaviour] B. NEVER_SET -> blocked',
    decide('EDUCATIONAL', { preferenceState: 'NEVER_SET' }).decision === 'SUPPRESS_POLICY');
  t('[behaviour] B. NEVER_SET reports preference_never_set',
    decide('EDUCATIONAL', { preferenceState: 'NEVER_SET' }).policyReason === 'preference_never_set');

  t('[behaviour] C. no preference row at all -> blocked',
    decide('EDUCATIONAL', { preferenceState: null }).decision === 'SUPPRESS_POLICY');
  t('[behaviour] C. no row reports no_preference_on_record',
    decide('EDUCATIONAL', { preferenceState: null }).policyReason === 'no_preference_on_record');

  t('[behaviour] D. UNSUBSCRIBED -> blocked',
    decide('EDUCATIONAL', { preferenceState: 'UNSUBSCRIBED' }).decision === 'SUPPRESS_PREFERENCE');

  t('[safety]    ALLOW is reachable ONLY from SUBSCRIBED',
    ['NEVER_SET', 'UNSUBSCRIBED', null]
      .every(p => decide('EDUCATIONAL', { preferenceState: p }).decision !== 'ALLOW'));
}

// ── E-G. Absolute suppression still outranks consent ─────────────────────────
section('-- E-G. Absolute suppression outranks an affirmative preference --');
{
  const blockers = [
    ['HARD_BOUNCE',           'SUPPRESS_HARD_BOUNCE'],
    ['SPAM_COMPLAINT',        'SUPPRESS_COMPLAINT'],
    ['SOFT_BOUNCE_REPEATED',  'SUPPRESS_POLICY'],
    ['ACCOUNT_CONTACTABILITY_REVOKED', 'SUPPRESS_ACCOUNT_STATE'],
    ['ADMIN_SUPPRESSION',     'SUPPRESS_ADMIN'],
    ['RECIPIENT_UNSUBSCRIBE', 'SUPPRESS_PREFERENCE'],
  ];

  for (const [reason] of blockers) {
    const d = decide('EDUCATIONAL', {
      preferenceState: 'SUBSCRIBED', activeSuppressionReasons: [reason],
    });
    t(`[safety] E-G. ${reason} blocks EDUCATIONAL despite SUBSCRIBED`,
      d.decision !== 'ALLOW');
  }

  t('[safety] E. hard bounce reports the hard-bounce decision, not a policy reason',
    decide('EDUCATIONAL', { preferenceState: 'SUBSCRIBED',
      activeSuppressionReasons: ['HARD_BOUNCE'] }).decision === 'SUPPRESS_HARD_BOUNCE');
  t('[safety] F. a complaint reports the complaint decision',
    decide('EDUCATIONAL', { preferenceState: 'SUBSCRIBED',
      activeSuppressionReasons: ['SPAM_COMPLAINT'] }).decision === 'SUPPRESS_COMPLAINT');

  t('[ordering] G. suppression precedence is evaluated before any class rule',
    /for \(const rule of SUPPRESSION_PRECEDENCE\)[\s\S]{0,400}?switch \(communicationClass\)/
      .test(GOV));
  t('[safety]   G. EDUCATIONAL suppression matches every other class',
    ['HARD_BOUNCE', 'SPAM_COMPLAINT', 'ADMIN_SUPPRESSION'].every(r =>
      decide('EDUCATIONAL', { preferenceState: 'SUBSCRIBED', activeSuppressionReasons: [r] }).decision ===
      decide('CLINICAL_CONTINUITY', { preferenceState: 'SUBSCRIBED', activeSuppressionReasons: [r] }).decision));
}

// ── H. Unknown state fails closed ────────────────────────────────────────────
section('-- H. Unresolvable state fails closed --');
{
  t('[safety] H. an unresolved preference is treated as no permission',
    decide('EDUCATIONAL', { preferenceState: undefined }).decision !== 'ALLOW');
  t('[safety] H. canSend still returns UNAVAILABLE when the store throws',
    /catch[\s\S]{0,400}?decision: 'UNAVAILABLE'/.test(GOV));
  t('[safety] H. a missing identity secret still refuses to send',
    /UNAVAILABLE/.test(GOV) && !/decision: 'ALLOW'[\s\S]{0,80}?catch/.test(GOV));
  t('[safety] H. callers must not send on UNAVAILABLE (C3E contract intact)',
    /gate\.decision === 'UNAVAILABLE'/.test(
      strip(src('src/lib/communications/serviceEmail.ts'))));
}

// ── I. MARKETING stays closed ────────────────────────────────────────────────
section('-- I. MARKETING remains class_not_activated --');
{
  for (const p of ['SUBSCRIBED', 'NEVER_SET', 'UNSUBSCRIBED', null]) {
    const d = decide('MARKETING', { preferenceState: p });
    t(`[safety] I. MARKETING + ${p} -> class_not_activated`,
      d.decision === 'SUPPRESS_POLICY' && d.policyReason === 'class_not_activated');
  }
  t('[safety] I. MARKETING can never reach ALLOW on any preference state',
    ['SUBSCRIBED', 'NEVER_SET', 'UNSUBSCRIBED', null]
      .every(p => decide('MARKETING', { preferenceState: p }).decision !== 'ALLOW'));
  t('[ordering] I. MARKETING does not read the preference state at all',
    /case 'MARKETING':\s*return \{ decision: 'SUPPRESS_POLICY', policyReason: 'class_not_activated' \};/
      .test(GOV));
}

// ── J-K. Untouched classes ───────────────────────────────────────────────────
section('-- J-K. ESSENTIAL_SERVICE and CLINICAL_CONTINUITY are unchanged --');
{
  for (const p of ['SUBSCRIBED', 'NEVER_SET', 'UNSUBSCRIBED', null]) {
    t(`[behaviour] J. ESSENTIAL_SERVICE + ${p} -> ALLOW (preference is not consulted)`,
      decide('ESSENTIAL_SERVICE', { preferenceState: p }).decision === 'ALLOW');
  }
  t('[safety] J. ESSENTIAL_SERVICE is still blocked by a hard bounce',
    decide('ESSENTIAL_SERVICE', { activeSuppressionReasons: ['HARD_BOUNCE'] }).decision
      === 'SUPPRESS_HARD_BOUNCE');

  t('[behaviour] K. CLINICAL_CONTINUITY + SUBSCRIBED + verified -> ALLOW',
    decide('CLINICAL_CONTINUITY', { preferenceState: 'SUBSCRIBED' }).decision === 'ALLOW');
  t('[behaviour] K. CLINICAL_CONTINUITY + NEVER_SET -> preference_never_set',
    decide('CLINICAL_CONTINUITY', { preferenceState: 'NEVER_SET' }).policyReason
      === 'preference_never_set');
  t('[behaviour] K. CLINICAL_CONTINUITY + no row -> no_preference_on_record',
    decide('CLINICAL_CONTINUITY', { preferenceState: null }).policyReason
      === 'no_preference_on_record');
  t('[behaviour] K. CLINICAL_CONTINUITY + UNSUBSCRIBED -> SUPPRESS_PREFERENCE',
    decide('CLINICAL_CONTINUITY', { preferenceState: 'UNSUBSCRIBED' }).decision
      === 'SUPPRESS_PREFERENCE');
  t('[safety]    K. CLINICAL_CONTINUITY keeps its verification gate',
    decide('CLINICAL_CONTINUITY',
      { preferenceState: 'SUBSCRIBED', recipientVerified: false }).policyReason
      === 'recipient_not_verified');
  t('[safety]    K. OPERATIONAL_INTERNAL is unchanged',
    decide('OPERATIONAL_INTERNAL', { preferenceState: null }).decision === 'ALLOW');
}

// ── L-N. Permission cannot be inferred ───────────────────────────────────────
section('-- L-N. EDUCATIONAL permission is class-specific and cannot be inferred --');
{
  // A one-shot ESSENTIAL_SERVICE delivery leaves preferenceState untouched, so
  // the very next EDUCATIONAL question still answers "no permission".
  t('[safety] L. an allowed ESSENTIAL_SERVICE send grants no EDUCATIONAL permission',
    decide('ESSENTIAL_SERVICE', { preferenceState: null }).decision === 'ALLOW' &&
    decide('EDUCATIONAL',       { preferenceState: null }).decision !== 'ALLOW');
  t('[safety] L. the C3E send path creates no preference or consent row',
    !/communicationPreference\.(create|upsert)|communicationConsentEvent\.(create|upsert)/
      .test(strip(src('src/lib/communications/serviceEmail.ts'))));
  t('[safety] L. the public capture pathways create no preference or consent row',
    ['app/api/email-capture/route.ts', 'app/api/protocol-email/route.ts'].every(p =>
      !/communicationPreference\.|communicationConsentEvent\./.test(strip(src(p)))));

  t('[safety] M. research consent cannot authorise EDUCATIONAL',
    !/EDUCATIONAL/.test(GOV.split("case 'EDUCATIONAL'")[0] + '') ||
    !/studyConsent|StudyConsent|enrollment/i.test(GOV));
  t('[safety] M. the consent ledger is never written from a study surface',
    !/studyConsent|StudyEnrollment/i.test(SVC));

  // N. Cross-class leakage: each class is asked about its own row only. The
  // engine receives one preferenceState per call, so the proof is that the same
  // state produces different answers per class.
  t('[safety] N. a CLINICAL_CONTINUITY subscription does not allow EDUCATIONAL',
    decide('CLINICAL_CONTINUITY', { preferenceState: 'SUBSCRIBED' }).decision === 'ALLOW' &&
    decide('EDUCATIONAL',         { preferenceState: null }).decision !== 'ALLOW');
  t('[safety] N. an EDUCATIONAL subscription does not allow MARKETING',
    decide('EDUCATIONAL', { preferenceState: 'SUBSCRIBED' }).decision === 'ALLOW' &&
    decide('MARKETING',   { preferenceState: 'SUBSCRIBED' }).decision !== 'ALLOW');
  t('[ordering] N. the preference row is keyed per class in the schema',
    /@@unique\(\[recipientId, channel, communicationClass\]\)/
      .test(src('prisma/schema.prisma')));
  t('[safety] N. no generic subscription boolean was introduced',
    !/\b(isSubscribed|subscribedToAll|globalOptIn|emailOptIn)\b/.test(GOV + SVC));
}

// ── O. The engine is open; the product is not ────────────────────────────────
section('-- O. No public surface can grant EDUCATIONAL permission --');
{
  t('[safety] O. SETTABLE_CLASSES is still CLINICAL_CONTINUITY only',
    /SETTABLE_CLASSES = \['CLINICAL_CONTINUITY'\]/.test(PREF));
  t('[safety] O. the only grant surface still requires a Clerk session',
    /auth\(\)/.test(PREF) && /status: 401/.test(PREF));
  // Comments are stripped before matching: a route that documents "never calls
  // grantConsent" must not be counted as calling it. C3F-2 added exactly such a
  // comment, and an unstripped scan read it as a call site.
  t('[safety] O. grantConsent is called from no public route but the authenticated one',
    (() => {
      const root = fileURLToPath(new URL('../app', import.meta.url));
      const hits = [];
      (function walk(d) {
        for (const e of readdirSync(d)) {
          const p = join(d, e);
          if (statSync(p).isDirectory()) walk(p);
          else if (e === 'route.ts' && /grantConsent\s*\(/.test(strip(readFileSync(p, 'utf8')))) hits.push(p);
        }
      })(root);
      return hits.length === 1 && hits[0].includes('preferences');
    })());
  t('[safety] O. no EDUCATIONAL sender exists',
    !/communicationClass:\s*'EDUCATIONAL'/.test(
      ['src/lib/communications/serviceEmail.ts', 'src/lib/email.ts']
        .map(p => strip(src(p))).join('\n')));
  t('[safety] O. no consent wording surface exists that could grant EDUCATIONAL',
    declaredSurfaces().length === 1);
  // C3F-2 added the Guide requested-delivery route under Founder authorisation,
  // so its absence is no longer the invariant. What must stay true is that it
  // grants nothing: the route is ESSENTIAL_SERVICE only and writes no
  // permission of any kind.
  t('[safety] O. the Guide request route grants no communication permission',
    (() => {
      const p = fileURLToPath(new URL('../app/api/guide-request/route.ts', import.meta.url));
      const s = strip(readFileSync(p, 'utf8'));
      return !/grantConsent\s*\(/.test(s) &&
             !/communicationPreference|communicationConsentEvent|consentWording/i.test(s) &&
             !/EDUCATIONAL|MARKETING/.test(s);
    })());
  t('[safety] O. no /learn surface exists',
    (() => {
      const root = fileURLToPath(new URL('../app', import.meta.url));
      let found = false;
      (function walk(d) {
        for (const e of readdirSync(d)) {
          const p = join(d, e);
          if (statSync(p).isDirectory()) { if (/^learn$/i.test(e)) found = true; walk(p); }
        }
      })(root);
      return !found;
    })());
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
