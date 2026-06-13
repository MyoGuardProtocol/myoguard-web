/**
 * app/research/protein-requirements/page.tsx
 *
 * Protein Requirements During Weight-Loss Therapy — MyoGuard Protocol
 *
 * Topic-specific research page describing clinical evidence on protein adequacy,
 * anabolic resistance, and nutritional considerations relevant to muscle
 * preservation during GLP-1 and incretin-based weight-loss therapy.
 *
 * POSITIONING CONSTRAINTS (non-negotiable):
 *   - Observational language only. Never: "proves", "confirms", "validates".
 *   - No claims that protein prevents sarcopenia.
 *   - No treatment instructions or prescribing guidance.
 *   - SRI described only as physician-led CDS framework — not validated,
 *     diagnostic, or predictive.
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
  title: 'Protein Requirements During Weight-Loss Therapy | MyoGuard Protocol',
  description:
    'Clinical evidence describing protein adequacy, anabolic resistance, and nutritional considerations relevant to muscle preservation during GLP-1 and incretin-based weight-loss therapy.',
  alternates: {
    canonical: 'https://myoguard.health/research/protein-requirements',
  },
  openGraph: {
    title: 'Protein Requirements During Weight-Loss Therapy | MyoGuard Protocol',
    description:
      'Clinical evidence describing protein adequacy, anabolic resistance, and nutritional considerations relevant to muscle preservation during GLP-1 and incretin-based weight-loss therapy.',
    url: 'https://myoguard.health/research/protein-requirements',
    type: 'website',
  },
};

// ── Style tokens ───────────────────────────────────────────────────────────────
// Identical to /research/sarcopenia-risk and /research/glp1-therapy.
// Midnight Silk palette maintained throughout.

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
// Identical to sarcopenia-risk, glp1-therapy, and library pages.
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

export default function ProteinRequirementsPage() {
  const citations = getCitationsByTopic('protein-requirements');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalWebPage',
        name: 'Protein Requirements During Weight-Loss Therapy | MyoGuard Protocol',
        description:
          'Clinical evidence describing protein adequacy, anabolic resistance, and nutritional considerations relevant to muscle preservation during GLP-1 and incretin-based weight-loss therapy.',
        url: 'https://myoguard.health/research/protein-requirements',
        about: [
          {
            '@type': 'MedicalEntity',
            name: 'Dietary protein requirements',
            description:
              'The quantity and distribution of dietary protein intake described in clinical guidelines as relevant to lean mass preservation, functional capacity, and metabolic health in adults.',
          },
          {
            '@type': 'MedicalEntity',
            name: 'Muscle preservation',
            description:
              'The attenuation of skeletal muscle loss during periods of caloric deficit, ageing, or pharmacological weight-loss therapy through nutritional and exercise co-interventions.',
          },
          {
            '@type': 'MedicalTherapy',
            name: 'GLP-1 and incretin-based weight-loss therapy',
            description:
              'Pharmacological interventions acting on glucagon-like peptide-1 and related incretin receptor pathways, associated with significant reductions in total body weight in clinical trial data.',
          },
        ],
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

        {/* ── Governance notice (top) ────────────────────────────────── */}
        <ResearchGovernanceNotice />

        {/* ── Back navigation ────────────────────────────────────────── */}
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

        {/* ── Section A: Header ──────────────────────────────────────── */}
        <header>
          <p style={LABEL_STYLE}>Research Topic &middot; Clinical Evidence</p>
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
            Protein Requirements During Weight-Loss Therapy
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
            Clinical evidence describing protein adequacy, anabolic resistance, and nutritional
            considerations relevant to muscle preservation during GLP-1 and incretin-based
            weight-loss therapy.
          </p>
        </header>

        {/* ── Section B: Why Protein Adequacy Matters ────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Clinical Rationale</p>
          <h2 style={SECTION_H2_STYLE}>Why Protein Adequacy Matters</h2>

          <p style={PROSE_STYLE}>
            Dietary protein intake has been described in clinical literature as a primary
            nutritional variable in the preservation of skeletal muscle mass during periods
            of caloric restriction. When total energy intake is reduced — whether through
            behavioural modification or pharmacological weight-loss therapy — the adequacy
            of protein consumption relative to body weight has been reported as a relevant
            determinant of the lean-to-fat composition of weight lost.
          </p>

          <p style={PROSE_STYLE}>
            The concept of anabolic resistance — a reduced sensitivity of skeletal muscle to
            the protein synthesis stimulus provided by dietary amino acids — has been described
            in published literature as a feature of ageing muscle physiology. In older adults,
            the muscle protein synthesis response to a given dose of dietary protein has been
            observed to be attenuated relative to younger populations, suggesting that higher
            absolute protein intakes may be required to achieve equivalent anabolic outcomes.
            This consideration has been incorporated into the published guidelines of groups
            including the PROT-AGE Study Group and the European Society for Clinical Nutrition
            and Metabolism (ESPEN).
          </p>

          <p style={PROSE_STYLE}>
            Among individuals receiving GLP-1 and incretin-based weight-loss therapy,
            appetite suppression is a reported mechanism of action associated with reduced
            total dietary intake. In populations where baseline protein consumption is already
            below guideline recommendations — a pattern described as prevalent in older adult
            cohorts — further reductions in total caloric intake may compound the risk of
            inadequate dietary protein. The implications of this pattern for lean mass
            preservation during pharmacotherapy have been described in the literature as a
            clinically relevant area for physician-guided nutritional review.
          </p>

          <p style={PROSE_LAST_STYLE}>
            Physician-guided assessment of protein adequacy — in the context of an individual
            patient&rsquo;s body weight, activity level, GI tolerance, and co-morbidities —
            has been described in published consensus frameworks as the appropriate approach
            to nutritional management during weight-loss therapy. This page presents the
            published evidence base informing that clinical consideration. It does not
            constitute personalised nutritional guidance.
          </p>
        </section>

        {/* ── Section C: Clinical Guidance Frameworks ────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Consensus Frameworks</p>
          <h2 style={SECTION_H2_STYLE}>Clinical Guidance Frameworks</h2>

          {/* PROT-AGE */}
          <div
            style={{
              marginBottom: '28px',
              paddingBottom: '28px',
              borderBottom: '1px solid rgba(26, 39, 68, 0.8)',
            }}
          >
            <h3 style={SUBHEADING_STYLE}>PROT-AGE Study Group</h3>
            <p style={PROSE_STYLE}>
              The PROT-AGE Study Group published evidence-based recommendations in 2013
              describing dietary protein intake of 1.0–1.2 g/kg body weight per day for
              healthy older adults — above the population-level recommended daily allowance
              (RDA) of 0.8 g/kg/day. For older adults with acute or chronic illness, the
              group described intakes of 1.2–1.5 g/kg/day as appropriate within clinical
              contexts. These recommendations were described as intended to support lean mass
              maintenance and functional capacity in the context of the physiological changes
              associated with ageing.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The PROT-AGE position paper has been referenced in subsequent published
              guidelines and clinical reviews as a foundational framework for protein
              recommendations in older adult populations. Its recommendations were described
              as evidence-based and developed through systematic review of the available
              literature at the time of publication.
            </p>
          </div>

          {/* ESPEN */}
          <div
            style={{
              marginBottom: '28px',
              paddingBottom: '28px',
              borderBottom: '1px solid rgba(26, 39, 68, 0.8)',
            }}
          >
            <h3 style={SUBHEADING_STYLE}>ESPEN Expert Group Recommendations</h3>
            <p style={PROSE_STYLE}>
              The European Society for Clinical Nutrition and Metabolism (ESPEN) Expert Group
              published recommendations in 2014 describing protein intake targets of
              1.0–1.2 g/kg/day for healthy older adults and 1.2–1.5 g/kg/day for those
              with illness or injury. The ESPEN document described the combination of
              adequate dietary protein intake with physical exercise as the most effective
              strategy associated with preservation of muscle mass in published literature,
              noting that either intervention alone was reported to be less effective than
              their combination.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The ESPEN recommendations were developed through expert review of the available
              trial and observational literature. They represent one of several published
              clinical frameworks that have described protein intake above the standard RDA
              as appropriate within specific clinical populations, recommended within guideline
              contexts and subject to individual physician assessment.
            </p>
          </div>

          {/* Protein distribution */}
          <div>
            <h3 style={SUBHEADING_STYLE}>Protein Quantity, Distribution, and Timing</h3>
            <p style={PROSE_STYLE}>
              Published review and meta-analysis literature has described both the total
              quantity and the distribution of dietary protein across eating occasions as
              relevant variables in the context of muscle protein synthesis. Evidence reviewed
              by Phillips et al. described protein intakes above the RDA as associated with
              more favourable lean mass outcomes in older adults and individuals engaged in
              resistance training. A systematic review and meta-analysis by Morton et al.
              reported that dietary protein supplementation was significantly associated with
              resistance training-induced gains in muscle mass and strength, with effects
              described as reaching a plateau at intakes of approximately 1.62 g/kg/day
              across the study populations reviewed.
            </p>
            <p style={PROSE_LAST_STYLE}>
              Stokes et al. described evidence supporting the role of both protein quantity
              and timing in facilitating muscle protein synthesis responses to resistance
              exercise. These findings are described in the context of exercise-based
              intervention; their translation to pharmacologically mediated weight-loss
              settings, where appetite suppression and GI side effects may influence both
              dietary intake and exercise capacity, is an area of ongoing clinical interest.
            </p>
          </div>
        </section>

        {/* ── Section D: Relationship to MyoGuard Protocol ───────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>CDS Framework</p>
          <h2 style={SECTION_H2_STYLE}>Relationship to MyoGuard Protocol</h2>

          <p style={PROSE_STYLE}>
            MyoGuard Protocol incorporates protein adequacy as one component of the
            physician-led Clinical Decision Support (CDS) framework provided through the
            Sarcopenia Risk Index (SRI). Within the SRI framework, contextual protein
            guidance is generated to support physician review — it is not prescriptive,
            and it does not constitute personalised nutritional advice or clinical
            treatment direction.
          </p>

          <p style={PROSE_STYLE}>
            Protein targets surfaced within the SRI output are described as contextual
            reference ranges derived from published consensus frameworks, calibrated to the
            patient&rsquo;s reported body weight, GLP-1 dose stage, and gastrointestinal
            burden indicators. These outputs are intended to inform physician-led discussion
            with the patient — not to replace that discussion, or to function as
            autonomous prescribing guidance.
          </p>

          <p style={PROSE_STYLE}>
            The decision to recommend, modify, or defer nutritional intervention for any
            individual patient remains the clinical responsibility of the treating physician.
            MyoGuard CDS outputs are designed to present relevant evidence-informed reference
            points in a structured format that supports, rather than supplants, that
            physician-led clinical assessment.
          </p>

          <p style={PROSE_LAST_STYLE}>
            The Sarcopenia Risk Index (SRI) is an expert-consensus framework currently
            undergoing prospective evaluation. It is not a validated instrument, and its
            outputs do not constitute medical advice, clinical diagnosis, or treatment
            recommendations. Physician oversight is required for all clinical decisions.
          </p>
        </section>

        {/* ── Section E: Clinical Evidence ───────────────────────────── */}
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
              Protein Requirements — Referenced Literature
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.7, margin: 0 }}>
              Published guidelines, expert consensus documents, systematic reviews, and
              meta-analyses describing dietary protein recommendations and their relationship
              to lean mass outcomes in adults. All {citations.length} references are
              peer-reviewed and indexed.
            </p>
          </div>

          {/* Citation cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {citations.map(citation => (
              <CitationCard key={citation.id} citation={citation} />
            ))}
          </div>

        </section>

        {/* ── Governance notice (bottom) ──────────────────────────────── */}
        <ResearchGovernanceNotice />

        {/* ── Section F: Related topics ───────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Related Evidence Domains</p>
          <nav
            aria-label="Related topic navigation"
            style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}
          >
            {[
              { href: '/research/glp1-therapy', label: 'GLP-1 Therapy' },
              { href: '/research/sarcopenia-risk', label: 'Sarcopenia Risk' },
              { href: '/research/muscle-preservation', label: 'Muscle Preservation' },
              { href: '/research/library', label: 'Evidence Library' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
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
                {label}
              </Link>
            ))}
          </nav>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────── */}
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
