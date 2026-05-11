/**
 * src/lib/research/cohort.ts
 *
 * Application-layer guards and cohort query helpers for the MyoGuard Protocol
 * observational study infrastructure.
 *
 * LAYER: Observational Research Infrastructure (not CDS, not export).
 * This module has no UI surface, no API routes, and no PostHog calls.
 *
 * Three guard functions implement the mandatory pre-write verification rules:
 *   createStudy             — physician role + actor identity check
 *   createStudyEnrollment   — consent version, researchConsent, role checks
 *   createAssessmentSnapshotNonBlocking — fire-and-forget, never interrupts clinical flow
 *
 * All cohort query functions return researchParticipantId as the patient identifier.
 * patientId is never included in query results intended for research consumers.
 *
 * sriScore is exposed internally as sri_value_internal in SriTimepoint objects.
 * This name is normative — rename it and the export pipeline breaks.
 */

import { prisma } from '../prisma';
import {
  Prisma,
  EnrollmentStatus,
  StudyStatus,
  StudyEventType,
  RiskBand,
} from '@prisma/client';
import type {
  Study,
  StudyEnrollment,
  StudyConsent,
  StudyEventLog,
} from '@prisma/client';

// Minimum patient consent version required for study enrollment.
// null User.consentVersion is treated as "0.0" per governance decision —
// these users are prompted to re-consent but are not blocked from clinical use.
const MIN_CONSENT_VERSION = '1.0';

// Compares dot-separated semantic version strings.
// Returns negative if a < b, zero if equal, positive if a > b.
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateStudyInput {
  title: string;
  /** URL-safe unique identifier, e.g. "glp1-sarcopenia-2026". */
  slug: string;
  description?: string;
  /** User.id of the creating physician. Never clerkId, referralSlug, or referralCode. */
  createdById: string;
}

export interface CreateEnrollmentInput {
  studyId: string;
  /** User.id of the patient. Never clerkId or email. */
  patientId: string;
  /** User.id of the responsible physician. Never clerkId or referralCode. */
  physicianId: string;
  cohortLabel?: string;
  /** Semantic version of the consent text the patient is agreeing to, e.g. "1.0". */
  consentVersion: string;
  /** Full verbatim consent text at the moment of signing. Immutable legal record. */
  consentTextSnapshot: string;
  /** Optional for consent provenance. Never included in research exports. */
  ipAddress?: string;
}

export interface SnapshotInput {
  /** Assessment.id of the clinical record that just completed. */
  assessmentId: string;
  /** User.id of the patient whose Assessment was just persisted. */
  patientId: string;
}

export interface StudyEventInput {
  studyId: string;
  enrollmentId?: string;
  /** Internal patient identifier — never included in research exports. */
  patientId?: string;
  eventType: StudyEventType;
  /**
   * Structured payload — no PHI. Key naming rules:
   *   "sri_band" not "score"
   *   "sri_value_internal" not "sriScore"
   *   "generated" not "calculated"
   */
  eventData?: Record<string, unknown>;
  /** User.id of the recording actor (physician or system). Never clerkId. */
  recordedBy: string;
}

// ─── Query Result Types ───────────────────────────────────────────────────────

export interface CohortSummary {
  studyId: string;
  totalEnrolled: number;
  activeCount: number;
  withdrawnCount: number;
  completedCount: number;
  snapshotCount: number;
}

/**
 * A single longitudinal timepoint for one enrollment.
 * sri_value_internal is the mandatory export label for the internal SRI score.
 * This field must never be renamed to "sriScore" or "score" in any consumer.
 */
export interface SriTimepoint {
  timepoint: number;
  snapshotDate: Date;
  sri_band: RiskBand;
  /** Internal SRI numeric output. Label is normative — see module docstring. */
  sri_value_internal: number;
  proteinTargetG: number;
  hydrationTargetL: number;
  activityStatus: string;
  /** Structured symptom codes. No free-text PHI. */
  symptoms: unknown;
  weightKg: number;
  glp1Stage: string | null;
  gripStrengthKg: number | null;
  sleepQuality: number | null;
  giTolerance: string | null;
  /** Days since previous snapshot. Null for the first timepoint. */
  intervalDays: number | null;
}

/**
 * A de-identified enrollment segment returned by cohort query functions.
 * patientId is never present — researchParticipantId is the sole patient identifier.
 */
export interface EnrollmentSegment {
  enrollmentId: string;
  researchParticipantId: string;
  cohortLabel: string | null;
  enrolledAt: Date;
  latestSriBand: RiskBand | null;
  snapshotCount: number;
}

// ─── Application-Layer Guards ─────────────────────────────────────────────────

/**
 * Creates a Study after verifying the actor is an approved PHYSICIAN.
 *
 * Guards enforced:
 *   (a) actorId must equal createdById — prevents impersonation.
 *   (b) User must exist.
 *   (c) User.role must be PHYSICIAN — PHYSICIAN_PENDING, PATIENT, and ADMIN are rejected.
 *
 * Study is created in DRAFT status. Transition to ACTIVE requires explicit update.
 */
export async function createStudy(
  input: CreateStudyInput,
  actorId: string
): Promise<Study> {
  if (actorId !== input.createdById) {
    throw new Error('[research] actorId must equal createdById to prevent impersonation');
  }

  const actor = await prisma.user.findUnique({ where: { id: input.createdById } });
  if (!actor) {
    throw new Error(`[research] Study creator not found: ${input.createdById}`);
  }
  if (actor.role !== 'PHYSICIAN') {
    throw new Error(
      `[research] Only PHYSICIAN role may create a Study. Actor role: ${actor.role}`
    );
  }

  return prisma.study.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description,
      status: StudyStatus.DRAFT,
      createdById: input.createdById,
    },
  });
}

/**
 * Enrolls a patient in a study after verifying all governance prerequisites.
 *
 * Guards enforced:
 *   (a) actorId must equal physicianId.
 *   (b) Study must exist and be ACTIVE.
 *   (c) Patient must exist and have researchConsent = true.
 *   (d) Patient consentVersion must meet MIN_CONSENT_VERSION ("1.0").
 *       null consentVersion is treated as "0.0" — patient will be rejected
 *       and must re-consent. Clinical access is unaffected.
 *   (e) Physician must exist with role = PHYSICIAN.
 *
 * On success: creates StudyEnrollment + initial StudyConsent in a single transaction.
 * Stamps consentedAt on the enrollment at the moment of first consent creation.
 */
export async function createStudyEnrollment(
  input: CreateEnrollmentInput,
  actorId: string
): Promise<StudyEnrollment> {
  if (actorId !== input.physicianId) {
    throw new Error('[research] actorId must equal physicianId to prevent impersonation');
  }

  const [study, patient, physician] = await Promise.all([
    prisma.study.findUnique({ where: { id: input.studyId } }),
    prisma.user.findUnique({ where: { id: input.patientId } }),
    prisma.user.findUnique({ where: { id: input.physicianId } }),
  ]);

  if (!study) {
    throw new Error(`[research] Study not found: ${input.studyId}`);
  }
  if (study.status !== StudyStatus.ACTIVE) {
    throw new Error(`[research] Study is not ACTIVE (current status: ${study.status})`);
  }

  if (!patient) {
    throw new Error(`[research] Patient not found: ${input.patientId}`);
  }
  if (!patient.researchConsent) {
    throw new Error(
      '[research] Patient has not given general research consent (User.researchConsent = false). ' +
        'Patient must opt in before study enrollment.'
    );
  }

  // null consentVersion is treated as "0.0" — below the minimum threshold.
  const effectiveVersion = patient.consentVersion ?? '0.0';
  if (compareVersions(effectiveVersion, MIN_CONSENT_VERSION) < 0) {
    throw new Error(
      `[research] Patient consent version "${effectiveVersion}" is below the minimum ` +
        `required version "${MIN_CONSENT_VERSION}". Patient must re-consent before enrollment. ` +
        'Clinical access is unaffected.'
    );
  }

  if (!physician) {
    throw new Error(`[research] Physician not found: ${input.physicianId}`);
  }
  if (physician.role !== 'PHYSICIAN') {
    throw new Error(
      `[research] Enrolling actor must have PHYSICIAN role (current: ${physician.role})`
    );
  }

  const now = new Date();

  return prisma.studyEnrollment.create({
    data: {
      studyId: input.studyId,
      patientId: input.patientId,
      physicianId: input.physicianId,
      cohortLabel: input.cohortLabel,
      status: EnrollmentStatus.ACTIVE,
      consentedAt: now,
      consents: {
        create: {
          consentVersion: input.consentVersion,
          consentTextSnapshot: input.consentTextSnapshot,
          ipAddress: input.ipAddress,
          signedAt: now,
        },
      },
    },
  });
}

/**
 * Non-blocking AssessmentSnapshot creation trigger.
 *
 * CRITICAL: This function is intentionally NOT async and returns void immediately.
 * Call it immediately after an Assessment is persisted — do NOT await it.
 * The clinical Assessment always succeeds even if snapshot creation fails.
 *
 * Trigger conditions (all must be true to create a snapshot):
 *   (1) Patient has at least one ACTIVE StudyEnrollment.
 *   (2) That enrollment has at least one operative StudyConsent.
 *   (3) No existing snapshot exists for the (assessmentId, enrollmentId) pair.
 *
 * If the patient has multiple ACTIVE enrollments (multi-study), a snapshot is
 * attempted for each consented enrollment independently.
 *
 * Failure handling: all errors are caught, logged with structured context,
 * and swallowed. The clinical workflow is never interrupted.
 *
 * Unique constraint violations (duplicate snapshot attempts) are silently
 * swallowed — they indicate a safe retry scenario, not a data error.
 *
 * Usage in Assessment creation route:
 *   await prisma.assessment.create({ ... });           // await this
 *   createAssessmentSnapshotNonBlocking({ assessmentId, patientId }); // NO await
 */
export function createAssessmentSnapshotNonBlocking(input: SnapshotInput): void {
  (async () => {
    try {
      const activeEnrollments = await prisma.studyEnrollment.findMany({
        where: { patientId: input.patientId, status: EnrollmentStatus.ACTIVE },
        include: { consents: { orderBy: { signedAt: 'desc' }, take: 1 } },
      });

      const consentedEnrollments = activeEnrollments.filter(
        (e) => e.consents.length > 0
      );

      if (consentedEnrollments.length === 0) return;

      // Batch-fetch all related records. MuscleScore and ProtocolPlan may not exist
      // yet if the snapshot fires before those records are created — fallback values
      // are used in that case (clinical Assessment fields are always present).
      const [assessment, muscleScore, protocolPlan, userProfile] = await Promise.all([
        prisma.assessment.findUnique({ where: { id: input.assessmentId } }),
        prisma.muscleScore.findUnique({ where: { assessmentId: input.assessmentId } }),
        prisma.protocolPlan.findUnique({ where: { assessmentId: input.assessmentId } }),
        prisma.userProfile.findUnique({ where: { userId: input.patientId } }),
      ]);

      if (!assessment) {
        console.error('[research:snapshot] Assessment not found — skipping snapshot:', {
          assessmentId: input.assessmentId,
        });
        return;
      }

      for (const enrollment of consentedEnrollments) {
        // Idempotency guard: skip if a snapshot already exists for this pair.
        const exists = await prisma.assessmentSnapshot.findUnique({
          where: {
            assessmentId_enrollmentId: {
              assessmentId: input.assessmentId,
              enrollmentId: enrollment.id,
            },
          },
        });
        if (exists) continue;

        await prisma.assessmentSnapshot.create({
          data: {
            assessmentId: input.assessmentId,
            enrollmentId: enrollment.id,
            sriBand: assessment.riskBand,
            // sriScore is stored internally; never surfaced in UI or PostHog.
            // Export consumers must use the column label "sri_value_internal".
            sriScore: assessment.score,
            proteinTargetG: muscleScore?.proteinTargetG ?? assessment.proteinGrams,
            hydrationTargetL: protocolPlan?.hydrationTarget ?? assessment.hydrationLitres,
            // activityLevel enum stored as String to preserve historical value
            // if the ActivityLevel enum is extended or renamed in future schema revisions.
            activityStatus: userProfile?.activityLevel ?? 'SEDENTARY',
            symptoms: assessment.symptoms,
            giTolerance: muscleScore?.giSeverity ?? null,
            sleepQuality: assessment.sleepQuality ?? null,
            gripStrengthKg: assessment.gripStrengthKg ?? null,
            glp1Stage: assessment.glp1Stage ?? null,
            weightKg: assessment.weightKg,
          },
        });
      }
    } catch (err) {
      // Log with structured context so failures are findable in Vercel logs.
      // Never rethrow — the Assessment is already persisted and the clinical
      // workflow must not be interrupted.
      console.error(
        '[research:snapshot] Snapshot creation failed — clinical workflow unaffected:',
        {
          assessmentId: input.assessmentId,
          error: err instanceof Error ? err.message : String(err),
        }
      );
    }
  })();
  // Returns synchronously. Caller must not await this function.
}

/**
 * Records a structured research workflow event in StudyEventLog.
 * eventData must not contain PHI. Use "sri_value_internal" not "sriScore".
 * This log is append-only by convention — never update or delete entries.
 */
export async function recordStudyEvent(input: StudyEventInput): Promise<StudyEventLog> {
  return prisma.studyEventLog.create({
    data: {
      studyId: input.studyId,
      enrollmentId: input.enrollmentId ?? null,
      patientId: input.patientId ?? null,
      eventType: input.eventType,
      eventData: input.eventData as Prisma.InputJsonValue | undefined,
      recordedBy: input.recordedBy,
    },
  });
}

// ─── Cohort Query Helpers ─────────────────────────────────────────────────────
// All query results use researchParticipantId as the patient identifier.
// patientId from StudyEnrollment is deliberately excluded from returned objects.

/** Returns the ACTIVE enrollment for a patient in a specific study, or null. */
export async function getActiveEnrollmentForPatient(
  patientId: string,
  studyId: string
): Promise<StudyEnrollment | null> {
  return prisma.studyEnrollment.findFirst({
    where: { patientId, studyId, status: EnrollmentStatus.ACTIVE },
  });
}

/** Returns the most recent operative consent for an enrollment, or null. */
export async function getOperativeConsent(
  enrollmentId: string
): Promise<StudyConsent | null> {
  return prisma.studyConsent.findFirst({
    where: { enrollmentId },
    orderBy: { signedAt: 'desc' },
  });
}

/**
 * Returns aggregate enrollment counts and snapshot totals for a study.
 * Intended for physician-facing research dashboard summaries.
 */
export async function getStudyCohortSummary(studyId: string): Promise<CohortSummary> {
  const [enrollmentGroups, snapshotCount] = await Promise.all([
    prisma.studyEnrollment.groupBy({
      by: ['status'],
      where: { studyId },
      _count: { _all: true },
    }),
    prisma.assessmentSnapshot.count({
      where: { enrollment: { studyId } },
    }),
  ]);

  const countByStatus: Record<string, number> = {};
  for (const g of enrollmentGroups) {
    countByStatus[g.status] = g._count._all;
  }

  return {
    studyId,
    totalEnrolled:
      (countByStatus['ACTIVE'] ?? 0) +
      (countByStatus['WITHDRAWN'] ?? 0) +
      (countByStatus['COMPLETED'] ?? 0),
    activeCount: countByStatus['ACTIVE'] ?? 0,
    withdrawnCount: countByStatus['WITHDRAWN'] ?? 0,
    completedCount: countByStatus['COMPLETED'] ?? 0,
    snapshotCount,
  };
}

/**
 * Returns all ACTIVE enrollments in a study where the most recent snapshot
 * matches the given GLP-1 stage string.
 *
 * Enrollments with no snapshots are excluded (no stage data available).
 * Results contain researchParticipantId — never patientId.
 */
export async function getEnrollmentsByGlp1Stage(
  studyId: string,
  stage: string
): Promise<EnrollmentSegment[]> {
  const enrollments = await prisma.studyEnrollment.findMany({
    where: { studyId, status: EnrollmentStatus.ACTIVE },
    include: { snapshots: { orderBy: { snapshotDate: 'desc' } } },
  });

  return enrollments
    .filter((e) => e.snapshots[0]?.glp1Stage === stage)
    .map((e) => ({
      enrollmentId: e.id,
      researchParticipantId: e.researchParticipantId,
      cohortLabel: e.cohortLabel,
      enrolledAt: e.enrolledAt,
      latestSriBand: e.snapshots[0]?.sriBand ?? null,
      snapshotCount: e.snapshots.length,
    }));
}

/**
 * Returns all ACTIVE enrollments in a study within a given patient age band.
 *
 * Age is looked up from UserProfile via a separate batch query — plain scalar
 * strategy on patientId means Prisma cannot JOIN directly. patientId is used
 * only internally for the lookup and is never included in returned objects.
 *
 * Enrollments for patients with no UserProfile are excluded.
 */
export async function getEnrollmentsByAgeBand(
  studyId: string,
  minAge: number,
  maxAge: number
): Promise<EnrollmentSegment[]> {
  const enrollments = await prisma.studyEnrollment.findMany({
    where: { studyId, status: EnrollmentStatus.ACTIVE },
    include: { snapshots: { orderBy: { snapshotDate: 'desc' } } },
  });

  const patientIds = enrollments.map((e) => e.patientId);

  const profiles = await prisma.userProfile.findMany({
    where: { userId: { in: patientIds } },
    select: { userId: true, age: true },
  });

  const ageMap = new Map(profiles.map((p) => [p.userId, p.age]));

  return enrollments
    .filter((e) => {
      const age = ageMap.get(e.patientId);
      return age !== undefined && age >= minAge && age <= maxAge;
    })
    .map((e) => ({
      enrollmentId: e.id,
      researchParticipantId: e.researchParticipantId,
      cohortLabel: e.cohortLabel,
      enrolledAt: e.enrolledAt,
      latestSriBand: e.snapshots[0]?.sriBand ?? null,
      snapshotCount: e.snapshots.length,
    }));
}

/**
 * Returns the full longitudinal SRI trajectory for a single enrollment.
 * Ordered ascending by snapshotDate (timepoint 1 = earliest assessment).
 *
 * sriScore is returned as sri_value_internal — this name is normative.
 * This function is for research analysis only. Never call from patient UI routes.
 * intervalDays is null for the first timepoint; days-between-snapshots thereafter.
 */
export async function getSriTrajectory(enrollmentId: string): Promise<SriTimepoint[]> {
  const snapshots = await prisma.assessmentSnapshot.findMany({
    where: { enrollmentId },
    orderBy: { snapshotDate: 'asc' },
  });

  return snapshots.map((s, i) => {
    const prev = snapshots[i - 1];
    const intervalDays =
      prev !== undefined
        ? Math.round(
            (s.snapshotDate.getTime() - prev.snapshotDate.getTime()) / 86_400_000
          )
        : null;

    return {
      timepoint: i + 1,
      snapshotDate: s.snapshotDate,
      sri_band: s.sriBand,
      sri_value_internal: s.sriScore,
      proteinTargetG: s.proteinTargetG,
      hydrationTargetL: s.hydrationTargetL,
      activityStatus: s.activityStatus,
      symptoms: s.symptoms,
      weightKg: s.weightKg,
      glp1Stage: s.glp1Stage,
      gripStrengthKg: s.gripStrengthKg,
      sleepQuality: s.sleepQuality,
      giTolerance: s.giTolerance,
      intervalDays,
    };
  });
}
