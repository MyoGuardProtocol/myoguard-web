/**
 * app/research/sarcopenia-risk/page.tsx
 *
 * Sarcopenia Risk Assessment — MyoGuard Protocol
 *
 * Topic-specific research page describing clinical evidence on sarcopenia
 * prevalence, consensus frameworks, and the rationale for longitudinal
 * monitoring during weight-loss therapy.
 *
 * POSITIONING CONSTRAINTS (non-negotiable):
 *   - Observational language only. Never: "proves", "confirms", "validates".
 *   - SRI is described only as a physician-led CDS framework — never as
 *     validated, diagnostic, predictive, approved, or certified.
 *   - All content is CDS context — not medical advice.
 *
 * Architecture:
 *   - Server component. Static page. No auth. No Prisma. No API calls.
 *   - Citation data from src/data/citations.ts (single source of truth).
 *   - Compiles as ○ Static.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { ResearchGovernanceNotice } from '@/components/research/ResearchGovernanceNotice';
import {
  getCitationsByTopic,
  type Citation,
  type EvidenceType,
} from '@/src/data/citations';

// ── Metadata ───────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Sarcopenia Risk Assessment Evidence | MyoGuard Protocol',
  description:
    'Clinical evidence describing sarcopenia prevalence, consensus frameworks, and the rationale for longitudinal monitoring during weight-loss therapy.',
  alternates: {
    canonical: 'https://myoguard.health/research/sarcopenia-risk',
  },
  openGraph: {
    title: 'Sarcopenia Risk Assessment Evidence | MyoGuard Protocol',
    description:
      'Clinical evidence describing sarcopenia prevalence, consensus frameworks, and the rationale for longitudinal monitoring during weight-loss therapy.',
    url: 'https://myoguard.health/research/sarcopenia-risk',
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
  margin: '0 0 10px 0',
  lineHeight: 1.35,
};

const PROSE_STYLE: CSSProperties = {
  fontSize: '0.9375rem',
  color: '#94A3B8',
  lineHeight: 1.8,
  margin: '0 0 16px 0',
};

const PROSE_LAST_STYLE: CSSProperties = {
  fontSize: '0.9375rem',
  color: '#94A3B8',
  lineHeight: 1.8,
  margin: 0,
};

const PROSE_MUTED_STYLE: CSSProperties = {
  fontSize: '0.9375rem',
  color: '#64748B',
  lineHeight: 1.8,
  margin: 0,
};

// ── Evidence type badge config ─────────────────────────────────────────────────
//
// Identical to library page — Midnight Silk palette maintained throughout.
// Authoritative types (Guideline, Consensus): teal accent.
// Empirical types (RCT, Meta-Analysis): neutral highlight.
// Narrative types (Review, Observational): muted secondary.

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
        <span style={{ fontSize: '0.8125rem', color: '#475569', letterSpacing: '0.01em' }}>
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
      <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
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
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
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

export default function SarcopeniaRiskPage() {
  const citations = getCitationsByTopic('sarcopenia-risk');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalWebPage',
        name: 'Sarcopenia Risk Assessment Evidence | MyoGuard Protocol',
        description:
          'Clinical evidence describing sarcopenia prevalence, consensus frameworks, and the rationale for longitudinal monitoring during weight-loss therapy.',
        url: 'https://myoguard.health/research/sarcopenia-risk',
        about: {
          '@type': 'MedicalCondition',
          name: 'Sarcopenia',
          description:
            'A progressive skeletal muscle disorder associated with accelerated loss of muscle mass, strength, and function across the lifespan.',
          code: {
            '@type': 'MedicalCode',
            code: 'M62.84',
            codingSystem: 'ICD-10',
          },
        },
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
      },
    ],
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

        {/* ── Section F (top): Governance notice ─────────────────────────── */}
        <ResearchGovernanceNotice />

        {/* ── Back navigation ────────────────────────────────────────────── */}
        <div>
          <Link
            href="/research/library"
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
            ← Clinical Evidence Library
          </Link>
        </div>

        {/* ── Section A: Header ──────────────────────────────────────────── */}
        <header>
          <p style={LABEL_STYLE}>Sarcopenia Risk &middot; Clinical Evidence</p>
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
            Sarcopenia Risk Assessment
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
            Clinical evidence describing sarcopenia prevalence, diagnostic frameworks, and the
            rationale for longitudinal monitoring during weight-loss therapy.
          </p>
        </header>

        {/* ── Section B: Why Sarcopenia Matters ─────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Clinical Rationale</p>
          <h2 style={SECTION_H2_STYLE}>Why Sarcopenia Matters</h2>

          <p style={PROSE_STYLE}>
            Sarcopenia — characterised by progressive loss of skeletal muscle mass, strength,
            and function — has been observed across a broad spectrum of older adult populations.
            Epidemiological data reported in systematic reviews and meta-analyses indicate
            prevalence estimates ranging from approximately 10% to 27%, with substantial
            variation attributable to the diagnostic criteria applied and the populations studied.
          </p>

          <p style={PROSE_STYLE}>
            Functional consequences associated with sarcopenia have been described across
            multiple clinical cohorts. These include reduced grip strength, impaired gait speed,
            difficulty with activities of daily living, and increased risk of falls and
            fall-related injury. Loss of muscle function has been associated with hospitalisation,
            extended recovery periods, and reduced quality-of-life outcomes in observational data.
          </p>

          <p style={PROSE_STYLE}>
            A growing body of observational literature has associated sarcopenia with chronic
            disease states, including type 2 diabetes, cardiovascular disease, and
            obesity-related conditions. The coexistence of reduced lean mass and excess
            adiposity — a pattern described in published literature as sarcopenic obesity —
            has been reported to compound both metabolic risk and functional impairment,
            representing a clinically distinct phenotype from either condition alone.
          </p>

          <p style={PROSE_LAST_STYLE}>
            GLP-1 receptor agonist therapies, now widely prescribed for the management of
            obesity and type 2 diabetes, have been observed to produce substantial reductions
            in total body weight. Available randomised trial data describe lean body mass
            reduction occurring as a proportion of total weight lost during pharmacological
            treatment. The clinical significance of this lean mass reduction — particularly
            across the duration of long-term therapy — has been described in the literature
            as a consideration for structured, physician-led monitoring frameworks.
          </p>
        </section>

        {/* ── Section C: Clinical Frameworks ────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Consensus Frameworks</p>
          <h2 style={SECTION_H2_STYLE}>Clinical Frameworks for Sarcopenia Assessment</h2>

          {/* EWGSOP2 */}
          <div
            style={{
              marginBottom: '28px',
              paddingBottom: '28px',
              borderBottom: '1px solid rgba(26, 39, 68, 0.8)',
            }}
          >
            <h3 style={SUBHEADING_STYLE}>
              EWGSOP2 — European Working Group on Sarcopenia in Older People
            </h3>
            <p style={PROSE_STYLE}>
              The European Working Group on Sarcopenia in Older People published a revised
              consensus definition in 2019 — referred to as EWGSOP2 — establishing low muscle
              strength as the primary clinical parameter for sarcopenia identification, with
              low muscle quantity or quality serving as the confirmatory criterion. This revision
              represented a departure from earlier definitions, which had centred on muscle mass
              alone as the defining characteristic.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The EWGSOP2 document described case-finding, assessment, and severity
              classification approaches, providing a structured framework for clinical practice
              and research standardisation across European adult populations. Its approach is
              described as applicable to both community and clinical settings.
            </p>
          </div>

          {/* AWGS */}
          <div>
            <h3 style={SUBHEADING_STYLE}>
              AWGS — Asian Working Group for Sarcopenia
            </h3>
            <p style={PROSE_STYLE}>
              The Asian Working Group for Sarcopenia published region-specific consensus
              criteria noting that sarcopenia diagnostic thresholds differ meaningfully across
              ethnic populations. Reference values for both muscle mass and functional
              measures described in the AWGS document were observed to be lower than those
              derived from predominantly European cohorts, reflecting differences in body
              composition distributions across populations.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The AWGS consensus represents one of the principal frameworks for sarcopenia
              assessment in Asian adult populations. Its publication contributed to recognition
              that a single universal threshold may not adequately capture sarcopenia risk
              across all ethnic groups — a finding with implications for globally deployed
              clinical monitoring frameworks.
            </p>
          </div>
        </section>

        {/* ── Section D: Relationship to Longitudinal Monitoring ────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Monitoring Rationale</p>
          <h2 style={SECTION_H2_STYLE}>Relationship to Longitudinal Monitoring</h2>

          <p style={PROSE_STYLE}>
            Body composition changes during ageing follow a well-described trajectory.
            Progressive loss of skeletal muscle mass — accompanied by relative increases in
            fat mass — has been observed from early to mid-adulthood, with acceleration
            reported after the sixth decade of life. These changes occur alongside
            physiological shifts in anabolic hormone levels, physical activity patterns, and
            dietary protein utilisation efficiency.
          </p>

          <p style={PROSE_STYLE}>
            Chronic disease states and pharmacological interventions have been independently
            associated with accelerated body composition changes in observational data.
            Conditions including type 2 diabetes, systemic inflammation, and prolonged
            caloric deficit have been associated with muscle wasting. Weight-loss
            therapies — including both caloric restriction and GLP-1 receptor agonist
            pharmacotherapy — have been observed to reduce lean body mass alongside fat mass,
            with the proportion of lean mass loss varying across interventions and individual
            clinical characteristics.
          </p>

          <p style={PROSE_LAST_STYLE}>
            The Sarcopenia Risk Index (SRI) is a physician-led Clinical Decision Support
            framework and expert-consensus clinical instrument developed to support structured
            observation of sarcopenia risk indicators during weight-loss therapy. It is not a
            validated diagnostic instrument, and its outputs do not constitute medical advice
            or replace physician assessment. Its application is intended to complement
            longitudinal clinical observation consistent with the intent described in published
            consensus frameworks such as EWGSOP2 and AWGS.
          </p>
        </section>

        {/* ── Section E: Evidence ────────────────────────────────────────── */}
        <section>

          {/* Section header */}
          <div
            style={{
              ...CARD_STYLE,
              marginBottom: '16px',
              borderBottom: '1px solid rgba(45, 212, 191, 0.12)',
            }}
          >
            <p style={LABEL_STYLE}>Evidence Domain</p>
            <h2
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '1.375rem',
                fontWeight: 700,
                color: '#F1F5F9',
                margin: '0 0 10px 0',
                lineHeight: 1.3,
              }}
            >
              Sarcopenia Risk — Referenced Literature
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.7, margin: 0 }}>
              Published consensus definitions, diagnostic frameworks, epidemiological analyses,
              and clinical review literature on sarcopenia prevalence, classification, and
              consequences. All {citations.length} references are peer-reviewed and indexed.
            </p>
          </div>

          {/* Citation cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {citations.map(citation => (
              <CitationCard key={citation.id} citation={citation} />
            ))}
          </div>

        </section>

        {/* ── Section F (bottom): Governance notice ──────────────────────── */}
        <ResearchGovernanceNotice />

        {/* ── Related topics ─────────────────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Related Evidence Domains</p>
          <nav
            aria-label="Related topic navigation"
            style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}
          >
            <Link
              href="/research/glp1-therapy"
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
              GLP-1 Therapy
            </Link>
            <Link
              href="/research/protein-requirements"
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
              Protein Requirements
            </Link>
            <Link
              href="/research/muscle-preservation"
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
              Muscle Preservation
            </Link>
          </nav>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid #1A2744', paddingTop: '28px' }}>
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
