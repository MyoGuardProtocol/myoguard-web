/**
 * components/research/ResearchGovernanceNotice.tsx
 *
 * Reusable clinical positioning notice for all public research pages.
 *
 * Renders the mandatory CDS classification statement and SRI framework
 * disclaimer. Used at the top and bottom of every research-layer page.
 *
 * Server component — no client-side interactivity required.
 */

import type { CSSProperties } from 'react';

// ── Style tokens ───────────────────────────────────────────────────────────────

const WRAPPER_STYLE: CSSProperties = {
  background: 'rgba(13, 20, 33, 0.6)',
  border: '1px solid #1A2744',
  borderRadius: '12px',
  padding: '16px 20px',
  display: 'flex',
  gap: '12px',
  alignItems: 'flex-start',
};

const INDICATOR_STYLE: CSSProperties = {
  width: '3px',
  minWidth: '3px',
  borderRadius: '2px',
  background: 'rgba(45, 212, 191, 0.3)',
  alignSelf: 'stretch',
};

const INNER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
};

const LABEL_STYLE: CSSProperties = {
  fontSize: '9px',
  fontWeight: 700,
  color: '#2DD4BF',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  margin: 0,
};

const TEXT_STYLE: CSSProperties = {
  fontSize: '0.8rem',
  color: '#64748B',
  lineHeight: 1.7,
  margin: 0,
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ResearchGovernanceNotice() {
  return (
    <aside style={WRAPPER_STYLE} aria-label="Clinical positioning statement">
      <div style={INDICATOR_STYLE} aria-hidden="true" />
      <div style={INNER_STYLE}>
        <p style={LABEL_STYLE}>Clinical Positioning</p>
        <p style={TEXT_STYLE}>
          The Sarcopenia Risk Index (SRI) is a physician-led Clinical Decision Support
          framework intended to support clinical judgment. It is not a validated diagnostic
          instrument and should not replace physician assessment. All outputs from
          MyoGuard Protocol are clinical decision support and do not constitute medical advice.
        </p>
      </div>
    </aside>
  );
}
