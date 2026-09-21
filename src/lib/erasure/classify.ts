/**
 * src/lib/erasure/classify.ts
 *
 * DRY RUN ONLY. Reports what an erasure WOULD do for one subject.
 *
 * READ-ONLY BY CONSTRUCTION
 * Every Prisma call in this module is `count` or a `findUnique` with an
 * explicit `select`. There is no `update`, `delete`, `deleteMany`, `upsert` or
 * `create` anywhere in it, no provider call, no ShareCard revocation and no
 * suppression access — and the suite asserts that by scanning this file, so a
 * future edit that introduces a write turns the tests red rather than quietly
 * making the dry run wet.
 *
 * WHAT IT IS FOR
 * No executing erasure workflow is authorized. Before one can be, somebody has
 * to be able to answer "what would this actually touch?" for a real subject,
 * with numbers rather than a matrix on paper. That is all this does.
 *
 * WHAT IT DELIBERATELY DOES NOT COUNT
 * `StartSheetProtocol`, `PreloadedAssessment` and `PhysicianApplication` are
 * reachable only by plaintext email, and `PhysicianProfile` is not reachable
 * from a User at all (R2-CF2). Those are reported as linkage-deferred rather
 * than counted, so the report never implies a precision the data model cannot
 * support.
 */

import { prisma } from '@/src/lib/prisma';
import {
  ERASURE_DISPOSITION,
  TREATMENTS,
  type Treatment,
} from './disposition';

export interface ModelFinding {
  model:     string;
  treatment: Treatment;
  /** Rows found for this subject, or null when linkage is deferred. */
  rows:      number | null;
  /** Set when `rows` is null — why the count could not be taken. */
  deferred?: string;
}

export interface ErasureDryRun {
  /** Internal User.id. Never a Clerk id, never an address. */
  subjectId:    string;
  subjectFound: boolean;
  /** Whether this subject is already in the terminal anonymized state. */
  alreadyErased: boolean;
  totalsByTreatment: Record<Treatment, number>;
  findings:     ModelFinding[];
  /** Models whose rows cannot be enumerated in this phase. */
  linkageDeferred: string[];
}

/**
 * Models this dry run does not enumerate, and why.
 *
 * The first four are reachable only by plaintext email, or — for
 * `PhysicianProfile` — not reachable from a User at all (R2-CF2).
 *
 * The communications models are deferred for a different and more important
 * reason: that layer enforces its own zero-touch consumer lock, and an erasure
 * dry run must not become an unauthorised consumer of it. Their dispositions
 * are settled in the matrix (recipient and preference deleted, suppression and
 * the consent ledger retained pseudonymously); enumerating them belongs to the
 * communications-governed path, not here.
 */
const LINKAGE_DEFERRED: Readonly<Record<string, string>> = {
  StartSheetProtocol:     'reachable only by plaintext patientEmail — CF-gated',
  PreloadedAssessment:    'reachable only by plaintext patientEmail — CF-gated',
  PhysicianApplication:   'reachable only by plaintext email — counsel Q6',
  PhysicianProfile:       'no userId column; reachable only via referralSlug — R2-CF2',
  CommunicationRecipient: 'communications governance owns its own consumers',
  CommunicationEvent:     'communications governance owns its own consumers',
};

/**
 * Counts, per model, what an erasure of `subjectId` would act on.
 *
 * Writes nothing. Calling it has no effect on any row.
 */
export async function classifyErasure(subjectId: string): Promise<ErasureDryRun> {
  const subject = await prisma.user.findUnique({
    where:  { id: subjectId },
    select: { id: true, erasedAt: true },
  });

  const findings: ModelFinding[] = [];
  const add = (model: string, rows: number | null, deferred?: string) =>
    findings.push({ model, treatment: ERASURE_DISPOSITION[model].treatment, rows, deferred });

  if (subject) {
    // The identity row itself — one row, anonymized in place, never deleted.
    add('User', 1);

    // Models keyed directly by the subject's User.id.
    const byUserId: Array<[string, () => Promise<number>]> = [
      ['UserProfile',            () => prisma.userProfile.count({ where: { userId: subjectId } })],
      ['Assessment',             () => prisma.assessment.count({ where: { userId: subjectId } })],
      ['MuscleScore',            () => prisma.muscleScore.count({ where: { userId: subjectId } })],
      ['ProtocolPlan',           () => prisma.protocolPlan.count({ where: { userId: subjectId } })],
      ['ProgressLog',            () => prisma.progressLog.count({ where: { userId: subjectId } })],
      ['WeeklyCheckin',          () => prisma.weeklyCheckin.count({ where: { userId: subjectId } })],
      ['PhysicianReview',        () => prisma.physicianReview.count({ where: { userId: subjectId } })],
      ['Notification',           () => prisma.notification.count({ where: { userId: subjectId } })],
      ['ShareCard',              () => prisma.shareCard.count({ where: { userId: subjectId } })],
      ['PhysicianOnboarding',    () => prisma.physicianOnboarding.count({ where: { userId: subjectId } })],
      ['AnalyticsEvent',         () => prisma.analyticsEvent.count({ where: { userId: subjectId } })],
    ];
    for (const [model, count] of byUserId) add(model, await count());

    // Models keyed by the subject under a different column name.
    add('PhysicianPatientInvitation',
      await prisma.physicianPatientInvitation.count({ where: { patientUserId: subjectId } }));
    add('PhysicianReviewSession',
      await prisma.physicianReviewSession.count({ where: { patientId: subjectId } }));
    // Audit evidence becomes pseudonymous when the User row is anonymized, so
    // this is reported for visibility, not because anything acts on it.
    add('AuditLog',
      await prisma.auditLog.count({ where: { actorId: subjectId } }));
  }

  for (const [model, why] of Object.entries(LINKAGE_DEFERRED)) add(model, null, why);

  // Models with no per-subject rows: dormant research, pseudonymous ledgers
  // and wording. Listed with a zero so the report covers every model rather
  // than silently omitting the ones nothing happens to.
  for (const [model, d] of Object.entries(ERASURE_DISPOSITION)) {
    if (findings.some(f => f.model === model)) continue;
    add(model, d.subjectKey === null ? 0 : 0);
  }

  const totalsByTreatment = Object.fromEntries(
    TREATMENTS.map(t => [t, findings
      .filter(f => f.treatment === t)
      .reduce((n, f) => n + (f.rows ?? 0), 0)]),
  ) as Record<Treatment, number>;

  return {
    subjectId,
    subjectFound:  !!subject,
    alreadyErased: !!subject?.erasedAt,
    totalsByTreatment,
    findings:      findings.sort((a, b) => a.model.localeCompare(b.model)),
    linkageDeferred: Object.keys(LINKAGE_DEFERRED).sort(),
  };
}
