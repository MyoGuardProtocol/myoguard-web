import type { ProtocolResult } from '@/src/types';

type ScoreCardProps = Pick<ProtocolResult, 'myoguardScore' | 'riskBand' | 'leanLossEstPct' | 'explanation'>;

const BAND_CONFIG = {
  LOW:      { label: 'Low Risk',      bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  MODERATE: { label: 'Moderate Risk', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   bar: 'bg-amber-500'   },
  HIGH:     { label: 'High Risk',     bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  bar: 'bg-orange-500'  },
  CRITICAL: { label: 'Critical Risk', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     bar: 'bg-red-500'     },
};

/**
 * MyoGuard Score card — new section added to the 9-section results structure.
 * Visually consistent with existing result cards (white rounded-2xl, teal accents).
 */
export default function ScoreCard({ myoguardScore, riskBand, leanLossEstPct, explanation }: ScoreCardProps) {
  const config = BAND_CONFIG[riskBand];

  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${config.bg} ${config.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">MyoGuard Score</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-slate-800">{myoguardScore}</p>
            <p className="text-slate-400 text-lg font-normal">/ 100</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${config.bg} ${config.border} ${config.text}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Est. lean-mass risk: ~{leanLossEstPct}% without intervention
          </p>
        </div>
        <span className="text-2xl">📊</span>
      </div>

      {/* Score bar */}
      <div className="mt-4 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${config.bar}`}
          style={{ width: `${myoguardScore}%` }}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 leading-relaxed">{explanation}</p>
      </div>
    </div>
  );
}
