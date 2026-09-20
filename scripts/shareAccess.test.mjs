/**
 * scripts/shareAccess.test.mjs
 *
 * Phase 1D-R1 — share access hardening.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/shareAccess.test.mjs
 *
 * HOW THIS SUITE PROVES WHAT IT CLAIMS
 * The hardening rests on one architectural move: every token consumer resolves
 * through `resolveActiveShareCard`, and that resolver applies one predicate. So
 * the proof is in two halves, and both are needed —
 *
 *   BEHAVIOURAL  the predicate itself is exercised as a real function, with
 *                real dates and real tokens. `sharePolicy` holds no I/O
 *                precisely so this is possible without a database.
 *
 *   STRUCTURAL   each of the five consumers is shown to go through the
 *                resolver, and shown NOT to reach `prisma.shareCard` directly.
 *                Composed with the behavioural half, that is what makes "all
 *                five reject expired and revoked tokens" true.
 *
 * The structural half is stated plainly rather than dressed up as behaviour:
 * these routes need a database and a Clerk session, so a source-level
 * assertion is the honest instrument here. What it is good at is exactly the
 * failure this phase exists to prevent — a consumer that quietly resolves the
 * token itself and forgets the check.
 *
 *   [safety]  — an invariant whose violation exposes or writes patient data.
 *   [policy]  — the expiry/revocation rules themselves.
 *   [flow]    — a workflow that must keep working.
 *   [lock]    — something that must not appear through bearer access.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync } from 'node:fs';
import {
  isShareCardActive,
  mintShareToken,
  shareExpiryFrom,
} from '../src/lib/share/sharePolicy.ts';
import {
  SHARE_LINK_TTL_DAYS,
  SHARE_NOTICE_TEXT,
  SHARE_NOTICE_VERSION,
} from '../src/lib/share/shareNotice.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/** Strips comments, so a rule named only in prose never satisfies an assertion. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-20T12:00:00Z');

// The five sites that turn a share token into patient data or a linkage write.
const CONSUMERS = {
  'the public report page':      'app/report/[token]/page.tsx',
  'the physician preview':       'app/api/doctor/patient-preview/route.ts',
  'the accept-patient linkage':  'app/api/doctor/accept-patient/route.ts',
  'physician registration':      'app/api/doctor/register/route.ts',
  'physician onboarding':        'app/api/doctor/onboarding/route.ts',
};

section('-- A. The expiry and revocation rules --');
{
  t('[policy] a link inside its window is active',
    isShareCardActive({ expiresAt: new Date(NOW.getTime() + DAY), revokedAt: null }, NOW));

  t('[policy] a link past its expiry is not',
    !isShareCardActive({ expiresAt: new Date(NOW.getTime() - 1), revokedAt: null }, NOW));

  // Absolute, never sliding — the Founder decision. Expiry is stamped once at
  // creation, so a link opened every day still dies on schedule.
  t('[policy] expiry is exactly 30 days from creation',
    SHARE_LINK_TTL_DAYS === 30
    && shareExpiryFrom(NOW).getTime() === NOW.getTime() + 30 * DAY);

  t('[policy] the boundary is closed — expiry at this instant is not active',
    !isShareCardActive({ expiresAt: new Date(NOW.getTime()), revokedAt: null }, NOW));

  // Revocation outranks everything. A patient who withdraws must not be told
  // "but the link had not expired yet".
  t('[policy] revocation beats a still-valid expiry',
    !isShareCardActive({ expiresAt: new Date(NOW.getTime() + 30 * DAY), revokedAt: NOW }, NOW));

  t('[policy] a revoked and expired link is still dead',
    !isShareCardActive({ expiresAt: new Date(NOW.getTime() - DAY), revokedAt: NOW }, NOW));

  // The legacy transition. Null expiry reads as active so that enforcement and
  // the backfill stay independent: a partial backfill must degrade to the
  // previous behaviour, not lock patients out of their own links.
  t('[flow]   a legacy row with no expiry still resolves until backfilled',
    isShareCardActive({ expiresAt: null, revokedAt: null }, NOW));

  t('[safety] a legacy row can still be revoked',
    !isShareCardActive({ expiresAt: null, revokedAt: NOW }, NOW));
}

section('-- B. Token entropy --');
{
  const a = mintShareToken();
  const b = mintShareToken();

  t('[safety] tokens are high-entropy, not identifiers',
    a.length >= 42 && a !== b);

  t('[safety] tokens are URL- and QR-safe',
    /^[A-Za-z0-9_-]+$/.test(a));

  // 200 draws sharing no prefix rules out a counter or timestamp lead, which is
  // what made the previous cuid() default guessable in bulk.
  const draws = Array.from({ length: 200 }, mintShareToken);
  t('[safety] tokens share no common prefix and never repeat',
    new Set(draws).size === 200 && new Set(draws.map(s => s.slice(0, 6))).size > 190);

  // The schema default is gone, so a future create site cannot silently fall
  // back to cuid(). This is the guard that keeps that true.
  const schema = strip(src('prisma/schema.prisma'));
  const shareCard = schema.slice(schema.indexOf('model ShareCard'), schema.indexOf('model ReferralInvite'));
  t('[safety] the schema no longer defaults shareToken to cuid()',
    /shareToken\s+String\s+@unique\s*$/m.test(shareCard)
    && !/shareToken[^\n]*@default/.test(shareCard));

  t('[safety] ShareCard carries expiry and revocation columns',
    /expiresAt\s+DateTime\?/.test(shareCard) && /revokedAt\s+DateTime\?/.test(shareCard));
}

section('-- C. Enforcement reaches all five token consumers --');
{
  // The composition that makes section A binding on real traffic.
  for (const [label, file] of Object.entries(CONSUMERS)) {
    const code = strip(src(file));
    t(`[safety] ${label} resolves through the shared resolver`,
      /resolveActiveShareCard\s*\(/.test(code));
    t(`[safety] ${label} never resolves a share token itself`,
      !/prisma\s*\.\s*shareCard\s*\.\s*find/.test(code));
  }

  // The resolver is the only place that may.
  const access = strip(src('src/lib/share/shareAccess.ts'));
  t('[safety] only the resolver reads ShareCard by token',
    /prisma\.shareCard\.findUnique/.test(access));

  t('[safety] the resolver applies the predicate rather than its own rule',
    /isShareCardActive\s*\(/.test(access)
    && /revokedAt !== null/.test(access));
}

section('-- D. No existence oracle --');
{
  const access = strip(src('src/lib/share/shareAccess.ts'));
  t('[safety] the resolver distinguishes the three failures for the server only',
    /'unknown'/.test(access) && /'expired'/.test(access) && /'revoked'/.test(access));

  // Every consumer must collapse them back into one answer. An endpoint that
  // said "expired" rather than "unknown" would confirm that a guessed token
  // belonged to a real patient.
  const report = strip(src('app/report/[token]/page.tsx'));
  t('[safety] the report page answers all three identically',
    /if \(!access\.ok\) return <ShareUnavailable \/>;/.test(report)
    && !/reason ===/.test(report));

  for (const file of ['app/api/doctor/patient-preview/route.ts', 'app/api/doctor/accept-patient/route.ts']) {
    const code = strip(src(file));
    t(`[safety] ${file.split('/').slice(-2)[0]} does not branch on the failure reason`,
      !/access\.reason/.test(code));
  }

  t('[safety] the unavailable surface names no patient and confirms no record',
    !/fullName|score|riskBand|assessment/i.test(
      src('src/lib/share/shareAccess.ts').match(/SHARE_UNAVAILABLE_BODY[\s\S]{0,200}/)[0]));
}

section('-- E. The linkage write is gated --');
{
  const code = strip(src('app/api/doctor/accept-patient/route.ts'));
  // The CALL, not the import — `indexOf('resolveActiveShareCard')` would match
  // the import line at the top of the file and make every ordering assertion
  // below trivially true. Mutation testing caught exactly that.
  const gate  = code.indexOf('await resolveActiveShareCard(');
  const write = code.indexOf('prisma.user.update');
  const invite = code.indexOf('physicianPatientInvitation.create');

  // Order matters, not just presence: the permanent write must sit behind the
  // check, so an expired or revoked link cannot establish a treating
  // relationship that outlives the access which justified it.
  t('[safety] share access is checked before the physicianId write',
    gate !== -1 && write !== -1 && gate < write);
  t('[safety] share access is checked before any invitation is created',
    gate !== -1 && invite !== -1 && gate < invite);
  t('[safety] a failed resolution returns before any write',
    /if \(!access\.ok\) \{[\s\S]{0,160}return NextResponse\.json[\s\S]{0,80}\}/.test(code));

  // Registration and onboarding seed PENDING invitations from a token too.
  for (const file of ['app/api/doctor/register/route.ts', 'app/api/doctor/onboarding/route.ts']) {
    const c = strip(src(file));
    t(`[safety] ${file.split('/').slice(-2)[0]} seeds an invitation only on active access`,
      /if \(access\.ok\)/.test(c)
      && c.indexOf('await resolveActiveShareCard(') < c.indexOf('physicianPatientInvitation.create'));
  }
}

section('-- F. Issuance, reuse and rotation --');
{
  const code = strip(src('app/api/report/share/route.ts'));

  t('[flow]   an active link is reused rather than reissued',
    /const active = existing\.find\(c => isShareCardActive\(c\)\)/.test(code)
    && /if \(active\) \{/.test(code));

  t('[safety] a new link is minted once the old one lapses or is revoked',
    /shareToken: mintShareToken\(\)/.test(code) && /expiresAt:\s*shareExpiryFrom\(\)/.test(code));

  t('[safety] issuance requires the patient to acknowledge the notice',
    /acknowledged\s*===\s*true/.test(code)
    && /status:\s*422/.test(code));

  t('[safety] a missing or malformed body is never an acknowledgement',
    /catch\s*\{[^}]*\}/.test(code) && /let acknowledged = false/.test(code));

  t('[safety] issuance requires an authenticated patient',
    /await auth\(\)/.test(code) && /status: 401/.test(code));
}

section('-- G. Revocation --');
{
  const code = strip(src('app/api/report/share/route.ts'));
  const del  = code.slice(code.indexOf('export async function DELETE'));

  t('[safety] revocation exists and is authenticated',
    /export async function DELETE/.test(code) && /await auth\(\)/.test(del) && /status: 401/.test(del));

  // Scoped by the caller's own userId with no id accepted from the request, so
  // there is nothing to tamper with and no way to name another patient's link.
  t('[safety] another patient cannot revoke the owner\'s link',
    /where:\s*\{\s*userId:\s*user\.id,\s*revokedAt:\s*null\s*\}/.test(del)
    && !/params|searchParams|body|req\.json/.test(del));

  t('[safety] revocation closes every one of the patient\'s links',
    /updateMany/.test(del) && /revokedAt:\s*now/.test(del));

  // The reassurance that makes revocation safe to offer plainly.
  t('[flow]   revocation does not touch the physician relationship',
    !/physicianId/.test(del) && !/prisma\.user\.update/.test(del)
    && !/physicianPatientInvitation/.test(del));
}

section('-- H. What bearer access may see --');
{
  const report = src('app/report/[token]/page.tsx');
  const code   = strip(report);

  // The Founder decision. One clinician's free-text opinion, written in another
  // context, must not be readable by whoever the URL reaches.
  t('[lock]   the physician free-text review is never fetched by the token page',
    !/physicianReview/i.test(code));
  t('[lock]   the physician free-text review is never rendered by the token page',
    !/savedReview/.test(code) && !/overallImpression/.test(code) && !/followUpDays/.test(code));

  // Guards the removal from going too far — the shared report still has to be
  // clinically useful, or patients simply will not share it.
  t('[flow]   the clinical summary itself is still rendered',
    /buildInterpretation/.test(code) && /buildSuggestedActions/.test(code)
    && /buildEscalationSignal/.test(code));

  // The linked physician keeps the note through authenticated access.
  t('[flow]   the authenticated physician view still carries the review',
    /physicianReview/i.test(strip(src('app/doctor/patients/[userId]/page.tsx'))));
}

section('-- I. The patient is told what the link does --');
{
  t('[safety] the notice states purpose, lifetime and withdrawal',
    /view your MyoGuard information/i.test(SHARE_NOTICE_TEXT)
    && /expires after 30 days/i.test(SHARE_NOTICE_TEXT)
    && /revoke it at any time/i.test(SHARE_NOTICE_TEXT));

  t('[safety] the notice carries a version, so evidence records what was shown',
    typeof SHARE_NOTICE_VERSION === 'string' && SHARE_NOTICE_VERSION.length > 0);

  const ui = strip(src('app/dashboard/report/ShareButton.tsx'));
  t('[safety] the dialog shows the shared notice rather than its own wording',
    /\{SHARE_NOTICE_TEXT\}/.test(ui));

  // Acknowledgement causes issuance. Were the order reversed, a link would
  // exist before the patient affirmed anything.
  t('[safety] the link is generated by the acknowledgement, not by opening the dialog',
    /if \(next && shareUrl === ''\) void generate\(\)/.test(ui)
    && /acknowledged: true/.test(ui));

  t('[safety] the acknowledgement is not remembered across dialogs',
    !/sessionStorage/.test(ui));

  t('[flow]   the patient can see the expiry and revoke from the dialog',
    /expiresAt/.test(ui) && /Revoke this link/.test(ui));

  // A linked patient previously had no share controls at all, and so no way to
  // withdraw a link they had already created.
  t('[flow]   a linked patient can still revoke',
    /Revoke my share link/.test(ui));
}

section('-- J. Evidence of the patient\'s share action --');
{
  const access = strip(src('src/lib/share/shareAccess.ts'));
  const route  = strip(src('app/api/report/share/route.ts'));

  t('[safety] creation and revocation are both recorded',
    /SHARE_LINK_CREATED/.test(access) && /SHARE_LINK_REVOKED/.test(access)
    && /recordShareAuthorization/.test(route));

  t('[safety] the record identifies the acting patient and the notice version',
    /actorId:\s*input\.actorUserId/.test(access) && /noticeVersion/.test(access));

  // The credential must not be copied into a table with a far broader read
  // surface than the credential itself.
  t('[safety] the token is never written into the audit record',
    !/shareToken/.test(access.slice(access.indexOf('recordShareAuthorization'))));

  // Scope discipline. This is evidence of one act, not a consent primitive —
  // the broader patient-physician authorisation doctrine remains open.
  t('[safety] no consent model was introduced',
    !/consent/i.test(strip(src('prisma/schema.prisma')).slice(
      strip(src('prisma/schema.prisma')).indexOf('model ShareCard'),
      strip(src('prisma/schema.prisma')).indexOf('model ReferralInvite'))));
  t('[safety] evidence is an audit event, not a permission grant',
    /prisma\.auditLog\.create/.test(access)
    && !/CommunicationConsentEvent|StudyConsent|researchConsent/.test(access));

  // A failed audit insert must not be able to block a withdrawal.
  t('[safety] recording failure cannot prevent revocation',
    /catch \(err\)/.test(access.slice(access.indexOf('recordShareAuthorization'))));
}

section('-- K. Nothing else moved --');
{
  t('[lock]   SRI generation is untouched',
    !/protocolEngine|generateMuscleScore|riskBand =/.test(strip(src('src/lib/share/shareAccess.ts')))
    && !/protocolEngine/.test(strip(src('app/api/report/share/route.ts'))));

  t('[lock]   communications governance is untouched',
    !/CommunicationClass|ESSENTIAL_SERVICE|CommunicationEvent/.test(
      strip(src('src/lib/share/shareAccess.ts')) + strip(src('app/api/report/share/route.ts'))));

  t('[lock]   no retention or deletion machinery was introduced',
    !/deleteMany|\.delete\(/.test(strip(src('src/lib/share/shareAccess.ts')))
    && !/deleteMany|prisma\.[a-zA-Z]+\.delete\(/.test(strip(src('app/api/report/share/route.ts'))));

  t('[lock]   admin revocation was not added',
    !/ADMIN|requireAdmin/.test(strip(src('app/api/report/share/route.ts'))));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
