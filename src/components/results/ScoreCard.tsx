import type { ProtocolResult, RiskBand } from '@/src/types';

type ScoreCardProps = Pick<ProtocolResult, 'myoguardScore' | 'riskBand' | 'leanLossEstPct' | 'explanation'>;

/**
 * Presentation map keyed by the engine's authoritative `riskBand`.
 *
 * This component does NOT derive the band from the numeric SRI. The engine is
 * the single source of truth: it can force CRITICAL via the recovery override
 * (severe sleep deprivation combined with protein deficit) regardless of the
 * numeric value, and a display that recomputed the band from the number would
 * silently hide that — showing a reassuring band while the clinical
 * explanation rendered directly below reports a critical recovery deficit.
 *
 * No thresholds are duplicated here. Keys are band values, not score ranges.
 */
const BAND_PRESENTATION: Record<RiskBand, {
  label:       string;
  badge:       string;
  bar:         string;
  thumb:       string;
  border:      string;
  bg:          string;
  accent:      string;
  description: string;
}> = {
  LOW: {
    label: 'Low Risk',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    bar: 'bg-emerald-500',
    thumb: '#10b981',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    accent: 'text-emerald-600',
    description:
      'Your muscle-preservation risk is low. Your current activity level and protocol inputs suggest a favourable outcome with consistent nutritional support. Continue to meet your daily protein targets and stay active.',
  },
  MODERATE: {
    label: 'Moderate Risk',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    bar: 'bg-amber-500',
    thumb: '#f59e0b',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    accent: 'text-amber-600',
    description:
      'Your assessment indicates a moderate risk of lean muscle loss during GLP-1 therapy. Prioritising the protein targets and resistance exercise below will significantly reduce this risk. Review the full protocol with your physician.',
  },
  HIGH: {
    label: 'High Risk',
    badge: 'bg-red-100 text-red-700 border-red-300',
    bar: 'bg-red-500',
    thumb: '#ef4444',
    border: 'border-red-200',
    bg: 'bg-red-50',
    accent: 'text-red-600',
    description:
      'Your inputs indicate a high risk of clinically significant muscle loss without active intervention. Urgently review the nutritional targets below and discuss this result with your prescribing physician before your next dose.',
  },
  CRITICAL: {
    label: 'Critical Risk',
    badge: 'bg-red-200 text-red-900 border-red-400',
    bar: 'bg-red-700',
    thumb: '#b91c1c',
    border: 'border-red-400',
    bg: 'bg-red-100',
    accent: 'text-red-800',
    description:
      'Your inputs indicate a critical risk to muscle preservation. Contact your prescribing physician before your next dose and review the nutritional targets below. This result requires physician oversight.',
  },
};

/**
 * `leanLossEstPct` remains part of the prop contract (callers and the engine
 * output are unchanged) but is deliberately NOT rendered here. The value is a
 * fixed band-associated expert-consensus constant, not a validated individual
 * prediction, so presenting it to a patient as "~N%" overstated its standing.
 * The authoritative band interpretation below carries the clinical meaning.
 */
export default function ScoreCard({ myoguardScore, riskBand, explanation }: ScoreCardProps) {
  // Authoritative band from the engine — never recomputed from myoguardScore.
  const risk = BAND_PRESENTATION[riskBand];

  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${risk.bg} ${risk.border}`}>

      {/* ── Title + score ── */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">
            Sarcopenia Risk Index (SRI)
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-4xl font-bold text-slate-800">{myoguardScore}</p>
            <p className="text-slate-400 text-lg font-normal">/ 100</p>
          </div>

          {/* Risk level line */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-600">Risk Level:</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${risk.badge}`}>
              {riskBand}
            </span>
            <span className={`text-xs font-semibold ${risk.accent}`}>
              — {risk.label}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-2">
            A higher SRI indicates greater muscle protection.
          </p>
        </div>
        <span className="text-2xl ml-3 flex-shrink-0">📊</span>
      </div>

      {/* ── Visual gauge ── */}
      <div className="mt-4">
        {/* Scale labels — boundaries match the engine's authoritative bands */}
        <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-medium select-none">
          <span>0</span>
          <span className="text-red-500">40</span>
          <span className="text-amber-400">60</span>
          <span className="text-emerald-500">80</span>
          <span>100</span>
        </div>

        {/* Colour-banded background track — 0–39 / 40–59 / 60–79 / 80–100 */}
        <div className="relative h-3 rounded-full overflow-hidden flex">
          <div className="w-[40%] bg-red-300 h-full" />
          <div className="w-[20%] bg-red-200 h-full" />
          <div className="w-[20%] bg-amber-200 h-full" />
          <div className="w-[20%] bg-emerald-200 h-full" />
        </div>

        {/* Score fill + thumb */}
        <div className="relative h-2 mt-2">
          <div
            className={`absolute top-0 h-full rounded-full transition-all duration-500 opacity-70 ${risk.bar}`}
            style={{ width: `${myoguardScore}%` }}
          />
          <div
            className="absolute top-[-3px] w-3.5 h-3.5 rounded-full border-2 border-white shadow-md transition-all duration-500"
            style={{ left: `calc(${Math.min(Math.max(myoguardScore, 2), 98)}% - 7px)`, backgroundColor: risk.thumb }}
          />
        </div>
      </div>

      {/* ── Clinical explanation ── */}
      <div className="mt-5 pt-4 border-t border-slate-200 space-y-2">
        <p className="text-xs font-semibold text-slate-700">What this means for you</p>
        <p className="text-xs text-slate-600 leading-relaxed">{risk.description}</p>
        {explanation && (
          <p className="text-xs text-slate-500 leading-relaxed italic">{explanation}</p>
        )}
      </div>
    </div>
  );
}
