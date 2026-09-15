/**
 * scripts/commsGovernanceSchema.test.mjs
 *
 * Phase 1D-C3A — communications governance data foundation validation.
 *
 * Run:  node scripts/commsGovernanceSchema.test.mjs
 *
 * C3A is schema-only. There is no behaviour to exercise, so every check here is
 * STATIC: it reads the shipped prisma/schema.prisma and the shipped application
 * source and asserts structural invariants the architecture depends on.
 *
 * Touches no database, sends no email, imports no Prisma client.
 *
 * Three kinds of check:
 *   [shape]      — the model/enum exists with the required members.
 *   [safety]     — a relation or default cannot undermine the architecture
 *                  (evidence survives deletion; no silent opt-in).
 *   [zero-touch] — this phase changed no existing behaviour: no route, utility
 *                  or cron references the new models.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const SCHEMA = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

/**
 * Doc comments describe the very things the data-minimisation check forbids
 * ("never the subject line", "no risk band"). Strip them before scanning field
 * declarations, or the prose trips the check it is explaining.
 */
const stripDocs = s => s.split('\n').filter(l => !l.trim().startsWith('///') && !l.trim().startsWith('//')).join('\n');

/** Prisma blocks contain no nested braces — first closing brace ends the block. */
const block = (kind, name) => {
  const m = SCHEMA.match(new RegExp(`^${kind} ${name} \\{([\\s\\S]*?)^\\}`, 'm'));
  return m ? m[1] : null;
};
const modelBody = name => block('model', name);
const enumBody  = name => block('enum',  name);

// ── 1. Enums ─────────────────────────────────────────────────────────────────
section('-- 1. required enums --');

const REQUIRED_ENUMS = {
  CommunicationClass: [
    'ESSENTIAL_SERVICE', 'CLINICAL_CONTINUITY', 'EDUCATIONAL', 'MARKETING', 'OPERATIONAL_INTERNAL',
  ],
  CommunicationChannel: ['EMAIL', 'SMS'],
  CommunicationPreferenceState: ['SUBSCRIBED', 'UNSUBSCRIBED', 'NEVER_SET'],
  CommunicationConsentAction: ['GRANT', 'WITHDRAW', 'ADMIN_SET', 'SYSTEM_SET'],
  CommunicationSuppressionReason: [
    'RECIPIENT_UNSUBSCRIBE', 'HARD_BOUNCE', 'SOFT_BOUNCE_REPEATED',
    'SPAM_COMPLAINT', 'ADMIN_SUPPRESSION', 'ACCOUNT_CONTACTABILITY_REVOKED',
  ],
  CommunicationState: [
    'REQUESTED', 'SUPPRESSED', 'SENT', 'DELIVERED',
    'BOUNCED_HARD', 'BOUNCED_SOFT', 'COMPLAINED', 'FAILED',
  ],
};

for (const [name, members] of Object.entries(REQUIRED_ENUMS)) {
  const body = enumBody(name);
  t(`[shape] enum ${name} exists`, body !== null);
  if (body) {
    const present = members.filter(m => new RegExp(`^\\s*${m}\\s*$`, 'm').test(body));
    t(`[shape] enum ${name} has all ${members.length} approved members`, present.length === members.length);
  }
}

// ── 2. Models ────────────────────────────────────────────────────────────────
section('-- 2. required models --');

const REQUIRED_MODELS = [
  'CommunicationRecipient', 'CommunicationPreference', 'CommunicationConsentEvent',
  'ConsentWording', 'CommunicationSuppression', 'CommunicationEvent',
];
for (const name of REQUIRED_MODELS) {
  t(`[shape] model ${name} exists`, modelBody(name) !== null);
}

// ── 3. Preference dimension uniqueness ───────────────────────────────────────
section('-- 3. preference dimension --');
{
  const body = modelBody('CommunicationPreference') ?? '';
  t('[shape] preference is unique on recipient + channel + class',
    /@@unique\(\[recipientId,\s*channel,\s*communicationClass\]\)/.test(body));
  t('[shape] preference carries all three dimension fields',
    /\brecipientId\s+String/.test(body) &&
    /\bchannel\s+CommunicationChannel/.test(body) &&
    /\bcommunicationClass\s+CommunicationClass/.test(body));
  t('[shape] preference records which ledger entry established it',
    /\blastEventId\s+String\?/.test(body));
}

// ── 4. No silent opt-in for anyone ───────────────────────────────────────────
section('-- 4. no silent default subscription --');
{
  const body = stripDocs(modelBody('CommunicationPreference') ?? '');
  t('[safety] preference state defaults to NEVER_SET, not SUBSCRIBED',
    /state\s+CommunicationPreferenceState\s+@default\(NEVER_SET\)/.test(body));
  t('[safety] no field anywhere defaults to SUBSCRIBED',
    !/@default\(SUBSCRIBED\)/.test(SCHEMA));
}

// ── 5. Evidence survives deletion ────────────────────────────────────────────
section('-- 5. deletion safety --');
{
  const supp = modelBody('CommunicationSuppression') ?? '';
  t('[safety] suppression recipientKey is NOT nullable (always identifiable)',
    /\brecipientKey\s+String\s/.test(supp) && !/\brecipientKey\s+String\?/.test(supp));
  t('[safety] suppression recipientId IS nullable — can exist with no recipient row',
    /\brecipientId\s+String\?/.test(supp));
  t('[safety] suppression relation is SetNull, never Cascade',
    /recipient\s+CommunicationRecipient\?[^\n]*onDelete:\s*SetNull/.test(supp) &&
    !/onDelete:\s*Cascade/.test(supp));

  const consent = modelBody('CommunicationConsentEvent') ?? '';
  t('[safety] consent event recipientKey is NOT nullable',
    /\brecipientKey\s+String\s/.test(consent) && !/\brecipientKey\s+String\?/.test(consent));
  t('[safety] consent event recipientId IS nullable',
    /\brecipientId\s+String\?/.test(consent));
  t('[safety] consent ledger does not cascade away with the recipient',
    /recipient\s+CommunicationRecipient\?[^\n]*onDelete:\s*SetNull/.test(consent) &&
    !/onDelete:\s*Cascade/.test(consent));
  t('[safety] wording referenced by consent evidence is not deletable (Restrict)',
    /wording\s+ConsentWording\?[^\n]*onDelete:\s*Restrict/.test(consent));

  const ev = modelBody('CommunicationEvent') ?? '';
  t('[safety] communication event recipientId IS nullable',
    /\brecipientId\s+String\?/.test(ev));
  t('[safety] send history does not cascade away with the recipient',
    /recipient\s+CommunicationRecipient\?[^\n]*onDelete:\s*SetNull/.test(ev) &&
    !/onDelete:\s*Cascade/.test(ev));
}

// ── 6. Zero-touch on existing clinical models ────────────────────────────────
section('-- 6. zero-touch on existing models --');
{
  for (const existing of ['User', 'Notification', 'Assessment']) {
    const body = modelBody(existing) ?? '';
    t(`[zero-touch] model ${existing} gained no relation to the new block`,
      !/Communication|ConsentWording/.test(body));
  }
  const recip = modelBody('CommunicationRecipient') ?? '';
  t('[zero-touch] recipient references User by plain scalar, not @relation',
    /\buserId\s+String\?/.test(recip) && !/\buser\s+User/.test(recip));
  const ev = modelBody('CommunicationEvent') ?? '';
  t('[zero-touch] event references Notification by plain scalar, not @relation',
    /\brelatedNotificationId\s+String\?/.test(ev) && !/Notification\s/.test(stripDocs(ev)));
}

// ── 7. Data minimisation in CommunicationEvent ───────────────────────────────
section('-- 7. no clinical content in CommunicationEvent --');
{
  const body = stripDocs(modelBody('CommunicationEvent') ?? '');
  // Field declarations only: "  name  Type ..." — attributes and blank lines excluded.
  const fields = body.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('@@'))
    .map(l => l.split(/\s+/)[0]);

  const FORBIDDEN = [
    'body', 'html', 'subject', 'content', 'score', 'sri', 'sriScore', 'riskBand',
    'symptoms', 'medication', 'dose', 'doseMg', 'explanation', 'proteinTargetG',
    'trendStatus', 'payload', 'text',
  ];
  const found = fields.filter(f => FORBIDDEN.includes(f));
  t(`[safety] no prohibited clinical/body field (checked ${fields.length} fields)`,
    found.length === 0);
  if (found.length) console.log('        offending fields: ' + found.join(', '));

  t('[shape] clinical context is referenced by id, not copied',
    fields.includes('relatedNotificationId'));
  t('[shape] template is an identifier, not rendered output',
    fields.includes('templateId'));
}

// ── 8. Webhook join key and registry uniqueness ──────────────────────────────
section('-- 8. keys and constraints --');
{
  const ev = modelBody('CommunicationEvent') ?? '';
  t('[shape] providerMessageId is unique and nullable',
    /providerMessageId\s+String\?\s+@unique/.test(ev));

  const wording = modelBody('ConsentWording') ?? '';
  t('[shape] wording is unique on surface + version',
    /@@unique\(\[surface,\s*version\]\)/.test(wording));

  const recip = modelBody('CommunicationRecipient') ?? '';
  t('[shape] recipientKey is unique on the recipient identity',
    /recipientKey\s+String\s+@unique/.test(recip));
  t('[shape] every keyed model carries keyVersion for later rotation',
    ['CommunicationRecipient', 'CommunicationConsentEvent',
     'CommunicationSuppression', 'CommunicationEvent']
      .every(m => /\bkeyVersion\s+Int/.test(modelBody(m) ?? '')));
}

// ── 9. Only the authorised consumers use the new models ──────────────────────
//
// C3A shipped with this asserting ZERO consumers. Phase 1D-C3B deliberately
// introduced the first ones, so the check was narrowed rather than deleted: it
// now asserts that the ONLY things touching the governance models are the
// governance layer itself and the four CLINICAL_CONTINUITY pathways C3B was
// authorised to migrate. Anything else appearing here is an unauthorised
// migration, which is what this guard is actually for.
section('-- 9. only authorised consumers --');
{
  /** Authorised by Phase 1D-C3B. Paths are repo-relative, forward-slashed. */
  const AUTHORISED = [
    'src/lib/communications/governance.ts',
    'src/lib/communications/identity.ts',
    'app/api/cron/weekly-pulse/route.ts',
    'app/api/cron/longitudinal-summary/route.ts',
    'app/api/email/weekly-pulse/route.ts',
    'app/api/email/longitudinal-summary/route.ts',
  ];
  const roots = ['app', 'src'];
  const files = [];
  const walk = d => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(p)) files.push(p);
    }
  };
  // fileURLToPath, not URL.pathname — the repo path contains a space, which
  // stays percent-encoded in pathname and would not resolve on disk.
  for (const r of roots) walk(fileURLToPath(new URL('../' + r, import.meta.url)));

  // Prisma accessors, enum type names, AND the governance wrappers. The
  // wrappers matter: C3B's callers reach the models only through canSend /
  // recordCommunicationEvent, so a regex covering only Prisma accessors would
  // report a false pass for every migrated pathway.
  const CONSUMERS = /\b(communicationRecipient|communicationPreference|communicationConsentEvent|consentWording|communicationSuppression|communicationEvent|CommunicationClass|CommunicationChannel|CommunicationState|CommunicationPreferenceState|CommunicationConsentAction|CommunicationSuppressionReason|canSend|recordCommunicationEvent|markEventSent|deriveRecipientIdentity)\b/;

  const repoRel = f => f.replace(/\\/g, '/').split('/myoguard-web/')[1] ?? f.replace(/\\/g, '/');
  const consumers = files.filter(f => CONSUMERS.test(readFileSync(f, 'utf8'))).map(repoRel);
  const unauthorised = consumers.filter(c => !AUTHORISED.includes(c));

  t(`[zero-touch] only authorised files consume the governance layer ` +
    `(${consumers.length} consumers of ${files.length} scanned)`,
    unauthorised.length === 0);
  if (unauthorised.length) unauthorised.forEach(o => console.log('        UNAUTHORISED: ' + o));

  // The pathways C3B was explicitly told NOT to migrate must stay untouched.
  const NOT_YET_MIGRATED = [
    'app/api/protocol-email/route.ts',
    'app/api/email-capture/route.ts',
    'app/api/doctor/register/route.ts',
    'app/api/doctor/onboarding/route.ts',
    'app/api/invite/send/route.ts',
    'app/api/admin/verify-physician/route.ts',
    'app/api/admin/physician-review/route.ts',
    'src/lib/email.ts',
    'src/lib/email/index.ts',
  ];
  const touched = NOT_YET_MIGRATED.filter(p =>
    CONSUMERS.test(readFileSync(new URL('../' + p, import.meta.url), 'utf8')));
  t(`[zero-touch] none of the ${NOT_YET_MIGRATED.length} unmigrated pathways was touched`,
    touched.length === 0);
  if (touched.length) touched.forEach(o => console.log('        touched: ' + o));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
