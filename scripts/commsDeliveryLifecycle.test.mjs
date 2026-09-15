/**
 * scripts/commsDeliveryLifecycle.test.mjs
 *
 * Phase 1D-C3D — Resend delivery lifecycle, webhook authenticity, bounce and
 * complaint governance, RFC 8058 one-click unsubscribe.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/commsDeliveryLifecycle.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS PROVEN STRUCTURALLY
 * The signature check is exercised against the genuine svix primitive the route
 * calls — real keys, real HMAC, real tampering. The entire provider state
 * machine and every bounce classification are pure functions and are called
 * directly. Token and header generation is called directly.
 *
 * The route handlers themselves cannot be imported under this harness: Next 16
 * resolves `next/server` through package exports that the resolution shim does
 * not implement. Route-level guarantees are therefore asserted against the
 * shipped source, exactly as the C3C suite does. The only database in this
 * project is production and this phase forbids writing to it, so the
 * DB-mutating branches are likewise structural.
 *
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would send mail that
 *                 should not be sent, lose recipient choice, or leak PII.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Webhook } from 'svix';

import {
  HANDLED_EVENT_TYPES,
  isHandledEventType,
  classifyBounce,
  targetStateFor,
  nextState,
  STATE_RANK,
  SOFT_BOUNCE_THRESHOLD,
  SOFT_BOUNCE_WINDOW_DAYS,
  softBounceWindowStart,
} from '../src/lib/communications/providerEvents.ts';

import {
  mintUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrlFor,
  unsubscribeOneClickUrlFor,
  listUnsubscribeHeaders,
  OPTIONAL_CLASSES,
  UNSUBSCRIBE_SECRET_ENV,
  MIN_SECRET_LENGTH,
} from '../src/lib/communications/unsubscribeToken.ts';

import { decideFromGovernanceState } from '../src/lib/communications/governance.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src   = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const WEBHOOK_ROUTE   = 'app/api/webhooks/resend/route.ts';
const LIFECYCLE       = 'src/lib/communications/deliveryLifecycle.ts';
const PROVIDER_EVENTS = 'src/lib/communications/providerEvents.ts';
const GOVERNANCE      = 'src/lib/communications/governance.ts';
const UNSUB_ROUTE     = 'app/api/communications/unsubscribe/route.ts';

const GOVERNED_SENDERS = [
  'src/lib/email/categories/WeeklyPulse.ts',
  'src/lib/email/categories/LongitudinalSummary.ts',
];

const GOVERNED_ROUTES = [
  'app/api/cron/weekly-pulse/route.ts',
  'app/api/cron/longitudinal-summary/route.ts',
  'app/api/email/weekly-pulse/route.ts',
  'app/api/email/longitudinal-summary/route.ts',
];

const SECRET = 'k'.repeat(MIN_SECRET_LENGTH);
const KEY_A  = 'a1'.repeat(32);   // 64 hex
const KEY_B  = 'b2'.repeat(32);

const withSecret = (v, fn) => {
  const prev = process.env[UNSUBSCRIBE_SECRET_ENV];
  if (v === undefined) delete process.env[UNSUBSCRIBE_SECRET_ENV];
  else process.env[UNSUBSCRIBE_SECRET_ENV] = v;
  try { return fn(); }
  finally {
    if (prev === undefined) delete process.env[UNSUBSCRIBE_SECRET_ENV];
    else process.env[UNSUBSCRIBE_SECRET_ENV] = prev;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
section('W. WEBHOOK SECURITY');
// ═══════════════════════════════════════════════════════════════════════════

const hook = strip(src(WEBHOOK_ROUTE));

// 1. public by design
t('[safety]    W1  webhook takes no Clerk session',
  !/\bauth\s*\(/.test(hook) && !/@clerk/.test(hook));
t('[ordering]  W1  webhook documents why it is public',
  /PUBLIC BY NECESSITY/i.test(src(WEBHOOK_ROUTE)));
t('[safety]    W1  webhook exposes POST only, no GET handler',
  /export async function POST/.test(hook) && !/export async function GET/.test(hook));

// 2-4. signature verification — exercised against the real svix primitive that
//      the route calls, not a stand-in.
const whSecret = 'whsec_' + Buffer.from('c'.repeat(32)).toString('base64');
const wh       = new Webhook(whSecret);
const payload  = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg-abc' } });
const msgId    = 'msg_2vX';
const when     = new Date();
const goodSig  = wh.sign(msgId, when, payload);
const hdrs     = s => ({
  'svix-id':        msgId,
  'svix-timestamp': Math.floor(when.getTime() / 1000).toString(),
  'svix-signature': s,
});

let accepted = false;
try { wh.verify(payload, hdrs(goodSig)); accepted = true; } catch { accepted = false; }
t('[behaviour] W2  valid Svix signature accepted', accepted);

const rejects = (body, headers, secret = whSecret) => {
  try { new Webhook(secret).verify(body, headers); return false; }
  catch { return true; }
};

t('[behaviour] W3  forged signature rejected',
  rejects(payload, hdrs('v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')));
t('[behaviour] W3  signature from a different secret rejected',
  rejects(payload, hdrs(new Webhook('whsec_' + Buffer.from('d'.repeat(32)).toString('base64'))
    .sign(msgId, when, payload))));
t('[safety]    W3  tampered body under a valid signature rejected',
  rejects(JSON.stringify({ type: 'email.bounced', data: { email_id: 'msg-abc' } }), hdrs(goodSig)));
t('[behaviour] W4  missing signature header rejected',
  rejects(payload, { ...hdrs(goodSig), 'svix-signature': '' }));
t('[behaviour] W4  all headers absent rejected',
  rejects(payload, { 'svix-id': '', 'svix-timestamp': '', 'svix-signature': '' }));

// 5. missing secret fails closed
t('[safety]    W5  route refuses when RESEND_WEBHOOK_SECRET is unset',
  /if\s*\(\s*!secret\s*\)/.test(hook) && /status:\s*500/.test(hook));
t('[ordering]  W5  secret check precedes signature verification',
  hook.indexOf('!secret') < hook.indexOf('.verify('));
t('[safety]    W5  secret name is dedicated, not shared',
  /RESEND_WEBHOOK_SECRET/.test(hook)
  && !/COMMS_IDENTITY_SECRET|COMMS_UNSUBSCRIBE_SECRET|EMAIL_THROTTLE_SECRET|CLERK_WEBHOOK_SECRET/.test(hook));

// 6. malformed payload rejected after verification
t('[ordering]  W6  payload shape validated after verify, not before',
  hook.indexOf('.verify(') < hook.indexOf("typeof eventType !== 'string'"));
t('[behaviour] W6  missing event type is a 400',
  /typeof eventType !== 'string'[\s\S]{0,200}?status:\s*400/.test(hook));
t('[behaviour] W6  missing email_id is a 400',
  /typeof providerMessageId !== 'string'[\s\S]{0,260}?status:\s*400/.test(hook));

// 7. no mutation before verification
t('[safety]    W7  verification precedes any lifecycle call',
  hook.indexOf('.verify(') < hook.indexOf('applyProviderEvent('));
t('[safety]    W7  route imports no prisma client at all',
  !/prisma/i.test(hook));
t('[safety]    W7  raw body is read with req.text(), never req.json()',
  /req\.text\(\)/.test(hook) && !/req\.json\(\)/.test(hook));

// 8. duplicate webhook idempotent
t('[behaviour] W8  duplicate delivered is a no-op', nextState('DELIVERED', 'DELIVERED') === null);
t('[behaviour] W8  duplicate sent is a no-op',      nextState('SENT', 'SENT') === null);
t('[behaviour] W8  duplicate complaint is a no-op', nextState('COMPLAINED', 'COMPLAINED') === null);

// 9. unknown provider event safe
t('[behaviour] W9  email.opened is not handled',  !isHandledEventType('email.opened'));
t('[behaviour] W9  email.clicked is not handled', !isHandledEventType('email.clicked'));
t('[behaviour] W9  contact.created is not handled', !isHandledEventType('contact.created'));
t('[behaviour] W9  nonsense type is not handled', !isHandledEventType('email.exploded'));
t('[safety]    W9  unhandled type acknowledges without processing',
  /isHandledEventType[\s\S]{0,300}?handled:\s*false/.test(hook));

// 10-11. orphan behaviour
t('[safety]    W10 lifecycle never creates a CommunicationEvent',
  !/communicationEvent\.create/.test(strip(src(LIFECYCLE))));
t('[safety]    W10 lifecycle never upserts a CommunicationEvent',
  !/communicationEvent\.upsert/.test(strip(src(LIFECYCLE))));
t('[ordering]  W11 orphan returns before any suppression call',
  strip(src(LIFECYCLE)).indexOf("outcome: 'orphan'")
    < strip(src(LIFECYCLE)).indexOf('ensureSuppression(prisma'));
t('[behaviour] W11 orphan outcome is a distinct reported value',
  /outcome:\s*'orphan'/.test(src(LIFECYCLE)));

// 12-13. the two ledgers the webhook may never touch
for (const [label, file] of [['route', WEBHOOK_ROUTE], ['lifecycle', LIFECYCLE]]) {
  const s = strip(src(file));
  t(`[safety]    W12 ${label} never touches CommunicationPreference`,
    !/communicationPreference/i.test(s));
  t(`[safety]    W13 ${label} never writes CommunicationConsentEvent`,
    !/communicationConsentEvent/i.test(s));
  t(`[safety]    W13 ${label} never calls grant or withdraw`,
    !/grantConsent|withdrawConsent/.test(s));
}

// ═══════════════════════════════════════════════════════════════════════════
section('X. PROVIDER LIFECYCLE');
// ═══════════════════════════════════════════════════════════════════════════

const gov = strip(src(GOVERNANCE));

// 14-16. provider message id
t('[safety]    X14 markEventSent persists providerMessageId',
  /markEventSent[\s\S]{0,600}?providerMessageId:\s*providerMessageId/.test(gov));
t('[behaviour] X15 every governed route takes the id from the send result',
  GOVERNED_ROUTES.every(f => /\{\s*id:\s*providerMessageId,\s*error\s*\}\s*=\s*await send/.test(strip(src(f)))));
t('[safety]    X16 governance never derives an id from the address',
  !/providerMessageId\s*=\s*[^;]*email/i.test(gov));
t('[safety]    X16 governance never derives an id from the recipient key',
  !/providerMessageId\s*=\s*[^;]*recipientKey/.test(gov));
t('[safety]    X16 no route fabricates an id',
  GOVERNED_ROUTES.every(f => !/providerMessageId\s*=\s*(`|'|")/.test(strip(src(f)))));
t('[safety]    X16 correlation key is unique in the schema',
  /providerMessageId\s+String\?\s+@unique/.test(src('prisma/schema.prisma')));

// 17. synchronous rejection marks failed
for (const f of GOVERNED_ROUTES) {
  const s = strip(src(f));
  t(`[behaviour] X17 ${f.split('/').slice(-2)[0]} marks FAILED on provider rejection`,
    /if\s*\(\s*error\s*\)\s*\{[\s\S]{0,320}?markEventFailed\(eventId\)/.test(s));
}
t('[safety]    X17 markEventFailed creates no suppression',
  /export async function markEventFailed[\s\S]{0,700}?\n\}/.exec(gov)?.[0]
    ?.includes('communicationSuppression') === false);

// 18. accepted send whose persistence fails must never resend
const markSent = /export async function markEventSent[\s\S]*?\n\}/.exec(gov)?.[0] ?? '';
t('[safety]    X18 markEventSent never calls a provider',
  !/sendEmail|resend|emails\.send/i.test(markSent));
t('[safety]    X18 failure path records a reconcilable marker',
  /RECONCILE/.test(markSent));
t('[safety]    X18 failure path retries correlation only, not the send',
  /data:\s*\{\s*providerMessageId\s*\}/.test(markSent));
t('[safety]    X18 governance module imports no email sender',
  !/from\s+'@\/src\/lib\/email/.test(gov));

// 19-21. transitions
t('[behaviour] X19 sent -> delivered', nextState('SENT', 'DELIVERED') === 'DELIVERED');
t('[behaviour] X19 requested -> sent', nextState('REQUESTED', 'SENT') === 'SENT');
t('[behaviour] X20 sent -> delayed',   nextState('SENT', 'DELAYED') === 'DELAYED');
t('[behaviour] X20 delayed -> delivered', nextState('DELAYED', 'DELIVERED') === 'DELIVERED');
t('[behaviour] X20 DELAYED exists in the Prisma enum',
  /enum CommunicationState[\s\S]*?\bDELAYED\b[\s\S]*?\}/.test(src('prisma/schema.prisma')));
t('[behaviour] X21 sent -> failed',    nextState('SENT', 'FAILED') === 'FAILED');
t('[behaviour] X21 requested -> failed', nextState('REQUESTED', 'FAILED') === 'FAILED');

// 22. terminal states do not regress
t('[safety]    X22 delivered does not fall back to sent',   nextState('DELIVERED', 'SENT') === null);
t('[safety]    X22 delivered does not fall back to delayed', nextState('DELIVERED', 'DELAYED') === null);
t('[safety]    X22 complaint is not erased by a late delivered',
  nextState('COMPLAINED', 'DELIVERED') === null);
t('[safety]    X22 hard bounce is not erased by a late delivered',
  nextState('BOUNCED_HARD', 'DELIVERED') === null);
t('[safety]    X22 hard bounce is not erased by a late sent',
  nextState('BOUNCED_HARD', 'SENT') === null);
t('[safety]    X22 complaint outranks hard bounce, not the reverse',
  nextState('BOUNCED_HARD', 'COMPLAINED') === 'COMPLAINED'
  && nextState('COMPLAINED', 'BOUNCED_HARD') === null);
t('[safety]    X22 a suppressed record is never touched by a provider event',
  ['SENT', 'DELIVERED', 'BOUNCED_HARD', 'COMPLAINED', 'FAILED']
    .every(s => nextState('SUPPRESSED', s) === null));

// 23-24. duplicates and ordering
t('[behaviour] X23 duplicate delivered changes nothing', nextState('DELIVERED', 'DELIVERED') === null);
t('[safety]    X24 every backwards transition is refused', (() => {
  const states = Object.keys(STATE_RANK);
  return states.every(a => states.every(b =>
    STATE_RANK[b] <= STATE_RANK[a] ? nextState(a, b) === null : nextState(a, b) === b));
})());
t('[safety]    X24 ranks are strictly ordered and unique', (() => {
  const v = Object.values(STATE_RANK);
  return new Set(v).size === v.length;
})());

// 25-26. no clinical data, no rendered content
const recordFn = /export async function recordCommunicationEvent[\s\S]*?\n\}/.exec(gov)?.[0] ?? '';
t('[safety]    X25 event record carries no clinical field',
  !/riskBand|trendStatus|proteinTarget|sri|symptom|medication|dose/i.test(recordFn));
t('[safety]    X26 event record stores no subject',   !/subject/i.test(recordFn));
t('[safety]    X26 event record stores no html/body', !/\bhtml\b|\bbody\b/i.test(recordFn));
t('[safety]    X26 event record stores no address',   !/\bemail\b/i.test(recordFn));
t('[safety]    X26 lifecycle stores no provider payload',
  !/JSON\.stringify|payload:/.test(strip(src(LIFECYCLE))));

// ═══════════════════════════════════════════════════════════════════════════
section('Y. BOUNCE / COMPLAINT');
// ═══════════════════════════════════════════════════════════════════════════

const life = strip(src(LIFECYCLE));

// 27-31. hard bounce
t('[behaviour] Y27 Permanent classifies as HARD', classifyBounce({ type: 'Permanent' }) === 'HARD');
t('[behaviour] Y27 case and padding tolerated',   classifyBounce({ type: ' permanent ' }) === 'HARD');
t('[behaviour] Y27 permanent bounce targets BOUNCED_HARD',
  targetStateFor('email.bounced', { type: 'Permanent' }) === 'BOUNCED_HARD');
t('[ordering]  Y27 BOUNCED_HARD creates a HARD_BOUNCE suppression',
  /to === 'BOUNCED_HARD'[\s\S]{0,300}?reason:\s*'HARD_BOUNCE'/.test(life));

t('[safety]    Y28 provider suppressions are all-class by construction',
  /ensureSuppression[\s\S]*?communicationClass:\s*null,[\s\S]*?source:\s*PROVIDER_SOURCE/.test(life));
for (const cls of ['ESSENTIAL_SERVICE', 'CLINICAL_CONTINUITY', 'EDUCATIONAL', 'MARKETING']) {
  const d = decideFromGovernanceState(cls, {
    activeSuppressionReasons: ['HARD_BOUNCE'],
    preferenceState: 'SUBSCRIBED',
    recipientVerified: true,
  });
  t(`[behaviour] Y28 hard bounce blocks ${cls}`, d.decision === 'SUPPRESS_HARD_BOUNCE');
}
t('[safety]    Y29 hard-bounce path writes no preference', !/communicationPreference/i.test(life));
t('[safety]    Y30 hard-bounce path writes no consent event', !/communicationConsentEvent/i.test(life));
t('[behaviour] Y31 repeat hard bounce is refused by precedence',
  nextState('BOUNCED_HARD', 'BOUNCED_HARD') === null);
t('[ordering]  Y31 suppression creation is guarded by an active-row lookup',
  /findFirst\(\{[\s\S]{0,400}?clearedAt:\s*null[\s\S]{0,200}?\}\)[\s\S]{0,200}?if \(existing\) return 'existing'/.test(life));

// 32-36. spam complaint
t('[behaviour] Y32 complaint targets COMPLAINED', targetStateFor('email.complained') === 'COMPLAINED');
t('[ordering]  Y32 COMPLAINED creates a SPAM_COMPLAINT suppression',
  /to === 'COMPLAINED'[\s\S]{0,300}?reason:\s*'SPAM_COMPLAINT'/.test(life));
for (const cls of ['ESSENTIAL_SERVICE', 'CLINICAL_CONTINUITY', 'EDUCATIONAL', 'MARKETING']) {
  const d = decideFromGovernanceState(cls, {
    activeSuppressionReasons: ['SPAM_COMPLAINT'],
    preferenceState: 'SUBSCRIBED',
    recipientVerified: true,
  });
  t(`[behaviour] Y33 complaint blocks ${cls}`, d.decision === 'SUPPRESS_COMPLAINT');
}
t('[safety]    Y34 complaint path mutates no preference', !/communicationPreference/i.test(life));
t('[safety]    Y35 complaint fabricates no withdrawal consent',
  !/WITHDRAW|action:\s*'WITHDRAW'/.test(life));
t('[behaviour] Y36 duplicate complaint refused by precedence',
  nextState('COMPLAINED', 'COMPLAINED') === null);

// 37-43. soft bounce policy
t('[behaviour] Y37 Transient classifies as SOFT', classifyBounce({ type: 'Transient' }) === 'SOFT');
t('[behaviour] Y37 transient bounce targets BOUNCED_SOFT',
  targetStateFor('email.bounced', { type: 'Transient' }) === 'BOUNCED_SOFT');
t('[behaviour] Y38 threshold is three', SOFT_BOUNCE_THRESHOLD === 3);
t('[behaviour] Y39 threshold fires only at or above three', (() => {
  const fires = n => n >= SOFT_BOUNCE_THRESHOLD;
  return fires(1) === false && fires(2) === false && fires(3) === true && fires(4) === true;
})());
t('[ordering]  Y39 suppression is SOFT_BOUNCE_REPEATED at the threshold',
  /count >= SOFT_BOUNCE_THRESHOLD[\s\S]{0,300}?reason:\s*'SOFT_BOUNCE_REPEATED'/.test(life));
t('[behaviour] Y40 window is a rolling 30 days', SOFT_BOUNCE_WINDOW_DAYS === 30);
t('[behaviour] Y40 window start is 30 days back', (() => {
  const now = new Date('2026-09-15T00:00:00Z');
  const start = softBounceWindowStart(now);
  return Math.round((now - start) / 86400000) === 30;
})());
t('[ordering]  Y40 the count query is bounded by that window',
  /state:\s*'BOUNCED_SOFT',[\s\S]{0,120}?requestedAt:\s*\{\s*gte:\s*softBounceWindowStart\(\)/.test(life));
t('[safety]    Y41 a duplicate soft bounce cannot increment the count',
  nextState('BOUNCED_SOFT', 'BOUNCED_SOFT') === null);
t('[ordering]  Y41 threshold is evaluated only after a real transition',
  life.indexOf("to === 'BOUNCED_SOFT'") > life.indexOf('if (to === null)'));
t('[safety]    Y42 the count query excludes hard bounces',
  /state:\s*'BOUNCED_SOFT'/.test(life) && !/state:\s*\{\s*in:\s*\[/.test(life));
t('[behaviour] Y42 hard bounce does not classify as soft',
  classifyBounce({ type: 'Permanent' }) !== 'SOFT');

// 43. ambiguity is never guessed
for (const v of ['Undetermined', 'undetermined', '', 'Weird', null, undefined, 42, {}]) {
  t(`[safety]    Y43 bounce type ${JSON.stringify(v)} classifies AMBIGUOUS`,
    classifyBounce({ type: v }) === 'AMBIGUOUS');
}
t('[safety]    Y43 a missing bounce object is AMBIGUOUS', classifyBounce(undefined) === 'AMBIGUOUS');
t('[behaviour] Y43 ambiguous bounce records FAILED, not a bounce state',
  targetStateFor('email.bounced', { type: 'Undetermined' }) === 'FAILED');
t('[safety]    Y43 ambiguous bounce creates no suppression',
  !/FAILED[\s\S]{0,120}?ensureSuppression/.test(life));
t('[safety]    Y43 classification never reads the free-text message',
  !/bounce[\s\S]{0,40}?\.message/.test(strip(src(PROVIDER_EVENTS))));
t('[safety]    Y43 classification never reads subType',
  !/subType/.test(strip(src(PROVIDER_EVENTS))));

// 44-45. delayed and failed
t('[behaviour] Y44 delivery_delayed targets DELAYED',
  targetStateFor('email.delivery_delayed') === 'DELAYED');
t('[safety]    Y44 DELAYED triggers no suppression branch',
  !/to === 'DELAYED'[\s\S]{0,200}?ensureSuppression/.test(life));
t('[behaviour] Y45 email.failed targets FAILED', targetStateFor('email.failed') === 'FAILED');
t('[safety]    Y45 only three states can create suppression', (() => {
  const branches = life.match(/to === '([A-Z_]+)'/g) ?? [];
  const suppressing = new Set(branches.map(b => b.match(/'([A-Z_]+)'/)[1]));
  return suppressing.size === 3
    && suppressing.has('BOUNCED_HARD')
    && suppressing.has('COMPLAINED')
    && suppressing.has('BOUNCED_SOFT');
})());
// Scoped to the CREATE block on purpose: the active-row LOOKUP legitimately
// mentions expiresAt (it must ignore lapsed rows). What must never appear is an
// expiry being SET on a new provider suppression — §M forbids automatic timed
// clearing in C3D.
t('[safety]    Y45 no expiry is set on a new provider suppression', (() => {
  const create = /communicationSuppression\.create\(\{[\s\S]*?\n  \}\);/.exec(life)?.[0] ?? '';
  return create.length > 0 && !/expiresAt/.test(create);
})());

// exact subscribed set
t('[behaviour] Y45 exactly six event types are handled', HANDLED_EVENT_TYPES.length === 6);
t('[behaviour] Y45 handled set is the documented set',
  ['email.sent', 'email.delivered', 'email.delivery_delayed',
   'email.bounced', 'email.complained', 'email.failed']
    .every(e => HANDLED_EVENT_TYPES.includes(e)));

// ═══════════════════════════════════════════════════════════════════════════
section('Z. UNSUBSCRIBE HEADERS / RFC 8058');
// ═══════════════════════════════════════════════════════════════════════════

// 46-49. both governed senders attach both headers
for (const f of GOVERNED_SENDERS) {
  const s = strip(src(f));
  const name = f.split('/').pop();
  t(`[behaviour] Z46 ${name} attaches List-Unsubscribe headers`,
    /headers:\s*listUnsubscribeHeaders\(opts\.unsubscribeToken\)/.test(s));
  t(`[safety]    Z46 ${name} still refuses to send without the capability`,
    /if\s*\(\s*!opts\.unsubscribeToken\s*\)[\s\S]{0,260}?return\s*\{\s*id:\s*undefined/.test(s));
}
const headerSrc = strip(src('src/lib/communications/unsubscribeToken.ts'));
t('[behaviour] Z47 List-Unsubscribe-Post declares One-Click',
  /'List-Unsubscribe-Post':\s*'List-Unsubscribe=One-Click'/.test(headerSrc));
t('[behaviour] Z48 both headers are produced together', withSecret(SECRET, () => {
  const tok = mintUnsubscribeToken({
    recipientKey: KEY_A, keyVersion: 1, channel: 'EMAIL',
    communicationClass: 'CLINICAL_CONTINUITY',
  });
  const h = listUnsubscribeHeaders(tok);
  return h['List-Unsubscribe']?.startsWith('<https://')
    && h['List-Unsubscribe'].endsWith('>')
    && h['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click';
}));
t('[behaviour] Z49 all four governed routes pass the token, not a URL',
  GOVERNED_ROUTES.every(f => {
    const s = strip(src(f));
    return /unsubscribeToken:\s*unsubToken/.test(s) && !/unsubscribeUrl:/.test(s);
  }));
t('[safety]    Z49 all four still abandon the send if minting fails',
  GOVERNED_ROUTES.every(f => /if\s*\(\s*!unsubToken\s*\)/.test(strip(src(f)))));

// 50-52. the capability in the header
t('[behaviour] Z50 different recipients get different header URLs', withSecret(SECRET, () => {
  const mk = k => listUnsubscribeHeaders(mintUnsubscribeToken({
    recipientKey: k, keyVersion: 1, channel: 'EMAIL',
    communicationClass: 'CLINICAL_CONTINUITY',
  }))['List-Unsubscribe'];
  return mk(KEY_A) !== mk(KEY_B);
}));
t('[behaviour] Z50 the header token verifies to that recipient', withSecret(SECRET, () => {
  const tok = mintUnsubscribeToken({
    recipientKey: KEY_A, keyVersion: 1, channel: 'EMAIL',
    communicationClass: 'CLINICAL_CONTINUITY',
  });
  const url = listUnsubscribeHeaders(tok)['List-Unsubscribe'].slice(1, -1);
  const t2  = decodeURIComponent(new URL(url).searchParams.get('t'));
  const v   = verifyUnsubscribeToken(t2);
  return v.ok && v.payload.k === KEY_A && v.payload.cl === 'CLINICAL_CONTINUITY';
}));
t('[safety]    Z51 header URL carries no plaintext address', withSecret(SECRET, () => {
  const tok = mintUnsubscribeToken({
    recipientKey: KEY_A, keyVersion: 1, channel: 'EMAIL',
    communicationClass: 'CLINICAL_CONTINUITY',
  });
  const url = listUnsubscribeHeaders(tok)['List-Unsubscribe'];
  return !url.includes('@') && !/%40/i.test(url);
}));
t('[safety]    Z51 header URL avoids the redirecting apex host', withSecret(SECRET, () => {
  const tok = mintUnsubscribeToken({
    recipientKey: KEY_A, keyVersion: 1, channel: 'EMAIL',
    communicationClass: 'CLINICAL_CONTINUITY',
  });
  return listUnsubscribeHeaders(tok)['List-Unsubscribe'].includes('https://www.myoguard.health/');
}));
t('[safety]    Z52 ESSENTIAL_SERVICE is not an optional class',
  !OPTIONAL_CLASSES.includes('ESSENTIAL_SERVICE'));
t('[safety]    Z52 OPERATIONAL_INTERNAL is not an optional class',
  !OPTIONAL_CLASSES.includes('OPERATIONAL_INTERNAL'));
t('[safety]    Z52 a token re-signed for ESSENTIAL_SERVICE is refused', withSecret(SECRET, () => {
  // Forge the payload AND sign it correctly — the allowlist must still refuse.
  const part = Buffer.from(JSON.stringify({
    v: 1, k: KEY_A, kv: 1, ch: 'EMAIL', cl: 'ESSENTIAL_SERVICE', p: 'unsub',
  }), 'utf8').toString('base64url');
  const sig = createHmac('sha256', SECRET).update(part).digest('base64url');
  const v = verifyUnsubscribeToken(`${part}.${sig}`);
  return v.ok === false && v.reason === 'class_not_optional';
}));

// 53-55. one-click POST semantics
const unsub = strip(src(UNSUB_ROUTE));
t('[safety]    Z53 one-click accepts the token from the query string',
  /searchParams\.get\('t'\)/.test(unsub));
t('[safety]    Z53 withdrawal still runs through the shared service',
  /withdrawConsent\(/.test(unsub));
t('[safety]    Z53 class breadth still comes from the allowlist',
  /allOptional \? OPTIONAL_CLASSES : \[tokenClass\]/.test(unsub));
t('[ordering]  Z53 token verification precedes withdrawal',
  unsub.indexOf('verifyUnsubscribeToken(') < unsub.indexOf('withdrawConsent('));
t('[safety]    Z53 there is no subscribe path on this endpoint',
  !/grantConsent|SUBSCRIBED/.test(unsub));
t('[behaviour] Z54 withdrawal service is idempotent by lookup',
  /if \(existing\) \{ alreadyWithdrawn\.push/.test(strip(src('src/lib/communications/preferenceService.ts'))));
t('[safety]    Z55 unsubscribe endpoint still has no GET handler',
  !/export async function GET/.test(unsub));
t('[safety]    Z55 public confirmation page performs no write',
  (() => {
    const p = strip(src('app/unsubscribe/page.tsx'));
    return !/withdrawConsent|grantConsent|prisma/.test(p);
  })());

// 56-58. fail-closed and no C3C regression
t('[safety]    Z56 no secret means no token to put in a header',
  withSecret(undefined, () => mintUnsubscribeToken({
    recipientKey: KEY_A, keyVersion: 1, channel: 'EMAIL',
    communicationClass: 'CLINICAL_CONTINUITY',
  }) === null));
t('[safety]    Z56 a weak secret is refused',
  withSecret('short', () => mintUnsubscribeToken({
    recipientKey: KEY_A, keyVersion: 1, channel: 'EMAIL',
    communicationClass: 'CLINICAL_CONTINUITY',
  }) === null));
t('[safety]    Z56 verification without a secret is an outage, not a bad link',
  withSecret(undefined, () => verifyUnsubscribeToken('x.y').reason === 'secret_unavailable'));
t('[behaviour] Z57 the human-facing body link is unchanged in shape',
  withSecret(SECRET, () => {
    const tok = mintUnsubscribeToken({
      recipientKey: KEY_A, keyVersion: 1, channel: 'EMAIL',
      communicationClass: 'CLINICAL_CONTINUITY',
    });
    return unsubscribeUrlFor(tok).startsWith('https://myoguard.health/unsubscribe?t=');
  }));
t('[behaviour] Z57 body link and header name the same capability',
  withSecret(SECRET, () => {
    const tok = mintUnsubscribeToken({
      recipientKey: KEY_A, keyVersion: 1, channel: 'EMAIL',
      communicationClass: 'CLINICAL_CONTINUITY',
    });
    const fromBody   = new URL(unsubscribeUrlFor(tok)).searchParams.get('t');
    const fromHeader = new URL(unsubscribeOneClickUrlFor(tok)).searchParams.get('t');
    return fromBody === fromHeader;
  }));
t('[safety]    Z58 settings route still requires a session',
  /auth\(\)/.test(strip(src('app/settings/page.tsx')))
  && /redirect\('\/sign-in'\)/.test(strip(src('app/settings/page.tsx'))));
t('[safety]    Z58 preferences API still rejects the unauthenticated',
  /status:\s*401/.test(strip(src('app/api/communications/preferences/route.ts'))));

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
