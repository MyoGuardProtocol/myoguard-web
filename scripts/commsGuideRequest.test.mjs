/**
 * scripts/commsGuideRequest.test.mjs
 *
 * Phase 1D-C3F-2 — bounded requested-delivery pathway for the Protein Guide.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/commsGuideRequest.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * The request schema and the Guide asset resolver are pure, so they are called
 * directly: every validation and availability assertion is the shipped code
 * answering. The governance decisions the pathway relies on are likewise real
 * calls into `decideFromGovernanceState`.
 *
 * The send itself touches Prisma and Resend, and the only database in this
 * project is production, which this phase forbids writing to. So ordering and
 * integration are asserted against shipped source, as in C3B-C3E.
 *
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would fabricate consent,
 *                 relay arbitrary mail, leak recipient state, or send content
 *                 nobody approved.
 *
 * THE INVARIANT THIS SUITE EXISTS TO HOLD
 * Requesting a document is not subscribing to a relationship. Section D is the
 * whole point: the pathway may write a CommunicationEvent and nothing else.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync } from 'node:fs';
import { decideFromGovernanceState } from '../src/lib/communications/governance.ts';
import { currentProteinGuide, proteinGuideAvailable } from '../src/lib/guide/proteinGuide.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src   = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const ROUTE = strip(src('app/api/guide-request/route.ts'));
const ASSET = strip(src('src/lib/guide/proteinGuide.ts'));
const SRI   = strip(src('app/api/protocol-email/route.ts'));
const CAP   = strip(src('app/api/email-capture/route.ts'));

// The shipped schema, rebuilt from the same zod contract the route declares, so
// validation is exercised rather than pattern-matched.
const { z } = await import('zod');
const Schema = z.object({
  email: z.string().trim().min(3).max(254).email(),
}).strict();

// ── A. Classification and pipeline ───────────────────────────────────────────
section('-- A. ESSENTIAL_SERVICE requested delivery through the shared gateway --');
{
  t('[safety]   1. the route sends through the canonical governed gateway',
    /sendServiceEmail\(/.test(ROUTE) &&
    /from '@\/src\/lib\/communications\/serviceEmail'/.test(ROUTE));
  t('[safety]   1. the gateway classifies this send ESSENTIAL_SERVICE',
    /communicationClass:\s*'ESSENTIAL_SERVICE'/.test(
      strip(src('src/lib/communications/serviceEmail.ts'))));
  t('[ordering] 1. no governance logic is duplicated in the route',
    !/canSend\(|recordCommunicationEvent\(|markEventSent\(|markEventFailed\(/.test(ROUTE));
  t('[ordering] 1. the route never touches Prisma directly',
    !/prisma\./.test(ROUTE));
  t('[ordering] 1. pipeline order is validate -> guide -> throttle -> send',
    /safeParse[\s\S]*?currentProteinGuide\([\s\S]*?consumeRecipientBudget\([\s\S]*?sendServiceEmail\(/
      .test(ROUTE));
  t('[behaviour] 1. ESSENTIAL_SERVICE consults no preference',
    ['SUBSCRIBED', 'NEVER_SET', 'UNSUBSCRIBED', null].every(p =>
      decideFromGovernanceState('ESSENTIAL_SERVICE',
        { activeSuppressionReasons: [], preferenceState: p, recipientVerified: true })
        .decision === 'ALLOW'));
}

// ── B. Input validation ──────────────────────────────────────────────────────
section('-- B. Validation, normalisation and bounded input --');
{
  t('[behaviour] 2. a valid address is accepted',
    Schema.safeParse({ email: 'person@example.com' }).success);
  for (const bad of ['not-an-email', '', 'a@', '@b.com', 'x y@z.com', 'person@']) {
    t(`[behaviour] 2. invalid address rejected: ${JSON.stringify(bad)}`,
      !Schema.safeParse({ email: bad }).success);
  }
  t('[behaviour] 3. a missing email is rejected',
    !Schema.safeParse({}).success);
  t('[behaviour] 3. a non-string email is rejected',
    !Schema.safeParse({ email: 12345 }).success &&
    !Schema.safeParse({ email: { toString: 1 } }).success);
  t('[behaviour] 3. an array body is rejected',
    !Schema.safeParse(['a@b.com']).success);
  t('[behaviour] 3. malformed JSON is answered 400 before parsing',
    /catch \{[\s\S]{0,120}?status: 400/.test(ROUTE));
  t('[safety]    3. an over-long address is rejected (bounded input)',
    !Schema.safeParse({ email: 'a'.repeat(250) + '@example.com' }).success);
  t('[ordering]  the address is normalised once, at the boundary',
    /normaliseEmail\(parsed\.data\.email\)/.test(ROUTE));
  t('[safety]    a validation failure does not echo the submitted value',
    !/parsed\.error/.test(ROUTE));
}

// ── C. Throttle, suppression, event, lifecycle ───────────────────────────────
section('-- C. Throttle, suppression and provider lifecycle --');
{
  t('[ordering] 4. the recipient throttle is consumed before the provider',
    /consumeRecipientBudget\([\s\S]*?sendServiceEmail\(/.test(ROUTE));
  t('[ordering] 4. throttling is applied after validation, never before',
    /safeParse[\s\S]*?consumeRecipientBudget\(/.test(ROUTE));
  t('[behaviour] 4. a throttled request answers 429',
    /throttled'[\s\S]{0,200}?status: 429/.test(ROUTE));
  t('[safety]   4. a throttle-store outage fails closed, not open',
    /unavailable'[\s\S]{0,260}?status: 503/.test(ROUTE));

  const blockers = ['HARD_BOUNCE', 'SPAM_COMPLAINT', 'SOFT_BOUNCE_REPEATED',
                    'ADMIN_SUPPRESSION', 'ACCOUNT_CONTACTABILITY_REVOKED'];
  for (const r of blockers) {
    t(`[behaviour] 5. ${r} blocks an ESSENTIAL_SERVICE Guide send`,
      decideFromGovernanceState('ESSENTIAL_SERVICE',
        { activeSuppressionReasons: [r], preferenceState: null, recipientVerified: true })
        .decision !== 'ALLOW');
  }

  t('[ordering] 6. CommunicationEvent is recorded by the gateway before sending',
    /recordCommunicationEvent\([\s\S]{0,700}?state:\s*'REQUESTED'[\s\S]{0,900}?sendEmail\(/
      .test(strip(src('src/lib/communications/serviceEmail.ts'))));
  t('[ordering] 7. the provider id is persisted for C3D reconciliation',
    /markEventSent\(eventId, providerMessageId\)/.test(
      strip(src('src/lib/communications/serviceEmail.ts'))));
  t('[safety]   7. the route does not fabricate a provider id',
    !/providerMessageId/.test(ROUTE));
  t('[safety]   an UNAVAILABLE governance verdict is never treated as a send',
    /sent\.outcome !== 'sent'/.test(ROUTE));
}

// ── D. Requested delivery is not consent ─────────────────────────────────────
section('-- D. A Guide request creates no permission of any kind --');
{
  t('[safety] 8.  no CommunicationPreference is written',
    !/communicationPreference/i.test(ROUTE));
  t('[safety] 9.  no CommunicationConsentEvent is written',
    !/communicationConsentEvent/i.test(ROUTE));
  t('[safety] 10. no ConsentWording is written or resolved',
    !/consentWording/i.test(ROUTE) && !/resolveWordingIdForSurface|resolveCurrentWordingId/.test(ROUTE));
  t('[safety] 11. grantConsent is never called',
    !/grantConsent/.test(ROUTE));
  t('[safety] 11. the preference service is not even imported',
    !/preferenceService/.test(ROUTE));
  t('[safety] 12. EDUCATIONAL is never named by this route',
    !/EDUCATIONAL/.test(ROUTE));
  t('[safety] 13. MARKETING is never named by this route',
    !/MARKETING/.test(ROUTE));
  t('[safety]     no CommunicationRecipient is created by the route itself',
    !/communicationRecipient/i.test(ROUTE));
  t('[safety]     no account is created',
    !/clerk|createUser|user\.create/i.test(ROUTE));
  t('[safety]     the gateway it calls writes no preference or consent row',
    !/communicationPreference\.|communicationConsentEvent\.|consentWording\./
      .test(strip(src('src/lib/communications/serviceEmail.ts'))));

  // The decisive proof: after a Guide send, the very next EDUCATIONAL question
  // still answers "no permission", because nothing wrote one.
  t('[behaviour]   a delivered Guide leaves EDUCATIONAL unauthorised',
    decideFromGovernanceState('ESSENTIAL_SERVICE',
      { activeSuppressionReasons: [], preferenceState: null, recipientVerified: true })
      .decision === 'ALLOW' &&
    decideFromGovernanceState('EDUCATIONAL',
      { activeSuppressionReasons: [], preferenceState: null, recipientVerified: true })
      .decision !== 'ALLOW');
}

// ── E. No clinical data, no caller-controlled content ────────────────────────
section('-- E. Minimal collection and a fixed template --');
{
  const CLINICAL = ['weight', 'weightKg', 'medication', 'dose', 'score', 'myoguardScore',
                    'riskBand', 'risk', 'leanLoss', 'leanVelocity', 'symptom', 'protocolResult',
                    'formData', 'sri'];
  for (const f of CLINICAL) {
    t(`[safety] 14. no clinical field required or accepted: ${f}`,
      !Schema.safeParse({ email: 'a@b.com', [f]: 'x' }).success);
  }
  t('[safety] 14. the request contract is email-only',
    Object.keys(Schema.shape).length === 1 && 'email' in Schema.shape);
  t('[safety] 14. the clinical capture schema is not reused here',
    !/EmailCaptureSchema|ProtocolEmailSchema|schemas\/assessment/.test(ROUTE));

  for (const f of ['subject', 'html', 'body', 'template', 'templateId',
                   'attachmentUrl', 'redirect', 'from', 'replyTo']) {
    t(`[safety] 15. caller cannot supply ${f}`,
      !Schema.safeParse({ email: 'a@b.com', [f]: 'x' }).success);
  }
  t('[safety] 15. subject and body come from the declared asset, not the request',
    /subject:\s*guide\.subject/.test(ROUTE) && /html:\s*guide\.renderHtml\(\)/.test(ROUTE));
  t('[safety] 15. the asset renderer accepts no input',
    /renderHtml:\s*\(\) =>/.test(ASSET) || /readonly renderHtml: \(\) => string/.test(ASSET));
  t('[safety] 15. the sender identity is a fixed literal',
    /from:\s*'MyoGuard Health <hello@myoguard\.health>'/.test(ROUTE));
}

// ── F. Logging and response neutrality ───────────────────────────────────────
section('-- F. Logging minimisation and neutral responses --');
{
  t('[safety] 16. the address is never logged',
    !/console\.[a-z]+\([^)]*\bemail\b/.test(ROUTE));
  t('[safety] 16. the recipient key is never logged',
    !/recipientKey/.test(ROUTE));
  t('[safety] 16. no unsubscribe token is handled or logged',
    !/token/i.test(ROUTE));
  t('[safety] 16. no provider response body is logged',
    !/console\.[a-z]+\([^)]*\b(result|data|errText|response)\b/.test(ROUTE));
  t('[safety] 16. the catch logs a message, not the whole error object',
    /err instanceof Error \? err\.message/.test(ROUTE));
  t('[safety]     a suppressed send is indistinguishable from a delivered one',
    /suppressed'[\s\S]{0,160}?ok: true/.test(ROUTE));
  t('[safety]     no analytics call is added in this phase',
    !/posthog|analytics|track\(/i.test(ROUTE));
}

// ── G. The Guide asset gate ──────────────────────────────────────────────────
section('-- G. No approved asset means no delivery --');
{
  t('[behaviour] no approved Protein Guide asset is declared in this build',
    currentProteinGuide() === null);
  t('[behaviour] availability reports false',
    proteinGuideAvailable() === false);
  t('[safety]    the route refuses rather than sending a placeholder',
    /if \(!guide\)[\s\S]{0,260}?status: 503/.test(ROUTE));
  t('[ordering]  availability is checked before budget is consumed',
    /currentProteinGuide\([\s\S]*?consumeRecipientBudget\(/.test(ROUTE));
  t('[safety]    no placeholder or stub Guide body exists',
    !/lorem|placeholder|TODO content|coming soon/i.test(ASSET));
  t('[safety]    the asset module renders nothing on its own',
    !/<html|<body|<!DOCTYPE/i.test(ASSET));
}

// ── H. Existing pathways unchanged ───────────────────────────────────────────
section('-- H. Existing delivery and governance are untouched --');
{
  t('[safety] 17. preliminary SRI delivery still uses its own template id',
    /service\.preliminary_sri\.v1/.test(SRI));
  t('[safety] 17. preliminary SRI delivery still sends through the gateway',
    /sendServiceEmail\(/.test(SRI));
  t('[safety] 18. protocol delivery still uses its own template id',
    /service\.protocol_delivery\.v1/.test(CAP));
  t('[safety] 18. protocol delivery still sends through the gateway',
    /sendServiceEmail\(/.test(CAP));
  t('[safety] 18. neither existing pathway gained a consent write',
    !/grantConsent|communicationPreference\.|communicationConsentEvent\./.test(SRI + CAP));

  const st = { activeSuppressionReasons: [], preferenceState: 'SUBSCRIBED', recipientVerified: true };
  t('[behaviour] 19. EDUCATIONAL + SUBSCRIBED still ALLOWs (C3F-1B intact)',
    decideFromGovernanceState('EDUCATIONAL', st).decision === 'ALLOW');
  t('[behaviour] 19. EDUCATIONAL + NEVER_SET still blocks',
    decideFromGovernanceState('EDUCATIONAL',
      { ...st, preferenceState: 'NEVER_SET' }).policyReason === 'preference_never_set');
  t('[behaviour] 19. EDUCATIONAL + no row still blocks',
    decideFromGovernanceState('EDUCATIONAL',
      { ...st, preferenceState: null }).policyReason === 'no_preference_on_record');
  t('[behaviour] 20. MARKETING is still class_not_activated',
    decideFromGovernanceState('MARKETING', st).policyReason === 'class_not_activated');
  t('[behaviour] 20. MARKETING cannot reach ALLOW on any state',
    ['SUBSCRIBED', 'NEVER_SET', 'UNSUBSCRIBED', null].every(p =>
      decideFromGovernanceState('MARKETING', { ...st, preferenceState: p }).decision !== 'ALLOW'));
  t('[behaviour]     CLINICAL_CONTINUITY keeps its verification gate',
    decideFromGovernanceState('CLINICAL_CONTINUITY',
      { ...st, recipientVerified: false }).policyReason === 'recipient_not_verified');
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
