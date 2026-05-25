// MyoGuard Clinical Email Layer — Physician Priority Review Category
// Tone: institutional clinical escalation correspondence. Audience: physician only.
// Variant: clinical-paper (white card on dark shell).
// NEVER: emergency red, panic framing, alarmist language, flashing urgency.
// Escalation hierarchy (restrained):
//   leanVelocityFlag = "concerning"      → amber institutional tone, "Physician Review Recommended"
//   leanVelocityFlag = "critical_review"  → rose/slate institutional tone, "Physician Review Recommended"
// Always: physician-aligned, CDS-positioned, institutionally restrained.

import { prisma } from '@/src/lib/prisma';
import { buildPhysicianEmail, sendEmail, EMAIL_TOKENS } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeanVelocityFlag = 'concerning' | 'critical_review';

export interface PhysicianPriorityReviewPayload {
  /** Internal DB User.id of the patient */
  patientId:        string;
  /** Patient display name — for clinical context; never placed in URL */
  patientName:      string;
  /** Assessment ID that triggered the review signal */
  assessmentId:     string;
  /** Current SRI risk band */
  riskBand:         'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  /** Lean mass velocity signal that triggered this notification */
  leanVelocityFlag: LeanVelocityFlag;
  /** Estimated lean mass loss percentage at this assessment cycle */
  leanLossEstPct:   number;
  /** Delta in lean loss percentage vs prior qualifying assessment (pct points) */
  leanVelocityPct:  number;
  /** Total assessments on record for this patient */
  assessmentCount:  number;
}

export interface PhysicianPriorityReviewEmailOptions {
  /** Physician's full name */
  physicianName: string;
  /** Structured clinical payload from the triggering assessment */
  payload:       PhysicianPriorityReviewPayload;
}

export interface PhysicianPriorityReviewTriggerInput {
  patientId:        string;
  assessmentId:     string;
  riskBand:         'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  leanVelocityFlag: LeanVelocityFlag;
  leanLossEstPct:   number;
  leanVelocityPct:  number;
}

// ─── Escalation styling ───────────────────────────────────────────────────────
//
// Restrained institutional palette — never emergency red, never panic framing.
// Amber and rose tones signal clinical attention without alarm.

const ESCALATION_STYLE = {
  concerning: {
    subject:      'MyoGuard Protocol — Physician Review Recommended',
    heading:      'Physician Review Recommended',
    signalLabel:  'Lean Mass Velocity — Review Threshold',
    borderColor:  '#D97706',  // amber-600 — restrained amber signal
    bgColor:      '#FEFCE8',  // amber-50  — subtle institutional tint
    headingColor: '#78350F',  // amber-950 — institutional, not alarming
    labelColor:   '#B45309',  // amber-700
  },
  critical_review: {
    subject:      'MyoGuard Protocol — Physician Review Recommended',
    heading:      'Physician Review Recommended',
    signalLabel:  'Lean Mass Velocity — Escalated Review Threshold',
    borderColor:  '#BE123C',  // rose-700  — restrained rose signal
    bgColor:      '#FFF1F2',  // rose-50   — subtle institutional tint
    headingColor: '#881337',  // rose-900  — institutional, not alarming
    labelColor:   '#BE123C',  // rose-700
  },
} as const;

// ─── Clinical label helpers ───────────────────────────────────────────────────

const BAND_LABEL: Record<string, string> = {
  CRITICAL: 'Elevated — Critical',
  HIGH:     'Elevated',
  MODERATE: 'Moderate',
  LOW:      'Low',
};

// ─── Template composer ────────────────────────────────────────────────────────

/**
 * buildPhysicianPriorityReviewEmail()
 *
 * Produces the physician-facing Priority Review email HTML string.
 * Variant: clinical-paper (white card).
 *
 * Escalation hierarchy — restrained institutional only:
 *   concerning      → amber tone, "Physician Review Recommended"
 *   critical_review → rose/slate tone, "Physician Review Recommended"
 *
 * Never: emergency red, panic language, urgency manipulation.
 * Always: deterministic clinical copy, no AI-generated language.
 */
export function buildPhysicianPriorityReviewEmail({
  physicianName,
  payload,
}: PhysicianPriorityReviewEmailOptions): string {
  const {
    patientName, riskBand, leanVelocityFlag,
    leanLossEstPct, leanVelocityPct, assessmentCount,
  } = payload;

  const style = ESCALATION_STYLE[leanVelocityFlag];
  const T     = EMAIL_TOKENS.color;
  const font  = EMAIL_TOKENS.font.body;

  // Clinical-paper variant: body text uses dark-on-white palette
  const bodyText      = T.textDark;
  const secondaryText = T.textDarkSecondary;
  const mutedText     = T.textMuted;
  const borderPaper   = T.borderPaper;

  // Physician first name — strip "Dr." prefix, clinical correspondence style
  const physicianFirst = physicianName
    .replace(/^Dr\.?\s+/i, '')
    .split(' ')[0]
    .slice(0, 40);

  // Signal description — restrained, institutional, not alarmist
  const signalDescription = leanVelocityFlag === 'critical_review'
    ? `Lean mass velocity markers have exceeded the escalated review threshold ` +
      `(&#916;&thinsp;${leanVelocityPct.toFixed(1)} percentage points since the qualifying prior assessment). ` +
      `Prompt physician review is recommended to assess protocol appropriateness.`
    : `Lean mass velocity markers met the standard review threshold ` +
      `(&#916;&thinsp;${leanVelocityPct.toFixed(1)} percentage points since the qualifying prior assessment). ` +
      `Physician review is recommended at earliest clinical convenience.`;

  // Clinical summary — deterministic; no AI-generated language
  const clinicalSummary =
    `Current SRI classification: ${BAND_LABEL[riskBand] ?? riskBand}. ` +
    `Estimated lean mass loss at current assessment: ${leanLossEstPct.toFixed(1)}%. ` +
    `Assessment cycle: ${assessmentCount} assessment${assessmentCount !== 1 ? 's' : ''} on record.`;

  const content = `
<p style="margin:0 0 6px;font-size:${EMAIL_TOKENS.size.caption};color:${mutedText};font-family:${font};letter-spacing:0.06em;text-transform:uppercase;line-height:1;">
  For: Dr. ${physicianFirst}
</p>

<h1 style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.heading};color:${style.headingColor};font-family:${EMAIL_TOKENS.font.heading};font-weight:700;line-height:1.2;">
  ${style.heading}
</h1>

<p style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.body};color:${bodyText};font-family:${font};line-height:1.6;">
  A new assessment by <strong>${patientName}</strong> has generated a physician review signal
  from the MyoGuard Protocol clinical continuity system.
</p>

<!-- Escalation callout — restrained amber or rose, never emergency red -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>
    <td style="border-left:3px solid ${style.borderColor};background-color:${style.bgColor};padding:14px 16px;border-radius:0 4px 4px 0;">
      <p style="margin:0 0 6px;font-size:${EMAIL_TOKENS.size.caption};color:${style.labelColor};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;font-weight:600;line-height:1;">
        ${style.signalLabel}
      </p>
      <p style="margin:0;font-size:${EMAIL_TOKENS.size.body};color:${bodyText};font-family:${font};line-height:1.5;">
        ${signalDescription}
      </p>
    </td>
  </tr>
</table>

<!-- Clinical summary panel -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>
    <td style="border:1px solid ${borderPaper};border-radius:4px;padding:14px 16px;">
      <p style="margin:0 0 6px;font-size:${EMAIL_TOKENS.size.caption};color:${mutedText};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;line-height:1;">
        Clinical Summary
      </p>
      <p style="margin:0;font-size:${EMAIL_TOKENS.size.body};color:${secondaryText};font-family:${font};line-height:1.5;">
        ${clinicalSummary}
      </p>
    </td>
  </tr>
</table>

<p style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.body};color:${bodyText};font-family:${font};line-height:1.6;">
  Full assessment details, check-in history, and protocol plan are available in the MyoGuard physician dashboard.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
  <tr>
    <td style="background-color:${T.accent};border-radius:4px;">
      <a href="${EMAIL_TOKENS.url.base}/doctor/patients"
        style="display:inline-block;padding:11px 24px;font-size:${EMAIL_TOKENS.size.body};font-family:${font};font-weight:600;color:#0A1020;text-decoration:none;letter-spacing:0.01em;line-height:1.4;">
        Open Patient Record &rarr;
      </a>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:${EMAIL_TOKENS.size.caption};color:${mutedText};font-family:${font};line-height:1.5;">
  This notification was generated automatically by the MyoGuard Protocol clinical continuity system.
  It reflects Clinical Decision Support data only and does not constitute a clinical finding or diagnosis.
  Physician judgment governs all protocol decisions.
</p>`;

  return buildPhysicianEmail({
    title:    style.subject,
    preheader: `Physician review signal generated for ${patientName}. Assessment data available in your MyoGuard dashboard.`,
    content,
    variant:  'clinical-paper',
  });
}

// ─── De-duplication ───────────────────────────────────────────────────────────
//
// Maximum one physician review notification per patient per 7 days.
// Uses Notification.type = REPORT_READY — the closest available NotificationType
// for this purpose. A dedicated PHYSICIAN_REVIEW type is pending BUILD 4C schema extension.
// userId = patientId — records the notification against the patient's continuity record.

const DEDUP_WINDOW_DAYS = 7;

// ─── Active trigger ───────────────────────────────────────────────────────────

/**
 * triggerPhysicianPriorityReview()
 *
 * Active trigger — called fire-and-forget from POST /api/assessment when
 * leanVelocityFlag = "concerning" | "critical_review".
 *
 * Execution contract:
 *   - Non-blocking: assessment persistence and HTTP response are complete before this runs
 *   - Never throws: all errors are caught internally
 *   - Performs: physician lookup → de-duplication check → email send → Notification write
 *
 * Caller must chain .catch() to prevent unhandled Promise rejection warnings.
 */
export async function triggerPhysicianPriorityReview(
  input: PhysicianPriorityReviewTriggerInput,
): Promise<void> {
  const {
    patientId, assessmentId, riskBand,
    leanVelocityFlag, leanLossEstPct, leanVelocityPct,
  } = input;

  // 1. Look up patient — need fullName and physicianId
  const patient = await prisma.user.findUnique({
    where:  { id: patientId },
    select: { fullName: true, physicianId: true },
  });

  if (!patient?.physicianId) {
    // No physician assigned to this patient — nothing to send
    return;
  }

  // 2. De-duplication — skip if a physician review notification was already sent recently
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const existing = await prisma.notification.findFirst({
    where: {
      userId: patientId,
      type:   'REPORT_READY',  // PHYSICIAN_REVIEW type pending BUILD 4C schema extension
      sentAt: { gte: dedupSince },
    },
    select: { id: true },
  });

  if (existing) {
    // Physician already notified for this patient within the de-duplication window
    return;
  }

  // 3. Look up physician — need email and name
  const physician = await prisma.user.findUnique({
    where:  { id: patient.physicianId },
    select: { email: true, fullName: true },
  });

  if (!physician?.email) {
    return;
  }

  // 4. Assessment count — required for clinical summary line
  const assessmentCount = await prisma.assessment.count({
    where: { userId: patientId },
  });

  // 5. Build and send email
  const style = ESCALATION_STYLE[leanVelocityFlag];
  const html  = buildPhysicianPriorityReviewEmail({
    physicianName: physician.fullName,
    payload: {
      patientId,
      patientName:     patient.fullName,
      assessmentId,
      riskBand,
      leanVelocityFlag,
      leanLossEstPct,
      leanVelocityPct,
      assessmentCount,
    },
  });

  const { error } = await sendEmail({
    to:      physician.email,
    subject: style.subject,
    html,
    from:    EMAIL_TOKENS.from.physician,
  });

  if (error) {
    console.error('[physician-priority-review] Email send failed:', error.message);
    return;
  }

  // 6. Write Notification record — de-duplication tracking and audit trail
  //    type: REPORT_READY — closest available NotificationType (pending BUILD 4C)
  //    userId: patientId  — notification recorded against the patient's record
  //    body: JSON-encoded signal metadata for auditability
  await prisma.notification.create({
    data: {
      userId:  patientId,
      type:    'REPORT_READY',
      subject: style.subject,
      body:    JSON.stringify({ leanVelocityFlag, assessmentId, leanVelocityPct, riskBand }),
      sentAt:  new Date(),
    },
  });
}
