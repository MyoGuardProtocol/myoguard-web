// MyoGuard Clinical Email Layer — Patient Longitudinal Reflection Summary Category
// Tone: observational, non-judgmental, non-predictive.
// Subject: "Your MyoGuard Longitudinal Summary"
// NEVER: "improved", "worsened", "better", "poorer", predictive language, diagnostic implication.
// Use: "trajectory", "trend direction", "continuity", "consistency".
// Always: physician-aligned, CDS-positioned, institutionally restrained.

import { buildPatientEmail, sendEmail, EMAIL_TOKENS } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LongitudinalSummaryData {
  /** Total assessments on record */
  assessmentCount:  number;
  /** Current SRI risk band */
  riskBand:         'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  /** Longitudinal trend direction */
  trendStatus:      'improving' | 'stable' | 'declining' | 'insufficient';
  /** Current protocol protein target (g/day), if available */
  proteinTargetG:   number | null;
  /** Total weekly check-ins on record */
  totalCheckins:    number;
  /** Current consecutive-week check-in continuity */
  streakWeeks:      number;
  /** Longest check-in continuity streak on record */
  bestStreak:       number;
}

export interface LongitudinalSummaryEmailOptions {
  /** Recipient email address */
  to:          string;
  /** Patient's full name — first name extracted internally */
  patientName: string;
  /** Pre-computed longitudinal data */
  data:        LongitudinalSummaryData;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function bandLabel(band: LongitudinalSummaryData['riskBand']): string {
  const labels: Record<string, string> = {
    CRITICAL: 'Elevated — Critical',
    HIGH:     'Elevated',
    MODERATE: 'Moderate',
    LOW:      'Low',
  };
  return labels[band] ?? band;
}

/**
 * Longitudinal trend direction summary — purely observational.
 *
 * Governance:
 *   - Never "improved" / "declined" / "better" / "poorer"
 *   - Use "trajectory" / "trend direction" / "continuity" / "consistency"
 *   - No predictive claims, no diagnostic implications, no outcome promises
 */
function trendDirectionSummary(trendStatus: LongitudinalSummaryData['trendStatus']): string {
  const summaries: Record<string, string> = {
    improving:
      'Trend direction: positive trajectory noted across your recent assessment cycle. ' +
      'Continued protocol consistency supports this direction.',
    stable:
      'Trend direction: consistent across your recent assessment cycle. ' +
      'Maintaining protocol adherence is recommended to sustain this classification.',
    declining:
      'Trend direction: a downward trajectory has been noted across recent cycles. ' +
      'This may reflect changes in protocol adherence or physiological factors. ' +
      'Your physician can review this data in full.',
    insufficient:
      'Trend direction: insufficient longitudinal data for analysis. ' +
      'Additional assessment cycles will establish a clearer picture.',
  };
  return summaries[trendStatus] ?? summaries['insufficient'];
}

// ─── Template composer ────────────────────────────────────────────────────────

/**
 * buildLongitudinalSummaryEmail()
 *
 * Produces patient-facing Longitudinal Reflection Summary email HTML.
 * Variant: dark.
 *
 * Tone: observational — reflects recorded data only.
 * Language: trajectory, trend direction, continuity, consistency.
 * NEVER: "improved", "worsened", "better", "poorer".
 * NEVER: predictive claims, diagnostic implications, outcome promises.
 */
export function buildLongitudinalSummaryEmail({
  patientName,
  data,
}: LongitudinalSummaryEmailOptions): string {
  const {
    assessmentCount, riskBand, trendStatus,
    proteinTargetG, totalCheckins, streakWeeks, bestStreak,
  } = data;

  const T    = EMAIL_TOKENS.color;
  const font = EMAIL_TOKENS.font.body;

  const firstName = patientName.split(' ')[0].slice(0, 40);

  const checkinMeta = [
    `${totalCheckins} check-in${totalCheckins !== 1 ? 's' : ''} on record`,
    streakWeeks > 1 ? `${streakWeeks}-week current continuity` : null,
    bestStreak > streakWeeks && bestStreak > 1 ? `${bestStreak}-week longest continuity` : null,
  ].filter(Boolean).join(' &middot; ');

  const proteinRow = proteinTargetG != null
    ? `
        <tr>
          <td style="padding-top:12px;border-top:1px solid ${T.border};">
            <p style="margin:0 0 4px;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;line-height:1;">
              Protocol Protein Target
            </p>
            <p style="margin:0;font-size:${EMAIL_TOKENS.size.body};color:${T.textPrimary};font-family:${font};line-height:1.4;">
              ${Math.round(proteinTargetG)}&thinsp;g/day
            </p>
          </td>
        </tr>`
    : '';

  const content = `
<p style="margin:0 0 18px;font-size:${EMAIL_TOKENS.size.subheading};color:${T.textPrimary};font-family:${EMAIL_TOKENS.font.heading};font-weight:700;line-height:1.3;">
  Your MyoGuard Longitudinal Record
</p>

<p style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.body};color:${T.textSecondary};font-family:${font};line-height:1.6;">
  ${firstName}, this summary reflects your longitudinal MyoGuard Protocol engagement.
  All data is observational — it reflects what has been recorded across your assessment cycles
  and does not constitute a clinical assessment or diagnosis.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>
    <td style="background-color:#0A1020;border:1px solid ${T.border};border-radius:4px;padding:20px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

        <tr>
          <td style="padding-bottom:12px;border-bottom:1px solid ${T.border};">
            <p style="margin:0 0 4px;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;line-height:1;">
              Assessment Continuity
            </p>
            <p style="margin:0;font-size:${EMAIL_TOKENS.size.body};color:${T.textPrimary};font-family:${font};line-height:1.4;">
              ${assessmentCount} assessment${assessmentCount !== 1 ? 's' : ''} on record
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${T.border};">
            <p style="margin:0 0 4px;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;line-height:1;">
              Current SRI Classification
            </p>
            <p style="margin:0;font-size:${EMAIL_TOKENS.size.body};color:${T.textPrimary};font-family:${font};font-weight:600;line-height:1.4;">
              ${bandLabel(riskBand)}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${T.border};">
            <p style="margin:0 0 4px;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;line-height:1;">
              Longitudinal Trend Direction
            </p>
            <p style="margin:0;font-size:${EMAIL_TOKENS.size.caption};color:${T.textSecondary};font-family:${font};line-height:1.6;">
              ${trendDirectionSummary(trendStatus)}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding-top:12px;">
            <p style="margin:0 0 4px;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};letter-spacing:0.08em;text-transform:uppercase;line-height:1;">
              Check-In Continuity
            </p>
            <p style="margin:0;font-size:${EMAIL_TOKENS.size.caption};color:${T.textSecondary};font-family:${font};line-height:1.5;">
              ${checkinMeta}
            </p>
          </td>
        </tr>

        ${proteinRow}

      </table>
    </td>
  </tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
  <tr>
    <td style="background-color:${T.accent};border-radius:4px;">
      <a href="${EMAIL_TOKENS.url.base}/dashboard"
        style="display:inline-block;padding:11px 24px;font-size:${EMAIL_TOKENS.size.body};font-family:${font};font-weight:600;color:#0A1020;text-decoration:none;letter-spacing:0.01em;line-height:1.4;">
        View Full Record &rarr;
      </a>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:${EMAIL_TOKENS.size.caption};color:${T.textMuted};font-family:${font};line-height:1.5;">
  This summary is generated by the MyoGuard Protocol clinical continuity system.
  It reflects recorded data only — not a clinical assessment, diagnosis, or medical advice.
  All protocol decisions are made in consultation with your supervising physician.
</p>`;

  return buildPatientEmail({
    title:    'Your MyoGuard Longitudinal Summary',
    preheader: `${firstName}, a longitudinal summary of your MyoGuard Protocol record is available.`,
    content,
    variant:  'dark',
  });
}

// ─── Send wrapper ─────────────────────────────────────────────────────────────

/**
 * sendLongitudinalSummaryEmail()
 *
 * Sends the Longitudinal Summary email via the central sendEmail primitive.
 *
 * Scheduled delivery infrastructure deferred to BUILD 4C (Vercel Cron).
 * Available for on-demand admin invocation via app/api/email/longitudinal-summary.
 */
export async function sendLongitudinalSummaryEmail(opts: LongitudinalSummaryEmailOptions) {
  const html = buildLongitudinalSummaryEmail(opts);
  return sendEmail({
    to:      opts.to,
    subject: 'Your MyoGuard Longitudinal Summary',
    html,
    from:    EMAIL_TOKENS.from.patient,
  });
}
