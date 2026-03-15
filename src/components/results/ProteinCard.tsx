import type { ProtocolResult } from '@/src/types';

type ProteinCardProps = Pick<ProtocolResult, 'proteinStandard' | 'proteinAggressive'>;

/**
 * Protein Shield result card — verbatim from app/page.tsx lines 281–295.
 */
export default function ProteinCard({ proteinStandard, proteinAggressive }: ProteinCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">The Protein Shield</p>
          <p className="text-3xl font-bold text-slate-800">{proteinStandard}g <span className="text-slate-400 text-lg font-normal">– {proteinAggressive}g</span></p>
          <p className="text-sm text-slate-500 mt-1">per day · activity-adjusted target range</p>
        </div>
        <span className="text-2xl">🛡️</span>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 leading-relaxed">
          High-protein intake preserves lean body mass and metabolic rate during GLP-1-induced weight loss. Distribute across 3–4 meals. Prioritise complete protein sources — whey isolate, eggs, fish, legumes.
        </p>
      </div>
    </div>
  );
}
