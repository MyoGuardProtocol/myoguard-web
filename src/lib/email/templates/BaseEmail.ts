// MyoGuard Clinical Email Layer
// These emails are clinical continuity communications, not marketing.
// Tone: restrained clinical correspondence.
// Never: urgency manipulation, streak gamification, wellness-coach language,
// product promotion, emojis.
// Always: physician-aligned, CDS-positioned, institutionally restrained.

import { EMAIL_TOKENS } from '../tokens';
import { complianceFooter } from './ComplianceFooter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BaseEmailOptions {
  /** Subject line value — also used as the document <title>. */
  title: string;

  /**
   * Inbox preview text (visible before opening in most email clients).
   * Keep under 90 chars; remainder is padded with zero-width non-joiners.
   */
  preheader: string;

  /** Inner HTML content rendered inside the card. */
  content: string;

  /**
   * Visual variant:
   * - "dark"          → Midnight Silk (#0D1421 card on #080C14 shell) — default
   * - "clinical-paper" → White card on #080C14 shell (for high-legibility contexts)
   */
  variant?: 'dark' | 'clinical-paper';

  /**
   * Audience classification.
   * Renders as a tiny restrained metadata line above the content
   * (uppercase, subtle slate, tracked — institutional typographic hierarchy).
   * NOT a pill, badge, or chip.
   */
  audience?: 'patient' | 'physician' | 'system';
}

// ─── Audience metadata labels ─────────────────────────────────────────────────

const AUDIENCE_LABELS: Record<NonNullable<BaseEmailOptions['audience']>, string> = {
  patient:   'PATIENT COMMUNICATION',
  physician: 'PHYSICIAN COMMUNICATION',
  system:    'SYSTEM NOTIFICATION',
};

// ─── baseEmail ────────────────────────────────────────────────────────────────

/**
 * baseEmail()
 *
 * Produces a complete HTML email document.
 *
 * Structure:
 *   [#080C14 shell]
 *     [MyoGuard wordmark — Georgia serif]
 *     [Card — dark or clinical-paper]
 *       [audience metadata line — tiny, restrained, uppercase]
 *       [content]
 *     [ComplianceFooter — automatic]
 *
 * Design references:
 *   - Wordmark: Midnight Silk web spec, Georgia serif
 *   - Audience label: hospital correspondence metadata — NOT SaaS UI chips
 *   - Card: email-table layout, 600px max-width, responsive
 *   - Shell: always #080C14 regardless of card variant
 *
 * @param options - BaseEmailOptions
 */
export function baseEmail({
  title,
  preheader,
  content,
  variant  = 'dark',
  audience,
}: BaseEmailOptions): string {
  const isDark = variant === 'dark';

  const cardBg     = isDark ? EMAIL_TOKENS.color.cardDark   : EMAIL_TOKENS.color.cardPaper;
  const cardBorder = isDark ? EMAIL_TOKENS.color.border      : EMAIL_TOKENS.color.borderPaper;
  const font       = EMAIL_TOKENS.font.body;

  // ── Audience metadata line ─────────────────────────────────────────────────
  // Rendered as tiny restrained uppercase metadata — hospital correspondence style.
  // No pills, no colored badges, no chip UI.
  const audienceLine = audience
    ? `<p style="margin:0 0 20px;font-size:${EMAIL_TOKENS.size.meta};color:${EMAIL_TOKENS.color.textMuted};letter-spacing:0.1em;text-transform:uppercase;font-family:${font};line-height:1;">${AUDIENCE_LABELS[audience]}</p>`
    : '';

  // ── Preheader padding ──────────────────────────────────────────────────────
  // Zero-width non-joiners prevent email clients from pulling body text into preview.
  const preheaderPadding = '&nbsp;&zwnj;'.repeat(20);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_TOKENS.color.pageBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader: visible in inbox preview, hidden in body -->
  <div style="display:none;font-size:1px;color:${EMAIL_TOKENS.color.pageBg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(preheader)}${preheaderPadding}
  </div>

  <!-- Outer shell -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background-color:${EMAIL_TOKENS.color.pageBg};">
    <tr>
      <td align="center" style="padding:40px 16px 32px;">

        <!-- Inner container — max 600px -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="max-width:${EMAIL_TOKENS.layout.maxWidth};">

          <!-- ── Wordmark ──────────────────────────────────────────────── -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <p style="margin:0;font-size:17px;font-weight:700;color:${EMAIL_TOKENS.color.textPrimary};font-family:${EMAIL_TOKENS.font.heading};letter-spacing:-0.01em;line-height:1.2;">
                Myo<span style="color:${EMAIL_TOKENS.color.accent};">Guard</span><span
                  style="font-size:12px;font-weight:400;color:${EMAIL_TOKENS.color.textMuted};font-family:${font};letter-spacing:0.05em;"
                >&ensp;Protocol</span>
              </p>
            </td>
          </tr>

          <!-- ── Card ─────────────────────────────────────────────────── -->
          <tr>
            <td style="background-color:${cardBg};border:1px solid ${cardBorder};border-radius:6px;padding:${EMAIL_TOKENS.layout.cardPadding};">
              ${audienceLine}
              ${content}
            </td>
          </tr>

          <!-- ── Compliance footer ─────────────────────────────────────── -->
          <tr>
            <td>${complianceFooter(variant)}</td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Escapes HTML special characters for safe interpolation into document
 * title and preheader (user-supplied strings).
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
