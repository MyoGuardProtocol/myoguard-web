/**
 * ContributingFactors — server component (no 'use client').
 *
 * Renders the 5 muscle-protection factor cards on the patient dashboard.
 * All computation is done in the parent (deriveFactors helper); this
 * component is pure presentation.
 *
 * Layout: 2-column grid. The 5th card spans full width so the row is
 * visually balanced.
 */

export type ImpactLevel = 'LOW' | 'MODERATE' | 'HIGH';

export type Factor = {
  icon:   string;        // emoji character
  label:  string;        // e.g. "Protein Intake"
  state:  string;        // concise current status, one line
  detail: string;        // patient-friendly explanation, 1–2 sentences
  impact: ImpactLevel;
};

const IMPACT_STYLES: Record<ImpactLevel, {
  pill:   string;
  dot:    string;
  label:  string;
}> = {
  LOW:      { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Low impact'      },
  MODERATE: { pill: 'bg-amber-50   text-amber-700   border-amber-200',   dot: 'bg-amber-500',   label: 'Moderate impact' },
  HIGH:     { pill: 'bg-orange-50  text-orange-700  border-orange-200',  dot: 'bg-orange-500',  label: 'High impact'     },
};

function FactorCard({ factor, wide }: { factor: Factor; wide?: boolean }) {
  const { pill, dot, label: impactLabel } = IMPACT_STYLES[factor.impact];

  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3${wide ? ' col-span-2' : ''}`}
    >
      {/* Icon + label row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none flex-shrink-0">{factor.icon}</span>
          <p className="text-sm font-semibold text-slate-800 leading-tight">{factor.label}</p>
        </div>
        {/* Impact pill */}
        <span
          className={`inline-flex items-center gap-1.5 flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
          {impactLabel}
        </span>
      </div>

      {/* State */}
      <p className="text-sm font-bold text-slate-900 leading-snug">{factor.state}</p>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Detail */}
      <p className="text-xs text-slate-500 leading-relaxed">{factor.detail}</p>
    </div>
  );
}

export default function ContributingFactors({ factors }: { factors: Factor[] }) {
  if (!factors.length) return null;

  // Split: first 4 in 2×2 grid, 5th spans full width
  const gridFactors = factors.slice(0, 4);
  const wideFactors = factors.slice(4);

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Contributing Factors
        </p>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {gridFactors.map((f) => (
          <FactorCard key={f.label} factor={f} />
        ))}
        {wideFactors.map((f) => (
          <FactorCard key={f.label} factor={f} wide />
        ))}
      </div>
    </section>
  );
}
