// MyoGuard Insights Layer — Research Insights
//
// Aggregates observational study metrics across all ACTIVE studies.
// Consumes src/lib/research/cohort.ts helper functions where possible.
//
// Architecture: Raw Data → Research Layer → Research Insights
//
// Justified raw data accesses (three routing/metadata queries):
//   (1) ACTIVE study IDs — routing query to identify which studies to aggregate.
//   (2) StudyEnrollment.enrolledAt — metadata timestamp, not clinical signal data.
//       Required to compute averageFollowUpDays; not available from research layer.
//   (3) AssessmentSnapshot groupBy enrollmentId — snapshot count per enrollment.
//       Required to compute longitudinalParticipationRate.
//
// All cohort count aggregation is delegated to getStudyCohortSummary()
// from the research layer — not queried directly.
//
// MyoGuard observes. MyoGuard does not predict.

import { prisma }               from '@/src/lib/prisma';
import { getStudyCohortSummary } from '@/src/lib/research/cohort';
import type { ResearchInsightsSummary } from './types';

// ─── Zero-study baseline ──────────────────────────────────────────────────────

function emptyResearchInsights(): ResearchInsightsSummary {
  return {
    activeStudyCount:              0,
    activeCohortSize:              0,
    totalEnrolledAcrossStudies:    0,
    withdrawalCount:               0,
    snapshotCount:                 0,
    averageFollowUpDays:           null,
    longitudinalParticipationRate: 0,
  };
}

// ─── Insight computation ──────────────────────────────────────────────────────

/**
 * getResearchInsights()
 *
 * Aggregates observational study metrics across all ACTIVE studies.
 *
 * Routing query:
 *   Fetches ACTIVE study IDs to identify which studies to aggregate.
 *   Returns early with zero baseline if no ACTIVE studies exist.
 *
 * Research layer delegation:
 *   getStudyCohortSummary(studyId) is called for each ACTIVE study concurrently.
 *   Provides: activeCount, totalEnrolled, withdrawnCount, snapshotCount.
 *
 * Metadata queries (concurrent with cohort summaries):
 *   StudyEnrollment.enrolledAt  — to compute averageFollowUpDays (lifecycle timestamp).
 *   AssessmentSnapshot counts   — to compute longitudinalParticipationRate.
 *
 * For longitudinalParticipationRate:
 *   Active enrollment IDs are fetched first (step 1), then snapshots are grouped
 *   by enrollmentId in a separate query (step 2). This two-step approach avoids
 *   relation-filter compatibility concerns in Prisma groupBy.
 *
 * longitudinalParticipationRate = (enrollments with ≥2 snapshots / totalEnrolled) × 100.
 * averageFollowUpDays = mean of (now − enrolledAt) across all ACTIVE enrollments.
 *
 * All rates are expressed as percentages (0.0–100.0), rounded to one decimal place.
 * Read-only. No writes. No side effects.
 */
export async function getResearchInsights(): Promise<ResearchInsightsSummary> {

  // Step 1: routing query — which studies are ACTIVE?
  const activeStudies = await prisma.study.findMany({
    where:  { status: 'ACTIVE' },
    select: { id: true },
  });

  const activeStudyCount = activeStudies.length;
  if (activeStudyCount === 0) return emptyResearchInsights();

  const activeStudyIds = activeStudies.map(s => s.id);

  // Step 2: concurrent aggregation — cohort summaries + enrollment metadata
  const [cohortSummaries, activeEnrollments] = await Promise.all([

    // Research layer: cohort counts per study
    Promise.all(activeStudyIds.map(id => getStudyCohortSummary(id))),

    // Metadata query: enrollment timestamps for follow-up duration + IDs for snapshot count
    // enrolledAt is a lifecycle timestamp (when the patient was enrolled), not clinical data
    prisma.studyEnrollment.findMany({
      where:  { studyId: { in: activeStudyIds }, status: 'ACTIVE' },
      select: { id: true, enrolledAt: true },
    }),

  ]);

  // ── Cohort count aggregation ───────────────────────────────────────────────
  let activeCohortSize           = 0;
  let totalEnrolledAcrossStudies = 0;
  let withdrawalCount            = 0;
  let snapshotCount              = 0;

  for (const summary of cohortSummaries) {
    activeCohortSize           += summary.activeCount;
    totalEnrolledAcrossStudies += summary.totalEnrolled;
    withdrawalCount            += summary.withdrawnCount;
    snapshotCount              += summary.snapshotCount;
  }

  // ── Average follow-up duration ─────────────────────────────────────────────
  const now = Date.now();
  const averageFollowUpDays =
    activeEnrollments.length > 0
      ? Math.round(
          activeEnrollments.reduce(
            (sum, e) => sum + (now - e.enrolledAt.getTime()) / 86_400_000,
            0,
          ) / activeEnrollments.length,
        )
      : null;

  // ── Longitudinal participation rate ───────────────────────────────────────
  // Two-step: known enrollment IDs → snapshot counts per enrollment
  // Avoids relation-filter in groupBy (compatibility across Prisma versions)
  const activeEnrollmentIds = activeEnrollments.map(e => e.id);

  let longitudinalParticipationRate = 0;

  if (activeEnrollmentIds.length > 0) {
    const snapshotCounts = await prisma.assessmentSnapshot.groupBy({
      by:    ['enrollmentId'],
      where: { enrollmentId: { in: activeEnrollmentIds } },
      _count: { _all: true },
    });

    const enrollmentsWithLongitudinalData = snapshotCounts.filter(
      e => e._count._all >= 2,
    ).length;

    if (totalEnrolledAcrossStudies > 0) {
      longitudinalParticipationRate = Math.round(
        (enrollmentsWithLongitudinalData / totalEnrolledAcrossStudies) * 1000,
      ) / 10;
    }
  }

  return {
    activeStudyCount,
    activeCohortSize,
    totalEnrolledAcrossStudies,
    withdrawalCount,
    snapshotCount,
    averageFollowUpDays,
    longitudinalParticipationRate,
  };
}
