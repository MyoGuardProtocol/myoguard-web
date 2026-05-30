// MyoGuard Insights Layer — Physician Insights
//
// Aggregates intelligence signals across all patients assigned to a physician.
// Produces system-wide physician-patient relationship metrics.
//
// Architecture: Raw Data → Intelligence Layer → Physician Insights
//
// Justified raw data accesses (two routing queries, no clinical fields):
//   (1) Count of users with role = PHYSICIAN.
//   (2) IDs of PATIENT users where physicianId IS NOT NULL.
// All clinical signal computation is delegated to the Intelligence Layer.
//
// MyoGuard observes. MyoGuard does not predict.

import { prisma }                       from '@/src/lib/prisma';
import { getPatientIntelligenceSummary } from '@/src/lib/intelligence/synthesis';
import type { PhysicianInsightsSummary } from './types';

// ─── Insight computation ──────────────────────────────────────────────────────

/**
 * getPhysicianInsights()
 *
 * Derives system-wide physician-level intelligence metrics.
 *
 * Routing queries:
 *   (1) prisma.user.count({ where: { role: 'PHYSICIAN' } }) — physician headcount.
 *   (2) prisma.user.findMany({ where: { role: 'PATIENT', physicianId: not null } })
 *       — IDs of patients under physician care. No clinical fields fetched.
 *
 * All clinical signal computation is delegated to getPatientIntelligenceSummary()
 * in the Intelligence Layer. No clinical fields are read directly in this module.
 *
 * averagePatientsPerPhysician is rounded to one decimal place.
 * Returns 0 when activePhysicianCount = 0 to prevent division by zero.
 *
 * Read-only. No writes. No side effects.
 */
export async function getPhysicianInsights(): Promise<PhysicianInsightsSummary> {

  // Routing query 1: count active physicians (no clinical fields)
  const activePhysicianCount = await prisma.user.count({
    where: { role: 'PHYSICIAN' },
  });

  // Routing query 2: patient IDs with a physician assigned (physicianId only)
  const assignedPatients = await prisma.user.findMany({
    where:  { role: 'PATIENT', physicianId: { not: null } },
    select: { id: true },
  });

  const totalPatientsUnderCare = assignedPatients.length;

  if (totalPatientsUnderCare === 0) {
    return {
      activePhysicianCount,
      totalPatientsUnderCare:  0,
      patientsRequiringReview: 0,
      reviewThresholdCount:    0,
      engagementConcernCount:  0,
      adherenceConcernCount:   0,
      averagePatientsPerPhysician: 0,
    };
  }

  // Concurrent intelligence computation for all physician-assigned patients
  const summaries = await Promise.all(
    assignedPatients.map(p => getPatientIntelligenceSummary(p.id)),
  );

  // ── Accumulation ───────────────────────────────────────────────────────────
  let patientsRequiringReview = 0;
  let reviewThresholdCount    = 0;
  let engagementConcernCount  = 0;
  let adherenceConcernCount   = 0;

  for (const s of summaries) {
    if (
      s.physicianSignals.status === 'review_threshold_crossed' ||
      s.physicianSignals.status === 'review_recommended'
    ) {
      patientsRequiringReview++;
    }
    if (s.physicianSignals.status === 'review_threshold_crossed') {
      reviewThresholdCount++;
    }
    if (
      s.continuity.status === 'inactive' ||
      s.continuity.status === 'inconsistent'
    ) {
      engagementConcernCount++;
    }
    if (s.adherence.status === 'persistent_deficit') {
      adherenceConcernCount++;
    }
  }

  const averagePatientsPerPhysician =
    activePhysicianCount > 0
      ? Math.round((totalPatientsUnderCare / activePhysicianCount) * 10) / 10
      : 0;

  return {
    activePhysicianCount,
    totalPatientsUnderCare,
    patientsRequiringReview,
    reviewThresholdCount,
    engagementConcernCount,
    adherenceConcernCount,
    averagePatientsPerPhysician,
  };
}
