// MyoGuard Clinical Email Governance Layer
// Core principle: "The safest email is the email not unnecessarily sent."
// These are clinical continuity communications, not marketing campaigns.
// Suppression is a feature, not a failure.
// Every suppression is logged for auditability.

/**
 * CADENCE — Governed delivery windows, batch limits, and suppression thresholds.
 *
 * All cadence windows must be enforced via Notification.createdAt — NOT sentAt.
 *
 * Rationale:
 *   - createdAt is non-nullable (@default(now())) and always set on every Notification write.
 *   - sentAt is nullable (DateTime?) and is unsafe as a cadence window anchor.
 *     A Notification with sentAt = null would fall outside any sentAt-based window query,
 *     producing false negatives in the deduplication check and allowing duplicate sends.
 *
 * This constraint is enforced in suppression.ts and idempotency.ts.
 * It must never be bypassed.
 */
export const CADENCE = {

  // ─── Delivery Windows ─────────────────────────────────────────────────────

  /**
   * Weekly Pulse: at most once per patient per 7 days.
   * Suppression query: Notification.type = WEEKLY_REMINDER, createdAt > now - 7 days.
   */
  WEEKLY_PULSE_DAYS: 7,

  /**
   * Longitudinal Summary: at most once per patient per 30 days.
   * Suppression query: Notification.type = LONGITUDINAL_SUMMARY, createdAt > now - 30 days.
   */
  LONGITUDINAL_SUMMARY_DAYS: 30,

  // ─── Weekly Pulse Suppression Thresholds ──────────────────────────────────

  /**
   * Recent check-in suppression window for Weekly Pulse.
   * If a patient completed a WeeklyCheckin within this window, suppress the pulse.
   * The patient is actively engaged — an email notification is unnecessary.
   * This is a suppression success, not a failure.
   */
  RECENT_CHECKIN_DAYS: 5,

  // ─── Longitudinal Summary Data Requirements ───────────────────────────────

  /**
   * Minimum longitudinal data requirements for Longitudinal Summary delivery.
   *
   * At least one of the following conditions must be met, or the summary is suppressed.
   *
   * Condition A: minimum LONGITUDINAL_MIN_ASSESSMENTS assessments
   *              in the prior LONGITUDINAL_MIN_ASSESSMENTS_DAYS days.
   * Condition B: minimum LONGITUDINAL_MIN_CHECKINS WeeklyCheckin records
   *              in the prior LONGITUDINAL_MIN_CHECKINS_DAYS days.
   *
   * These thresholds ensure the summary reflects genuine longitudinal engagement,
   * not a single data point. Suppression protects patients from receiving
   * a summary with insufficient data to be clinically meaningful.
   */
  LONGITUDINAL_MIN_ASSESSMENTS:      2,
  LONGITUDINAL_MIN_ASSESSMENTS_DAYS: 60,
  LONGITUDINAL_MIN_CHECKINS:         3,
  LONGITUDINAL_MIN_CHECKINS_DAYS:    30,

  // ─── Batch Governance ─────────────────────────────────────────────────────

  /**
   * Maximum patients processed per cron execution.
   *
   * If more than BATCH_LIMIT patients qualify after suppression:
   *   - Process the oldest BATCH_LIMIT patients by last check-in date ascending.
   *   - Remaining patients wait for the next cron execution.
   *
   * This prevents a single cron invocation from sending unbounded email volume
   * and provides a natural safety ceiling on delivery throughput.
   */
  BATCH_LIMIT: 50,

} as const;

/**
 * CRON_SCHEDULES — Vercel Cron schedule expressions.
 *
 * These are the authoritative schedule expressions for vercel.json.
 * Kept here for documentation alignment — not programmatically consumed by routes.
 */
export const CRON_SCHEDULES = {
  /** Weekly Pulse: Monday 09:00 UTC. */
  WEEKLY_PULSE:         '0 9 * * 1',
  /** Longitudinal Summary: 1st of month, 09:00 UTC. */
  LONGITUDINAL_SUMMARY: '0 9 1 * *',
} as const;
