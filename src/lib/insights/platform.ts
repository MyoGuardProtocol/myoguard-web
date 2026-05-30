// MyoGuard Insights Layer — Platform Insights
//
// Derives platform-level engagement and delivery metrics from Notification
// records and raw patient/assessment engagement counts.
//
// JUSTIFIED RAW DATA EXCEPTION — documented:
//   Notification records represent infrastructure delivery state.
//   WeeklyCheckin and Assessment presence queries derive engagement rates.
//   These metrics are NOT derivable from the Intelligence Layer.
//   This module is the only insights layer module with direct Prisma access
//   to non-routing clinical tables. All queries are aggregate counts only —
//   no PHI is read, no individual records are returned.
//
// MyoGuard observes. MyoGuard does not predict.

import { prisma }                  from '@/src/lib/prisma';
import type { PlatformInsightsSummary } from './types';

// ─── Observation windows ──────────────────────────────────────────────────────

const CHECKIN_WINDOW_DAYS          = 7;
const ASSESSMENT_WINDOW_DAYS       = 30;
const NOTIFICATION_WINDOW_7_DAYS   = 7;
const NOTIFICATION_WINDOW_30_DAYS  = 30;

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Returns a percentage (0.0–100.0) rounded to one decimal place. Avoids division by zero. */
function toPct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// ─── Insight computation ──────────────────────────────────────────────────────

/**
 * getPlatformInsights()
 *
 * Observes platform-level engagement and delivery metrics.
 *
 * All queries run concurrently via Promise.all().
 *
 * Queries and their justification:
 *   user.count(PATIENT)           — total patient denominator for rates
 *   notification.count(7d)        — WEEKLY_REMINDER delivery metric
 *   notification.count(30d)       — LONGITUDINAL_SUMMARY delivery metric
 *   notification.count(30d)       — PHYSICIAN_REVIEW escalation metric
 *   weeklyCheckin.groupBy(userId) — distinct patients with check-in last 7d
 *   assessment.groupBy(userId)    — distinct patients with assessment last 30d
 *
 * WeeklyCheckin queries use createdAt (non-nullable) as the time anchor.
 * Assessment queries use assessmentDate (clinical date of assessment).
 * All Notification queries use createdAt — NOT sentAt (sentAt is nullable).
 *
 * All rates returned as percentages (0.0–100.0). No PHI in output.
 * Read-only. No writes. No side effects.
 */
export async function getPlatformInsights(): Promise<PlatformInsightsSummary> {
  const now     = Date.now();
  const since7  = new Date(now - NOTIFICATION_WINDOW_7_DAYS  * 86_400_000);
  const since30 = new Date(now - NOTIFICATION_WINDOW_30_DAYS * 86_400_000);
  const sinceCheckin    = new Date(now - CHECKIN_WINDOW_DAYS    * 86_400_000);
  const sinceAssessment = new Date(now - ASSESSMENT_WINDOW_DAYS * 86_400_000);

  const [
    totalPatients,
    weeklyReminderSentLast7Days,
    longitudinalSummarySentLast30Days,
    physicianReviewNotificationsLast30Days,
    patientsWithCheckinLast7Days,
    patientsWithAssessmentLast30Days,
  ] = await Promise.all([

    // Total PATIENT users — denominator for all rate calculations
    prisma.user.count({
      where: { role: 'PATIENT' },
    }),

    // WEEKLY_REMINDER notifications recorded in the last 7 days
    // Uses createdAt — non-nullable, authoritative cadence anchor (BUILD 4C-ii governance)
    prisma.notification.count({
      where: { type: 'WEEKLY_REMINDER', createdAt: { gte: since7 } },
    }),

    // LONGITUDINAL_SUMMARY notifications recorded in the last 30 days
    prisma.notification.count({
      where: { type: 'LONGITUDINAL_SUMMARY', createdAt: { gte: since30 } },
    }),

    // PHYSICIAN_REVIEW notifications recorded in the last 30 days
    prisma.notification.count({
      where: { type: 'PHYSICIAN_REVIEW', createdAt: { gte: since30 } },
    }),

    // Distinct patients with at least one check-in in the last 7 days
    // groupBy userId → number of distinct users = patients who checked in
    prisma.weeklyCheckin.groupBy({
      by:    ['userId'],
      where: { createdAt: { gte: sinceCheckin } },
      _count: { _all: true },
    }).then(groups => groups.length),

    // Distinct patients with at least one assessment in the last 30 days
    // Uses assessmentDate (clinical date) not createdAt
    prisma.assessment.groupBy({
      by:    ['userId'],
      where: { assessmentDate: { gte: sinceAssessment } },
      _count: { _all: true },
    }).then(groups => groups.length),

  ]);

  return {
    totalPatients,
    weeklyReminderSentLast7Days,
    longitudinalSummarySentLast30Days,
    physicianReviewNotificationsLast30Days,
    weeklyCheckinRate:             toPct(patientsWithCheckinLast7Days,       totalPatients),
    assessmentCompletionRate:      toPct(patientsWithAssessmentLast30Days,    totalPatients),
    longitudinalParticipationRate: toPct(longitudinalSummarySentLast30Days,   totalPatients),
  };
}
