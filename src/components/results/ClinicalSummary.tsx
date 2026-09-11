'use client';

import type { ProtocolResult, AssessmentInput, PhysicianInfo, RiskBand } from '@/src/types';

type ClinicalSummaryProps = {
  results:    ProtocolResult;
  formData:   AssessmentInput;
  physician?: PhysicianInfo | null;
};

const MED_LABEL: Record<AssessmentInput['medication'], string> = {
  semaglutide: 'Semaglutide (Ozempic / Wegovy)',
  tirzepatide: 'Tirzepatide (Zepbound / Mounjaro)',
};

const ACTIVITY_LABEL: Record<AssessmentInput['activityLevel'], string> = {
  sedentary: 'Sedentary',
  moderate:  'Moderate',
  active:    'Active',
};

/**
 * Presentation map keyed by the engine's authoritative `riskBand`.
 *
 * The band is never recomputed from the numeric SRI here: the engine can force
 * CRITICAL via the recovery override regardless of the numeric value, and
 * re-deriving it from the number would hide that.
 *
 * No thresholds are duplicated — keys are band values, not score ranges.
 */
const BAND_PRESENTATION: Record<RiskBand, { level: string; badge: string; dot: string; fill: string }> = {
  LOW:      { level: 'LOW RISK',      badge: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500', fill: 'bg-emerald-500' },
  MODERATE: { level: 'MODERATE RISK', badge: 'bg-amber-100   text-amber-700   border-amber-300',   dot: 'bg-amber-500',   fill: 'bg-amber-500'   },
  HIGH:     { level: 'HIGH RISK',     badge: 'bg-red-100     text-red-700     border-red-300',     dot: 'bg-red-500',     fill: 'bg-red-500'     },
  CRITICAL: { level: 'CRITICAL RISK', badge: 'bg-red-200     text-red-900     border-red-400',     dot: 'bg-red-700',     fill: 'bg-red-700'     },
};

/**
 * Clinical report header shown at the top of the results page.
 * Contains: assessment date, medication, activity level, referring physician,
 * and the MyoGuard Score with prominent risk badge.
 * No calculation logic — presentation only.
 */
export default function ClinicalSummary({ results, formData, physician }: ClinicalSummaryProps) {
  // Authoritative band from the engine — never recomputed from myoguardScore.
  const risk = BAND_PRESENTATION[results.riskBand];

  const assessmentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const rows: { label: string; value: string }[] = [
    { label: 'Assessment Date',  value: assessmentDate },
    { label: 'Medication',       value: `${MED_LABEL[formData.medication]} · ${formData.doseMg} mg/week` },
    { label: 'Activity Level',   value: ACTIVITY_LABEL[formData.activityLevel] },
  ];

  if (physician?.displayName) {
    rows.push({ label: 'Referring Physician', value: physician.displayName });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">

      {/* ── Teal header band ── */}
      <div className="bg-teal-600 px-5 py-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-white opacity-80 flex-shrink-0" />
        <p className="text-xs font-bold text-white uppercase tracking-widest">
          MyoGuard Clinical Summary
        </p>
      </div>

      {/* ── Metadata rows ── */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <dl className="space-y-2">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-3">
              <dt className="w-40 flex-shrink-0 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}
              </dt>
              <dd className={`text-sm text-slate-800 ${label === 'Referring Physician' ? 'font-semibold text-teal-700' : ''}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Score block ── */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          MyoGuard Muscle Preservation Score
        </p>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Score number */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-extrabold text-slate-800 leading-none tabular-nums">
              {results.myoguardScore}
            </span>
            <span className="text-xl text-slate-400 font-normal">/&nbsp;100</span>
          </div>

          {/* Risk badge */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-bold ${risk.badge}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${risk.dot}`} />
            {risk.level}
          </span>
        </div>

        {/* Mini progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${risk.fill}`}
            style={{ width: `${results.myoguardScore}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 select-none">
          <span>0</span>
          <span>40</span>
          <span>60</span>
          <span>80 — 100</span>
        </div>
      </div>
    </div>
  );
}
