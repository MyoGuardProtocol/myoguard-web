'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SPECIALTIES = [
  'General Practice / Family Medicine',
  'Internal Medicine',
  'Endocrinology',
  'Obesity Medicine',
  'Cardiology',
  'Bariatric Medicine',
  'Sports & Exercise Medicine',
  'Dietetics / Nutrition',
  'Other',
];

const COUNTRIES = [
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Nigeria',
  'South Africa',
  'Germany',
  'France',
  'UAE',
  'India',
  'Other',
];

export default function OnboardingForm() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/doctor/onboarding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName:      form.get('fullName')      as string,
          country:       form.get('country')       as string,
          specialty:     form.get('specialty')     as string,
          licenseNumber: form.get('licenseNumber') as string,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push('/doctor/dashboard');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900 tracking-tight">
              Myo<span className="text-teal-600">Guard</span>
            </span>
            <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
          </Link>
          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-100 rounded-full px-3 py-1 font-semibold">
            Physician Setup
          </span>
        </div>
      </header>

      {/* ── Form ── */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="max-w-lg w-full space-y-6">

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-teal-600 rounded-full" />
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Step 1 of 1</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">Set up your physician profile</h1>
            <p className="text-slate-500 text-sm mt-1 leading-relaxed">
              Your account will be verified within 24 hours. Full access is unlocked once approved.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
          >
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Full name <span className="text-red-400">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                placeholder="Dr. Jane Smith"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              />
            </div>

            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Country <span className="text-red-400">*</span>
              </label>
              <select
                id="country"
                name="country"
                required
                defaultValue=""
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-white appearance-none"
              >
                <option value="" disabled>Select your country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Specialty */}
            <div>
              <label htmlFor="specialty" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Specialty / Role
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </label>
              <select
                id="specialty"
                name="specialty"
                defaultValue=""
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-white appearance-none"
              >
                <option value="">Select your specialty</option>
                {SPECIALTIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* License Number */}
            <div>
              <label htmlFor="licenseNumber" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Medical licence number
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </label>
              <input
                id="licenseNumber"
                name="licenseNumber"
                type="text"
                placeholder="e.g. GMC 1234567"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white text-sm font-semibold py-3.5 rounded-xl hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting…' : 'Complete Setup →'}
            </button>

            <p className="text-center text-xs text-slate-400">
              By continuing you confirm you are a licensed medical professional.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
