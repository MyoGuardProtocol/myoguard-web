/**
 * scripts/erasureFoundation.test.mjs
 *
 * Phase 1D-R2-I1 — the safe pre-counsel erasure foundation.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/erasureFoundation.test.mjs
 *
 * WHAT THIS PHASE IS, AND THEREFORE WHAT THE SUITE GUARDS
 * No executing erasure workflow is authorized. What exists is a marker field, a
 * prohibition, a declarative matrix, a read-only dry run and a vocabulary. So
 * the assertions are mostly of the form "this cannot happen yet" — and the one
 * that matters most is the delete prohibition, because `User` is the cascade
 * root for ten clinical models and a single `prisma.user.delete` would destroy
 * the longitudinal record this platform exists to keep.
 *
 * THE PROHIBITION IS SCOPED TO APPLICATION CODE
 * `app/` and `src/` only. `scripts/` is dev teardown and is deliberately out of
 * scope — seeding needs to be able to clean up after itself, and conflating the
 * two would either break seeding or weaken the lock.
 *
 *   [safety] — an invariant whose violation loses clinical data or identity.
 *   [schema] — the declared database state.
 *   [lock]   — something that must not move.
 *   [flow]   — a workflow that must keep working.
 *
 * Touches no database, contacts no provider, sends no email, and executes no
 * part of the erasure lifecycle.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import {
  ERASURE_DISPOSITION,
  ERASURE_LIFECYCLE,
  ERASURE_AUDIT_TARGET,
  ERASURE_REQUESTED,
  ERASURE_IDENTITY_VERIFIED,
  ERASURE_CLASSIFIED,
  ERASURE_PROVIDER_ACTIONED,
  ERASURE_COMPLETED,
  ERASURE_MANUAL_REVIEW,
  TREATMENTS,
  modelsByTreatment,
} from '../src/lib/erasure/disposition.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/^\s*\/\/\/.*$/gm, '')
                    .replace(/^\s*\/\/.*$/gm, '');

const SCHEMA   = strip(src('prisma/schema.prisma'));
const CLASSIFY = strip(src('src/lib/erasure/classify.ts'));

section('-- A. The erasure marker exists and is inert --');
{
  t('[schema] User.erasedAt is declared and nullable',
    /^\s*erasedAt\s+DateTime\?\s*$/m.test(SCHEMA));
  // Non-null or defaulted would assert something about every existing row.
  t('[safety] it carries no default, so existing rows mean "not erased"',
    !/^\s*erasedAt\s+DateTime\?\s*@default/m.test(SCHEMA));
  t('[schema] it sits on User, not on a clinical model',
    (SCHEMA.match(/model User \{[\s\S]*?\n\}/)?.[0] ?? '').includes('erasedAt')
    && (SCHEMA.match(/erasedAt/g) || []).length === 1);

  // R2-CF1: broad surface exclusion is explicitly NOT in this phase. Nothing
  // may read the field yet — a half-wired filter is worse than none, because
  // it implies coverage that does not exist.
  const readers = [...walk('app'), ...walk('src')]
    .filter(f => f !== 'src/lib/erasure/classify.ts' && /erasedAt/.test(strip(src(f))));
  t('[lock]   R2-CF1: no application surface filters on erasedAt yet',
    readers.length === 0);
  t('[flow]   the dry run may read it, since that is its whole job',
    /erasedAt:\s*true/.test(CLASSIFY));
}

section('-- B. User deletion is prohibited in application code --');
{
  const DELETE_CALL = /prisma\s*\.\s*user\s*\n?\s*\.\s*(delete|deleteMany)\s*\(/;
  const offenders = [...walk('app'), ...walk('src')]
    .filter(f => DELETE_CALL.test(strip(src(f))));

  t('[safety] no application file deletes a User',
    offenders.length === 0);
  // The cascade root is the reason. Ten models hang off it.
  t('[safety] ten clinical models still cascade from User, so a delete would take them',
    ([...SCHEMA.matchAll(/^\s*user\s+User\s+@relation\([^)]*onDelete:\s*Cascade[^)]*\)/gm)] || []).length === 10);
  t('[lock]   the prohibition is scoped to app/ and src/, leaving dev teardown alone',
    /deleteMany/.test(src('scripts/seed-clinical.ts')));
  // A transaction client would sidestep a `prisma.user` scan entirely.
  t('[safety] no transaction client deletes a User either',
    ![...walk('app'), ...walk('src')]
      .some(f => /tx\s*\.\s*user\s*\n?\s*\.\s*(delete|deleteMany)\s*\(/.test(strip(src(f)))));
}

section('-- C. The disposition matrix is complete and decided --');
{
  // Every model in the schema must appear. A model nobody classified is the
  // failure this assertion exists to catch.
  const schemaModels = [...SCHEMA.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m => m[1]).sort();
  const mapped = Object.keys(ERASURE_DISPOSITION).sort();

  t('[safety] every persistent model has a disposition',
    schemaModels.length === mapped.length
    && schemaModels.every((m, i) => m === mapped[i]));
  t('[lock]   32 models are classified',
    mapped.length === 32);
  t('[lock]   every treatment is one of the six approved values',
    Object.values(ERASURE_DISPOSITION).every(d => TREATMENTS.includes(d.treatment)));
  // Checked as "somebody wrote a sentence", not against a magic length — an
  // arbitrary threshold fails accurate short reasons and passes long stubs.
  t('[lock]   every disposition carries a written reason, not a stub',
    Object.values(ERASURE_DISPOSITION).every(d =>
      typeof d.reason === 'string' && d.reason.trim().includes(' ') && d.reason.trim().endsWith('.')));
  t('[lock]   no two models share a copy-pasted reason',
    new Set(Object.values(ERASURE_DISPOSITION).map(d => d.reason)).size === 32);

  // The decisions that must not drift.
  t('[safety] User is ANONYMIZE, never DELETE',
    ERASURE_DISPOSITION.User.treatment === 'ANONYMIZE');
  t('[safety] suppression tombstones survive',
    ERASURE_DISPOSITION.CommunicationSuppression.treatment === 'PSEUDONYMIZE_RETAIN');
  t('[safety] the consent ledger survives',
    ERASURE_DISPOSITION.CommunicationConsentEvent.treatment === 'PSEUDONYMIZE_RETAIN');
  t('[safety] ShareCard is deleted, so no bearer token outlives the subject',
    ERASURE_DISPOSITION.ShareCard.treatment === 'DELETE');
  t('[safety] all seven clinical models are RETAIN_FOR_DEFINED_PERIOD',
    ['Assessment','MuscleScore','ProtocolPlan','ProgressLog','WeeklyCheckin','UserProfile','PhysicianReview']
      .every(m => ERASURE_DISPOSITION[m].treatment === 'RETAIN_FOR_DEFINED_PERIOD'));
  t('[lock]   research stays dormant',
    ['Study','StudyEnrollment','StudyConsent','AssessmentSnapshot','StudyEventLog']
      .every(m => ERASURE_DISPOSITION[m].treatment === 'DORMANT_NO_ACTION'));
  t('[lock]   R2-CF2 is recorded against PhysicianProfile',
    ERASURE_DISPOSITION.PhysicianProfile.carryForward === 'R2-CF2');
  t('[flow]   grouping by treatment covers every model exactly once',
    Object.values(modelsByTreatment()).flat().length === 32);
}

section('-- D. The dry run is read-only by construction --');
{
  // The point of this section: a future edit that makes the dry run wet must
  // turn the suite red, not merely be discouraged by a comment.
  t('[safety] the classifier performs no write of any kind',
    !/\.\s*(update|updateMany|delete|deleteMany|upsert|create|createMany)\s*\(/.test(CLASSIFY));
  t('[safety] it only counts and reads',
    /\.count\(/.test(CLASSIFY) && /findUnique/.test(CLASSIFY));
  t('[safety] it calls no external provider',
    !/fetch\(|resend|stripe|clerkClient|axios/i.test(CLASSIFY));
  t('[safety] it does not touch suppression',
    !/communicationSuppression/i.test(CLASSIFY));
  t('[safety] it does not revoke ShareCards',
    !/revoke|revokedAt/i.test(CLASSIFY));
  t('[safety] it returns internal ids only — no address, no Clerk id',
    !/\bemail:\s*true/.test(CLASSIFY) && !/\bclerkId\b/.test(CLASSIFY));
  t('[lock]   no patient- or physician-facing route exposes it',
    ![...walk('app')].some(f => /classifyErasure/.test(strip(src(f)))));
  t('[flow]   models reachable only by plaintext email are deferred, not guessed',
    /LINKAGE_DEFERRED/.test(CLASSIFY)
    && /StartSheetProtocol/.test(CLASSIFY) && /PreloadedAssessment/.test(CLASSIFY));
  // The communications layer enforces a zero-touch consumer lock. The dry run
  // must not become an unauthorised consumer of it — those models are settled
  // in the matrix and enumerated by the communications-governed path instead.
  t('[safety] the dry run is not a consumer of the communications layer',
    !/prisma\.communication\w*\.\s*\w+\(/.test(CLASSIFY));
}

section('-- E. The erasure vocabulary is fixed before anything emits it --');
{
  t('[lock]   all six lifecycle actions are defined',
    ERASURE_LIFECYCLE.length === 6);
  t('[lock]   and carry their approved names',
    ERASURE_REQUESTED === 'ERASURE_REQUESTED'
    && ERASURE_IDENTITY_VERIFIED === 'ERASURE_IDENTITY_VERIFIED'
    && ERASURE_CLASSIFIED === 'ERASURE_CLASSIFIED'
    && ERASURE_PROVIDER_ACTIONED === 'ERASURE_PROVIDER_ACTIONED'
    && ERASURE_COMPLETED === 'ERASURE_COMPLETED'
    && ERASURE_MANUAL_REVIEW === 'ERASURE_MANUAL_REVIEW');
  // Identity verification before any mutation; classification before providers.
  t('[safety] verification precedes classification in the lifecycle order',
    ERASURE_LIFECYCLE.indexOf(ERASURE_IDENTITY_VERIFIED)
      < ERASURE_LIFECYCLE.indexOf(ERASURE_CLASSIFIED));
  t('[safety] classification precedes provider actions',
    ERASURE_LIFECYCLE.indexOf(ERASURE_CLASSIFIED)
      < ERASURE_LIFECYCLE.indexOf(ERASURE_PROVIDER_ACTIONED));
  t('[lock]   it records through the existing AuditLog, not a new table',
    ERASURE_AUDIT_TARGET === 'User'
    && !/model\s+ErasureRequest/.test(SCHEMA));
  // Nothing may emit these yet — the workflow is not authorized.
  t('[lock]   no code writes an ERASURE_* audit event yet',
    ![...walk('app'), ...walk('src')]
      .filter(f => f !== 'src/lib/erasure/disposition.ts')
      .some(f => /ERASURE_(REQUESTED|IDENTITY_VERIFIED|CLASSIFIED|PROVIDER_ACTIONED|COMPLETED|MANUAL_REVIEW)/
        .test(strip(src(f)))));
}

section('-- F. Nothing outside the authorized scope moved --');
{
  t('[lock]   R2A physician FK is still SetNull',
    /physician\s+User\?\s+@relation\("PatientPhysician"[^)]*onDelete:\s*SetNull\)/.test(SCHEMA));
  // The full delete-rule inventory: one addition to User (a plain column) must
  // not have disturbed any referential action anywhere.
  const rules = [...SCHEMA.matchAll(/^\s*(\w+)\s+\w+\??\s+@relation\([^)]*onDelete:\s*(\w+)[^)]*\)/gm)]
    .map(m => `${m[1]} -> ${m[2]}`).sort();
  t('[safety] the delete-rule inventory is unchanged at 20 declarations',
    rules.length === 20
    && rules.filter(r => r === 'user -> Cascade').length === 10
    && rules.filter(r => r === 'physician -> SetNull').length === 1);
  t('[lock]   no ErasureRequest or other new model was introduced',
    ([...SCHEMA.matchAll(/^model\s+\w+/gm)] || []).length === 32);
  t('[lock]   ShareCard keeps its 1D-R1 shape',
    /expiresAt\s+DateTime\?/.test(SCHEMA) && /revokedAt\s+DateTime\?/.test(SCHEMA));
  t('[lock]   SRI generation is untouched by erasure work',
    !/erasedAt|classifyErasure|ERASURE_/.test(src('src/lib/protocolEngine.ts')));
  t('[lock]   communications implementation is untouched by erasure work',
    !walk('src/lib/communications').some(f => /erasedAt|ERASURE_|classifyErasure/.test(src(f))));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/** Every .ts/.tsx under a directory, as repo-relative paths. */
function walk(d) {
  return readdirSync(new URL('../' + d, import.meta.url)).flatMap(f => {
    const rel = d + '/' + f;
    return statSync(new URL('../' + rel, import.meta.url)).isDirectory()
      ? walk(rel)
      : (/\.tsx?$/.test(rel) ? [rel] : []);
  });
}
