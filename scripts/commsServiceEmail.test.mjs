/**
 * scripts/commsServiceEmail.test.mjs
 *
 * Phase 1D-C3E — governance migration of the ten external ESSENTIAL_SERVICE
 * email pathways.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/commsServiceEmail.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * Every suppression decision is exercised by calling the real
 * `decideFromGovernanceState` with real state — all five absolute blockers
 * against ESSENTIAL_SERVICE, and the recipient-choice case that must NOT block
 * it. Those are pure functions and are called directly.
 *
 * The send sequence itself touches Prisma and Resend, and the only database in
 * this project is production, which this phase forbids writing to. So ordering
 * and integration are asserted against shipped source, as in C3B–C3D.
 *
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would send mail that
 *                 should not be sent, leak PII, or fabricate consent.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideFromGovernanceState } from '../src/lib/communications/governance.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src   = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const HELPER = 'src/lib/communications/serviceEmail.ts';

/** The ten authorised pathways, by the file that performs the governed send. */
const MIGRATED = {
  'T1.1 preliminary-SRI':      'app/api/protocol-email/route.ts',
  'T1.2 protocol-delivery':    'app/api/email-capture/route.ts',
  'T1.3 patient-welcome':      'src/lib/email.ts',
  'T1.4 patient-invitation':   'app/api/invite/send/route.ts',
  'T1.5 priority-review':      'src/lib/email/categories/PhysicianPriorityReview.ts',
  'T1.6 first-assessment':     'src/lib/email/categories/PhysicianFirstAssessment.ts',
  'T2.7 registration-applicant': 'app/api/doctor/register/route.ts',
  'T2.8 onboarding-physician': 'app/api/doctor/onboarding/route.ts',
  'T2.9 physician-activation': 'app/api/admin/verify-physician/route.ts',
  'T2.10 approval-rejection':  'app/api/admin/physician-review/route.ts',
};

const EXCLUDED_GOVERNED = [
  'app/api/cron/weekly-pulse/route.ts',
  'app/api/cron/longitudinal-summary/route.ts',
  'app/api/email/weekly-pulse/route.ts',
  'app/api/email/longitudinal-summary/route.ts',
];

const ABSOLUTE_BLOCKERS = [
  ['HARD_BOUNCE',                    'SUPPRESS_HARD_BOUNCE'],
  ['SPAM_COMPLAINT',                 'SUPPRESS_COMPLAINT'],
  ['SOFT_BOUNCE_REPEATED',           'SUPPRESS_POLICY'],
  ['ADMIN_SUPPRESSION',              'SUPPRESS_POLICY'],
  ['ACCOUNT_CONTACTABILITY_REVOKED', 'SUPPRESS_ACCOUNT_STATE'],
];

const helper = strip(src(HELPER));

// ═══════════════════════════════════════════════════════════════════════════
section('T. SHARED GOVERNANCE');
// ═══════════════════════════════════════════════════════════════════════════

// 1. every pathway reaches governance before the provider
for (const [label, file] of Object.entries(MIGRATED)) {
  const s = strip(src(file));
  t(`[ordering]  T1 ${label} routes through the governed helper`,
    /sendServiceEmail\(/.test(s));
  t(`[safety]    T1 ${label} performs no raw Resend call`,
    !/api\.resend\.com/.test(s));
}
t('[safety]    T1 every raw Resend fetch in the repo is gone', (() => {
  // Scan the whole app+src tree, not just migrated files.
  const hits = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && /api\.resend\.com/.test(readFileSync(p, 'utf8'))) hits.push(p);
    }
  };
  walk(fileURLToPath(new URL('../app', import.meta.url)));
  walk(fileURLToPath(new URL('../src', import.meta.url)));
  return hits.length === 0;
})());

// 2. classified ESSENTIAL_SERVICE
t('[safety]    T2 the helper sends ESSENTIAL_SERVICE and nothing else',
  (helper.match(/communicationClass:\s*'([A-Z_]+)'/g) ?? [])
    .every(m => m.includes('ESSENTIAL_SERVICE')));
t('[safety]    T2 the helper never names CLINICAL_CONTINUITY',
  !/CLINICAL_CONTINUITY/.test(helper));
t('[safety]    T2 no migrated pathway names another class', (() => {
  return Object.values(MIGRATED).every(f => {
    const s = strip(src(f));
    return !/communicationClass:\s*'(CLINICAL_CONTINUITY|EDUCATIONAL|MARKETING|OPERATIONAL_INTERNAL)'/.test(s);
  });
})());

// 3. no SUBSCRIBED requirement for essential mail
for (const pref of ['SUBSCRIBED', 'UNSUBSCRIBED', 'NEVER_SET', null]) {
  const d = decideFromGovernanceState('ESSENTIAL_SERVICE', {
    activeSuppressionReasons: [], preferenceState: pref, recipientVerified: undefined,
  });
  t(`[behaviour] T3 ESSENTIAL_SERVICE allowed with preference=${pref}`,
    d.decision === 'ALLOW');
}
t('[behaviour] T3 ESSENTIAL_SERVICE needs no verified recipient',
  decideFromGovernanceState('ESSENTIAL_SERVICE', {
    activeSuppressionReasons: [], preferenceState: null, recipientVerified: false,
  }).decision === 'ALLOW');

// 4-8. every absolute blocker blocks essential mail
for (const [reason, expected] of ABSOLUTE_BLOCKERS) {
  const d = decideFromGovernanceState('ESSENTIAL_SERVICE', {
    activeSuppressionReasons: [reason], preferenceState: 'SUBSCRIBED', recipientVerified: true,
  });
  t(`[behaviour] T4-8 ${reason} blocks ESSENTIAL_SERVICE`,
    d.decision !== 'ALLOW' && d.decision === expected);
}
t('[safety]    T4-8 all five blockers together still block',
  decideFromGovernanceState('ESSENTIAL_SERVICE', {
    activeSuppressionReasons: ABSOLUTE_BLOCKERS.map(b => b[0]),
    preferenceState: 'SUBSCRIBED', recipientVerified: true,
  }).decision !== 'ALLOW');

// A recipient's CLINICAL_CONTINUITY opt-out must never silence service mail.
// C3C scopes recipient-choice suppressions to a specific optional class, never
// to the all-class NULL scope, so such a row cannot appear in this state at all.
t('[safety]    T4-8 a clinical-continuity opt-out does NOT block service mail',
  decideFromGovernanceState('ESSENTIAL_SERVICE', {
    activeSuppressionReasons: [], preferenceState: 'UNSUBSCRIBED', recipientVerified: true,
  }).decision === 'ALLOW');
// Scoped to the CREATE. The active-row LOOKUP legitimately matches
// `communicationClass: null` — it must honour all-class suppressions written by
// other layers. What must never happen is C3C WRITING one.
t('[safety]    T4-8 C3C never creates an all-class recipient suppression', (() => {
  const pref = strip(src('src/lib/communications/preferenceService.ts'));
  const create = /communicationSuppression\.create\(\{[\s\S]*?\n\s{6}\}\);/.exec(pref)?.[0] ?? '';
  return create.length > 0
    && /communicationClass,/.test(create)      // scoped to the specific class
    && !/communicationClass:\s*null/.test(create);
})());

// 9. suppression prevents the provider call
t('[ordering]  T9 suppressed branch returns before sendEmail',
  helper.indexOf("outcome: 'suppressed'") < helper.indexOf('await sendEmail('));
t('[ordering]  T9 canSend precedes sendEmail',
  helper.indexOf('await canSend(') < helper.indexOf('await sendEmail('));
t('[safety]    T9 the suppressed branch records the refusal',
  /decision !== 'ALLOW'[\s\S]{0,500}?state:\s*'SUPPRESSED'/.test(helper));

// 10-12. no consent is fabricated anywhere in the migration
t('[safety]    T10 helper writes no consent event',
  !/communicationConsentEvent|withdrawConsent|grantConsent/i.test(helper));
t('[safety]    T10 helper writes no preference',
  !/communicationPreference/i.test(helper));
t('[safety]    T10 helper creates no recipient row',
  !/communicationRecipient/i.test(helper));
for (const [label, file] of Object.entries(MIGRATED)) {
  const s = strip(src(file));
  t(`[safety]    T11-12 ${label} creates no consent/preference/recipient`,
    !/communicationConsentEvent|communicationPreference|communicationRecipient|grantConsent|withdrawConsent/i.test(s));
  t(`[safety]    T11-12 ${label} activates no EDUCATIONAL/MARKETING`,
    !/EDUCATIONAL|MARKETING/.test(s));
}

// 13-15. event before send; provider id authentic
t('[ordering]  T13 CommunicationEvent is recorded before sendEmail',
  helper.indexOf("state:              'REQUESTED'") < helper.indexOf('await sendEmail('));
t('[safety]    T13 no event id means no send',
  /if \(!eventId\)[\s\S]{0,260}?return \{ outcome: 'unavailable' \}/.test(helper));
t('[behaviour] T14 accepted send persists the provider id',
  /markEventSent\(eventId, providerMessageId\)/.test(helper));
t('[safety]    T15 the provider id comes from the send result',
  /\{ id: providerMessageId, error \} = await sendEmail\(/.test(helper));
t('[safety]    T15 the helper never fabricates an id',
  !/providerMessageId\s*=\s*(`|'|"|crypto|Math|Date)/.test(helper));

// 16-17. failure handling
t('[behaviour] T16 synchronous provider failure marks the event FAILED',
  /if \(error\)[\s\S]{0,200}?markEventFailed\(eventId\)/.test(helper));
t('[safety]    T17 the helper never retries the provider',
  (helper.match(/await sendEmail\(/g) ?? []).length === 1);
t('[safety]    T17 the helper contains no retry loop',
  !/for\s*\(|while\s*\(|retry|attempt\s*\+\+/i.test(helper));
t('[safety]    T17 local-write failure is handled by markEventSent, not a resend',
  /markEventSent/.test(helper)
  && /RECONCILE/.test(strip(src('src/lib/communications/governance.ts'))));

// 18. webhook correlation
t('[ordering]  T18 the id persisted is the field the webhook correlates on',
  /providerMessageId:\s*providerMessageId/.test(strip(src('src/lib/communications/governance.ts')))
  && /where:\s*\{ providerMessageId: input\.providerMessageId \}/.test(
       strip(src('src/lib/communications/deliveryLifecycle.ts'))));
// Count the declared set only. The file also switches on each name, so a
// whole-file count double-counts and never equals six.
t('[safety]    T18 C3D webhook event types were not broadened', (() => {
  const pe = strip(src('src/lib/communications/providerEvents.ts'));
  const decl = /HANDLED_EVENT_TYPES = \[([\s\S]*?)\]/.exec(pe)?.[1] ?? '';
  return (decl.match(/'email\.[a-z_]+'/g) ?? []).length === 6;
})());

// ═══════════════════════════════════════════════════════════════════════════
section('U. PUBLIC REQUESTED DELIVERY');
// ═══════════════════════════════════════════════════════════════════════════

const proto = strip(src('app/api/protocol-email/route.ts'));
const capture = strip(src('app/api/email-capture/route.ts'));

t('[safety]    U19 protocol-email remains public',
  !/\bauth\(\)/.test(proto) && !/@clerk/.test(proto));
t('[safety]    U20 email-capture remains public',
  !/\bauth\(\)/.test(capture) && !/@clerk/.test(capture));
t('[safety]    U21 protocol-email validation preserved',
  /safeParse\(/.test(proto) && /ProtocolEmailSchema/.test(proto));
t('[safety]    U21 email-capture validation preserved',
  /safeParse\(/.test(capture) && /EmailCaptureSchema/.test(capture));
t('[safety]    U22 protocol-email throttle preserved',
  /consumeRecipientBudget\(/.test(proto));
t('[safety]    U22 email-capture throttle preserved',
  /consumeRecipientBudget\(/.test(capture));
t('[ordering]  U23 validation precedes throttle, throttle precedes send',
  proto.indexOf('safeParse(') < proto.indexOf('consumeRecipientBudget(')
  && proto.indexOf('consumeRecipientBudget(') < proto.indexOf('sendServiceEmail('));
t('[ordering]  U23 malformed input returns before any governance call',
  proto.indexOf('!parsed.success') < proto.indexOf('sendServiceEmail('));
t('[safety]    U24-27 requested delivery creates no consent artefact',
  !/communicationPreference|communicationConsentEvent|communicationRecipient/i.test(proto)
  && !/communicationPreference|communicationConsentEvent|communicationRecipient/i.test(capture));
// Class names are matched case-SENSITIVELY. The report body legitimately uses
// the word "educational" in its clinical disclaimer copy; the governance class
// EDUCATIONAL is a different thing and must not appear.
t('[safety]    U26-27 requested delivery grants no future nurture permission',
  !/\bEDUCATIONAL\b|\bMARKETING\b/.test(proto)
  && !/\bEDUCATIONAL\b|\bMARKETING\b/.test(capture)
  && !/nurture|Protein Guide/i.test(proto)
  && !/nurture/i.test(capture));
t('[behaviour] U28 suppressed destination short-circuits protocol-email',
  /outcome === 'suppressed'[\s\S]{0,260}?return NextResponse/.test(proto));
t('[behaviour] U28 suppressed destination reports not-delivered in capture',
  /delivered = sent\.outcome === 'sent'/.test(capture));
t('[behaviour] U29 both create an event and persist the id via the helper',
  /sendServiceEmail\(/.test(proto) && /sendServiceEmail\(/.test(capture));

// 30. the specific logging C3E-A found
t('[safety]    U30 protocol-email no longer logs address+SRI+risk together',
  !/console\.log\(\s*"\[protocol-email\] received:"/.test(proto));
t('[safety]    U30 protocol-email logs no provider response body',
  !/console\.log\("\[protocol-email\] result:"/.test(proto));
t('[safety]    U30 email-capture no longer logs the recipient address',
  !/'to:',\s*email/.test(capture) && !/NOT sent to:',\s*email/.test(capture));
// The point is that no VARIABLE holding an address is passed to a log — not
// that the word "email" never appears. Log tags like "[email-capture]" and
// prose like "physician email failed" are fine and must not fail this check.
// So: drop plain string literals entirely, and from template literals keep only
// the ${...} interpolations, then inspect what is actually being evaluated.
const loggedExpressions = (source) => {
  const calls = [...source.matchAll(/console\.(log|warn|error)\(([\s\S]*?)\);/g)].map(m => m[2]);
  return calls.map(c => c
    .replace(/`([^`]*)`/g, (_m, inner) =>
      (inner.match(/\$\{[^}]*\}/g) ?? []).join(' '))
    .replace(/'[^']*'|"[^"]*"/g, ''));
};

t('[safety]    U30 no migrated pathway interpolates an address into a log', (() => {
  return Object.values(MIGRATED).every(f =>
    loggedExpressions(strip(src(f))).every(expr =>
      !/\bemail\b|\btrimmed\b|verifiedEmail|application\.email|physician\.email|patient\.fullName/.test(expr)));
})());

// ═══════════════════════════════════════════════════════════════════════════
section('V. WELCOME / INVITATION');
// ═══════════════════════════════════════════════════════════════════════════

const welcome = strip(src('src/lib/email.ts'));
const invite  = strip(src('app/api/invite/send/route.ts'));

t('[safety]    V31 welcome is ESSENTIAL_SERVICE via the helper',
  /sendServiceEmail\(/.test(welcome) && /service\.patient_welcome/.test(welcome));
t('[behaviour] V32 welcome suppression is enforced by the shared helper',
  /sendServiceEmail\(/.test(welcome));
t('[safety]    V32 welcome stays non-fatal to onboarding',
  /catch \(err\)[\s\S]{0,200}?governed send threw/.test(welcome));
t('[safety]    V33 welcome schedules no sequence',
  !/nurture|sequence|drip|day2|followUp|setTimeout|cron/i.test(welcome));
t('[safety]    V34 invitation physician ownership check unchanged',
  /physician\.id !== doctorId\.trim\(\)/.test(invite)
  && /role !== 'PHYSICIAN' && physician\.role !== 'ADMIN'/.test(invite));
t('[safety]    V34 invitation still requires a Clerk session',
  /const \{ userId: clerkId \} = await auth\(\)/.test(invite));
t('[behaviour] V35 invitation suppression yields 409, not a silent success',
  /outcome === 'suppressed'[\s\S]{0,300}?status:\s*409/.test(invite));
t('[behaviour] V36-37 invitation uses the governed helper',
  /sendServiceEmail\(/.test(invite) && /service\.patient_invitation/.test(invite));
t('[safety]    V38 SMS still uses Twilio directly and is untouched',
  /async function sendSms/.test(invite) && /api\.twilio\.com/.test(invite));
t('[safety]    V39 SMS is not routed through the email gateway',
  !/sendServiceEmail\([\s\S]{0,200}?sendSms/.test(invite)
  && !/sendSms[\s\S]{0,200}?sendServiceEmail\(/.test(invite));
t('[safety]    V40 invitation creates no recipient preference',
  !/communicationPreference|communicationRecipient|communicationConsentEvent/i.test(invite));
t('[safety]    V40 invitation passes no userId — recipient stays pseudonymous',
  !/sendServiceEmail\(\{[\s\S]{0,400}?userId:/.test(invite));

// ═══════════════════════════════════════════════════════════════════════════
section('W. PHYSICIAN CLINICAL ALERTS');
// ═══════════════════════════════════════════════════════════════════════════

const assess = strip(src('app/api/assessment/route.ts'));
const pr = strip(src('src/lib/email/categories/PhysicianPriorityReview.ts'));
const fa = strip(src('src/lib/email/categories/PhysicianFirstAssessment.ts'));

t('[safety]    W41 PhysicianFirstAssessment still has a live caller',
  /triggerPhysicianFirstAssessmentNotification\(/.test(assess));
t('[safety]    W42 PhysicianPriorityReview still has a live caller',
  /triggerPhysicianPriorityReview\(/.test(assess));
t('[safety]    W43 priority-review trigger criteria preserved',
  /leanVelocityFlag === 'concerning' \|\| leanVelocityFlag === 'critical_review'/.test(assess));
t('[safety]    W43 first-assessment trigger criteria preserved',
  /priorAssessment === null/.test(assess));
t('[safety]    W44 priority-review dedup window preserved',
  /DEDUP_WINDOW_DAYS/.test(pr) && /type:\s*'PHYSICIAN_REVIEW'/.test(pr));
t('[safety]    W44 first-assessment dedup preserved',
  /type:\s*'REPORT_READY'/.test(fa));
t('[safety]    W45 physician resolved server-side from the patient record',
  /patient\.physicianId/.test(pr) && /patient\.physicianId/.test(fa));
t('[behaviour] W46 suppression prevents the physician email',
  /outcome !== 'sent'\) return/.test(pr) && /outcome !== 'sent'\) return/.test(fa));
t('[ordering]  W46 no Notification is written unless the send succeeded',
  pr.indexOf("outcome !== 'sent') return") < pr.indexOf('notification.create')
  && fa.indexOf("outcome !== 'sent') return") < fa.indexOf('notification.create'));
t('[safety]    W47 alerts stay fire-and-forget from the assessment route',
  /triggerPhysicianPriorityReview\([\s\S]{0,400}?\.catch\(/.test(assess)
  && /triggerPhysicianFirstAssessmentNotification\([\s\S]{0,300}?\.catch\(/.test(assess));
t('[behaviour] W48-49 allowed send creates the event and persists the id',
  /sendServiceEmail\(/.test(pr) && /sendServiceEmail\(/.test(fa));
t('[safety]    W50 no clinical value is passed to the governed send', (() => {
  const args = f => /sendServiceEmail\(\{([\s\S]*?)\n  \}\)/.exec(f)?.[1] ?? '';
  const a = args(pr) + args(fa);
  return a.length > 0
    && !/riskBand|leanVelocity|leanLoss|patientName|assessmentCount|symptom|medication|dose/i.test(a);
})());
t('[safety]    W50 CommunicationEvent carries no clinical field', (() => {
  const rec = /export async function recordCommunicationEvent[\s\S]*?\n\}/
    .exec(strip(src('src/lib/communications/governance.ts')))?.[0] ?? '';
  return rec.length > 0
    && !/riskBand|trendStatus|leanVelocity|leanLoss|subject|html|\bbody\b/i.test(rec);
})());
t('[safety]    W51 no clinical value appears in alert logs', (() => {
  const calls = [...(pr + fa).matchAll(/console\.(log|warn|error)\(([\s\S]*?)\);/g)].map(m => m[2]);
  return calls.every(c =>
    !/riskBand|leanVelocity|leanLoss|patientName|physician\.email|\bemail\b/i.test(c));
})());
t('[safety]    W52 provider failure does not throw into the assessment flow',
  !/throw /.test(pr.split('sendServiceEmail')[1] ?? '')
  && !/throw /.test(fa.split('sendServiceEmail')[1] ?? ''));

// ═══════════════════════════════════════════════════════════════════════════
section('X. PHYSICIAN WORKFLOW EMAIL');
// ═══════════════════════════════════════════════════════════════════════════

const reg = strip(src('app/api/doctor/register/route.ts'));
const onb = strip(src('app/api/doctor/onboarding/route.ts'));
const ver = strip(src('app/api/admin/verify-physician/route.ts'));
const rev = strip(src('app/api/admin/physician-review/route.ts'));

t('[safety]    X53 registration S4 controls intact',
  /RegistrationSchema/.test(reg) && /consumeRecipientBudget/.test(reg)
  && /normaliseEmail/.test(reg));
t('[safety]    X54 registration admin notification still direct/excluded',
  /to:\s*"admin@myoguard\.health"/.test(reg) && /resend\.emails\.send/.test(reg));
t('[safety]    X54 registration admin send is NOT governed',
  !/sendServiceEmail\(\{[\s\S]{0,200}?admin@myoguard\.health"/.test(reg));
t('[safety]    X55 registration persistence not rolled back by mail outcome',
  /catch \(ackErr/.test(reg) && /non-fatal/i.test(reg));
t('[safety]    X56 onboarding S3 identity controls intact',
  /verifiedEmail/.test(onb) && /resolveVerifiedPrimaryEmail|verifiedEmailMatchesBody|onboardingIdentity/.test(onb));
t('[safety]    X56 onboarding reuses the verified primary, no second resolver',
  /to:\s*verifiedEmail/.test(onb));
t('[safety]    X57 onboarding admin notification still direct/excluded',
  /to:\s*"admin@myoguard\.health"/.test(onb) && /resend\.emails\.send/.test(onb));
t('[safety]    X58 onboarding persistence not rolled back by mail outcome',
  /catch \(err\)[\s\S]{0,200}?physician email failed/.test(onb));
t('[safety]    X59 activation authorization unchanged',
  /token/.test(ver) && /application/.test(ver));
t('[safety]    X59 activation still redirects regardless of mail outcome',
  ver.indexOf('sendServiceEmail(') < ver.indexOf('redirect("/admin/physician-approved")'));
t('[safety]    X60-61 approval/rejection authorization unchanged',
  /requireAdmin\(\)/.test(rev));
// Search for the USE of each template id from the branch onwards. Searching
// from position 0 finds the const declaration at the top of the file, which
// sits before both branches and makes the comparison meaningless.
t('[safety]    X62 decision is applied before the notification in both branches', (() => {
  const usedAfter = (branch, tid) => {
    const b = rev.indexOf(branch);
    const u = rev.indexOf(tid, b);
    return b >= 0 && u > b;
  };
  return usedAfter('action === "APPROVE"', 'TEMPLATE_ID_APPROVED')
      && usedAfter('action === "REJECT"',  'TEMPLATE_ID_REJECTED');
})());
t('[safety]    X62 no rollback of application state on mail failure',
  !/rollback|revert|status:\s*"PENDING"/i.test(
    rev.split('sendServiceEmail')[1] ?? ''));
t('[behaviour] X63-64 all four workflow emails use the governed helper',
  [reg, onb, ver, rev].every(s => /sendServiceEmail\(/.test(s)));
t('[behaviour] X63-64 approval and rejection are separately identified',
  /service\.physician_approved/.test(rev) && /service\.physician_rejected/.test(rev));

// ── Excluded pathways must be untouched ─────────────────────────────────────
for (const f of EXCLUDED_GOVERNED) {
  const s = strip(src(f));
  t(`[safety]    CLINICAL_CONTINUITY unchanged in ${f.split('/').slice(-2)[0]}`,
    /communicationClass: 'CLINICAL_CONTINUITY'/.test(s) && !/sendServiceEmail/.test(s));
}
t('[safety]    n8n remains gated and unactivated',
  /if \(webhookUrl\)/.test(capture) && /N8N_WEBHOOK_URL/.test(capture));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
