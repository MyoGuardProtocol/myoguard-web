'use client';

/**
 * EverydayProteinReference — MyoGuard Protocol
 *
 * Educational-only reference component. Renders a static grid of common
 * high-protein foods with approximate values to contextualise the patient's
 * CDS-generated daily protein target.
 *
 * CLINICAL POSITIONING (non-negotiable):
 * This component is educational only. It does NOT constitute dietary advice,
 * a meal plan, a nutrition prescription, or personalised medical guidance.
 * Passive equivalency calculations are informational math derived from the
 * static USDA-referenced dataset — not recommendations.
 *
 * DEFERRED [interactive nutrition]: Interactive features — food search,
 * quantity adjusters, running protein tallies, or personalised meal plans —
 * must NOT be added here. Any interactive nutrition tooling requires a
 * separate registered-dietitian partnership review before clinical deployment.
 *
 * Variants:
 *   "clinical" — Midnight Silk dark palette. Collapsed by default; one-tap
 *                expansion. Used on authenticated patient-facing pages.
 *   "print"    — White clinical paper palette. Always expanded — the physician
 *                token report must render the full reference without interaction.
 */

import { useState } from 'react';

// ── Dataset type ───────────────────────────────────────────────────────────────
//
// The `region` field is intentionally optional and unused in the current render
// path. It is included now so that future regional dataset additions (Caribbean,
// Nigerian, South Asian, etc.) can be appended without requiring a schema change
// to this component.
//
// DEFERRED [cultural adaptation]: When UserProfile.dietaryRegion is available,
// add a region-aware filter here and review the expanded food list with a
// registered dietitian panel before deployment.

type ProteinFoodItem = {
  food:     string;
  portion:  string;
  proteinG: number;
  /**
   * Optional region tag for future localisation. Reserved for region-aware
   * filtering once a global food dataset is dietitian-reviewed and approved.
   * Possible future values: 'global' | 'caribbean' | 'nigerian' | 'south-asian' | …
   */
  region?: string;
};

// ── Static reference dataset ───────────────────────────────────────────────────
//
// Values approximate those published in USDA FoodData Central.
// Preparation methods affect final protein content.
//
// DEFERRED [dataset expansion]: Future regional additions may include:
//   Caribbean  — Doubles, Pelau, Callaloo
//   Nigerian   — Egusi, Moi Moi, Suya
// These require dietitian review before being surfaced to patients.

const PROTEIN_ITEMS: ReadonlyArray<ProteinFoodItem> = [
  { food: 'Chicken breast, cooked', portion: '100g',           proteinG: 31, region: 'global' },
  { food: 'Whey protein isolate',   portion: '1 scoop (~30g)', proteinG: 27, region: 'global' },
  { food: 'Salmon fillet, cooked',  portion: '100g',           proteinG: 25, region: 'global' },
  { food: 'Canned tuna, drained',   portion: '100g',           proteinG: 24, region: 'global' },
  { food: 'Greek yoghurt, plain',   portion: '200g',           proteinG: 20, region: 'global' },
  { food: 'Cottage cheese',         portion: '150g',           proteinG: 18, region: 'global' },
  { food: 'Lentils, cooked',        portion: '150g',           proteinG: 13, region: 'global' },
  { food: 'Whole eggs',             portion: '2 large',        proteinG: 13, region: 'global' },
];

// ── Props ──────────────────────────────────────────────────────────────────────

type EverydayProteinReferenceProps = {
  /** Protein target in grams from the patient's most recent SRI assessment */
  proteinTargetG: number;
  /**
   * Visual variant.
   * "clinical" → Midnight Silk dark theme, collapsed by default (default).
   * "print"    → White clinical paper theme, always expanded.
   */
  variant?: 'clinical' | 'print';
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function EverydayProteinReference({
  proteinTargetG,
  variant = 'clinical',
}: EverydayProteinReferenceProps) {
  const isPrint    = variant === 'print';
  const isClinical = !isPrint;

  // Print variant is always expanded (no interaction); clinical starts collapsed.
  const [expanded, setExpanded] = useState(isPrint);

  const rounded = Math.round(proteinTargetG);

  return (
    <div
      style={{
        background:   isClinical ? '#0D1421' : '#ffffff',
        border:       isClinical ? '1px solid #1A2744' : '1px solid #e2e8f0',
        borderRadius: isClinical ? '16px'   : '12px',
        padding:      isClinical ? '24px'   : '20px',
      }}
    >
      {/* ── Section header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: expanded ? (isClinical ? '20px' : '14px') : '0' }}>
        <p
          style={{
            fontSize:      '10px',
            fontWeight:    700,
            color:         isClinical ? '#2DD4BF' : '#0f766e',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom:  '6px',
          }}
        >
          Everyday Protein Reference
        </p>
        <p
          style={{
            fontSize:   isClinical ? '12px' : '11px',
            color:      isClinical ? '#94A3B8' : '#64748b',
            lineHeight: '1.55',
            margin:     0,
          }}
        >
          Approximate protein values from common foods to contextualise your{' '}
          <strong style={{ color: isClinical ? '#F1F5F9' : '#1e293b' }}>
            {rounded}g/day
          </strong>{' '}
          protein target. Educational reference only.
        </p>
      </div>

      {/* ── Expand trigger — clinical only, collapsed state ─────────────────── */}
      {isClinical && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop:    '16px',
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '6px',
            background:   'rgba(45,212,191,0.06)',
            border:       '1px solid rgba(45,212,191,0.2)',
            borderRadius: '10px',
            padding:      '9px 16px',
            cursor:       'pointer',
            color:        '#2DD4BF',
            fontSize:     '12px',
            fontWeight:   600,
            letterSpacing: '0.01em',
          }}
        >
          View Everyday Examples
          <span aria-hidden="true" style={{ fontSize: '10px' }}>▾</span>
        </button>
      )}

      {/* ── Expanded content ─────────────────────────────────────────────────── */}
      {expanded && (
        <>
          {/* ── Reference grid — 2-col mobile / 4-col sm+ ─────────────────── */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4"
            style={{
              gap:          isClinical ? '10px' : '8px',
              marginBottom: isClinical ? '20px' : '14px',
            }}
          >
            {PROTEIN_ITEMS.map(({ food, portion, proteinG }) => {
              // Approximate Equivalency — informational math only.
              // This is NOT a recommendation or suggested serving schedule.
              const approxServings = Math.ceil(rounded / proteinG);

              return (
                <div
                  key={food}
                  style={{
                    background:   isClinical ? '#080C14' : '#f8fafc',
                    border:       isClinical ? '1px solid #1A2744' : '1px solid #e2e8f0',
                    borderRadius: isClinical ? '12px' : '8px',
                    padding:      isClinical ? '12px'  : '10px',
                    display:      'flex',
                    flexDirection: 'column',
                    gap:          '4px',
                  }}
                >
                  {/* Protein value — most prominent element */}
                  <p
                    style={{
                      fontSize:   isClinical ? '22px' : '17px',
                      fontWeight: 700,
                      color:      isClinical ? '#2DD4BF' : '#0f766e',
                      lineHeight: 1,
                      margin:     '0 0 4px 0',
                    }}
                  >
                    {proteinG}g
                  </p>

                  {/* Food name */}
                  <p
                    style={{
                      fontSize:   isClinical ? '11px' : '10px',
                      fontWeight: 500,
                      color:      isClinical ? '#F1F5F9' : '#334155',
                      lineHeight: 1.35,
                      margin:     0,
                    }}
                  >
                    {food}
                  </p>

                  {/* Portion size */}
                  <p
                    style={{
                      fontSize: isClinical ? '10px' : '9px',
                      color:    isClinical ? '#64748B' : '#94a3b8',
                      margin:   '0 0 6px 0',
                    }}
                  >
                    {portion}
                  </p>

                  {/* Approximate Equivalency divider */}
                  <div
                    style={{
                      borderTop:  isClinical ? '1px solid #1A2744' : '1px solid #e2e8f0',
                      paddingTop: '6px',
                    }}
                  >
                    <p
                      style={{
                        fontSize:      isClinical ? '8px' : '8px',
                        fontWeight:    700,
                        color:         isClinical ? '#475569' : '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        margin:        '0 0 2px 0',
                      }}
                    >
                      Approx. Equivalency
                    </p>
                    <p
                      style={{
                        fontSize:   isClinical ? '10px' : '9px',
                        color:      isClinical ? '#94A3B8' : '#475569',
                        lineHeight: 1.4,
                        margin:     0,
                      }}
                    >
                      ~{approxServings} servings ≈ {rounded}g
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Attribution + disclaimer ─────────────────────────────────────── */}
          <div
            style={{
              borderTop:  isClinical ? '1px solid #1A2744' : '1px solid #e2e8f0',
              paddingTop: isClinical ? '16px' : '12px',
              display:    'flex',
              flexDirection: 'column',
              gap:        '8px',
            }}
          >
            {/* USDA attribution */}
            <p
              style={{
                fontSize:   isClinical ? '10px' : '9px',
                color:      isClinical ? '#475569' : '#94a3b8',
                lineHeight: 1.6,
                margin:     0,
              }}
            >
              Protein values derived from{' '}
              <strong style={{ color: isClinical ? '#64748B' : '#64748b' }}>
                USDA FoodData Central
              </strong>{' '}
              reference data.
            </p>

            {/* Disclaimer */}
            <p
              style={{
                fontSize:  isClinical ? '10px' : '9px',
                color:     isClinical ? '#475569' : '#94a3b8',
                lineHeight: 1.6,
                fontStyle: 'italic',
                margin:    0,
              }}
            >
              Protein values are approximate and provided for educational reference
              only. Individual dietary needs should be reviewed with a qualified
              healthcare professional.
            </p>
          </div>

          {/* ── Collapse trigger — clinical only ─────────────────────────────── */}
          {isClinical && (
            <button
              onClick={() => setExpanded(false)}
              style={{
                marginTop:     '16px',
                display:       'inline-flex',
                alignItems:    'center',
                gap:           '5px',
                background:    'transparent',
                border:        'none',
                cursor:        'pointer',
                color:         '#475569',
                fontSize:      '11px',
                fontWeight:    500,
                padding:       '4px 0',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '9px' }}>▴</span>
              Hide examples
            </button>
          )}
        </>
      )}
    </div>
  );
}
