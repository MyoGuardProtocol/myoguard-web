// MyoGuard Clinical Email Layer — Physician First Assessment Notification
// Tone: institutional clinical notification. Audience: physician only.
// Variant: clinical-paper (white card on dark shell).
// Trigger: patient completes their first Sarcopenia Risk Index (SRI) assessment.
//
// De-duplication: Notification.type = REPORT_READY — 24-hour window.
//   REPORT_READY is semantically correct (physician's first view of a new patient
//   report) and is independent of PHYSICIAN_REVIEW, which is reserved exclusively
//   for lean-velocity escalation (7-day window). The two notification tracks cannot
//   interfere: first assessments always produce leanVelocityFlag = 'insufficient_data',
//   so the priority-review trigger is structurally excluded on first assessment.
//
// PHI constraint: patient name + assessment date + availability signal only.
// No clinical values, no risk band, no SRI scores are transmitted.

import { prisma }                               from '@/src/lib/prisma';
import { buildPhysicianEmail, sendEmail, EMAIL_TOKENS } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhysicianFirstAssessmentEmailOptions {
  /** Physician's full name */
  physicianName:  string;
  /** Patient's full name */
  patientName:    string;
  /** ISO date string of the completed assessment */
  assessmentDate: string;
  /** Deep-link CTA — routes physician to the patient record */
  reviewUrl:      string;
}

export interface PhysicianFirstAssessmentTriggerInput {
  /** Internal DB User.id of the patient */
  patientId:      string;
  /** Internal DB Assessment.id of the completed assessment */
  assessmentId:   string;
  /** ISO date string of the completed assessment */
  assessmentDate: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT             = 'New Patient Assessment Available';
const DEDUP_WINDOW_HOURS  = 24;

// ─── Template composer ────────────────────────────────────────────────────────

/**
 * buildPhysicianFirstAssessmentEmail()
 *
 * Produces the physician-facing First Assessment notification HTML string.
 * Variant: clinical-paper (white card on dark shell).
 *
 * Informs the physician that a linked patient has completed their first
 * Sarcopenia Risk Index (SRI) assessment. Includes patient name,
 * assessment date, and a deep-link CTA to the patient record.
 *
 * PHI constraint: patient name + assessment availability only.
 * No clinical values, no risk band, no scores included in transmission.
 */
export function buildPhysicianFirstAssessmentEmail({
  physicianName,
  patientName,
  assessmentDate,
  reviewUrl,
}: PhysicianFirstAssessmentEmailOptions): string {
  const T    = EMAIL_TOKENS.color;
  const font = EMAIL_TOKENS.font.body;

  // clinical-paper variant: dark-on-white body text
  const bodyText      = T.textDark;
  const secondaryText = T.textDarkSecondary;
  const mutedText     = T.textMuted;
  const borderPaper   = T.borderPaper;

  // Physician first name — strip "Dr." prefix, clinical correspondence style
  const physicianFirst = physicianName
    .replace(/^Dr\.?\s+/i, '')
    .split(' ')[0]
    .slice(0, 40);

  // Format assessment date — readable for clinical correspondence
  const formattedDate = new Date(assessmentDate).toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  });

  const content = `
<p style="margin:0 0 6px;font-size:${EMAIL_TOKENS.size.caption};color:${mutedText};font-family:${font};letter-spacing:0.06em;text-transform:uppercase;line-height:1;">
  For: Dr. ${physicianFirst}
</p>

<h1 style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.heading};color:#0F172A;font-family:${EMAIL_TOKENS.font.heading};font-weight:700;line-height:1.2;">
  New Patient Assessment Available
</h1>

<p style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.body};color:${bodyText};font-family:${font};line-height:1.6;">
  A patient linked to your MyoGuard Protocol account has completed a
  Sarcopenia Risk Index (SRI) assessment and is available for review.
</p>

<!-- Patient summary panel — clinical-paper border -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>
    <td style="border:1px solid ${borderPaper};border-radius:4px;padding:14px 16px;">
      <p style="margin:0 0 8px;font-size:${EMAIL_TOKENS.size.caption};color:${mutedText};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;line-height:1;">
        Assessment Summary
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0 0;font-size:${EMAIL_TOKENS.size.body};color:${secondaryText};font-family:${font};line-height:1.5;width:110px;vertical-align:top;">
            Patient
          </td>
          <td style="padding:4px 0 0;font-size:${EMAIL_TOKENS.size.body};color:${bodyText};font-family:${font};line-height:1.5;font-weight:600;">
            ${patientName}
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0 0;font-size:${EMAIL_TOKENS.size.body};color:${secondaryText};font-family:${font};line-height:1.5;vertical-align:top;">
            Completed
          </td>
          <td style="padding:4px 0 0;font-size:${EMAIL_TOKENS.size.body};color:${bodyText};font-family:${font};line-height:1.5;">
            ${formattedDate}
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0 0;font-size:${EMAIL_TOKENS.size.body};color:${secondaryText};font-family:${font};line-height:1.5;vertical-align:top;">
            Status
          </td>
          <td style="padding:4px 0 0;font-size:${EMAIL_TOKENS.size.body};color:${T.accent};font-family:${font};line-height:1.5;font-weight:600;">
            Awaiting Physician Review
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.body};color:${bodyText};font-family:${font};line-height:1.6;">
  Full assessment details and the clinical protocol plan are available in your
  MyoGuard physician dashboard.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
  <tr>
    <td style="background-color:${T.accent};border-radius:4px;">
      <a href="${reviewUrl}"
        style="display:inline-block;padding:11px 24px;font-size:${EMAIL_TOKENS.size.body};font-family:${font};font-weight:600;color:#0A1020;text-decoration:none;letter-spacing:0.01em;line-height:1.4;">
        Review Assessment &rarr;
      </a>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:${EMAIL_TOKENS.size.caption};color:${mutedText};font-family:${font};line-height:1.5;">
  This notification was generated automatically by the MyoGuard Protocol clinical
  continuity system. It reflects Clinical Decision Support data only and does not
  constitute a clinical finding or diagnosis. Physician judgment governs all
  protocol decisions.
</p>`;

  return buildPhysicianEmail({
    title:     SUBJECT,
    preheader: `${patientName} has completed their first Sarcopenia Risk Index (SRI) assessment. Review now in your MyoGuard dashboard.`,
    content,
    variant:   'clinical-paper',
  });
}

// ─── De-duplication ───────────────────────────────────────────────────────────
//
// Maximum one first-assessment notification per patient per 24 hours.
// Uses Notification.type = REPORT_READY — semantically appropriate for a
// physician's first view of a new patient report.
// NEVER uses PHYSICIAN_REVIEW — that type is reserved for lean-velocity escalation.
// userId = patientId — notification recorded against the patient's continuity record.
// Uses createdAt (non-nullable) as the time anchor — NOT sentAt (nullable, would
// produce false negatives if send succeeded but sentAt write was skipped).

// ─── Active trigger ───────────────────────────────────────────────────────────

/**
 * triggerPhysicianFirstAssessmentNotification()
 *
 * Active trigger — called fire-and-forget from POST /api/assessment when
 * priorAssessment === null (this patient's first completed assessment).
 *
 * Execution contract:
 *   - Non-blocking: assessment persistence and HTTP response complete before this runs
 *   - Never throws: all errors are caught internally
 *   - Guard order: patient lookup → physician lookup → de-dup check → send → Notification
 *   - Exits silently at each guard if no action is warranted
 *
 * Caller must chain .catch() to prevent unhandled Promise rejection warnings.
 */
export async function triggerPhysicianFirstAssessmentNotification(
  input: PhysicianFirstAssessmentTriggerInput,
): Promise<void> {
  const { patientId, assessmentId, assessmentDate } = input;

  // 1. Look up patient — need fullName and physicianId
  const patient = await prisma.user.findUnique({
    where:  { id: patientId },
    select: { fullName: true, physicianId: true },
  });

  if (!patient?.physicianId) {
    // Patient has no linked physician — nothing to notify
    return;
  }

  // 2. Look up physician — need email and fullName
  const physician = await prisma.user.findUnique({
    where:  { id: patient.physicianId },
    select: { email: true, fullName: true },
  });

  if (!physician?.email) {
    // Physician record missing or email not set — cannot send
    return;
  }

  // 3. De-duplication — skip if a first-assessment notification was sent recently
  //    Uses createdAt (non-nullable) not sentAt (nullable — would miss rows where
  //    the notification row was written but sentAt was not persisted).
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);
  const existing   = await prisma.notification.findFirst({
    where: {
      userId:    patientId,
      type:      'REPORT_READY',
      createdAt: { gte: dedupSince },
    },
    select: { id: true },
  });

  if (existing) {
    // Already notified within the 24-hour de-duplication window — skip
    return;
  }

  // 4. Build and send email — CTA deep-links to the patient's record
  const reviewUrl = `${EMAIL_TOKENS.url.base}/doctor/patients/${patientId}`;

  const html = buildPhysicianFirstAssessmentEmail({
    physicianName:  physician.fullName,
    patientName:    patient.fullName,
    assessmentDate,
    reviewUrl,
  });

  const { error } = await sendEmail({
    to:      physician.email,
    subject: SUBJECT,
    html,
    from:    EMAIL_TOKENS.from.physician,
  });

  if (error) {
    console.error('[physician-first-assessment] Email send failed:', error.message);
    return;
  }

  // 5. Write Notification record — de-duplication tracking and audit trail
  //    type: REPORT_READY — first assessment report now available for physician review
  //    userId: patientId  — notification recorded against the patient's record
  //    body: JSON-encoded context for auditability
  await prisma.notification.create({
    data: {
      userId:  patientId,
      type:    'REPORT_READY',
      subject: SUBJECT,
      body:    JSON.stringify({ assessmentId, triggeredBy: 'first-assessment' }),
      sentAt:  new Date(),
    },
  });
}
