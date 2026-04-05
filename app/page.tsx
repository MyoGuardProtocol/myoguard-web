'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { calculateProtocol } from '@/src/lib/protocolEngine';
import type { AssessmentInput, ProtocolResult, PhysicianInfo } from '@/src/types';
import Header from '@/src/components/ui/Header';
import ReferralBanner from '@/src/components/ui/ReferralBanner';
import AssessmentForm from '@/src/components/forms/AssessmentForm';
import ProtocolResults from '@/src/components/results/ProtocolResults';

/**
 * Inner component — needs useSearchParams which requires a Suspense boundary
 * in the App Router to avoid static rendering errors.
 */
function CalculatorInner() {
  const searchParams          = useSearchParams();
  const refSlug               = searchParams.get('ref');
  const router                = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  // Signed-in users have a dashboard — redirect them rather than showing the
  // public calculator. /dashboard handles physician → /doctor/patients routing.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
router.replace('/doctor');
}

  }, [isLoaded, isSignedIn, router]);

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

  // Suppress the form while Clerk resolves a signed-in session — avoids a
  // flash of the public calculator before router.replace('/dashboard') fires.
  if (isLoaded && isSignedIn) {
router.replace('/doctor');
return null;
}

  // Recover persisted slug even when user navigates directly (no ?ref= in URL)
  const activeSlug =
    refSlug ??
    (typeof window !== 'undefined' ? sessionStorage.getItem('myoguard_ref') : null);

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Header showNav />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {step === 'form' ? (
          <>
            <ReferralBanner physician={physician} refSlug={refSlug} />
            <AssessmentForm onSubmit={handleFormSubmit} />

            {/* ── For Healthcare Professionals ─────────────────────────────────
                Secondary entry point shown at the bottom of the patient form.
                Visible on all screen sizes — no hidden classes.
            ─────────────────────────────────────────────────────────────── */}
            <div className="mt-10 pt-8 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">
                    For Healthcare Professionals
                  </p>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Monitor and protect your patients&apos; muscle health.
                  </p>
                </div>
                <Link
                  href="/doctor"
                  className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-5 py-3 rounded-xl hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-colors shadow-sm"
                >
                  Get Started as a Physician
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </>
        ) : results && formData ? (
          <ProtocolResults
            results={results}
            formData={formData}
            referralSlug={activeSlug}
            physician={physician}
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
              <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide">Protect Your Muscle During GLP-1 Therapy</p>
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
