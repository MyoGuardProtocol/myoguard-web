'use client';

// MyoGuard — Physician Review Summary Collapsible
//
// Core principle:
// MyoGuard generates clinical evidence. The physician generates clinical decisions.
// Never cross that boundary. All outputs are observational. Never diagnostic.
// Never predictive. Never directive.
//
// Client component. Handles collapse state only.
// Receives a fully-formed PhysicianReviewSummary from the server component
// and renders the five-section review document when expanded.
//
// BUILD 5E: First collapsible component in the physician UI.
// No data fetching. No Prisma. No exports. Collapse state only.

import { useState } from 'react';
import type { PhysicianReviewSummary } from '@/src/lib/evidence/physicianReviewSummary';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  summary: PhysicianReviewSummary;
}

// ─── Section definitions ──────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'section1_protocolContext',     label: 'Patient Overview'          },
  { key: 'section2_trajectory',          label: 'Longitudinal Observations' },
  { key: 'section3_continuityAdherence', label: 'Continuity Signals'        },
  { key: 'section4_physicianSignals',    label: 'Review Signals'            },
  { key: 'section5_documentationHistory', label: 'Documentation Timeline'  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhysicianReviewSummaryCollapsible({ summary }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        background:   '#0D1421',
        border:       '1px solid #1A2744',
        borderRadius: '16px',
        overflow:     'hidden',
      }}
    >

      {/* ── Toggle button ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width:          '100%',
          background:     'transparent',
          border:         'none',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '20px 24px',
          cursor:         'pointer',
          textAlign:      'left',
          minHeight:      '44px',
        }}
      >
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize:   '14px',
            fontWeight: '600',
            color:      '#F1F5F9',
          }}
        >
          Physician Review Summary
        </span>
        <span
          style={{
            fontSize:   '13px',
            color:      '#2DD4BF',
            fontWeight: '600',
            flexShrink: 0,
            marginLeft: '16px',
          }}
        >
          {isOpen ? 'Hide Review Summary' : 'Show Review Summary'}
        </span>
      </button>

      {/* ── Expanded content ───────────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            borderTop: '1px solid #1A2744',
            padding:   '24px',
          }}
        >

          {/* Five sections */}
          {SECTIONS.map(({ key, label }) => (
            <div key={key} style={{ marginBottom: '20px' }}>
              <p
                style={{
                  fontSize:      '11px',
                  fontWeight:    '700',
                  color:         '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom:  '8px',
                  marginTop:     0,
                }}
              >
                {label}
              </p>
              <p
                style={{
                  fontSize:   '13px',
                  color:      '#F1F5F9',
                  lineHeight: '1.7',
                  margin:     0,
                  whiteSpace: 'pre-line',
                }}
              >
                {summary[key]}
              </p>
            </div>
          ))}

          {/* Evidence readiness note */}
          {summary.evidenceReadinessNote && (
            <div
              style={{
                borderTop:   '1px solid #1A2744',
                paddingTop:  '16px',
                marginTop:   '4px',
              }}
            >
              <p
                style={{
                  fontSize:   '12px',
                  color:      '#94A3B8',
                  lineHeight: '1.6',
                  margin:     0,
                }}
              >
                {summary.evidenceReadinessNote}
              </p>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
