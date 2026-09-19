/**
 * app/learn/protein-on-glp-1/page.tsx
 *
 * The public patient-facing entry point for the Protein Guide.
 *
 * Pinterest / Google / organic discovery → this page → Guide request →
 * ESSENTIAL_SERVICE email delivery. No Sarcopenia Risk Index (SRI) assessment
 * is required to reach the Guide, by design: someone searching for how to eat
 * during treatment has completed nothing and should not have to.
 *
 * WHERE THE CLINICAL WORDING COMES FROM
 * Every clinical sentence on this page is rendered from
 * `src/lib/guide/proteinGuideContent.ts` — Manuscript v1.2, clinically
 * reconciled and Founder-approved. This file writes no clinical content of its
 * own, and that is deliberate rather than merely convenient: a public patient
 * page is exactly where an unreviewed sentence would do the most damage, and
 * the programme has spent three phases establishing that clinical wording
 * arrives through an approved manuscript and no other way.
 *
 * WHOLE PAGES, NOT CHERRY-PICKED SENTENCES
 * Manuscript Pages 2, 4 and 5 are rendered complete. Selecting individual
 * paragraphs would let a reassurance travel without its caveat, or the protein
 * material without the renal checkpoint that governs it. Page 5 in particular
 * is the safety page, and it is included in full for that reason.
 *
 * The nine references are rendered too, so every citation marker on the page
 * resolves to a visible source rather than a dangling numeral.
 *
 * WHAT THIS PAGE IS NOT
 * Not a lead-generation landing page. It carries one request panel, no pop-up,
 * no exit intent, no countdown, no second ask, and no consent checkbox —
 * requesting a document is not subscribing to a relationship, and this surface
 * must not suggest otherwise.
 *
 * Architecture: server component, static, no auth, no Prisma, no API call at
 * render time. The request panel is the only client component.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { GuideRequestForm } from '@/src/components/guide/GuideRequestForm';
import {
  GUIDE_COVER,
  GUIDE_PAGES,
  type GuideBlock,
  type GuidePage,
} from '@/src/lib/guide/proteinGuideContent';

// ── Metadata ─────────────────────────────────────────────────────────────────

const TITLE = 'Protein and Muscle Health During GLP-1 Treatment | MyoGuard Protocol';
const DESCRIPTION =
  'Patient education on protein, nutrition and muscle health during treatment with GLP-1 and related medicines. Physician-led Clinical Decision Support from MyoGuard Protocol.';
const CANONICAL = 'https://myoguard.health/learn/protein-on-glp-1';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    type: 'article',
  },
};

// ── Style tokens — Midnight Silk, matching the research layer ────────────────

const LABEL_STYLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: '#2DD4BF',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  margin: '0 0 10px 0',
};

const CARD_STYLE: CSSProperties = {
  background: '#0D1421',
  border: '1px solid #1A2744',
  borderRadius: '16px',
  padding: '24px 28px',
};

const SECTION_H2_STYLE: CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: '1.375rem',
  fontWeight: 700,
  color: '#F1F5F9',
  margin: '0 0 20px 0',
  lineHeight: 1.3,
};

const SUBHEADING_STYLE: CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: '1.0625rem',
  fontWeight: 700,
  color: '#CBD5E1',
  margin: '26px 0 10px 0',
  lineHeight: 1.35,
};

const PROSE_STYLE: CSSProperties = {
  fontSize: '0.9375rem',
  color: '#94A3B8',
  lineHeight: 1.8,
  margin: '0 0 16px 0',
};

const LIST_STYLE: CSSProperties = {
  ...PROSE_STYLE,
  paddingLeft: '20px',
  margin: '0 0 16px 0',
};

// Amber, used only where the manuscript marks genuine safety material — the
// Page 4 symptoms needing clinical attention and the Page 5 renal checkpoint.
const SAFETY_PANEL_STYLE: CSSProperties = {
  background: 'rgba(120, 53, 15, 0.16)',
  borderLeft: '3px solid #F59E0B',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 16px 0',
};

const SAFETY_TEXT_STYLE: CSSProperties = {
  fontSize: '0.9375rem',
  color: '#FBDCA7',
  lineHeight: 1.8,
  margin: 0,
  fontWeight: 600,
};

const PULL_STYLE: CSSProperties = {
  borderLeft: '3px solid #2DD4BF',
  padding: '2px 0 2px 18px',
  margin: '20px 0 4px 0',
  fontSize: '1rem',
  color: '#CBD5E1',
  fontStyle: 'italic',
  lineHeight: 1.7,
};

const REF_STYLE: CSSProperties = {
  fontSize: '0.8125rem',
  color: '#64748B',
  lineHeight: 1.7,
  margin: '0 0 10px 0',
};

// ── Manuscript rendering ─────────────────────────────────────────────────────

function cite(c?: string) {
  if (!c) return null;
  return (
    <sup style={{ color: '#2DD4BF', fontSize: '0.7em', marginLeft: '1px' }}>{c}</sup>
  );
}

/** Renders one approved block. Adds no words — only presentation. */
function Block({ b }: { b: GuideBlock }) {
  switch (b.k) {
    case 'h3':
      return <h3 style={SUBHEADING_STYLE}>{b.text}</h3>;

    case 'p':
      return (
        <p style={PROSE_STYLE}>
          {b.text}
          {cite(b.cite)}
        </p>
      );

    case 'pull':
      return <p style={PULL_STYLE}>{b.text}</p>;

    case 'note':
      return <p style={{ ...PROSE_STYLE, fontSize: '0.8125rem', color: '#64748B' }}>{b.text}</p>;

    case 'ul':
      return (
        <ul style={LIST_STYLE}>
          {b.items.map((it, i) => (
            <li key={i} style={{ margin: '0 0 8px 0' }}>{it}</li>
          ))}
        </ul>
      );

    case 'alertLead':
      return (
        <p style={{ ...PROSE_STYLE, color: '#FBDCA7', fontWeight: 600 }}>{b.text}</p>
      );

    case 'alert':
      return (
        <div style={SAFETY_PANEL_STYLE}>
          <p style={SAFETY_TEXT_STYLE}>{b.text}</p>
        </div>
      );

    case 'alertList':
      return (
        <div style={SAFETY_PANEL_STYLE}>
          <ul style={{ ...LIST_STYLE, color: '#FBDCA7', margin: 0 }}>
            {b.items.map((it, i) => (
              <li key={i} style={{ margin: '0 0 8px 0' }}>{it}</li>
            ))}
          </ul>
        </div>
      );

    case 'refs':
      return (
        <ol style={{ paddingLeft: '20px', margin: 0 }}>
          {b.items.map((it, i) => (
            <li key={i} style={REF_STYLE}>{it}</li>
          ))}
        </ol>
      );

    default:
      return null;
  }
}

const pageNumber = (n: number): GuidePage | undefined =>
  GUIDE_PAGES.find(p => p.n === n);

/** Manuscript Page 8 from "About MyoGuard" onward — the positioning tail. */
function positioningTail(): readonly GuideBlock[] {
  const p8 = pageNumber(8);
  if (!p8) return [];
  const at = p8.blocks.findIndex(b => b.k === 'h3' && b.text === 'About MyoGuard');
  return at === -1 ? [] : p8.blocks.slice(at);
}

function ManuscriptSection({ n, label }: { n: number; label: string }) {
  const page = pageNumber(n);
  if (!page) return null;
  return (
    <section style={CARD_STYLE}>
      <p style={LABEL_STYLE}>{label}</p>
      <h2 style={SECTION_H2_STYLE}>{page.title}</h2>
      {page.blocks.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProteinOnGlp1Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: 'Protein and Muscle Health During GLP-1 Treatment',
    description: DESCRIPTION,
    url: CANONICAL,
    inLanguage: 'en',
    audience: { '@type': 'Patient' },
    publisher: {
      '@type': 'Organization',
      name: 'Meridian Wellness Systems LLC',
      url: 'https://myoguard.health',
    },
    isPartOf: {
      '@type': 'WebSite',
      name: 'MyoGuard Protocol',
      url: 'https://myoguard.health',
    },
  };

  return (
    <main style={{ background: '#080C14', minHeight: '100vh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
        <div>
          <Link
            href="/learn"
            style={{
              fontSize: '0.8125rem',
              color: '#64748B',
              textDecoration: 'none',
              letterSpacing: '0.01em',
            }}
          >
            ← Patient Education
          </Link>
        </div>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header>
          <p style={LABEL_STYLE}>Patient Education</p>
          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              color: '#F1F5F9',
              lineHeight: 1.2,
              margin: '0 0 20px 0',
            }}
          >
            Protein and Muscle Health During GLP-1 Treatment
          </h1>
          {GUIDE_COVER.lede.map((l, i) => (
            <p
              key={i}
              style={{
                fontSize: '1.0625rem',
                color: '#94A3B8',
                lineHeight: 1.75,
                maxWidth: '640px',
                margin: i === 0 ? '0 0 14px 0' : 0,
              }}
            >
              {l}
            </p>
          ))}
        </header>

        {/* ── The Guide request panel ─────────────────────────────────── */}
        <GuideRequestForm />

        {/* ── Approved manuscript material ────────────────────────────── */}
        <ManuscriptSection n={2} label="What the evidence shows" />
        <ManuscriptSection n={4} label="Eating during treatment" />
        <ManuscriptSection n={5} label="Before you change what you eat" />

        {/* ── Positioning and disclaimer ──────────────────────────────── */}
        <section style={CARD_STYLE}>
          {positioningTail().map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </section>

        {/* ── Footer ──────────────────────────────────────────────────── */}
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
