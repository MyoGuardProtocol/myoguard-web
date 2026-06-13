/**
 * app/research/glp1-therapy/page.tsx
 *
 * GLP-1 and Incretin-Based Weight-Loss Therapy — MyoGuard Protocol
 *
 * Topic-specific research page describing clinical evidence on GLP-1 receptor
 * agonist therapies, body composition implications, and the rationale for
 * physician-led longitudinal monitoring during incretin-based weight-loss therapy.
 *
 * POSITIONING CONSTRAINTS (non-negotiable):
 *   - Observational language only. Never: "proves", "confirms", "validates".
 *   - SRI described only as physician-led CDS framework and expert-consensus
 *     instrument currently undergoing prospective evaluation — never as
 *     validated, diagnostic, or predictive.
 *   - All content is CDS context — not medical advice.
 *   - No product promotion. Educational tone only.
 *   - No diagnostic claims. No predictive claims. No treatment recommendations.
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
  title: 'GLP-1 and Incretin-Based Therapy Research | MyoGuard Protocol',
  description:
    'Clinical evidence on GLP-1 receptor agonists, incretin-based weight-loss therapies, and their implications for body composition, muscle preservation, and metabolic health.',
  alternates: {
    canonical: 'https://myoguard.health/research/glp1-therapy',
  },
  openGraph: {
    title: 'GLP-1 and Incretin-Based Therapy Research | MyoGuard Protocol',
    description:
      'Clinical evidence on GLP-1 receptor agonists, incretin-based weight-loss therapies, and their implications for body composition, muscle preservation, and metabolic health.',
    url: 'https://myoguard.health/research/glp1-therapy',
    type: 'website',
  },
};

// ── Style tokens ───────────────────────────────────────────────────────────────
// Identical to /research/sarcopenia-risk — Midnight Silk palette maintained throughout.

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
// Identical to sarcopenia-risk and library pages — Midnight Silk palette maintained.
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

export default function Glp1TherapyPage() {
  const citations = getCitationsByTopic('glp1-therapy');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalWebPage',
        name: 'GLP-1 and Incretin-Based Therapy Research | MyoGuard Protocol',
        description:
          'Clinical evidence on GLP-1 receptor agonists, incretin-based weight-loss therapies, and their implications for body composition, muscle preservation, and metabolic health.',
        url: 'https://myoguard.health/research/glp1-therapy',
        about: [
          {
            '@type': 'Drug',
            name: 'GLP-1 receptor agonist therapy',
            description:
              'A class of pharmacological agents that act on glucagon-like peptide-1 receptors, associated with meaningful reductions in body weight in clinical trial data.',
          },
          {
            '@type': 'MedicalTherapy',
            name: 'Incretin-based therapy',
            description:
              'Therapies acting on incretin hormone pathways, including GLP-1 and GIP receptor agonists, used in the management of obesity and type 2 diabetes.',
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
            GLP-1 and Incretin-Based Weight-Loss Therapy
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
            Understanding the evolution of incretin-based therapy and its implications for body
            composition, muscle preservation, and long-term metabolic health.
          </p>
        </header>

        {/* ── Section B: Why Incretin Therapy Matters ────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Clinical Rationale</p>
          <h2 style={SECTION_H2_STYLE}>Why Incretin Therapy Matters</h2>

          <p style={PROSE_STYLE}>
            Obesity is recognised in clinical literature as a chronic, relapsing disease of
            energy regulation — associated with a broad spectrum of cardiometabolic,
            musculoskeletal, and psychological comorbidities. Epidemiological data have described
            global obesity prevalence as a continuing public health challenge, with treatment
            outcomes under behavioural and dietary intervention alone historically reported as
            modest and difficult to sustain over the long term.
          </p>

          <p style={PROSE_STYLE}>
            Semaglutide, a glucagon-like peptide-1 (GLP-1) receptor agonist, has been the
            subject of several large randomised clinical trials. The STEP programme of trials
            reported mean total body weight reductions of 10%–15% or greater with weekly
            subcutaneous semaglutide, representing a magnitude of pharmacologically induced
            weight loss not previously described in randomised trial settings with this
            consistency. Tirzepatide, a dual GLP-1 and glucose-dependent insulinotropic
            polypeptide (GIP) receptor agonist, has been associated in SURMOUNT-1 trial data
            with mean weight reductions exceeding 20% at the highest evaluated doses.
          </p>

          <p style={PROSE_STYLE}>
            The emergence of incretin-based therapy — covering both GLP-1 receptor agonists
            and dual GLP-1/GIP receptor agonists — represents a structural shift in the
            pharmacological management of obesity. Published trial data describe weight loss
            of a magnitude and durability previously associated only with bariatric surgical
            interventions. Global prescription volumes for this class of therapy have been
            described as growing at a rate without precedent in the modern history of
            metabolic pharmacotherapy.
          </p>

          <p style={PROSE_LAST_STYLE}>
            The clinical significance of this shift extends beyond weight outcomes. As total
            body weight decreases, changes in the composition of weight lost — specifically,
            the proportion attributable to lean versus fat mass — have been described in
            published trial data as relevant considerations for long-term metabolic and
            functional health.
          </p>
        </section>

        {/* ── Section C: Body Composition Considerations ─────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Body Composition</p>
          <h2 style={SECTION_H2_STYLE}>Body Composition Considerations</h2>

          {/* Fat mass reduction */}
          <div
            style={{
              marginBottom: '28px',
              paddingBottom: '28px',
              borderBottom: '1px solid rgba(26, 39, 68, 0.8)',
            }}
          >
            <h3 style={SUBHEADING_STYLE}>Fat Mass Reduction During Pharmacotherapy</h3>
            <p style={PROSE_STYLE}>
              Reductions in total adipose tissue have been a consistent finding across published
              randomised trial data for GLP-1 receptor agonist therapy. The magnitude of fat
              mass loss observed in clinical trial datasets has been associated with improvements
              in cardiometabolic risk markers, including glycated haemoglobin, triglycerides,
              and blood pressure, across multiple published analyses.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The reduction of excess adiposity during pharmacotherapy has been described as one
              of the primary intended therapeutic outcomes of incretin-based treatment for
              obesity, and represents a clinically meaningful endpoint in the published
              evaluation of this drug class.
            </p>
          </div>

          {/* Lean mass changes */}
          <div
            style={{
              marginBottom: '28px',
              paddingBottom: '28px',
              borderBottom: '1px solid rgba(26, 39, 68, 0.8)',
            }}
          >
            <h3 style={SUBHEADING_STYLE}>Lean Mass Changes During Weight Loss</h3>
            <p style={PROSE_STYLE}>
              Alongside fat mass reduction, changes in lean body mass have been reported as an
              associated finding across multiple GLP-1 trial datasets. Available data from the
              STEP programme and SURMOUNT-1 describe lean mass losses occurring as a proportion
              of total weight lost. The clinical significance of this lean mass reduction —
              particularly across the duration of long-term continuous pharmacotherapy — has
              been described in published literature as a consideration for physician-led
              monitoring frameworks.
            </p>
            <p style={PROSE_MUTED_STYLE}>
              The degree to which lean mass loss during GLP-1 therapy is modifiable through
              nutritional and exercise co-interventions has been the subject of emerging
              research. Published data from Lundgren et al. described the combination of
              exercise with pharmacotherapy as associated with more favourable lean mass outcomes
              than pharmacotherapy alone over a 52-week observation period.
            </p>
          </div>

          {/* Monitoring body composition */}
          <div>
            <h3 style={SUBHEADING_STYLE}>Monitoring Body Composition and Functional Muscle</h3>
            <p style={PROSE_STYLE}>
              Structured monitoring of body composition during weight-loss therapy has been
              described in published clinical literature as a relevant component of
              physician-led care. Clinical consensus frameworks — including those issued by
              the European Working Group on Sarcopenia in Older People (EWGSOP2) and the
              PROT-AGE Study Group — have described structured assessment of lean mass
              indicators and functional muscle capacity as appropriate components of monitoring
              protocols in at-risk populations.
            </p>
            <p style={PROSE_LAST_STYLE}>
              The importance of preserving functional muscle during periods of caloric deficit
              has been described in relation to physical performance, activities of daily
              living, and long-term metabolic health outcomes. As GLP-1 therapy induces caloric
              deficit of a magnitude and duration not previously common in non-surgical
              treatment settings, physician attention to lean mass indicators has been described
              as increasingly relevant in this population.
            </p>
          </div>
        </section>

        {/* ── Section D: The Role of Longitudinal Monitoring ─────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Monitoring Rationale</p>
          <h2 style={SECTION_H2_STYLE}>The Role of Longitudinal Monitoring</h2>

          <p style={PROSE_STYLE}>
            Ongoing clinical assessment during incretin-based therapy encompasses multiple
            domains beyond weight change alone. Published clinical guidance has described
            the importance of tracking functional health indicators — including muscle strength,
            physical performance, and activities of daily living — over the duration of
            long-term pharmacological weight management.
          </p>

          <p style={PROSE_STYLE}>
            Nutritional considerations during GLP-1 therapy have been described in clinical
            literature as a relevant area for structured physician attention. The appetite
            suppression associated with incretin-based pharmacotherapy has been reported as
            associated with reductions in overall dietary intake; in populations with already
            suboptimal protein consumption, this reduction may carry implications for dietary
            protein adequacy and the support of lean mass preservation. Published frameworks
            from the PROT-AGE Study Group and ESPEN Expert Group describe elevated dietary
            protein targets — in the range of 1.0–1.5 g/kg body weight per day — for adults
            in clinical risk categories.
          </p>

          <p style={PROSE_STYLE}>
            Physician oversight remains the governing framework for all clinical decisions
            during incretin-based therapy. Published consensus documents describe individual
            clinical assessment — encompassing patient history, co-morbidity status, functional
            capacity, and nutritional evaluation — as essential components of longitudinal
            management in this setting.
          </p>

          <p style={PROSE_LAST_STYLE}>
            The Sarcopenia Risk Index (SRI) is an expert-consensus framework currently
            undergoing prospective evaluation, developed to support structured physician
            observation of sarcopenia risk indicators during weight-loss therapy. It is not a
            validated instrument, and its outputs do not constitute medical advice, clinical
            diagnosis, or treatment recommendations. All clinical decisions remain the
            responsibility of the treating physician.
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
              GLP-1 Therapy — Referenced Literature
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.7, margin: 0 }}>
              Randomised controlled trial data and outcome literature describing the efficacy,
              duration-dependence, and body composition implications of GLP-1 and
              incretin-based therapy. All {citations.length} references are peer-reviewed
              and indexed.
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
              { href: '/research/sarcopenia-risk', label: 'Sarcopenia Risk' },
              { href: '/research/protein-requirements', label: 'Protein Requirements' },
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
