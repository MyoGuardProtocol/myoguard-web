/**
 * /research/participate — Physician Participation Detail
 *
 * Detailed public page describing how physicians participate in the
 * MyoGuard Protocol observational registry: workflow, patient experience,
 * data governance, consent architecture, and enrollment process.
 *
 * POSITIONING CONSTRAINTS (non-negotiable):
 * - No enrollment numbers, cohort counts, or metrics of any kind.
 * - Study type: observational, non-interventional. Never "clinical trial".
 * - The SRI framework is designed to support prospective evaluation through
 *   this observational infrastructure. — mandatory, used verbatim.
 * - CTA routes to /doctor/sign-up (register) and /doctor/sign-in (existing).
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Physician Participation | Research Infrastructure | MyoGuard Protocol',
  description:
    'Details of physician participation in the MyoGuard Protocol observational registry — workflow, data governance, consent architecture, and the enrollment process.',
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

export default function ResearchParticipatePage() {
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

        {/* Back link */}
        <Link
          href="/research"
          style={{
            fontSize: '0.8125rem',
            color: '#64748B',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          &larr; Research Infrastructure
        </Link>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header>
          <p style={LABEL_STYLE}>Physician Participation</p>
          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(1.6rem, 4vw, 2.25rem)',
              fontWeight: 700,
              color: '#F1F5F9',
              lineHeight: 1.2,
              margin: '0 0 16px 0',
            }}
          >
            Participating in the<br />Observational Registry
          </h1>
          <p
            style={{
              fontSize: '1.0625rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              maxWidth: '620px',
              margin: 0,
            }}
          >
            This document describes how physician participation in the MyoGuard
            Protocol observational registry works &mdash; including physician workflow,
            patient experience, data governance, and consent architecture.
          </p>
        </header>

        {/* ── Section 1: Study Design Overview ───────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Study Design</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 14px 0',
            }}
          >
            Observational, Non-Interventional
          </h2>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              margin: '0 0 14px 0',
            }}
          >
            The registry collects observational data generated through routine
            clinical use of the MyoGuard Protocol CDS platform. No experimental
            intervention is introduced. Patient assessments are completed as part
            of the standard physician-led clinical workflow.
          </p>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              margin: '0 0 18px 0',
            }}
          >
            The SRI framework is designed to support prospective evaluation
            through this observational infrastructure. Longitudinal assessment
            data &mdash; collected across a patient&apos;s GLP-1 treatment course &mdash;
            enables cohort-level trajectory analysis when aggregated at the
            registry level.
          </p>
          <div
            style={{
              background: '#080C14',
              border: '1px solid #1A2744',
              borderRadius: '10px',
              padding: '16px 20px',
            }}
          >
            <p
              style={{
                fontSize: '0.8125rem',
                color: '#64748B',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              <strong style={{ color: '#94A3B8' }}>Study type:</strong>{' '}
              Prospective observational registry
              &ensp;&middot;&ensp;
              <strong style={{ color: '#94A3B8' }}>Intervention:</strong>{' '}
              None &mdash; standard CDS use only
              &ensp;&middot;&ensp;
              <strong style={{ color: '#94A3B8' }}>Population:</strong>{' '}
              GLP-1-treated adult patients
            </p>
          </div>
        </section>

        {/* ── Section 2: Physician Workflow ──────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Physician Workflow</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 22px 0',
            }}
          >
            How Physician Participation Works
          </h2>
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
            }}
          >

            <li style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <span
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#1A2744',
                  flexShrink: 0,
                  lineHeight: 1,
                  paddingTop: '2px',
                  minWidth: '32px',
                }}
              >
                01
              </span>
              <div>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F1F5F9',
                    margin: '0 0 6px 0',
                  }}
                >
                  Register and receive your referral credentials
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#94A3B8',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  Physicians register with MyoGuard Protocol and receive a unique
                  referral slug and activation link. These credentials attribute
                  patient assessments to your cohort within the registry.
                </p>
              </div>
            </li>

            <li style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <span
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#1A2744',
                  flexShrink: 0,
                  lineHeight: 1,
                  paddingTop: '2px',
                  minWidth: '32px',
                }}
              >
                02
              </span>
              <div>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F1F5F9',
                    margin: '0 0 6px 0',
                  }}
                >
                  Share the activation link with eligible patients
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#94A3B8',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  Eligible patients &mdash; those receiving or being considered for
                  GLP-1 receptor agonist therapy &mdash; are invited to complete an
                  SRI assessment via your physician activation link. No account
                  creation is required for the initial assessment.
                </p>
              </div>
            </li>

            <li style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <span
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#1A2744',
                  flexShrink: 0,
                  lineHeight: 1,
                  paddingTop: '2px',
                  minWidth: '32px',
                }}
              >
                03
              </span>
              <div>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F1F5F9',
                    margin: '0 0 6px 0',
                  }}
                >
                  Patient completes consent and assessment
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#94A3B8',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  Patients who wish to participate in the observational registry
                  provide explicit informed consent during the assessment process.
                  Consent is versioned and stored independently of clinical CDS
                  records. Patients who decline research consent continue through
                  the standard clinical workflow.
                </p>
              </div>
            </li>

            <li style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <span
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#1A2744',
                  flexShrink: 0,
                  lineHeight: 1,
                  paddingTop: '2px',
                  minWidth: '32px',
                }}
              >
                04
              </span>
              <div>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F1F5F9',
                    margin: '0 0 6px 0',
                  }}
                >
                  Longitudinal assessment data builds over time
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#94A3B8',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  Repeat assessments &mdash; completed during routine follow-up
                  consultations &mdash; accumulate longitudinal data within your cohort.
                  This trajectory data forms the analytical basis for future
                  observational evaluation.
                </p>
              </div>
            </li>

          </ol>
        </section>

        {/* ── Section 3: Patient Experience ──────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Patient Experience</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 14px 0',
            }}
          >
            What Patients Experience
          </h2>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              margin: '0 0 18px 0',
            }}
          >
            Patients complete a structured SRI assessment covering GLP-1 medication
            details, current body metrics, activity level, and symptomatic indicators.
            No laboratory values or imaging data are required at this stage.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {[
              'Consent to research participation is presented clearly and distinctly from the clinical CDS workflow.',
              'Patients may decline research participation and continue to receive CDS outputs through the standard clinical flow.',
              'Patients may withdraw consent at any time. Withdrawal triggers data suppression across all future cohort exports.',
              'No patient-identifiable data is included in any research export or cohort analysis.',
            ].map((point) => (
              <div
                key={point}
                style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}
              >
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
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#94A3B8',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  {point}
                </p>
              </div>
            ))}

          </div>
        </section>

        {/* ── Section 4: Data Governance ─────────────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Data Governance</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 14px 0',
            }}
          >
            Three-Layer Data Architecture
          </h2>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              margin: '0 0 20px 0',
            }}
          >
            Clinical CDS, observational research infrastructure, and de-identified
            export are maintained as architecturally distinct layers. PHI does not
            cross the clinical-to-research boundary.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            <div
              style={{
                background: 'rgba(45,212,191,0.04)',
                border: '1px solid #1A2744',
                borderRadius: '10px',
                padding: '16px 20px',
              }}
            >
              <p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 4px 0',
                }}
              >
                Layer 1 &mdash; Clinical CDS
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Assessment data, SRI outputs, protocol plans. PHI present.
                Physician and patient access only. Never exported to the
                research layer.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(45,212,191,0.07)',
                border: '1px solid #1A2744',
                borderRadius: '10px',
                padding: '16px 20px',
              }}
            >
              <p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 4px 0',
                }}
              >
                Layer 2 &mdash; Observational Research Infrastructure
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                De-identified cohort records. Patient identifier replaced by
                a pseudonymous research participant ID. Physician attribution
                retained for cohort grouping.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(45,212,191,0.10)',
                border: '1px solid #1A2744',
                borderRadius: '10px',
                padding: '16px 20px',
              }}
            >
              <p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 4px 0',
                }}
              >
                Layer 3 &mdash; De-identified Export
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Aggregate CSV pipeline for cohort-level analysis. A
                thirteen-field PHI exclusion set is enforced at export.
                An audit trail is maintained for all export operations.
              </p>
            </div>

          </div>
        </section>

        {/* ── Section 5: Consent Architecture ───────────────────────────────── */}
        <section style={CARD_STYLE}>
          <p style={LABEL_STYLE}>Consent Architecture</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 20px 0',
            }}
          >
            Informed Consent Design
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div style={{ borderLeft: '2px solid #1A2744', paddingLeft: '18px' }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 5px 0',
                }}
              >
                Explicit and separate consent capture
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Research consent is collected as a distinct step, separate from
                the clinical CDS workflow. Patients cannot inadvertently enrol
                through routine assessment completion.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid #1A2744', paddingLeft: '18px' }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 5px 0',
                }}
              >
                Versioned consent records
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Each consent event is recorded with a consent version, timestamp,
                and patient identifier. If the consent document is updated, patients
                are required to re-consent before continued research participation.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid #1A2744', paddingLeft: '18px' }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 5px 0',
                }}
              >
                Right to withdraw
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Patients retain the right to withdraw at any time. Withdrawal is
                processed immediately and triggers data suppression in all
                subsequent cohort exports.
              </p>
            </div>

            <div style={{ borderLeft: '2px solid #1A2744', paddingLeft: '18px' }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  margin: '0 0 5px 0',
                }}
              >
                Audit trail
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#94A3B8',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                All consent events &mdash; grant, update, and withdrawal &mdash; are
                recorded in an auditable event log maintained independently of
                the clinical CDS record.
              </p>
            </div>

          </div>
        </section>

        {/* ── Section 6: Enrollment Process / CTA ───────────────────────────── */}
        <section
          style={{
            ...CARD_STYLE,
            border: '1px solid rgba(45,212,191,0.2)',
          }}
        >
          <p style={LABEL_STYLE}>Express Interest</p>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 12px 0',
            }}
          >
            Physician Registration
          </h2>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#94A3B8',
              lineHeight: 1.75,
              margin: '0 0 14px 0',
            }}
          >
            Physicians who wish to contribute to the observational registry are
            invited to register through the MyoGuard Protocol physician portal.
            Following registration, an activation link and referral credentials
            are generated for patient attribution.
          </p>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748B',
              lineHeight: 1.7,
              margin: '0 0 24px 0',
            }}
          >
            For institutional enquiries, partnership discussions, or academic
            collaboration, contact{' '}
            <a
              href="mailto:hello@myoguard.health"
              style={{ color: '#2DD4BF', textDecoration: 'none' }}
            >
              hello@myoguard.health
            </a>
            .
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href="/doctor/sign-up"
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
              Register as a Physician
            </Link>
            <Link
              href="/doctor/sign-in"
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
              Physician Sign-in
            </Link>
          </div>
        </section>

        {/* ── Compliance footer ──────────────────────────────────────────────── */}
        <section style={{ borderTop: '1px solid #1A2744', paddingTop: '28px' }}>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#475569',
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            <strong style={{ color: '#64748B' }}>Classification:</strong>{' '}
            Physician-led Clinical Decision Support (CDS). The Sarcopenia Risk
            Index (SRI) is an expert-consensus framework and is not currently a
            validated clinical instrument. The SRI framework is designed to
            support prospective evaluation through this observational
            infrastructure. All intellectual property is held by Meridian
            Wellness Systems LLC, Wyoming, USA. Provisional patent application
            pending.
          </p>
        </section>

      </div>
    </main>
  );
}
