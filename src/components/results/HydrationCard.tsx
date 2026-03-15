import type { ProtocolResult } from '@/src/types';

type HydrationCardProps = Pick<ProtocolResult, 'hydration'>;

/**
 * Hydration Baseline result card — verbatim from app/page.tsx lines 314–330.
 */
export default function HydrationCard({ hydration }: HydrationCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Hydration Baseline</p>
          <p className="text-3xl font-bold text-slate-800">{hydration}L</p>
          <p className="text-sm text-slate-500 mt-1">per day · 35ml/kg baseline</p>
        </div>
        <span className="text-2xl">💧</span>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 leading-relaxed">
          Adequate hydration optimises stool transit time and prevents dehydration-related adverse effects during active weight loss. Increase by 500ml on days of physical activity.
        </p>
      </div>
    </div>
  );
}
