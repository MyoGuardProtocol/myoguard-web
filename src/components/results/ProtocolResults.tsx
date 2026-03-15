'use client';

import type { ProtocolResult, AssessmentInput, PhysicianInfo } from '@/src/types';
import ClinicalSummary from './ClinicalSummary';
import ProteinCard from './ProteinCard';
import FibreCard from './FibreCard';
import HydrationCard from './HydrationCard';
import ScoreCard from './ScoreCard';
import EmailCapture from '../ui/EmailCapture';
import SupplementCTA from '../ui/SupplementCTA';

type ProtocolResultsProps = {
  results:      ProtocolResult;
  formData:     AssessmentInput;
  referralSlug?: string | null;
  physician?:   PhysicianInfo | null;
  onRecalculate: () => void;
};

export default function ProtocolResults({
  results,
  formData,
  referralSlug,
  physician,
  onRecalculate,
}: ProtocolResultsProps) {
  const medLabel = formData.medication === 'semaglutide' ? 'Semaglutide' : 'Tirzepatide';
  const hasConstipation = formData.symptoms.includes('Constipation');

  const handleSavePdf = () => {
    window.print();
  };

  return (
    <>
      {/* ── Page heading ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
          <span className="text-xs font-medium text-teal-600 uppercase tracking-wide">Protocol Generated</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Your MyoGuard Protocol</h1>
        <p className="text-slate-500 text-sm mt-1">
          Based on {results.weightKg}kg body weight · {medLabel} {formData.doseMg}mg · {formData.activityLevel} activity
        </p>
      </div>

      {/* ── Clinical summary header ── */}
      <ClinicalSummary
        results={results}
        formData={formData}
        physician={physician}
      />

      {/* ── Detail cards ── */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        <ScoreCard
          myoguardScore={results.myoguardScore}
          riskBand={results.riskBand}
          leanLossEstPct={results.leanLossEstPct}
          explanation={results.explanation}
        />
        <ProteinCard
          proteinStandard={results.proteinStandard}
          proteinAggressive={results.proteinAggressive}
        />
        <FibreCard
          fiber={results.fiber}
          hasConstipation={hasConstipation}
        />
        <HydrationCard hydration={results.hydration} />
      </div>

      {/* ── Email capture ── */}
      <EmailCapture
        results={results}
        formData={formData}
        referralSlug={referralSlug}
      />

      {/* ── Supplement CTA ── */}
      <SupplementCTA />

      {/* ── Actions ── */}
      <div className="flex gap-3">
        <button
          onClick={onRecalculate}
          className="flex-1 border border-slate-300 text-slate-600 font-medium text-sm py-3 rounded-xl hover:bg-slate-50 transition-colors"
        >
          ← Recalculate
        </button>
        <button
          onClick={handleSavePdf}
          className="flex-1 bg-slate-800 text-white font-medium text-sm py-3 rounded-xl hover:bg-slate-700 transition-colors"
        >
          Save Protocol (PDF)
        </button>
      </div>

      {/* ── Disclaimer ── */}
      <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
        This protocol output is an educational nutritional reference tool only. It does not constitute
        a physician-patient relationship or individualised medical advice. Review all recommendations
        with your prescribing physician before commencing supplementation. © 2026 MyoGuard Protocol · myoguard.health · Dr. B, MBBS ·{' '}
        <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
      </p>
    </>
  );
}
