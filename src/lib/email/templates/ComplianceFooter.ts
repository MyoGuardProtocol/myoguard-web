// MyoGuard Clinical Email Layer
// These emails are clinical continuity communications, not marketing.
// Tone: restrained clinical correspondence.
// Never: urgency manipulation, streak gamification, wellness-coach language,
// product promotion, emojis.
// Always: physician-aligned, CDS-positioned, institutionally restrained.

import { EMAIL_TOKENS } from '../tokens';

/**
 * complianceFooter()
 *
 * Standardised compliance footer for all MyoGuard email communications.
 *
 * Required text (verbatim, per CLAUDE.md Footer Standard and BUILD 4B-i brief):
 *   1. Platform classification — physician-led CDS
 *   2. © entity line with domain
 *   3. Community positioning
 *   4. Account management / preferences reference
 *
 * Deliberately omits:
 *   - "HIPAA-aligned" or any unqualified compliance badge language
 *   - Marketing slogans, promotional copy, product superlatives
 *   - AI language, predictive claims, outcome statements
 *   - Emoji or decorative elements
 *
 * @param variant - "dark" (Midnight Silk card) or "clinical-paper" (white card)
 */
export function complianceFooter(
  variant: 'dark' | 'clinical-paper' = 'dark',
): string {
  const isDark = variant === 'dark';

  const borderColor = isDark
    ? EMAIL_TOKENS.color.border
    : EMAIL_TOKENS.color.borderPaper;

  const textColor  = EMAIL_TOKENS.color.textMuted;
  const linkColor  = EMAIL_TOKENS.color.textMuted;
  const font       = EMAIL_TOKENS.font.body;
  const size       = EMAIL_TOKENS.size.footer;
  const lineHeight = '1.7';

  // Shared inline style for each paragraph line
  const lineStyle = [
    `margin:0 0 5px`,
    `font-size:${size}`,
    `color:${textColor}`,
    `text-align:center`,
    `line-height:${lineHeight}`,
    `font-family:${font}`,
  ].join(';');

  const linkStyle = `color:${linkColor};text-decoration:underline;`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="border-top:1px solid ${borderColor};margin-top:24px;">
  <tr>
    <td align="center" style="padding:24px 16px 20px;">

      <p style="${lineStyle};">
        MyoGuard Protocol is a physician-led Clinical Decision Support (CDS) platform.
      </p>

      <p style="${lineStyle};">
        &copy; 2026 Meridian Wellness Systems LLC &nbsp;&middot;&nbsp;
        <a href="${EMAIL_TOKENS.url.base}" style="${linkStyle}">myoguard.health</a>
      </p>

      <p style="${lineStyle};">
        Built for the global GLP-1 prescribing community
      </p>

      <p style="margin:0;font-size:${size};color:${textColor};text-align:center;line-height:${lineHeight};font-family:${font};">
        You received this because you have a MyoGuard Protocol account.
        Manage your preferences at
        <a href="${EMAIL_TOKENS.url.settings}" style="${linkStyle}">myoguard.health/settings</a>
      </p>

    </td>
  </tr>
</table>`.trim();
}
