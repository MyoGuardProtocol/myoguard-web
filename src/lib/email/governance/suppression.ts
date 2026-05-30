// MyoGuard Clinical Email Governance Layer
// Core principle: "The safest email is the email not unnecessarily sent."
// These are clinical continuity communications, not marketing campaigns.
// Suppression is a feature, not a failure.
// Every suppression is logged for auditability.

import { prisma } from '@/src/lib/prisma';
import { CADENCE } from './cadence';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuppressionResult {
  /**
   * True if this patient should NOT receive the email this cycle.
   * Suppression is a success state — the patient was correctly protected
   * from an unnecessary communication.
   */
  suppressed: boolean;

  /**
   * Deterministic suppression reason code — logged for auditability.
   * Must never contain PHI (no names, emails, or identifiable data).
   * 'eligible' is the reason when suppressed = false.
   */
  reason: string;
}

const ELIGIBLE: SuppressionResult = { suppressed: false, reason: 'eligible' };

// ─── Internal helpers ─────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── Weekly Pulse Suppression ─────────────────────────────────────────────────

/**
 * checkWeeklyPulseSuppression()
 *
 * Evaluates all suppression conditions for the Weekly Pulse Check-In email.
 * Returns the first applicable suppression reason, or ELIGIBLE.
 *
 * Suppression is evaluated in this order (cheapest checks first):
 *
 *   1. Email not present or empty           → no_email_address
 *   2. Account not verified                 → email_not_verified
 *   3. No assessment history                → no_assessment_history
 *   4. WEEKLY_REMINDER sent within 7 days   → weekly_pulse_sent_within_cadence_window
 *      (Notification.createdAt anchor — NOT sentAt)
 *   5. WeeklyCheckin completed within 5 days → patient_completed_checkin_within_5_days
 *      (patient is actively engaged — email is unnecessary)
 *
 * Suppression reasons are deterministic and audit-safe.
 * No PHI appears in any reason string.
 *
 * @param userId     Internal DB User.id
 * @param email      User.email value from initial query
 * @param isVerified User.isVerified value from initial query
 */
export async function checkWeeklyPulseSuppression(
  userId:     string,
  email:      string,
  isVerified: boolean,
): Promise<SuppressionResult> {

  // 1. Email guard — schema enforces non-null but defensive check for empty string
  if (!email) {
    return { suppressed: true, reason: 'no_email_address' };
  }

  // 2. Verification guard — User.isVerified exists; suppress until account is verified
  if (!isVerified) {
    return { suppressed: true, reason: 'email_not_verified' };
  }

  // 3. Assessment history guard — patients with no assessments have no longitudinal context
  //    to surface in a pulse email; nothing meaningful to communicate
  const assessmentCount = await prisma.assessment.count({
    where: { userId },
  });
  if (assessmentCount === 0) {
    return { suppressed: true, reason: 'no_assessment_history' };
  }

  // 4. Notification dedup — WEEKLY_REMINDER within cadence window
  //    Anchor: createdAt (non-nullable, @default(now())).
  //    sentAt must NOT be used — it is nullable and unsafe as a window anchor.
  const recentPulse = await prisma.notification.findFirst({
    where: {
      userId,
      type:      'WEEKLY_REMINDER',
      createdAt: { gte: daysAgo(CADENCE.WEEKLY_PULSE_DAYS) },
    },
    select: { id: true },
  });
  if (recentPulse) {
    return { suppressed: true, reason: 'weekly_pulse_sent_within_cadence_window' };
  }

  // 5. Recent check-in guard — patient already engaged this cycle
  //    WeeklyCheckin.completedAt: non-null completedAt confirms an active completion.
  //    The patient has engaged with the protocol; this email would be redundant.
  const recentCheckin = await prisma.weeklyCheckin.findFirst({
    where: {
      userId,
      completedAt: { gte: daysAgo(CADENCE.RECENT_CHECKIN_DAYS) },
    },
    select: { id: true },
  });
  if (recentCheckin) {
    return { suppressed: true, reason: 'patient_completed_checkin_within_5_days' };
  }

  return ELIGIBLE;
}

// ─── Longitudinal Summary Suppression ────────────────────────────────────────

/**
 * checkLongitudinalSuppression()
 *
 * Evaluates all suppression conditions for the Longitudinal Summary email.
 * Returns the first applicable suppression reason, or ELIGIBLE.
 *
 * Suppression is evaluated in this order:
 *
 *   1. Email not present or empty                   → no_email_address
 *   2. LONGITUDINAL_SUMMARY sent within 30 days     → longitudinal_summary_sent_within_cadence_window
 *      (Notification.createdAt anchor — NOT sentAt)
 *   3. Minimum longitudinal data not met            → insufficient_longitudinal_data
 *      Requires either:
 *        A: ≥ 2 Assessments in prior 60 days, OR
 *        B: ≥ 3 WeeklyCheckin records in prior 30 days
 *      A summary with insufficient data is clinically meaningless — suppress it.
 *
 * Suppression reasons are deterministic and audit-safe.
 * No PHI appears in any reason string.
 *
 * @param userId Internal DB User.id
 * @param email  User.email value from initial query
 */
export async function checkLongitudinalSuppression(
  userId: string,
  email:  string,
): Promise<SuppressionResult> {

  // 1. Email guard
  if (!email) {
    return { suppressed: true, reason: 'no_email_address' };
  }

  // 2. Notification dedup — LONGITUDINAL_SUMMARY within cadence window
  //    Anchor: createdAt (non-nullable, @default(now())).
  //    sentAt must NOT be used — it is nullable and unsafe as a window anchor.
  const recentSummary = await prisma.notification.findFirst({
    where: {
      userId,
      type:      'LONGITUDINAL_SUMMARY',
      createdAt: { gte: daysAgo(CADENCE.LONGITUDINAL_SUMMARY_DAYS) },
    },
    select: { id: true },
  });
  if (recentSummary) {
    return { suppressed: true, reason: 'longitudinal_summary_sent_within_cadence_window' };
  }

  // 3. Minimum longitudinal data requirement
  //    Condition A: at least 2 Assessments in prior 60 days
  const recentAssessments = await prisma.assessment.count({
    where: {
      userId,
      createdAt: { gte: daysAgo(CADENCE.LONGITUDINAL_MIN_ASSESSMENTS_DAYS) },
    },
  });
  if (recentAssessments >= CADENCE.LONGITUDINAL_MIN_ASSESSMENTS) {
    // Condition A satisfied — sufficient longitudinal data
    return ELIGIBLE;
  }

  // Condition B: at least 3 WeeklyCheckin records in prior 30 days
  const recentCheckins = await prisma.weeklyCheckin.count({
    where: {
      userId,
      createdAt: { gte: daysAgo(CADENCE.LONGITUDINAL_MIN_CHECKINS_DAYS) },
    },
  });
  if (recentCheckins >= CADENCE.LONGITUDINAL_MIN_CHECKINS) {
    // Condition B satisfied — sufficient check-in continuity
    return ELIGIBLE;
  }

  // Neither condition met — a summary at this point would not reflect
  // meaningful longitudinal engagement. Suppress.
  return { suppressed: true, reason: 'insufficient_longitudinal_data' };
}
