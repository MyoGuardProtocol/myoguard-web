/**
 * app/research/muscle-preservation/page.tsx
 *
 * Muscle Preservation During Weight-Loss Therapy — MyoGuard Protocol
 *
 * Topic-specific research page describing clinical evidence on lean mass
 * preservation, resistance training, protein adequacy, and longitudinal
 * monitoring during GLP-1 and incretin-based weight-loss therapy.
 *
 * POSITIONING CONSTRAINTS (non-negotiable):
 *   - Observational language only. Never: "proves", "confirms", "validates".
 *   - No claims that MyoGuard prevents muscle loss.
 *   - No exercise prescriptions. No treatment plans. No prescribing guidance.
 *   - SRI described only as physician-led CDS framework and expert-consensus
 *     instrument currently undergoing prospective evaluation — never as
 *     validated, diagnostic, or predictive.
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
  title: 'Muscle Preservation During Weight-Loss Therapy | MyoGuard Protocol',
  description:
    'Clinical evidence describing lean mass preservation, resistance training, protein adequacy, and longitudinal monitoring during GLP-1 and incretin-based weight-loss therapy.',
  alternates: {
    canonical: 'https://myoguard.health/research/muscle-preservation',
  },
  openGraph: {
    title: 'Muscle Preservation During Weight-Loss Therapy | MyoGuard Protocol',
    description:
      'Clinical evidence describing lean mass preservation, resistance training, protein adequacy, and longitudinal monitoring during GLP-1 and incretin-based weight-loss therapy.',
    url: 'https://myoguard.health/research/muscle-preservation',
    type: 'website',
  },
};

// ── Style tokens ───────────────────────────────────────────────────────────────
// Identical to all other research topic pages — Midnight Silk palette throughout.

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
// Identical across all research topic pages — Midnight Silk palette maintained.
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

export default function MusclePreservationPage() {
  const citations = getCitationsByTopic('muscle-preservation');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalWebPage',
        name: 'Muscle Preservation During Weight-Loss Therapy | MyoGuard Protocol',
        description:
          'Clinical evidence describing lean mass preservation, resistance training, protein adequacy, and longitudinal monitoring during GLP-1 and incretin-based weight-loss therapy.',
        url: 'https://myoguard.health/research/muscle-preservation',
        about: [
          {
            '@type': 'MedicalEntity',
            name: 'Muscle preservation',
            description:
              'The attenuation of skeletal muscle loss during caloric deficit, ageing, or pharmacological weight-loss therapy through nutritional and physical co-interventions.',
          },
          {
            '@type': 'MedicalEntity',
            name: 'Lean mass preservation',
            description:
              'The maintenance of fat-free mass during periods of intentional weight loss, associated with physical function, metabolic health, and quality of life in clinical literature.',
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
            Muscle Preservation During Weight-Loss Therapy
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
            Clinical evidence describing lean mass preservation, resistance training, protein
            adequacy, and longitudinal monitoring during GLP-1 and incretin-based weight-loss
            therapy.
          </p>
        </header>

        {/* ── Section B: Why Muscle Preservation Matters ─────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Clinical Rationale</p>
          <h2 style={SECTION_H2_STYLE}>Why Muscle Preservation Matters</h2>

          <p style={PROSE_STYLE}>
            Skeletal muscle serves multiple functional roles beyond locomotion. Published
            literature has described lean tissue as a principal site of glucose disposal,
            a determinant of resting metabolic rate, and a key contributor to physical
            capacity across the lifespan. Loss of skeletal muscle mass — whether through
            ageing, caloric restriction, or pharmacological intervention — has been associated
            in observational data with reductions in functional independence, metabolic
            flexibility, and long-term health outcomes.
          </p>

          <p style={PROSE_STYLE}>
            During intentional weight loss, changes in both fat mass and lean mass have been
            observed across a range of intervention types. Published systematic review data
            have described energy restriction alone as consistently associated with significant
            fat-free mass loss in middle-aged and older adults. The proportion of weight loss
            attributable to lean tissue — as opposed to adipose — has been described as
            variable, and as influenced by the magnitude and rate of caloric deficit, baseline
            body composition, dietary protein intake, and physical activity patterns.
          </p>

          <p style={PROSE_STYLE}>
            In older adults, the physiological process of anabolic resistance — a diminished
            muscle protein synthesis response to dietary amino acid availability and mechanical
            loading — has been described in published literature as a factor that may
            accelerate lean mass loss during caloric restriction relative to younger populations.
            The interaction between ageing physiology, pharmacological appetite suppression,
            and weight loss at the magnitudes now achievable with incretin-based therapy
            represents an area of clinical interest that has not yet been comprehensively
            characterised in long-term prospective data.
          </p>

          <p style={PROSE_LAST_STYLE}>
            The functional significance of muscle loss during pharmacotherapy — particularly
            its implications for physical capacity, falls risk, and metabolic health over
            multi-year treatment durations — has been described in clinical literature as an
            important consideration for physician-led monitoring frameworks during GLP-1 and
            incretin-based therapy.
          </p>
        </section>

        {/* ── Section C: Clinical Preservation Factors ───────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Clinical Factors</p>
          <h2 style={SECTION_H2_STYLE}>Clinical Preservation Factors</h2>

          {/* Protein adequacy */}
          <div
            style={{
              marginBottom: '28px',
              paddingBottom: '28px',
              borderBottom: '1px solid rgba(26, 39, 68, 0.8)',
            }}
          >
            <h3 style={SUBHEADING_STYLE}>Protein Adequacy</h3>
            <p style={PROSE_STYLE}>
              Dietary protein intake has been described in published literature as the primary
              nutritional variable associated with lean mass retention during caloric deficit.
              The PROT-AGE Study Group and ESPEN Expert Group have described intakes above
              the standard recommended daily allowance as appropriate within guideline
              contexts for older adults and those with illness or clinical risk factors.
              Published data from Cava et al. described adequate dietary protein as one of
              the key reported strategies for attenuating lean mass loss during caloric
              restriction interventions.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The appetite suppression associated with GLP-1 and incretin-based therapy may
              reduce total dietary intake, with implications for protein adequacy that have
              been described as relevant for physician-guided nutritional review during
              long-term pharmacotherapy.
            </p>
          </div>

          {/* Resistance training context */}
          <div
            style={{
              marginBottom: '28px',
              paddingBottom: '28px',
              borderBottom: '1px solid rgba(26, 39, 68, 0.8)',
            }}
          >
            <h3 style={SUBHEADING_STYLE}>Resistance Training Context</h3>
            <p style={PROSE_STYLE}>
              Resistance exercise has been described in published literature as an independent
              contributor to lean mass retention and muscle protein synthesis during periods
              of caloric restriction. Systematic review data from Weinheimer et al. reported
              that the combination of energy restriction with exercise attenuated fat-free
              mass loss compared with energy restriction alone in middle-aged and older adults.
              Published data from Lundgren et al. described combined exercise and
              pharmacotherapy as associated with the most favourable lean mass preservation
              outcomes when compared with either intervention alone over a 52-week period.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The feasibility and tolerability of resistance exercise during GLP-1 therapy —
              particularly in individuals experiencing GI side effects, fatigue, or musculoskeletal
              limitations — is subject to individual clinical assessment. Published data do not
              provide prescriptive exercise guidance applicable across all patients; the
              appropriateness of any physical activity modification remains a physician-led
              clinical determination.
            </p>
          </div>

          {/* Recovery and activity context */}
          <div
            style={{
              marginBottom: '28px',
              paddingBottom: '28px',
              borderBottom: '1px solid rgba(26, 39, 68, 0.8)',
            }}
          >
            <h3 style={SUBHEADING_STYLE}>Recovery and Activity Context</h3>
            <p style={PROSE_STYLE}>
              Physical activity levels, recovery capacity, and the presence of GI burden
              have been described in clinical literature as contextual variables relevant to
              lean mass outcomes during weight-loss therapy. Published review literature has
              noted that both the amount and timing of protein intake relative to physical
              activity may influence muscle protein synthesis responses. These interactions
              are described in the context of research populations; their application to
              individuals on incretin-based pharmacotherapy with varying tolerance profiles
              requires individual physician assessment.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The GI side effects commonly associated with GLP-1 and incretin-based therapy —
              including nausea, reduced appetite, and altered gastric motility — may influence
              both dietary intake patterns and exercise capacity during the early phases of
              dose titration. These factors have been described in clinical literature as
              relevant to nutritional and activity monitoring during this period.
            </p>
          </div>

          {/* Longitudinal monitoring */}
          <div>
            <h3 style={SUBHEADING_STYLE}>Longitudinal Monitoring and Physician Oversight</h3>
            <p style={PROSE_STYLE}>
              Published clinical consensus frameworks — including EWGSOP2 and PROT-AGE — have
              described structured longitudinal monitoring of lean mass indicators and
              functional capacity as an appropriate component of physician-led care in
              at-risk populations. The duration of incretin-based therapy — now commonly
              extending to multiple years — has been described as a factor that increases
              the clinical relevance of sustained, structured monitoring of body composition
              and functional muscle outcomes.
            </p>
            <p style={PROSE_LAST_STYLE}>
              Physician oversight provides the clinical framework within which nutritional
              adequacy, physical activity, and body composition changes can be assessed and
              acted upon at the individual patient level. Published data describe physician-led
              monitoring as the appropriate mechanism for integrating evidence-based reference
              ranges with individual patient history, co-morbidities, and treatment response.
            </p>
          </div>
        </section>

        {/* ── Section D: Relationship to MyoGuard Protocol ───────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>CDS Framework</p>
          <h2 style={SECTION_H2_STYLE}>Relationship to MyoGuard Protocol</h2>

          <p style={PROSE_STYLE}>
            MyoGuard Protocol organises muscle preservation factors — including protein
            adequacy, activity context, recovery burden, and GI tolerance — as structured
            contextual signals within the physician-led Clinical Decision Support (CDS)
            framework provided through the Sarcopenia Risk Index (SRI). These signals are
            compiled from patient-reported inputs and presented to support physician review
            of muscle preservation indicators during GLP-1 and incretin-based therapy.
          </p>

          <p style={PROSE_STYLE}>
            The outputs generated through the SRI framework are not diagnoses, predictions,
            or treatment plans. They are contextual reference signals — structured summaries
            of clinically relevant indicators drawn from patient input and calibrated against
            published evidence-based reference ranges — intended to inform physician-led
            clinical discussion, not to replace it.
          </p>

          <p style={PROSE_STYLE}>
            Muscle preservation considerations within MyoGuard CDS are presented at the
            individual patient level to support physician-led review of protein adequacy,
            activity capacity, and body composition indicators over time. The clinical
            significance of any individual output, and the appropriate response, remains a
            physician determination made in the context of full clinical assessment.
          </p>

          <p style={PROSE_LAST_STYLE}>
            The Sarcopenia Risk Index (SRI) is an expert-consensus framework currently
            undergoing prospective evaluation. It is not a validated instrument, and its
            outputs do not constitute medical advice, clinical diagnosis, or treatment
            recommendations. All clinical decisions remain the responsibility of the
            treating physician.
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
              Muscle Preservation — Referenced Literature
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.7, margin: 0 }}>
              Randomised controlled trials, systematic reviews, and meta-analyses describing
              lean mass outcomes during caloric restriction, the role of dietary protein and
              exercise in muscle preservation, and the body composition implications of
              pharmacological weight-loss therapy. All {citations.length} references are
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
              { href: '/research/protein-requirements', label: 'Protein Requirements' },
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
