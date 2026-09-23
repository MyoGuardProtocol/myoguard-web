'use client';

/**
 * src/components/learn/PreliminarySriLink.tsx
 *
 * The optional forward path from patient education to the public Preliminary
 * Sarcopenia Risk Index (SRI).
 *
 * WHAT CHANGED, AND WHAT DID NOT
 * Until C-FUNNEL-2 the education surface carried no forward path at all: the
 * only link on the article pointed back to its own index, and the Guide-request
 * success state ended the journey. That was a deliberate position, and the
 * Founder has now replaced it with a narrower one — education may offer the
 * SRI, and may not require it. Decision 2 is unchanged and unchangeable here:
 * the Protein Guide stays independently accessible and is never gated behind
 * this link.
 *
 * WHY IT IS AN OFFER AND NOT AN ASK
 * This panel is visually subordinate to everything around it, states plainly
 * that it is optional, and appears only after the reader has been given the
 * material they came for. It carries no urgency, no scarcity, no countdown and
 * no second email field. A reader who ignores it loses nothing, and the copy
 * says so rather than leaving them to infer it.
 *
 * WHY IT IS A CLIENT COMPONENT
 * Only so the click can be counted. The education pages themselves stay server
 * components — that is asserted by the governance suite — and this file is the
 * one place the funnel's forward step is measured.
 *
 * WHAT REACHES ANALYTICS
 * The event name and one categorical `source` label drawn from the union type
 * below. Nothing else: no address, no SRI value, no clinical input, no token,
 * no identifier. The destination is a fragment on the public home page, so the
 * sanitiser strips the hash before any URL property leaves the browser.
 */

import type { CSSProperties } from 'react';
import posthog from 'posthog-js';
import { isAnalyticsEnabled, AnalyticsEvents } from '@/src/lib/posthog';

/** Closed set. Adding a value here is the only way to widen what is reported. */
export type PreliminarySriSource = 'article' | 'guide_success';

/**
 * The public preliminary instrument lives on the home page, which scrolls to
 * this anchor on arrival. It requires no account and stores nothing.
 */
const DESTINATION = '/#sri-form';

const PANEL_STYLE: CSSProperties = {
  background: '#0D1421',
  border: '1px solid #1A2744',
  borderRadius: '12px',
  padding: '18px 22px 20px',
};

const LABEL_STYLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  margin: '0 0 10px 0',
};

const BODY_STYLE: CSSProperties = {
  fontSize: '0.875rem',
  color: '#94A3B8',
  lineHeight: 1.7,
  margin: '0 0 14px 0',
  maxWidth: '540px',
};

const LINK_STYLE: CSSProperties = {
  display: 'inline-block',
  fontSize: '0.875rem',
  fontWeight: 700,
  color: '#2DD4BF',
  textDecoration: 'none',
  letterSpacing: '0.01em',
};

export function PreliminarySriLink({ source }: { source: PreliminarySriSource }) {
  return (
    <section style={PANEL_STYLE}>
      <p style={LABEL_STYLE}>Optional</p>

      <p style={BODY_STYLE}>
        MyoGuard also offers a preliminary Sarcopenia Risk Index (SRI), generated from a few
        questions about your treatment and your eating. It is optional, needs no account, and
        nothing above depends on it.
      </p>

      <a
        href={DESTINATION}
        style={LINK_STYLE}
        onClick={() => {
          if (isAnalyticsEnabled) {
            posthog.capture(AnalyticsEvents.PRELIMINARY_SRI_STARTED_FROM_LEARN, { source });
          }
        }}
      >
        Generate a preliminary SRI &rarr;
      </a>
    </section>
  );
}
