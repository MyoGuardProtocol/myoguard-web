/**
 * EverydayProteinReference — MyoGuard Protocol
 *
 * Educational-only reference component. Renders a static grid of common
 * high-protein foods with approximate values to contextualise the patient's
 * CDS-generated daily protein target.
 *
 * DEFERRED [reference-only rationale]: This component is intentionally static
 * and display-only. Interactive features — food search, quantity adjusters,
 * running protein tallies, or personalised meal plans — must NOT be added here.
 * Any interactive nutrition tooling requires a separate registered-dietitian
 * partnership review before clinical deployment on MyoGuard Protocol.
 *
 * Variants:
 *   "clinical" — Midnight Silk dark palette for authenticated patient pages.
 *   "print"    — White clinical paper palette for the physician token report.
 *                The print variant is deliberately more restrained: smaller
 *                typography, lighter borders, reduced teal prominence. The
 *                physician token report must remain clinical document first,
 *                educational reference second.
 */

type EverydayProteinReferenceProps = {
  /** Protein target in grams from the patient's most recent SRI assessment */
  proteinTargetG: number;
  /**
   * Visual variant.
   * "clinical" → Midnight Silk dark theme (default).
   * "print"    → White clinical paper theme for /report/[token].
   */
  variant?: 'clinical' | 'print';
};

// DEFERRED [cultural adaptation]: Food items are currently standardised to a
// Western dietary profile. A future iteration should localise this list per
// patient region and dietary preference (e.g., tofu, tempeh, paneer, edamame,
// quark for relevant markets). Requires a UserProfile.dietaryRegion field and
// a region-aware reference-food lookup table reviewed by a registered dietitian
// panel before deployment.
const PROTEIN_ITEMS: ReadonlyArray<{ food: string; portion: string; proteinG: number }> = [
  { food: 'Chicken breast, cooked', portion: '100g',            proteinG: 31 },
  { food: 'Whey protein isolate',   portion: '1 scoop (~30g)',  proteinG: 27 },
  { food: 'Salmon fillet, cooked',  portion: '100g',            proteinG: 25 },
  { food: 'Canned tuna, drained',   portion: '100g',            proteinG: 24 },
  { food: 'Greek yoghurt, plain',   portion: '200g',            proteinG: 20 },
  { food: 'Cottage cheese',         portion: '150g',            proteinG: 18 },
  { food: 'Lentils, cooked',        portion: '150g',            proteinG: 13 },
  { food: 'Whole eggs',             portion: '2 large',         proteinG: 13 },
];

export default function EverydayProteinReference({
  proteinTargetG,
  variant = 'clinical',
}: EverydayProteinReferenceProps) {
  const isClinical = variant === 'clinical';
  const rounded    = Math.round(proteinTargetG);

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
      <div style={{ marginBottom: isClinical ? '20px' : '14px' }}>
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
          These examples are approximate protein values from common foods,
          intended to help contextualise your daily protein target.
        </p>
      </div>

      {/* ── Reference grid — 2-col mobile / 4-col sm+ ───────────────────────── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{
          gap:          isClinical ? '10px' : '8px',
          marginBottom: isClinical ? '20px' : '14px',
        }}
      >
        {PROTEIN_ITEMS.map(({ food, portion, proteinG }) => (
          <div
            key={food}
            style={{
              background:   isClinical ? '#080C14' : '#f8fafc',
              border:       isClinical ? '1px solid #1A2744' : '1px solid #e2e8f0',
              borderRadius: isClinical ? '12px' : '8px',
              padding:      isClinical ? '12px'  : '10px',
            }}
          >
            {/* Protein value — most prominent element in each card */}
            <p
              style={{
                fontSize:     isClinical ? '22px' : '17px',
                fontWeight:   700,
                color:        isClinical ? '#2DD4BF' : '#0f766e',
                lineHeight:   1,
                marginBottom: '5px',
                margin:       '0 0 5px 0',
              }}
            >
              {proteinG}g
            </p>

            {/* Food name */}
            <p
              style={{
                fontSize:     isClinical ? '11px' : '10px',
                fontWeight:   500,
                color:        isClinical ? '#F1F5F9' : '#334155',
                lineHeight:   1.35,
                margin:       '0 0 3px 0',
              }}
            >
              {food}
            </p>

            {/* Portion size */}
            <p
              style={{
                fontSize: isClinical ? '10px' : '9px',
                color:    isClinical ? '#94A3B8' : '#64748b',
                margin:   0,
              }}
            >
              {portion}
            </p>
          </div>
        ))}
      </div>

      {/* ── Contextual guidance + disclaimer ────────────────────────────────── */}
      <div
        style={{
          borderTop:  isClinical ? '1px solid #1A2744' : '1px solid #e2e8f0',
          paddingTop: isClinical ? '16px' : '12px',
        }}
      >
        {/* Contextual line referencing the patient's specific target */}
        <p
          style={{
            fontSize:     isClinical ? '12px' : '11px',
            color:        isClinical ? '#94A3B8' : '#475569',
            lineHeight:   1.6,
            marginBottom: '8px',
            margin:       '0 0 8px 0',
          }}
        >
          To reach{' '}
          <strong style={{ color: isClinical ? '#F1F5F9' : '#1e293b' }}>
            {rounded}g
          </strong>{' '}
          daily, a combination of protein-rich meals and supplementation is
          typically required.
        </p>

        {/* DEFERRED [meal assembly]: Do not extend this section with meal
            composition guidance, recipe suggestions, food combining rules, or
            meal-timing schedules. If a meal assembly feature is introduced in
            a future build, it must be a separate, physician-reviewed CDS module
            — not an extension of this static reference component. */}
        <p
          style={{
            fontSize:     isClinical ? '12px' : '11px',
            color:        isClinical ? '#94A3B8' : '#475569',
            lineHeight:   1.6,
            marginBottom: isClinical ? '14px' : '10px',
            margin:       `0 0 ${isClinical ? '14px' : '10px'} 0`,
          }}
        >
          Protein targets are typically distributed across 4–5 meals and snacks
          throughout the day.
        </p>

        {/* Disclaimer */}
        <p
          style={{
            fontSize:   isClinical ? '10px' : '9px',
            color:      isClinical ? '#94A3B8' : '#94a3b8',
            lineHeight: 1.6,
            fontStyle:  'italic',
            margin:     0,
          }}
        >
          Values are general estimates. Individual preparation methods affect
          protein content. Consult a registered dietitian for personalised
          nutritional guidance.
        </p>
      </div>
    </div>
  );
}
