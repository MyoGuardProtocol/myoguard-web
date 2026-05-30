// MyoGuard Insights Layer — Institutional Insights Synthesis
//
// Orchestrates all four insight categories concurrently and derives
// ExecutiveInsights from their already-computed outputs.
//
// No additional database queries are made in this module.
// No Prisma imports. No side effects.
//
// Architecture:
//   Raw Data
//   ↓ Intelligence Layer  (src/lib/intelligence/)
//   ↓ Insights Layer      (src/lib/insights/)
//   └── getInstitutionalInsightsSummary()
//       ├── getCohortInsights()     — concurrent
//       ├── getPhysicianInsights()  — concurrent
//       ├── getPlatformInsights()   — concurrent
//       ├── getResearchInsights()   — concurrent
//       └── deriveExecutiveInsights() — pure derivation, zero queries
//
// MyoGuard observes. MyoGuard does not predict.

import { getCohortInsights }    from './cohort';
import { getPhysicianInsights } from './physician';
import { getPlatformInsights }  from './platform';
import { getResearchInsights }  from './research';
import type {
  InstitutionalInsightsSummary,
  ExecutiveInsights,
  CohortInsightsSummary,
  PhysicianInsightsSummary,
  PlatformInsightsSummary,
  ResearchInsightsSummary,
} from './types';

// ─── Executive derivation ─────────────────────────────────────────────────────

/**
 * deriveExecutiveInsights()
 *
 * Derives ExecutiveInsights from already-computed insight category outputs.
 * Pure function — zero database queries, zero side effects.
 *
 * Sources (documented per field — no new computation):
 *   totalPatients           → cohort.totalPatients
 *   activePatients          → cohort.patientsActive
 *   patientsRequiringReview → cohort.reviewRequiredCount
 *   activePhysicians        → physician.activePhysicianCount
 *   activeCohortSize        → research.activeCohortSize
 *   weeklyCheckinRate       → platform.weeklyCheckinRate
 */
function deriveExecutiveInsights(
  cohort:    CohortInsightsSummary,
  physician: PhysicianInsightsSummary,
  platform:  PlatformInsightsSummary,
  research:  ResearchInsightsSummary,
): ExecutiveInsights {
  return {
    totalPatients:           cohort.totalPatients,
    activePatients:          cohort.patientsActive,
    patientsRequiringReview: cohort.reviewRequiredCount,
    activePhysicians:        physician.activePhysicianCount,
    activeCohortSize:        research.activeCohortSize,
    weeklyCheckinRate:       platform.weeklyCheckinRate,
  };
}

// ─── Primary export ───────────────────────────────────────────────────────────

/**
 * getInstitutionalInsightsSummary()
 *
 * Computes all four insight categories concurrently via Promise.all(),
 * derives ExecutiveInsights from the results, and returns the full
 * InstitutionalInsightsSummary.
 *
 * All four insight computations are independent and share no state.
 * Promise.all() is used to minimise total database round-trip latency.
 *
 * Safe to call from:
 *   - Admin server components (RSC)
 *   - Physician dashboard server components
 *   - Any server-side context with access to the Prisma singleton
 *
 * Must NOT be called from:
 *   - Client components (no direct Prisma access in browser)
 *   - Edge runtime routes (Prisma requires Node.js runtime)
 *
 * This function is read-only — it writes nothing to the database.
 * It does not trigger notifications, emails, or any side effects.
 */
export async function getInstitutionalInsightsSummary(): Promise<InstitutionalInsightsSummary> {

  const [cohort, physician, platform, research] = await Promise.all([
    getCohortInsights(),
    getPhysicianInsights(),
    getPlatformInsights(),
    getResearchInsights(),
  ]);

  const executive = deriveExecutiveInsights(cohort, physician, platform, research);

  return {
    executive,
    cohort,
    physician,
    platform,
    research,
    generatedAt: new Date(),
  };
}
