/**
 * app/learn/page.tsx
 *
 * The patient education index — the front door of the patient-led pathway.
 *
 * WHY THIS EXISTS AS WELL AS THE TOPIC PAGE
 * /learn/protein-on-glp-1 is the canonical destination, and organic discovery
 * will mostly land there directly. But a topic page whose parent 404s is a
 * broken site: people trim URLs, crawlers follow breadcrumbs, and the back link
 * on the topic page has to go somewhere. This index is that somewhere.
 *
 * HOW IT DIFFERS FROM /research
 * The research layer addresses clinicians and is built around evidence
 * classification and citation apparatus. This layer addresses patients. The two
 * are deliberately separate surfaces with separate registers, and neither
 * should drift into the other's voice.
 *
 * It carries no clinical claim of its own. The one description below is the
 * Guide's own approved subtitle, and the topic card links onward rather than
 * summarising clinical content here.
 *
 * Architecture: server component, static, no auth, no Prisma.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { GUIDE_COVER } from '@/src/lib/guide/proteinGuideContent';
import AnalyticsMount from '@/src/components/analytics/AnalyticsMount';
import { AnalyticsEvents } from '@/src/lib/posthog';

const TITLE = 'Patient Education | MyoGuard Protocol';
const DESCRIPTION =
  'Patient education on nutrition, protein and muscle health during treatment with GLP-1 and related medicines, from the physician-led MyoGuard Protocol.';
const CANONICAL = 'https://myoguard.health/learn';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: 'website' },
};

const LABEL_STYLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: '#2DD4BF',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  margin: '0 0 10px 0',
};

/** Breadcrumb link. Midnight Silk's muted slate, the weight of furniture. */
const CRUMB_STYLE: CSSProperties = {
  fontSize: '0.8125rem',
  color: '#64748B',
  textDecoration: 'none',
  letterSpacing: '0.01em',
};

const CARD_STYLE: CSSProperties = {
  background: '#0D1421',
  border: '1px solid #1A2744',
  borderRadius: '16px',
  padding: '24px 28px',
  display: 'block',
  textDecoration: 'none',
};

export default function LearnIndexPage() {
  return (
    <main style={{ background: '#080C14', minHeight: '100vh' }}>
      {/* Renders nothing, and keeps this page a server component. One event,
          no properties — the first measured step of the acquisition funnel. */}
      <AnalyticsMount event={AnalyticsEvents.LEARN_PAGE_VIEWED} />

      <div
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          padding: '56px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >
        {/* The route out. These pages are public and most visitors arrive
            from search with no account, so the way back is to the public home
            page — never to a dashboard they have no way of reaching. */}
        <nav>
          <Link href="/" style={CRUMB_STYLE}>
            ← MyoGuard Home
          </Link>
        </nav>

        <header>
          <p style={LABEL_STYLE}>Patient Education</p>
          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              color: '#F1F5F9',
              lineHeight: 1.2,
              margin: '0 0 16px 0',
            }}
          >
            Patient Education
          </h1>
          <p
            style={{
              fontSize: '1.0625rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              maxWidth: '640px',
              margin: 0,
            }}
          >
            Plain-language education for people being treated with GLP-1 and related medicines,
            intended to be read alongside advice from your own clinician.
          </p>
        </header>

        <Link href="/learn/protein-on-glp-1" style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Guide</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 8px 0',
              lineHeight: 1.3,
            }}
          >
            Protein and Muscle Health During GLP-1 Treatment
          </h2>
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1rem',
              color: '#2DD4BF',
              margin: '0 0 12px 0',
              lineHeight: 1.5,
            }}
          >
            {GUIDE_COVER.subtitle}
          </p>
          <p style={{ fontSize: '0.9375rem', color: '#94A3B8', lineHeight: 1.8, margin: 0 }}>
            Read the education page and request the MyoGuard Protein Guide by email →
          </p>
        </Link>

        <footer style={{ borderTop: '1px solid #1A2744', paddingTop: '28px' }}>
          <p style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.8, margin: '0 0 6px 0', textAlign: 'center' }}>
            MyoGuard Protocol &middot; Physician-led Clinical Decision Support
          </p>
          <p style={{ fontSize: '0.75rem', color: '#1E293B', lineHeight: 1.8, margin: '0 0 6px 0', textAlign: 'center' }}>
            &copy; 2026 Meridian Wellness Systems LLC &middot; myoguard.health
          </p>
          <p style={{ fontSize: '0.75rem', color: '#1E293B', lineHeight: 1.8, margin: 0, textAlign: 'center' }}>
            Built for the global GLP-1 prescribing community
          </p>
        </footer>
      </div>
    </main>
  );
}
