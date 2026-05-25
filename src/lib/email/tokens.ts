// MyoGuard Clinical Email Layer
// These emails are clinical continuity communications, not marketing.
// Tone: restrained clinical correspondence.
// Never: urgency manipulation, streak gamification, wellness-coach language,
// product promotion, emojis.
// Always: physician-aligned, CDS-positioned, institutionally restrained.

/**
 * EMAIL_TOKENS
 *
 * Single source of truth for all MyoGuard email design values.
 * All templates must consume from here — no hardcoded colours or
 * sender addresses inside individual template files.
 *
 * Design system: Midnight Silk (email-client-safe adaptations).
 * Typography: Georgia serif headings, system sans-serif body.
 */
export const EMAIL_TOKENS = {
  // ─── Colour palette ────────────────────────────────────────────────────────
  color: {
    /** Page / outer shell background — Midnight Silk base */
    pageBg: '#080C14',

    /** Card surface — dark variant */
    cardDark: '#0D1421',

    /** Card surface — clinical-paper variant */
    cardPaper: '#FFFFFF',

    /** Border — dark variant (subtle ink on dark) */
    border: '#1A2744',

    /** Border — clinical-paper variant */
    borderPaper: '#E2E8F0',

    /** Primary accent — teal */
    accent: '#2DD4BF',

    /** Body text — dark variant */
    textPrimary: '#F1F5F9',

    /** Secondary text — dark variant */
    textSecondary: '#94A3B8',

    /** Muted text — footers, metadata, compliance */
    textMuted: '#64748B',

    /** Body text — clinical-paper variant */
    textDark: '#1E293B',

    /** Secondary text — clinical-paper variant */
    textDarkSecondary: '#475569',
  },

  // ─── Typography ────────────────────────────────────────────────────────────
  font: {
    /** Heading: Georgia serif — matches Midnight Silk web spec */
    heading: "Georgia, 'Times New Roman', serif",

    /** Body: system sans-serif — maximum email-client compatibility */
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },

  // ─── Type scale ────────────────────────────────────────────────────────────
  size: {
    /** Compliance footer, metadata classification labels */
    footer: '11px',

    /** Audience classification line (PHYSICIAN COMMUNICATION etc.) */
    meta: '10px',

    /** Supporting captions and sub-labels */
    caption: '12px',

    /** Standard body copy */
    body: '14px',

    /** Sub-section headings */
    subheading: '16px',

    /** Section headings */
    heading: '22px',
  },

  // ─── Layout ────────────────────────────────────────────────────────────────
  layout: {
    maxWidth: '600px',
    cardPadding: '32px',
  },

  // ─── Sender addresses ──────────────────────────────────────────────────────
  // Preserves established per-category sender behaviour from existing routes.
  // Do not change without auditing deliverability implications.
  from: {
    /** Patient-facing communications (welcome, assessment, continuity) */
    patient: 'MyoGuard Protocol <hello@myoguard.health>',

    /** Physician-facing and admin notifications */
    physician: 'MyoGuard Clinical <admin@myoguard.health>',

    /** Internal system, governance, and institutional correspondence */
    system: 'Meridian Wellness Systems LLC <hello@myoguard.health>',
  },

  // ─── URLs ──────────────────────────────────────────────────────────────────
  url: {
    base: 'https://myoguard.health',
    settings: 'https://myoguard.health/settings',
    privacy: 'https://myoguard.health/privacy',
    research: 'https://myoguard.health/research',
  },
} as const;
