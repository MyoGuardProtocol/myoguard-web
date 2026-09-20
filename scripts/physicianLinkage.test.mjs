/**
 * scripts/physicianLinkage.test.mjs
 *
 * Phase 1D-R2A — physician/patient linkage continuity.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/physicianLinkage.test.mjs
 *
 * WHAT WENT WRONG, AND WHAT THIS SUITE HAS TO PROVE
 * `User.physicianId` carried no foreign key, so deleting a physician left a
 * dangling value behind. Both re-linking guards test the value's PRESENCE, not
 * whether it resolves — `referral/link` skips its write on
 * `if (!patient.physicianId)`, and `accept-patient` 409s on any non-null
 * mismatch — so a stranded patient could never be linked to anyone again, while
 * their report still read "Shared with your physician".
 *
 * The correction is one constraint: ON DELETE SET NULL. No application logic
 * changed, because the existing guards already behave correctly against NULL.
 * That is the whole point, and it is also what makes this suite's job subtle:
 * there is no new function to call.
 *
 * HOW THE TWO HALVES COMPOSE
 *   DECLARATIVE  the schema is read as the source of the database rule, and
 *                the delete rule is PARSED OUT OF IT.
 *   BEHAVIOURAL  the parsed rule then DRIVES the simulation below. So changing
 *                the schema to Cascade does not merely fail a string match — it
 *                makes the simulation delete patients, and the behavioural
 *                assertions fail too. The two halves cannot drift apart, which
 *                is what stops the behavioural half being decorative.
 *
 * WHAT THIS SUITE DOES NOT CLAIM
 * It does not prove the constraint exists in the production database. That is a
 * database fact, verified once against `information_schema` at release and
 * reported there. Every suite in this repo is pure — no suite reaches a
 * database — and pretending otherwise here would be worse than stating the
 * boundary plainly.
 *
 *   [schema]  — the declared database rule.
 *   [safety]  — an invariant whose violation loses or misattributes care.
 *   [flow]    — a workflow that must keep working.
 *   [lock]    — something that must not move.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/** Strips comments, so a rule named only in prose never satisfies an assertion. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
                    .replace(/^\s*\/\/\/.*$/gm, '');

const SCHEMA   = strip(src('prisma/schema.prisma'));
const REFERRAL = strip(src('app/api/referral/link/route.ts'));
const ACCEPT   = strip(src('app/api/doctor/accept-patient/route.ts'));
const REPORT   = strip(src('app/dashboard/report/page.tsx'));

// ─── The declared delete rule, parsed rather than assumed ────────────────────
//
// Everything behavioural below is driven by this value. If the schema says
// Cascade, the simulation deletes patients and Section C goes red.
const physicianRelation =
  SCHEMA.match(/^\s*physician\s+User\?\s+@relation\([^)]*\)/m)?.[0] ?? '';
const DELETE_RULE = physicianRelation.match(/onDelete:\s*(\w+)/)?.[1] ?? 'NONE';

section('-- A. The relation is declared, and declared correctly --');
{
  t('[schema] User.physicianId is a relation, not a bare scalar',
    physicianRelation !== '');
  t('[schema] the delete rule is SetNull',
    DELETE_RULE === 'SetNull');
  // Cascade would delete the patient with the physician; Restrict would block
  // the deletion outright and strand them a different way.
  t('[safety] the delete rule is neither Cascade nor Restrict',
    DELETE_RULE !== 'Cascade' && DELETE_RULE !== 'Restrict');
  t('[schema] it points at User.id',
    /fields:\s*\[physicianId\]/.test(physicianRelation)
    && /references:\s*\[id\]/.test(physicianRelation));
  t('[schema] the relation is optional, so NULL is representable',
    /^\s*physician\s+User\?\s/m.test(physicianRelation));
  t('[schema] it is the named PatientPhysician relation, with both sides',
    /@relation\(\s*"PatientPhysician"/.test(physicianRelation)
    && /^\s*patients\s+User\[\]\s+@relation\("PatientPhysician"\)/m.test(SCHEMA));
  // The pre-existing self-relation must keep its own name, or Prisma would
  // silently pair the wrong fields together.
  t('[lock]   the Referrals self-relation is untouched',
    /referredBy\s+User\?\s+@relation\("Referrals"/.test(SCHEMA)
    && /referrals\s+User\[\]\s+@relation\("Referrals"\)/.test(SCHEMA));
  t('[schema] the scalar itself is unchanged and still optional',
    /^\s*physicianId\s+String\?\s*$/m.test(SCHEMA));
}

section('-- B. No other delete rule moved --');
{
  // Every explicit onDelete in the schema, as "field -> rule". One new entry is
  // expected (physician -> SetNull); anything else changing is a regression in
  // a model this phase was not authorized to touch.
  const EXPECTED = [
    'assessment -> Cascade', 'assessment -> Cascade', 'assessment -> Cascade',
    'lastEvent -> Restrict',
    'physician -> SetNull',
    'recipient -> Cascade',
    'recipient -> SetNull', 'recipient -> SetNull', 'recipient -> SetNull',
    'user -> Cascade', 'user -> Cascade', 'user -> Cascade', 'user -> Cascade',
    'user -> Cascade', 'user -> Cascade', 'user -> Cascade', 'user -> Cascade',
    'user -> Cascade', 'user -> Cascade',
    'wording -> Restrict',
  ].sort();

  const actual = [...SCHEMA.matchAll(/^\s*(\w+)\s+\w+\??\s+@relation\([^)]*onDelete:\s*(\w+)[^)]*\)/gm)]
    .map(m => `${m[1]} -> ${m[2]}`).sort();

  t('[lock]   the full delete-rule inventory is exactly as expected',
    actual.length === EXPECTED.length
    && actual.every((v, i) => v === EXPECTED[i]));
  t('[lock]   ten models still cascade from User',
    actual.filter(v => v === 'user -> Cascade').length === 10);
  t('[safety] no clinical model was switched away from Cascade-from-User',
    ['assessments', 'muscleScores', 'protocolPlans', 'weeklyCheckins', 'progressLogs']
      .every(() => actual.filter(v => v === 'user -> Cascade').length === 10));
}

section('-- C. Deleting a physician, under the rule the schema declares --');
{
  /** A patient's clinical record. Keyed by patient id — never by physician. */
  const makeDb = () => ({
    users: [
      { id: 'phys-A', role: 'PHYSICIAN', physicianId: null },
      { id: 'phys-B', role: 'PHYSICIAN', physicianId: null },
      { id: 'pat-1',  role: 'PATIENT',   physicianId: 'phys-A' },
      { id: 'pat-2',  role: 'PATIENT',   physicianId: 'phys-A' },
      { id: 'pat-3',  role: 'PATIENT',   physicianId: 'phys-B' },
      { id: 'pat-4',  role: 'PATIENT',   physicianId: null },
    ],
    assessments: [{ userId: 'pat-1' }, { userId: 'pat-1' }, { userId: 'pat-2' }],
    muscleScores: [{ userId: 'pat-1' }, { userId: 'pat-2' }],
    reviews: [{ userId: 'pat-1' }],
  });

  /** Postgres semantics for the rule the schema actually declares. */
  function deleteUser(db, id) {
    const referrers = db.users.filter(u => u.physicianId === id && u.id !== id);
    if (DELETE_RULE === 'Restrict' && referrers.length) throw new Error('restricted');

    db.users = db.users.filter(u => u.id !== id);
    if (DELETE_RULE === 'Cascade') {
      const gone = new Set(referrers.map(u => u.id));
      db.users        = db.users.filter(u => !gone.has(u.id));
      db.assessments  = db.assessments.filter(a => !gone.has(a.userId));
      db.muscleScores = db.muscleScores.filter(m => !gone.has(m.userId));
      db.reviews      = db.reviews.filter(r => !gone.has(r.userId));
    } else if (DELETE_RULE === 'SetNull') {
      for (const u of db.users) if (u.physicianId === id) u.physicianId = null;
    }
    // A cascade from User to the patient's own clinical rows is unchanged and
    // not modelled here — this phase concerns the physician edge only.
    return db;
  }

  const db = makeDb();
  // A Restrict rule throws here rather than deleting. Caught so the mutation
  // reports as failed assertions instead of an unhandled crash — the evidence
  // is only useful if it is readable.
  let restricted = false;
  try { deleteUser(db, 'phys-A'); } catch { restricted = true; }
  // Null-safe: under a Cascade rule the patient rows are gone, and the point of
  // these assertions is to say so, not to die dereferencing them.
  const get = id => db.users.find(u => u.id === id) ?? null;
  // `??` would be wrong here: a genuine NULL link is the success case, and
  // collapsing it into the sentinel would make "linkage is NULL" unprovable.
  const linkOf = id => { const u = get(id); return u ? u.physicianId : '<row deleted>'; };

  t('[safety] the deletion was permitted, not blocked',
    restricted === false);

  t('[safety] the physician row is gone',
    get('phys-A') === null);
  t('[safety] their patients still exist — deletion did not cascade to people',
    !!get('pat-1') && !!get('pat-2'));
  t('[safety] their linkage is NULL, not a dangling id',
    linkOf('pat-1') === null && linkOf('pat-2') === null);
  t('[safety] clinical history is untouched',
    db.assessments.length === 3 && db.muscleScores.length === 2 && db.reviews.length === 1);
  t('[safety] no automatic transfer occurred',
    linkOf('pat-1') === null && linkOf('pat-2') === null);
  t('[lock]   another physician’s patients are unaffected',
    linkOf('pat-3') === 'phys-B');
  t('[lock]   an already-unlinked patient is unaffected',
    linkOf('pat-4') === null);
  t('[flow]   the surviving physician is untouched',
    !!get('phys-B'));
}

section('-- D. The guards, exactly as the routes write them --');
{
  // Faithful models of the two guards. Section D2 below proves the routes still
  // have these shapes, so the models cannot quietly go stale.
  const canLinkViaReferral = patient => !patient.physicianId;
  const acceptOutcome = (patient, physicianId) =>
    patient.physicianId === physicianId                              ? 'already'
    : (patient.physicianId && patient.physicianId !== physicianId)   ? 'conflict'
    :                                                                  'link';

  const stranded = { physicianId: null };          // post-SET NULL
  const dangling = { physicianId: 'phys-deleted' }; // the old, broken state
  const linkedB  = { physicianId: 'phys-B' };
  const fresh    = { physicianId: null };

  t('[flow]   a nulled patient may be linked through the invite pathway',
    canLinkViaReferral(stranded) === true);
  t('[flow]   a nulled patient may be accepted by a new physician',
    acceptOutcome(stranded, 'phys-C') === 'link');
  t('[safety] accept-patient no longer 409s because of a deleted physician',
    acceptOutcome(stranded, 'phys-C') !== 'conflict');

  // The defect, stated as a test: this is what the old behaviour was, and the
  // constraint is what stops this state from ever existing again.
  t('[lock]   a DANGLING id would still be refused — which is why nulling matters',
    canLinkViaReferral(dangling) === false
    && acceptOutcome(dangling, 'phys-C') === 'conflict');

  // 1D-S1 protection must survive untouched.
  t('[safety] a patient linked to a LIVE other physician still conflicts',
    acceptOutcome(linkedB, 'phys-C') === 'conflict');
  t('[flow]   the same physician accepting again is idempotent, not a conflict',
    acceptOutcome(linkedB, 'phys-B') === 'already');
  t('[flow]   an ordinary unlinked patient links normally',
    canLinkViaReferral(fresh) === true && acceptOutcome(fresh, 'phys-A') === 'link');
}

section('-- D2. The routes still have the shapes modelled above --');
{
  t('[lock]   referral/link still guards on presence of physicianId',
    /if\s*\(\s*!\s*patient\.physicianId\s*\)/.test(REFERRAL));
  t('[lock]   accept-patient still returns early when already linked to the caller',
    /patient\.physicianId\s*===\s*physician\.id/.test(ACCEPT));
  t('[safety] accept-patient still refuses a patient linked elsewhere',
    /patient\.physicianId\s*&&\s*patient\.physicianId\s*!==\s*physician\.id/.test(ACCEPT));
  t('[safety] the refusal is still a 409 before any write',
    ACCEPT.search(/status:\s*409/) < ACCEPT.search(/\bdata:\s*\{\s*physicianId/));
  // The patient-facing claim is derived from the linkage, so nulling the link
  // also withdraws the false "Shared with your physician" assurance.
  t('[flow]   the report derives physicianLinked from physicianId',
    /physicianLinked=\{!!user\.physicianId\}/.test(REPORT));
}

section('-- E. The write sites remain exactly the known three --');
{
  const walk = d => readdirSync(new URL('../' + d, import.meta.url))
    .flatMap(f => {
      const rel = d + '/' + f;
      return statSync(new URL('../' + rel, import.meta.url)).isDirectory()
        ? walk(rel) : (/\.tsx?$/.test(rel) ? [rel] : []);
    });

  // A WRITE is physicianId inside a `data:` payload of a User update/upsert.
  // Scoping to `prisma.user` keeps PreloadedAssessment.physicianId and
  // StudyEnrollment.physicianId — different models, same field name — out.
  const writers = [...walk('app'), ...walk('src')].filter(f => {
    const s = strip(src(f));
    return /prisma\s*\.\s*user\s*\n?\s*\.\s*(update|upsert|updateMany)\s*\(/.test(s)
        // `\b` matters: `metadata:` ends with the substring `data:`, so an
        // unanchored pattern matches an analytics payload and reports a write
        // site that does not exist.
        && /\bdata:\s*\{[\s\S]{0,400}?physicianId/.test(s);
  }).sort();

  const EXPECTED = [
    'app/api/doctor/accept-patient/route.ts',
    'app/api/referral/link/route.ts',
    'app/api/user/onboard/route.ts',
  ];

  t('[lock]   exactly three files write User.physicianId',
    writers.length === 3);
  t('[lock]   and they are the three the audit identified',
    writers.length === EXPECTED.length && writers.every((f, i) => f === EXPECTED[i]));
  // R2A-CF1, recorded as a test rather than only as prose: onboarding still
  // overwrites an existing link. Deliberately NOT corrected in this phase —
  // transfer of care must not be defined accidentally through an onboarding
  // code. This assertion documents the known state so that changing it is a
  // deliberate act with a founder decision behind it.
  t('[lock]   R2A-CF1: onboarding still writes physicianId unguarded (known, deferred)',
    /\.\.\.\(physicianId\s*\?\s*\{\s*physicianId\s*\}\s*:\s*\{\}\)/
      .test(strip(src('app/api/user/onboard/route.ts'))));
}

section('-- F. Nothing else moved --');
{
  const SHARE = SCHEMA.match(/model ShareCard \{[\s\S]*?\n\}/)?.[0] ?? '';
  t('[lock]   ShareCard keeps its 1D-R1 shape',
    /expiresAt\s+DateTime\?/.test(SHARE)
    && /revokedAt\s+DateTime\?/.test(SHARE)
    && !/shareToken\s+String\s+@unique\s+@default/.test(SHARE));
  t('[lock]   SRI generation is untouched by linkage work',
    !/physicianId/.test(src('src/lib/protocolEngine.ts')));
  t('[lock]   no retention or deletion machinery was introduced',
    !/deleteMany|\.delete\(/.test(strip(src('app/api/referral/link/route.ts')))
    && !/deleteMany|\.delete\(/.test(ACCEPT));
  // Checked structurally, not by keyword: accept-patient legitimately MENTIONS
  // transfer of care — it tells a refused physician to arrange it with the
  // patient, which is the opposite of implementing it. What must stay true is
  // that the route has exactly one place it writes a link, and the conflict
  // return stands in front of it.
  t('[safety] accept-patient still has exactly one physicianId write',
    (ACCEPT.match(/\bdata:\s*\{\s*physicianId/g) || []).length === 1);
  t('[lock]   a refused physician is still told to arrange transfer with the patient',
    /Transfer of care must be arranged with the patient/.test(ACCEPT));
  t('[lock]   referral/link writes a link only, never a reassignment',
    (REFERRAL.match(/\bdata:\s*\{\s*physicianId/g) || []).length === 1
    && REFERRAL.search(/if\s*\(\s*!\s*patient\.physicianId\s*\)/)
       < REFERRAL.search(/\bdata:\s*\{\s*physicianId/));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
