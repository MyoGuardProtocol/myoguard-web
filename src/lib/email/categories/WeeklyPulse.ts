// MyoGuard Clinical Email Layer — Weekly Pulse Category
// Tone: continuity-oriented clinical correspondence. Not automation-oriented.
// NEVER: "scheduled reminder", "it's time again", "weekly reminder", "don't forget".
// NEVER: raw nextAction strings, "score trend" language, projected score framing.
// Language: "longitudinal check-in", "protocol continuity", "trend direction", "trajectory".
// Always: physician-aligned, CDS-positioned, institutionally restrained.

import { buildPatientEmail, sendEmail, EMAIL_TOKENS } from '../index';
import type { WeeklyDigestPayload } from '@/src/lib/weeklyDigest';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyPulseEmailOptions {
  /** Recipient email address */
  to: string;
  /** Patient's full name — first name extracted internally */
  patientName: string;
  /**
   * Selected fields from WeeklyDigestPayload.
   *
   * DO NOT pass nextAction, nextActionType, nextActionHref, or projectedScore:
   * those fields contain terminology violations (see weeklyDigest.ts → resolveNextAction).
   * Templates compose language from riskBand, trendStatus, and continuity signals.
   */
  digest: Pick<WeeklyDigestPayload,
    'riskBand' | 'trendStatus' | 'proteinTargetG' | 'totalCheckins' | 'streakWeeks'
  >;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Clinical SRI classification label — physician-aligned phrasing. */
function bandClassificationLabel(band: WeeklyDigestPayload['riskBand']): string {
  const labels: Record<string, string> = {
    CRITICAL: 'Elevated — Critical',
    HIGH:     'Elevated',
    MODERATE: 'Moderate',
    LOW:      'Low',
  };
  return labels[band] ?? band;
}

/**
 * Longitudinal trend direction line — observational, non-judgmental.
 *
 * Governance:
 *   - Never "score trend" — use "trajectory" / "trend direction"
 *   - Never bare "declining" — frame with clinical context
 *   - Never predictive language or outcome promises
 */
function trendDirectionLine(trendStatus: WeeklyDigestPayload['trendStatus']): string {
  const lines: Record<string, string> = {
    improving:
      'Longitudinal trajectory: positive trend direction noted across recent assessment cycles.',
    stable:
      'Longitudinal trajectory: consistent with prior assessment cycle. Sustained protocol adherence supports this classification.',
    declining:
      'Longitudinal trajectory: a downward trend direction has been noted across recent cycles. Continued check-in engagement supports physician review.',
    insufficient:
      'Longitudinal trajectory: insufficient data points for trend analysis. Further assessment cycles will refine this view.',
  };
  return lines[trendStatus] ?? lines['insufficient'];
}

// ─── Template composer ────────────────────────────────────────────────────────

/**
 * buildWeeklyPulseEmail()
 *
 * Produces the patient-facing Weekly Pulse Check-In email HTML string.
 *
 * Tone: continuity-oriented, not automation-oriented.
 *   Preferred: "Your longitudinal check-in remains available."
 *   Never: "scheduled reminder", "it's time again", "don't forget"
 *
 * Language source: riskBand, trendStatus, proteinTargetG, continuity signals.
 * Never surfaces: raw nextAction, "score trend" phrasing, projected score framing.
 */
export function buildWeeklyPulseEmail({
  patientName,
  digest,
}: WeeklyPulseEmailOptions): string {
  const { riskBand, trendStatus, proteinTargetG, totalCheckins, streakWeeks } = digest;

  const T    = EMAIL_TOKENS.color;
  const font = EMAIL_TOKENS.font.body;

  // First name only — clinical correspondence style; defensive cap at 40 chars
  const firstName = patientName.split(' ')[0].slice(0, 40);

  const proteinBlock = proteinTargetG != null
    ? `
<p style="margin:0 0 16px;font-size:${EMAIL_TOKENS.size.body};color:${T.textSecondary};font-family:${font};line-height:1.6;">
  Your current protocol protein target is <strong style="color:${T.textPrimary};">${Math.round(proteinTargetG)}&thinsp;g/day</strong>.
  Logging your weekly check-in records dietary adherence against this target for longitudinal tracking.
</p>`
    : '';

  const continuityMeta = totalCheckins > 0
    ? `<p style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};line-height:1.5;">${totalCheckins} check-in${totalCheckins !== 1 ? 's' : ''} on record${streakWeeks > 1 ? ` &middot; ${streakWeeks}-week continuity` : ''}</p>`
    : '';

  const content = `
<p style="margin:0 0 18px;font-size:${EMAIL_TOKENS.size.subheading};color:${T.textPrimary};font-family:${EMAIL_TOKENS.font.heading};font-weight:700;line-height:1.3;">
  Your longitudinal check-in remains available.
</p>

<p style="margin:0 0 18px;font-size:${EMAIL_TOKENS.size.body};color:${T.textSecondary};font-family:${font};line-height:1.6;">
  ${firstName}, this is a continuity notification from your MyoGuard Protocol record.
  Logging your weekly pulse keeps your longitudinal data current and supports meaningful physician review.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>
    <td style="background-color:#0A1020;border:1px solid ${T.border};border-radius:4px;padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;line-height:1;">
        Current SRI Classification
      </p>
      <p style="margin:0 0 8px;font-size:${EMAIL_TOKENS.size.body};color:${T.textPrimary};font-family:${font};font-weight:600;line-height:1.4;">
        ${bandClassificationLabel(riskBand)}
      </p>
      <p style="margin:0;font-size:${EMAIL_TOKENS.size.caption};color:${T.textSecondary};font-family:${font};line-height:1.5;">
        ${trendDirectionLine(trendStatus)}
      </p>
    </td>
  </tr>
</table>

${proteinBlock}

${continuityMeta}

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
  <tr>
    <td style="background-color:${T.accent};border-radius:4px;">
      <a href="${EMAIL_TOKENS.url.base}/checkin"
        style="display:inline-block;padding:11px 24px;font-size:${EMAIL_TOKENS.size.body};font-family:${font};font-weight:600;color:#0A1020;text-decoration:none;letter-spacing:0.01em;line-height:1.4;">
        Log Weekly Pulse &rarr;
      </a>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};line-height:1.5;">
  This notification is generated by the MyoGuard Protocol clinical continuity system.
  It is not a medical directive. Protocol decisions are made in consultation with your supervising physician.
</p>`;

  return buildPatientEmail({
    title:    'MyoGuard Weekly Pulse Check-In',
    preheader: 'Your longitudinal check-in remains available. Log your weekly pulse to maintain protocol continuity.',
    content,
    variant:  'dark',
  });
}

// ─── Send wrapper ─────────────────────────────────────────────────────────────

/**
 * sendWeeklyPulseEmail()
 *
 * Sends the Weekly Pulse Check-In email via the central sendEmail primitive.
 *
 * Scheduled delivery infrastructure deferred to BUILD 4C (Vercel Cron).
 * Available for on-demand admin invocation via app/api/email/weekly-pulse.
 */
export async function sendWeeklyPulseEmail(opts: WeeklyPulseEmailOptions) {
  const html = buildWeeklyPulseEmail(opts);
  return sendEmail({
    to:      opts.to,
    subject: 'MyoGuard Weekly Pulse Check-In',
    html,
    from:    EMAIL_TOKENS.from.patient,
  });
}
