'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateProtocol } from '@/src/lib/protocolEngine';
import type { AssessmentInput, ProtocolResult, PhysicianInfo } from '@/src/types';
import Header from '@/src/components/ui/Header';
import AssessmentForm from '@/src/components/forms/AssessmentForm';
import ProtocolResults from '@/src/components/results/ProtocolResults';

/**
 * Inner component — needs useSearchParams which requires a Suspense boundary
 * in the App Router to avoid static rendering errors.
 */
function CalculatorInner() {
  const searchParams = useSearchParams();
  const refSlug      = searchParams.get('ref');

  const [step, setStep]           = useState<'form' | 'results'>('form');
  const [results, setResults]     = useState<ProtocolResult | null>(null);
  const [formData, setFormData]   = useState<AssessmentInput | null>(null);
  const [physician, setPhysician] = useState<PhysicianInfo | null>(null);

  // Resolve physician branding from ?ref= slug on mount
  useEffect(() => {
    if (!refSlug) return;
    // Persist so downstream API calls (assessment, email-capture) carry attribution
    sessionStorage.setItem('myoguard_ref', refSlug);

    fetch(`/api/referral?slug=${encodeURIComponent(refSlug)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: PhysicianInfo | null) => {
        if (data) setPhysician(data);
      })
      .catch(() => {
        /* Non-critical — default "Dr. B, MBBS" branding is shown on failure */
      });
  }, [refSlug]);

  const handleFormSubmit = (data: AssessmentInput) => {
    const protocol = calculateProtocol(data);
    setFormData(data);
    setResults(protocol);
    setStep('results');
  };

  const handleRecalculate = () => {
    setStep('form');
    setResults(null);
    setFormData(null);
  };

  // Recover persisted slug even when user navigates directly (no ?ref= in URL)
  const activeSlug =
    refSlug ??
    (typeof window !== 'undefined' ? sessionStorage.getItem('myoguard_ref') : null);

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Header physicianName={physician?.displayName ?? null} showNav />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {step === 'form' ? (
          <AssessmentForm onSubmit={handleFormSubmit} />
        ) : results && formData ? (
          <ProtocolResults
            results={results}
            formData={formData}
            referralSlug={activeSlug}
            onRecalculate={handleRecalculate}
          />
        ) : null}
      </div>
    </main>
  );
}

/**
 * Home — GLP-1 Muscle Protection Protocol Calculator.
 *
 * Wrapped in Suspense so useSearchParams() works correctly with Next.js
 * App Router. The fallback renders a skeleton that matches the existing
 * visual structure (no layout shift on load).
 */
export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 font-sans">
          <header className="bg-white border-b border-slate-200 px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <span className="text-xl font-bold text-slate-800 tracking-tight">
                Myo<span className="text-teal-600">Guard</span> Protocol
              </span>
              <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
            </div>
          </header>
          <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-200 rounded-xl w-2/3" />
              <div className="h-4 bg-slate-200 rounded-xl w-full" />
              <div className="h-64 bg-white rounded-2xl border border-slate-200" />
            </div>
          </div>
        </main>
      }
    >
      <CalculatorInner />
    </Suspense>
  );
}
