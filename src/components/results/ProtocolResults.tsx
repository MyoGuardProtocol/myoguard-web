'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import type { ProtocolResult, AssessmentInput, PhysicianInfo } from '@/src/types';
import ClinicalSummary from './ClinicalSummary';
import ProteinCard from './ProteinCard';
import FibreCard from './FibreCard';
import HydrationCard from './HydrationCard';
import ScoreCard from './ScoreCard';
import ScoreProjectionCard from './ScoreProjectionCard';
import AccountGate from '../ui/AccountGate';
import EmailCapture from '../ui/EmailCapture';
import SupplementCTA from '../ui/SupplementCTA';
import RecoverySignalCard from '../ui/RecoverySignalCard';

type ProtocolResultsProps = {
  results:       ProtocolResult;
  formData:      AssessmentInput;
  referralSlug?: string | null;
  physician?:    PhysicianInfo | null;
  onRecalculate: () => void;
};

export default function ProtocolResults({
  results,
  formData,
  referralSlug,
  physician,
  onRecalculate,
}: ProtocolResultsProps) {
  const { isSignedIn, isLoaded } = useUser();

  // Gate is open (showing) until user dismisses it or is already signed in.
  // We wait for Clerk to load before deciding — avoids a flash on signed-in users.
  const [guestMode, setGuestMode] = useState(false);

  const medLabel        = formData.medication === 'semaglutide' ? 'Semaglutide' : 'Tirzepatide';
  const hasConstipation = formData.symptoms.includes('Constipation');

  // Persist formData to sessionStorage so PostAuthSync can save it after login.
  // Cleared by PostAuthSync once successfully written to the database.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        'myoguard_pending_assessment',
        JSON.stringify({ formData }),
      );
    } catch {
      /* sessionStorage unavailable (private browsing edge case) — safe to ignore */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show gate when: Clerk loaded, user is NOT signed in, and hasn't chosen guest yet
  const showGate = isLoaded && !isSignedIn && !guestMode;

  const handleSavePdf = () => window.print();

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

      {/* ── Score card — always visible ── */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <ScoreCard
          myoguardScore={results.myoguardScore}
          riskBand={results.riskBand}
          leanLossEstPct={results.leanLossEstPct}
          explanation={results.explanation}
        />
      </div>

      {/* ── Recovery Signal — shown when sleep data was collected ── */}
      <RecoverySignalCard
        sleepHours={formData.sleepHours}
        sleepQuality={formData.sleepQuality}
        recoveryStatus={results.recoveryStatus}
        penaltyApplied={results.recoveryModifierApplied}
        criticalOverride={results.criticalOverrideApplied}
      />

      {/* ── Account gate — shown to unauthenticated guests ── */}
      {showGate ? (
        <AccountGate
          score={results.myoguardScore}
          onGuest={() => setGuestMode(true)}
        />
      ) : (
        /* ── Full protocol (visible after gate dismissed or user signed in) ── */
        <div className="grid grid-cols-1 gap-4 mb-6">
          <ScoreProjectionCard results={results} formData={formData} />
          <ProteinCard
            proteinStandard={results.proteinStandard}
            proteinAggressive={results.proteinAggressive}
          />
          <FibreCard fiber={results.fiber} hasConstipation={hasConstipation} />
          <HydrationCard hydration={results.hydration} />
        </div>
      )}

      {/* ── Email capture — guests only.
           Signed-in users access their protocol via /dashboard/results/[id];
           they do not need to email it to themselves.
           We wait for Clerk to load (!isLoaded) so we never flash the capture
           form briefly on a signed-in user's first render. ── */}
      {(isLoaded && !isSignedIn) && (
        <EmailCapture results={results} formData={formData} referralSlug={referralSlug} />
      )}
      <SupplementCTA />

      {/* ── Actions ── */}
      <div className="flex gap-3">
        <button
          onClick={onRecalculate}
          className="flex-1 border border-slate-300 text-slate-600 font-medium text-sm py-3 rounded-xl hover:bg-slate-50 transition-colors"
        >
          ← Regenerate SRI
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
        with your prescribing physician before commencing supplementation. © 2026 MyoGuard Protocol · myoguard.health · MyoGuard Clinical Oversight ·{' '}
        <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
      </p>
    </>
  );
}
