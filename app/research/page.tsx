/**
 * /research — Observational Research Infrastructure
 *
 * Public institutional page presenting the MyoGuard Protocol
 * observational registry to physicians, academic researchers,
 * and institutional collaborators.
 *
 * POSITIONING CONSTRAINTS (non-negotiable):
 * - No enrollment numbers, cohort counts, or metrics of any kind.
 * - No active-study claims. Infrastructure is built; no active
 *   studies are currently running.
 * - Never: "clinical trial", "validated instrument", "AI research",
 *           "predictive AI", "patient database".
 * - Always: "observational registry", "physician-led data collection",
 *            "de-identified cohort data", "observational infrastructure".
 * - Mandatory positioning: "The SRI framework is designed to support
 *   prospective evaluation through this observational infrastructure."
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Research Infrastructure | MyoGuard Protocol',
  description:
    'Longitudinal observational infrastructure for physician-led sarcopenia and GLP-1 metabolic data collection. Designed to support prospective evaluation of the Sarcopenia Risk Index (SRI).',
};

// ── Shared style tokens ───────────────────────────────────────────────────────

const LABEL_STYLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: '#2DD4BF',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  marginBottom: '10px',
};

const CARD_STYLE: CSSProperties = {
  background: '#0D1421',
  border: '1px solid #1A2744',
  borderRadius: '16px',
  padding: '28px',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  return (
    <main style={{ background: '#080C14', minHeight: '100vh' }}>
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '56px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >

        {/* ── A: Header ──────────────────────────────────────────────────────── */}
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
            Observational Research<br />Infrastructure
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
            A longitudinal observational registry for physician-led data collection
            at the intersection of GLP-1 receptor agonist therapy and skeletal
            muscle preservation. Designed to support prospective evaluation of
            the Sarcopenia Risk Index (SRI) framework.
          </p>
        </header>

        {/* ── B: Registry Description ────────────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Observational Registry</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 14px 0',
            }}
          >
            Physician-Led Longitudinal Data Collection
          </h2>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              margin: '0 0 14px 0',
            }}
          >
            The MyoGuard Protocol observational registry is an infrastructure for
            collecting de-identified cohort data from physician-led SRI assessments
            across real-world clinical settings. Physicians who prescribe GLP-1
            receptor agonists may attribute patients to their registry cohort
            through the referral architecture.
          </p>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            Each assessment captures sarcopenia risk indicators at a defined point
            in time. Longitudinal tracking enables trajectory analysis across a
            patient&apos;s GLP-1 treatment course &mdash; from initiation through dose
            escalation and maintenance phases.
          </p>
        </section>

        {/* ── C: Evidence Gaps ───────────────────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Evidence Context</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 14px 0',
            }}
          >
            What the Literature Identifies as Unresolved
          </h2>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748B',
              lineHeight: 1.6,
              fontStyle: 'italic',
              margin: '0 0 22px 0',
            }}
          >
            The following reflects gaps identified in the published literature.
            These are not claims that MyoGuard Protocol has resolved them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div style={{ borderLeft: '2px solid #1A2744', paddingLeft: '18px' }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 6px 0',
                }}
              >
                Muscle mass preservation in GLP-1 therapy
              </p>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#94A3B8',
                  lineHeight: 1.75,
                  margin: 0,
                }}
              >
                Published data on GLP-1 receptor agonist therapies &mdash; including
                semaglutide and tirzepatide &mdash; indicate that a proportion of total
                weight loss derives from lean mass. The clinical significance of this
                lean mass attrition over multi-year treatment courses remains
                incompletely characterised in longitudinal observational studies.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid #1A2744', paddingLeft: '18px' }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 6px 0',
                }}
              >
                Sarcopenia risk stratification tooling
              </p>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#94A3B8',
                  lineHeight: 1.75,
                  margin: 0,
                }}
              >
                Standardised, scalable assessment instruments for sarcopenia risk
                identification in GLP-1-treated outpatient populations are not yet
                widely deployed. Most published studies rely on DXA or BIA in
                specialist settings, rather than accessible risk-stratification proxies
                suitable for integration into primary care clinical workflows.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid #1A2744', paddingLeft: '18px' }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 6px 0',
                }}
              >
                Protein adequacy in medically supervised weight management
              </p>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#94A3B8',
                  lineHeight: 1.75,
                  margin: 0,
                }}
              >
                Dietary protein intake monitoring in patients undergoing medically
                supervised GLP-1 therapy is inconsistent across clinical practice.
                Observational data linking protein adequacy targets to lean mass
                preservation outcomes in this population remains sparse.
              </p>
            </div>

          </div>
        </section>

        {/* ── D: Infrastructure Architecture — Three Cards ───────────────────── */}
        <section>
          <p style={{ ...LABEL_STYLE, marginBottom: '20px' }}>Infrastructure Architecture</p>
          <div
            className="grid grid-cols-1 sm:grid-cols-3"
            style={{ gap: '16px' }}
          >

            {/* Card 1 — Three-Layer Data Separation */}
            <div
              style={{
                background: '#0D1421',
                border: '1px solid #1A2744',
                borderRadius: '14px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(45,212,191,0.08)',
                  border: '1px solid rgba(45,212,191,0.15)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#2DD4BF"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
                  />
                </svg>
              </div>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: 0,
                }}
              >
                Three-Layer Data Separation
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Clinical CDS, observational research infrastructure, and
                de-identified export operate as distinct architectural layers.
                PHI never crosses the research boundary.
              </p>
            </div>

            {/* Card 2 — De-identification Governance */}
            <div
              style={{
                background: '#0D1421',
                border: '1px solid #1A2744',
                borderRadius: '14px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(45,212,191,0.08)',
                  border: '1px solid rgba(45,212,191,0.15)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#2DD4BF"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: 0,
                }}
              >
                De-identification Governance
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                A thirteen-field PHI exclusion set governs all research exports.
                The sole patient identifier in export data is a pseudonymous
                research participant ID.
              </p>
            </div>

            {/* Card 3 — Consent Infrastructure */}
            <div
              style={{
                background: '#0D1421',
                border: '1px solid #1A2744',
                borderRadius: '14px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(45,212,191,0.08)',
                  border: '1px solid rgba(45,212,191,0.15)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#2DD4BF"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: 0,
                }}
              >
                Consent Infrastructure
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Patient consent is versioned and auditable. Patients may withdraw
                at any point; withdrawal triggers data suppression in all future
                cohort exports.
              </p>
            </div>

          </div>
        </section>

        {/* ── E: Positioning Statement ───────────────────────────────────────── */}
        <section
          style={{
            ...CARD_STYLE,
            border: '1px solid rgba(45,212,191,0.2)',
          }}
        >
          <p style={LABEL_STYLE}>Clinical Positioning</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p
              style={{
                fontSize: '0.9375rem',
                color: '#94A3B8',
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              The MyoGuard Protocol is classified as{' '}
              <strong style={{ color: '#F1F5F9' }}>
                Physician-led Clinical Decision Support (CDS)
              </strong>
              . All outputs are intended to augment physician clinical judgement
              &mdash; not to replace it.
            </p>
            <p
              style={{
                fontSize: '0.9375rem',
                color: '#94A3B8',
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              The Sarcopenia Risk Index (SRI) is an expert-consensus framework.
              It is not currently a validated clinical instrument. The SRI framework
              is designed to support prospective evaluation through this
              observational infrastructure.
            </p>
            <p
              style={{
                fontSize: '0.9375rem',
                color: '#94A3B8',
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              A provisional patent application is pending. All intellectual property
              is held by Meridian Wellness Systems LLC.
            </p>
          </div>
        </section>

        {/* ── F: Physician CTA ───────────────────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Physician Participation</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 12px 0',
            }}
          >
            An Invitation to Clinical Colleagues
          </h2>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              margin: '0 0 24px 0',
            }}
          >
            Physicians who prescribe GLP-1 receptor agonists and wish to contribute
            to this longitudinal observational registry are invited to explore
            physician participation. Participating physicians retain attribution
            within their cohort and receive access to aggregated de-identified
            findings as the registry matures.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href="/research/participate"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#0d9488',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
                padding: '10px 20px',
                borderRadius: '10px',
                textDecoration: 'none',
              }}
            >
              Explore Participation Details
            </Link>
            <Link
              href="/doctor/sign-up"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                color: '#94A3B8',
                fontSize: '0.875rem',
                fontWeight: 500,
                padding: '10px 20px',
                borderRadius: '10px',
                textDecoration: 'none',
                border: '1px solid #1A2744',
              }}
            >
              Register as a Physician
            </Link>
          </div>
        </section>

        {/* ── G: Ethics & Governance ─────────────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Ethics &amp; Governance</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  background: '#2DD4BF',
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: '8px',
                }}
              />
              <div>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F1F5F9',
                    margin: '0 0 4px 0',
                  }}
                >
                  Consent-first design
                </p>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: '#94A3B8',
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  Patient enrolment in the observational registry requires explicit
                  informed consent. Consent records are versioned and stored
                  independently of clinical CDS records.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  background: '#2DD4BF',
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: '8px',
                }}
              />
              <div>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F1F5F9',
                    margin: '0 0 4px 0',
                  }}
                >
                  Data minimisation
                </p>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: '#94A3B8',
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  Only the data elements necessary for observational analysis are
                  captured in the research layer. PHI fields are excluded by design
                  from all research exports.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  background: '#2DD4BF',
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: '8px',
                }}
              />
              <div>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F1F5F9',
                    margin: '0 0 4px 0',
                  }}
                >
                  Patient withdrawal rights
                </p>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: '#94A3B8',
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  Patients may withdraw from the registry at any time. Withdrawal
                  triggers immediate data suppression across all future cohort
                  analyses.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  background: '#2DD4BF',
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: '8px',
                }}
              />
              <div>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F1F5F9',
                    margin: '0 0 4px 0',
                  }}
                >
                  Physician oversight requirement
                </p>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: '#94A3B8',
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  The registry is designed for physician-attributed data collection.
                  Patient participation is routed through a verified physician
                  relationship.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ── H: Compliance Positioning ──────────────────────────────────────── */}
        <section
          style={{
            borderTop: '1px solid #1A2744',
            paddingTop: '28px',
          }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              color: '#475569',
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            <strong style={{ color: '#64748B' }}>Classification:</strong>{' '}
            Physician-led Clinical Decision Support (CDS). All outputs from the
            MyoGuard Protocol are intended to support physician clinical judgement
            and do not constitute medical advice. The Sarcopenia Risk Index (SRI)
            is an expert-consensus framework and is not currently a validated
            clinical instrument. The SRI framework is designed to support
            prospective evaluation through this observational infrastructure.
            A provisional patent application is pending. All intellectual property
            is held by Meridian Wellness Systems LLC, Wyoming, USA.
            MyoGuard Protocol is a trading name of Meridian Wellness Systems LLC.
          </p>
        </section>

      </div>
    </main>
  );
}
