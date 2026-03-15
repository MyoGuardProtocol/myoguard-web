'use client';

import { useState } from 'react';
import type { AssessmentInput } from '@/src/types';

type AssessmentFormProps = {
  onSubmit: (data: AssessmentInput) => void;
};

const SYMPTOMS = [
  'Constipation',
  'Nausea',
  'Muscle weakness',
  'Fatigue',
  'Reduced appetite',
  'Bloating',
];

/**
 * Assessment intake form — verbatim JSX from app/page.tsx lines 99–261.
 * Extracts to a standalone component; state is local, result lifted via onSubmit.
 */
export default function AssessmentForm({ onSubmit }: AssessmentFormProps) {
  const [form, setForm] = useState<AssessmentInput>({
    weight: '',
    unit: 'kg',
    doseMg: 0,
    medication: 'semaglutide',
    activityLevel: 'sedentary',
    symptoms: [],
  });
  const [consented, setConsented] = useState(false);

  const toggleSymptom = (s: string) => {
    setForm(f => ({
      ...f,
      symptoms: f.symptoms.includes(s)
        ? f.symptoms.filter(x => x !== s)
        : [...f.symptoms, s],
    }));
  };

  const valid = form.weight && parseFloat(form.weight) > 0 && form.doseMg > 0;

  const handleSubmit = () => {
    if (valid && consented) onSubmit(form);
  };

  return (
    <>
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 leading-tight">
          GLP-1 Muscle Protection<br />
          <span className="text-teal-600">Protocol Calculator</span>
        </h1>
        <p className="mt-3 text-slate-600 text-base leading-relaxed">
          Calculate your personalised protein, fibre, and hydration targets
          to support lean muscle maintenance and manage GI symptoms during GLP-1 therapy.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">

        {/* Weight */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Current Body Weight
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="e.g. 85"
              value={form.weight}
              onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
            />
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              {(['kg', 'lbs'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setForm(f => ({ ...f, unit: u }))}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                    form.unit === u
                      ? 'bg-teal-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Medication */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            GLP-1 Medication
          </label>
          <select
            value={form.medication}
            onChange={e => setForm(f => ({ ...f, medication: e.target.value as AssessmentInput['medication'] }))}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
          >
            <option value="semaglutide">Semaglutide (Ozempic / Wegovy)</option>
            <option value="tirzepatide">Tirzepatide (Zepbound / Mounjaro)</option>
          </select>
        </div>

        {/* Dose */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Current Weekly Dose (mg)
          </label>
          <input
            type="number"
            placeholder="e.g. 1.0"
            value={form.doseMg || ''}
            onChange={e => setForm(f => ({ ...f, doseMg: parseFloat(e.target.value) || 0 }))}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
          />
        </div>

        {/* Activity */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Activity Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'sedentary', label: 'Sedentary', sub: 'Little/no exercise' },
              { value: 'moderate',  label: 'Moderate',  sub: '3–5x/week' },
              { value: 'active',    label: 'Active',    sub: 'Daily training' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setForm(f => ({ ...f, activityLevel: opt.value as AssessmentInput['activityLevel'] }))}
                className={`rounded-lg border p-3 text-left transition-all ${
                  form.activityLevel === opt.value
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className={`text-sm font-semibold ${form.activityLevel === opt.value ? 'text-teal-700' : 'text-slate-700'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Symptoms */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Current Symptoms <span className="text-slate-400 font-normal">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map(s => (
              <button
                key={s}
                onClick={() => toggleSymptom(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  form.symptoms.includes(s)
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'bg-white border-slate-300 text-slate-600 hover:border-teal-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Consent */}
        <div className="rounded-lg border border-slate-200 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={consented}
              onChange={e => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-teal-600 cursor-pointer"
            />
            <span className="text-xs text-slate-500 leading-relaxed">
              I understand this tool provides educational nutritional reference information only. It does not constitute medical advice or create a physician-patient relationship. I will review these recommendations with my prescribing physician.
            </span>
          </label>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!valid || !consented}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
            valid && consented
              ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          Generate My Protocol →
        </button>
      </div>

      {/* Disclaimer */}
      <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
        This tool generates educational nutritional reference data only. It does not constitute
        a physician-patient relationship or individualised medical advice. Review all recommendations
        with your prescribing physician. © 2026 MyoGuard Protocol · myoguard.health · <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
      </p>
    </>
  );
}
