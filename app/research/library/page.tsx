/**
 * app/research/library/page.tsx
 *
 * Clinical Evidence Library — MyoGuard Protocol
 *
 * Public, static, physician-facing evidence repository.
 * Groups peer-reviewed citations by evidence domain.
 *
 * POSITIONING CONSTRAINTS (non-negotiable):
 *   - Observational language only. Never: "proves", "confirms", "validates".
 *   - SRI is never described as validated, diagnostic, or predictive.
 *   - Never: "clinical trial", "AI", "predictive model", "score", "calculator".
 *   - All content is CDS context — not medical advice.
 *
 * Architecture:
 *   - Server component. Static page. No auth. No Prisma.
 *   - Citation data imported from src/data/citations.ts (single source of truth).
 *   - No client-side state. No search. No filtering.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { ResearchGovernanceNotice } from '@/components/research/ResearchGovernanceNotice';
import {
  getCitationsByTopic,
  type Citation,
  type CitationTopic,
  type EvidenceType,
} from '@/src/data/citations';

// ── Metadata ───────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Clinical Evidence Library | MyoGuard Protocol',
  description:
    'Curated peer-reviewed references on GLP-1 therapy, muscle preservation, protein requirements, and sarcopenia risk assessment — supporting the clinical rationale behind the Sarcopenia Risk Index (SRI).',
  alternates: {
    canonical: 'https://myoguard.health/research/library',
  },
  openGraph: {
    title: 'Clinical Evidence Library | MyoGuard Protocol',
    description:
      'Curated peer-reviewed references on GLP-1 therapy, muscle preservation, protein requirements, and sarcopenia risk assessment.',
    url: 'https://myoguard.health/research/library',
    type: 'website',
  },
};

// ── Style tokens ───────────────────────────────────────────────────────────────

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

const SECTION_HEADING_STYLE: CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: '1.375rem',
  fontWeight: 700,
  color: '#F1F5F9',
  margin: '0 0 10px 0',
  lineHeight: 1.3,
};

const SECTION_DESC_STYLE: CSSProperties = {
  fontSize: '0.9rem',
  color: '#64748B',
  lineHeight: 1.7,
  margin: 0,
};

// ── Evidence type badge config ─────────────────────────────────────────────────
//
// Badge colours must stay within the Midnight Silk palette.
// Authoritative types (Guideline, Consensus) use the teal accent.
// Empirical types (RCT, Meta-Analysis) use a neutral highlight.
// Narrative types (Review, Observational) use the muted secondary.

const BADGE_CONFIG: Record<EvidenceType, { background: string; color: string; border: string }> = {
  Guideline: {
    background: 'rgba(45, 212, 191, 0.10)',
    color: '#2DD4BF',
    border: '1px solid rgba(45, 212, 191, 0.30)',
  },
  Consensus: {
    background: 'rgba(45, 212, 191, 0.06)',
    color: '#7DD3CC',
    border: '1px solid rgba(45, 212, 191, 0.18)',
  },
  RCT: {
    background: 'rgba(203, 213, 225, 0.06)',
    color: '#CBD5E1',
    border: '1px solid rgba(203, 213, 225, 0.15)',
  },
  'Meta-Analysis': {
    background: 'rgba(203, 213, 225, 0.06)',
    color: '#CBD5E1',
    border: '1px solid rgba(203, 213, 225, 0.15)',
  },
  Review: {
    background: 'rgba(100, 116, 139, 0.08)',
    color: '#94A3B8',
    border: '1px solid #1A2744',
  },
  Observational: {
    background: 'rgba(100, 116, 139, 0.08)',
    color: '#94A3B8',
    border: '1px solid #1A2744',
  },
};

// ── Topic section definitions ──────────────────────────────────────────────────

const TOPIC_SECTIONS: Array<{
  id: string;
  topic: CitationTopic;
  navLabel: string;
  heading: string;
  description: string;
}> = [
  {
    id: 'glp1-therapy',
    topic: 'glp1-therapy',
    navLabel: 'GLP-1 Therapy',
    heading: 'GLP-1 Receptor Agonist Therapy',
    description:
      'Peer-reviewed randomised trial evidence on weight reduction and body composition changes during GLP-1 receptor agonist therapy, including semaglutide and tirzepatide.',
  },
  {
    id: 'sarcopenia-risk',
    topic: 'sarcopenia-risk',
    navLabel: 'Sarcopenia Risk',
    heading: 'Sarcopenia Risk Assessment',
    description:
      'Published consensus definitions, diagnostic criteria, and epidemiological data on sarcopenia prevalence, classification, and clinical consequences.',
  },
  {
    id: 'protein-requirements',
    topic: 'protein-requirements',
    navLabel: 'Protein Requirements',
    heading: 'Dietary Protein Requirements',
    description:
      'Evidence-based and guideline-derived recommendations on dietary protein targets for older adults, individuals with acute or chronic illness, and those undergoing weight reduction.',
  },
  {
    id: 'muscle-preservation',
    topic: 'muscle-preservation',
    navLabel: 'Lean Mass Preservation',
    heading: 'Lean Mass Preservation',
    description:
      'Evidence on attenuation of lean tissue loss during caloric restriction, including the reported roles of dietary protein adequacy and physical activity patterns.',
  },
];

// ── Helper functions ───────────────────────────────────────────────────────────

function formatAuthors(authors: string[]): string {
  if (authors.length <= 3) return authors.join(', ');
  return `${authors.slice(0, 3).join(', ')}, et al.`;
}

// ── Citation card ──────────────────────────────────────────────────────────────

function CitationCard({ citation }: { citation: Citation }) {
  const badge = BADGE_CONFIG[citation.evidenceType];

  return (
    <article
      style={{
        background: '#0D1421',
        border: '1px solid #1A2744',
        borderRadius: '12px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Meta row: year · journal · evidence badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            color: '#475569',
            letterSpacing: '0.01em',
          }}
        >
          {citation.year}
          <span style={{ margin: '0 6px', color: '#1A2744' }}>·</span>
          {citation.journal}
        </span>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            padding: '3px 9px',
            borderRadius: '4px',
            background: badge.background,
            color: badge.color,
            border: badge.border,
            whiteSpace: 'nowrap',
          }}
        >
          {citation.evidenceType}
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '1rem',
          fontWeight: 700,
          color: '#E2E8F0',
          lineHeight: 1.45,
          margin: 0,
        }}
      >
        {citation.title}
      </h3>

      {/* Authors */}
      <p
        style={{
          fontSize: '0.8125rem',
          color: '#475569',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {formatAuthors(citation.authors)}
      </p>

      {/* Summary */}
      <p
        style={{
          fontSize: '0.9rem',
          color: '#94A3B8',
          lineHeight: 1.75,
          margin: 0,
          borderTop: '1px solid rgba(26, 39, 68, 0.8)',
          paddingTop: '12px',
        }}
      >
        {citation.summary}
      </p>

      {/* External links */}
      {(citation.doi ?? citation.pmid) && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {citation.doi && (
            <a
              href={`https://doi.org/${citation.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.75rem',
                color: '#2DD4BF',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              DOI ↗
            </a>
          )}
          {citation.pmid && (
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}/`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.75rem',
                color: '#64748B',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              PubMed ↗
            </a>
          )}
        </div>
      )}
    </article>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ClinicalEvidenceLibraryPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Clinical Evidence Library',
    description:
      'Curated peer-reviewed references on GLP-1 therapy, muscle preservation, protein requirements, and sarcopenia risk assessment.',
    url: 'https://myoguard.health/research/library',
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

      {/* JSON-LD */}
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

        {/* ── Governance notice (top) ─────────────────────────────────────── */}
        <ResearchGovernanceNotice />

        {/* ── Back navigation ────────────────────────────────────────────── */}
        <div>
          <Link
            href="/research"
            style={{
              fontSize: '0.8125rem',
              color: '#64748B',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              letterSpacing: '0.01em',
            }}
          >
            ← Research Overview
          </Link>
        </div>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header>
          <p style={LABEL_STYLE}>Meridian Wellness Systems LLC &middot; myoguard.health</p>
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
            Clinical Evidence Library
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
            Curated peer-reviewed literature relevant to GLP-1 therapy, muscle preservation,
            protein adequacy, and sarcopenia risk assessment. This library represents the
            published evidence informing the clinical rationale behind the{' '}
            <span style={{ color: '#CBD5E1' }}>Sarcopenia Risk Index (SRI)</span> expert-consensus
            framework.
          </p>
        </header>

        {/* ── Anchor navigation ──────────────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Evidence Domains</p>
          <nav
            aria-label="Evidence domain navigation"
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {TOPIC_SECTIONS.map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  textDecoration: 'none',
                  background: '#080C14',
                  border: '1px solid #1A2744',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  letterSpacing: '0.01em',
                  display: 'inline-block',
                  lineHeight: 1,
                }}
              >
                {section.navLabel}
              </a>
            ))}
          </nav>
          <p
            style={{
              fontSize: '0.8125rem',
              color: '#334155',
              margin: '14px 0 0 0',
              lineHeight: 1.6,
            }}
          >
            {TOPIC_SECTIONS.map((s, i) => {
              const count = getCitationsByTopic(s.topic).length;
              return (
                <span key={s.id}>
                  {i > 0 && <span style={{ margin: '0 8px', color: '#1A2744' }}>·</span>}
                  <span style={{ color: '#475569' }}>{s.navLabel}:</span>{' '}
                  <span style={{ color: '#64748B' }}>{count}</span>
                </span>
              );
            })}
          </p>
        </section>

        {/* ── Topic sections ─────────────────────────────────────────────── */}
        {TOPIC_SECTIONS.map(section => {
          const citations = getCitationsByTopic(section.topic);
          return (
            <section key={section.id} id={section.id}>

              {/* Section header */}
              <div
                style={{
                  ...CARD_STYLE,
                  marginBottom: '16px',
                  borderBottom: '1px solid rgba(45, 212, 191, 0.12)',
                }}
              >
                <p style={LABEL_STYLE}>Evidence Domain</p>
                <h2 style={SECTION_HEADING_STYLE}>{section.heading}</h2>
                <p style={SECTION_DESC_STYLE}>{section.description}</p>
              </div>

              {/* Citation cards */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {citations.map(citation => (
                  <CitationCard key={citation.id} citation={citation} />
                ))}
              </div>

            </section>
          );
        })}

        {/* ── Methodology note ───────────────────────────────────────────── */}
        <section
          style={{
            ...CARD_STYLE,
            borderColor: 'rgba(26, 39, 68, 0.6)',
          }}
        >
          <p style={LABEL_STYLE}>Library Methodology</p>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748B',
              lineHeight: 1.75,
              margin: '0 0 10px 0',
            }}
          >
            Citations in this library are selected on the basis of clinical relevance to the
            GLP-1 prescribing context, sarcopenia surveillance, and physician-led muscle
            preservation protocols. Included publications are peer-reviewed, indexed, and
            accessible via PubMed or DOI where indicated.
          </p>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748B',
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            This library is not a systematic review. It does not constitute an exhaustive
            survey of the literature. Inclusion reflects relevance to the clinical framework
            and is subject to ongoing curation.
          </p>
        </section>

        {/* ── Governance notice (bottom) ──────────────────────────────────── */}
        <ResearchGovernanceNotice />

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer
          style={{
            borderTop: '1px solid #1A2744',
            paddingTop: '28px',
          }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              color: '#334155',
              lineHeight: 1.8,
              margin: '0 0 6px 0',
              textAlign: 'center',
            }}
          >
            MyoGuard Protocol &middot; Physician-led Clinical Decision Support
          </p>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#1E293B',
              lineHeight: 1.8,
              margin: '0 0 6px 0',
              textAlign: 'center',
            }}
          >
            &copy; 2026 Meridian Wellness Systems LLC &middot; myoguard.health
          </p>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#1E293B',
              lineHeight: 1.8,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Built for the global GLP-1 prescribing community
          </p>
        </footer>

      </div>
    </main>
  );
}
