import type { ProtocolResult, AssessmentInput } from '@/src/types';

type ScoreProjectionCardProps = {
  results:  ProtocolResult;
  formData: AssessmentInput;
};

type Projection = {
  icon:        string;
  label:       string;
  description: string;
  gain:        number;        // points added to current score
  gainLow:     number;        // lower bound (for range display)
  basis:       'exact' | 'indirect';
};

/**
 * Derives score improvement projections from the known scoring deductions
 * used in protocolEngine.ts. Pure display logic — algorithm is untouched.
 *
 * Deductions in protocolEngine that we can project against:
 *   • Protein deficit vs 1.4 g/kg target:  −8 (< 90%)  or  −15 (< 70%)
 *   • Activity level — sedentary:           −25   moderate: −10   active: 0
 *   • GI symptoms (each):                   −5,  capped at −15
 *
 * Hydration is not a direct scoring factor but supports GI symptom
 * resolution (+5 per symptom), so it is shown as an indirect projection
 * when GI symptoms are present.
 */
function buildProjections(
  formData: AssessmentInput,
  results:  ProtocolResult,
): Projection[] {
  const { activityLevel, symptoms } = formData;
  const { weightKg, proteinStandard, myoguardScore } = results;
  const projections: Projection[] = [];

  // ── 1. Protein ──────────────────────────────────────────────────────────────
  const proteinTarget = weightKg * 1.4;          // 1.4 g/kg reference in engine
  let proteinGain = 0;
  if      (proteinStandard < proteinTarget * 0.70) proteinGain = 15;
  else if (proteinStandard < proteinTarget * 0.90) proteinGain =  8;

  if (proteinGain > 0) {
    projections.push({
      icon:        '🥩',
      label:       'If protein target is achieved',
      description: `Reaching ${Math.round(results.proteinAggressive)} g protein/day eliminates the protein-deficit deduction.`,
      gain:        proteinGain,
      gainLow:     Math.round(proteinGain * 0.6),   // partial adherence lower bound
      basis:       'exact',
    });
  }

  // ── 2. Resistance training ───────────────────────────────────────────────────
  // Sedentary (−25) upgrading to moderate (−10) = +15 net gain
  // Moderate (−10) upgrading to active (0) = +10 net gain
  const trainingGain =
    activityLevel === 'sedentary' ? 15 :
    activityLevel === 'moderate'  ? 10 : 0;

  if (trainingGain > 0) {
    const targetLevel = activityLevel === 'sedentary' ? 'moderate' : 'active';
    projections.push({
      icon:        '🏋️',
      label:       'If resistance training added (2–3×/week)',
      description: `Moving from ${activityLevel} to ${targetLevel} activity is the single highest-impact intervention for lean-mass protection.`,
      gain:        trainingGain,
      gainLow:     trainingGain,
      basis:       'exact',
    });
  }

  // ── 3. Hydration (indirect — via GI symptom improvement) ────────────────────
  const giSymptoms = ['Constipation', 'Nausea', 'Bloating', 'Reduced appetite'];
  const activeGiSymptoms = symptoms.filter(s => giSymptoms.includes(s));

  if (activeGiSymptoms.length > 0) {
    // Each resolved GI symptom = +5 in the score (−5 penalty removed)
    // Conservative: project 1 symptom resolved, optimistic: 2 resolved
    const hydrationGainLow  = 5;
    const hydrationGainHigh = Math.min(activeGiSymptoms.length * 5, 10);
    projections.push({
      icon:        '💧',
      label:       'If hydration baseline is reached',
      description: 'Adequate hydration reduces GI symptoms, each of which carries a 5-point deduction.',
      gain:        hydrationGainHigh,
      gainLow:     hydrationGainLow,
      basis:       'indirect',
    });
  }

  // Only return projections that meaningfully move the score
  return projections.filter(p => myoguardScore + p.gainLow < 100);
}

/** Colour-code a projected score using the same 3-band clinical thresholds. */
function scoreColour(score: number) {
  if (score >= 70) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 40) return { text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'   };
  return               { text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'     };
}

/** Format a projected score as "72" or "70+" when it just crosses Low Risk. */
function formatScore(base: number, gain: number, gainLow: number): string {
  const high = Math.min(100, base + gain);
  const low  = Math.min(100, base + gainLow);

  if (gain === gainLow) {
    // Exact projection — no range
    return high >= 70 && base < 70 ? `${high}` : `${high}`;
  }
  // Range projection
  if (low === high) return `${high}`;
  return `${low}–${high}`;
}

/** Whether the projected score crosses into a better risk band. */
function crossesBand(current: number, projected: number): string | null {
  if (current < 40 && projected >= 40) return 'Enters Moderate Risk';
  if (current < 70 && projected >= 70) return 'Enters Low Risk';
  return null;
}

export default function ScoreProjectionCard({ results, formData }: ScoreProjectionCardProps) {
  const { myoguardScore } = results;
  const projections = buildProjections(formData, results);

  // If every factor is already optimal, show a positive reinforcement message
  if (projections.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-1">Score Projection</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your current inputs are already well-optimised. Maintaining your protein targets,
              activity level, and hydration will preserve your score over time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📈</span>
          <p className="text-sm font-bold text-slate-800">Score Projection</p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          How your MyoGuard Score could improve with key behavioural changes.
        </p>

        {/* Current score pill */}
        <div className="mt-3 inline-flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
          <span className="text-xs text-slate-500 font-medium">Current Score</span>
          <span className="text-sm font-bold text-slate-800 tabular-nums">{myoguardScore}</span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>

      {/* ── Projection rows ── */}
      <div className="divide-y divide-slate-100">
        {projections.map((p, i) => {
          const projectedHigh = Math.min(100, myoguardScore + p.gain);
          const projectedLow  = Math.min(100, myoguardScore + p.gainLow);
          const bandCrossing  = crossesBand(myoguardScore, projectedHigh);
          const colour        = scoreColour(projectedHigh);
          const scoreDisplay  = formatScore(myoguardScore, p.gain, p.gainLow);

          return (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg ${colour.bg} ${colour.border} border`}>
                  {p.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-xs font-semibold text-slate-700">{p.label}</p>
                    {p.basis === 'indirect' && (
                      <span className="text-[10px] text-slate-400 font-medium bg-slate-100 rounded-full px-1.5 py-0.5">
                        indirect
                      </span>
                    )}
                  </div>

                  {/* Score arrow */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs text-slate-400 tabular-nums">{myoguardScore}</span>
                    <span className="text-slate-300 text-xs">→</span>
                    <span className={`text-base font-extrabold tabular-nums leading-none ${colour.text}`}>
                      {scoreDisplay}
                    </span>
                    <span className={`text-[10px] font-semibold ${colour.text}`}>/ 100</span>

                    {/* Band crossing badge */}
                    {bandCrossing && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colour.bg} ${colour.border} ${colour.text}`}>
                        ✓ {bandCrossing}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">{p.description}</p>

                  {/* Mini progress comparison */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-14 flex-shrink-0">Now</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-400"
                          style={{ width: `${myoguardScore}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 w-6 text-right tabular-nums">{myoguardScore}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-14 flex-shrink-0">Projected</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            projectedHigh >= 70 ? 'bg-emerald-500' :
                            projectedHigh >= 40 ? 'bg-amber-500'   : 'bg-red-500'
                          }`}
                          style={{ width: `${projectedHigh}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold w-6 text-right tabular-nums ${colour.text}`}>
                        {projectedLow < projectedHigh ? `${projectedLow}+` : projectedHigh}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer note ── */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Projections are motivational estimates based on the scoring deductions applied to your assessment.
          They are not clinical guarantees. Individual outcomes vary.
        </p>
      </div>
    </div>
  );
}
