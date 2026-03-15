'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type FormState = {
  avgWeightKg: string;
  avgProteinG: string;
  totalWorkouts: string;
  avgHydration: string;
  energyLevel: number;
  nauseaLevel: number;
  notes: string;
};

const SCALE_LABELS: Record<number, string> = {
  1: '1 — Very low',
  2: '2 — Low',
  3: '3 — Moderate',
  4: '4 — Good',
  5: '5 — Excellent',
};

const NAUSEA_LABELS: Record<number, string> = {
  1: '1 — None',
  2: '2 — Mild',
  3: '3 — Moderate',
  4: '4 — Significant',
  5: '5 — Severe',
};

/**
 * Weekly check-in form page.
 * Visual style mirrors the assessment form — white card, teal accents, slate-50 bg.
 */
export default function CheckinPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    avgWeightKg:   '',
    avgProteinG:   '',
    totalWorkouts: '',
    avgHydration:  '',
    energyLevel:   3,
    nauseaLevel:   1,
    notes:         '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {};
      if (form.avgWeightKg)   payload.avgWeightKg   = parseFloat(form.avgWeightKg);
      if (form.avgProteinG)   payload.avgProteinG   = parseFloat(form.avgProteinG);
      if (form.totalWorkouts) payload.totalWorkouts = parseInt(form.totalWorkouts, 10);
      if (form.avgHydration)  payload.avgHydration  = parseFloat(form.avgHydration);
      payload.energyLevel = form.energyLevel;
      payload.nauseaLevel = form.nauseaLevel;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const res = await fetch('/api/checkins', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save check-in');
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
              Myo<span className="text-teal-600">Guard</span> Protocol
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
          </div>
          <Link href="/dashboard" className="text-xs text-teal-600 hover:underline font-medium">
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 leading-tight">
            Weekly <span className="text-teal-600">Check-in</span>
          </h1>
          <p className="mt-3 text-slate-600 text-base leading-relaxed">
            Log this week&apos;s metrics to track your protocol adherence and symptom trends over time.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">

          {/* Weight */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Average Weight This Week (kg) <span className="text-slate-400 font-normal">optional</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 84.5"
              value={form.avgWeightKg}
              onChange={e => setForm(f => ({ ...f, avgWeightKg: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
            />
          </div>

          {/* Protein */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Average Daily Protein (g) <span className="text-slate-400 font-normal">optional</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 120"
              value={form.avgProteinG}
              onChange={e => setForm(f => ({ ...f, avgProteinG: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
            />
          </div>

          {/* Workouts */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Total Workouts This Week <span className="text-slate-400 font-normal">optional</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 3"
              min={0}
              max={21}
              value={form.totalWorkouts}
              onChange={e => setForm(f => ({ ...f, totalWorkouts: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
            />
          </div>

          {/* Hydration */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Average Daily Hydration (L) <span className="text-slate-400 font-normal">optional</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 2.5"
              value={form.avgHydration}
              onChange={e => setForm(f => ({ ...f, avgHydration: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
            />
          </div>

          {/* Energy level */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Energy Level This Week
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setForm(f => ({ ...f, energyLevel: n }))}
                  className={`rounded-lg border p-2 text-center transition-all ${
                    form.energyLevel === n
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="text-lg font-bold">{n}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">{SCALE_LABELS[form.energyLevel]}</p>
          </div>

          {/* Nausea level */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Nausea Level This Week
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setForm(f => ({ ...f, nauseaLevel: n }))}
                  className={`rounded-lg border p-2 text-center transition-all ${
                    form.nauseaLevel === n
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="text-lg font-bold">{n}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">{NAUSEA_LABELS[form.nauseaLevel]}</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Notes <span className="text-slate-400 font-normal">optional</span>
            </label>
            <textarea
              placeholder="Any observations, side effects, or wins this week…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-xl font-semibold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Submit Check-in →'}
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-400 text-center">
          © 2026 MyoGuard Protocol · <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
        </p>
      </div>
    </main>
  );
}
