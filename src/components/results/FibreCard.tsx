import type { ProtocolResult } from '@/src/types';

type FibreCardProps = {
  fiber: ProtocolResult['fiber'];
  hasConstipation: boolean;
};

/**
 * Fibre Protocol result card — verbatim from app/page.tsx lines 297–312.
 */
export default function FibreCard({ fiber, hasConstipation }: FibreCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Fibre Protocol</p>
          <p className="text-3xl font-bold text-slate-800">{fiber}g</p>
          <p className="text-sm text-slate-500 mt-1">
            per day · {hasConstipation ? 'elevated — constipation detected' : 'standard maintenance dose'}
          </p>
        </div>
        <span className="text-2xl">🌿</span>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 leading-relaxed">
          Soluble fibre counteracts GLP-1-associated delayed gastric emptying and supports microbiome integrity. Introduce gradually over 2 weeks to prevent bloating. Psyllium husk or partially hydrolysed guar gum recommended.
        </p>
      </div>
    </div>
  );
}
