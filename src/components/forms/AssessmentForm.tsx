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

/** Clinical dose ceilings (weekly mg) above which a sanity warning fires. */
const MAX_DOSE: Record<AssessmentInput['medication'], number> = {
  semaglutide:  2.4,   // max approved Wegovy / Ozempic weekly dose
  tirzepatide: 15.0,   // max approved Zepbound / Mounjaro weekly dose
};

/** Realistic body-weight range in kg. */
const WEIGHT_KG = { min: 30, max: 250 };

/**
 * Assessment intake form.
 * Includes:
 *  - Credibility tagline below headline
 *  - "How it works" section above the form
 *  - Non-blocking clinical sanity warnings for weight and dose
 *  - Improved input contrast (explicit bg-white, placeholder colour)
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

  // ── Sanity checks (non-blocking — warn, don't prevent submission) ────────────
  const weightNum = parseFloat(form.weight) || 0;
  const weightKg  = form.unit === 'lbs' ? weightNum * 0.453592 : weightNum;

  const weightWarning: string | null = (() => {
    if (!form.weight || weightNum === 0) return null;
    if (weightKg < WEIGHT_KG.min)
      return `This value appears unusually low (${Math.round(weightKg)} kg). Please confirm before continuing.`;
    if (weightKg > WEIGHT_KG.max)
      return `This value appears unusually high (${Math.round(weightKg)} kg). Please confirm before continuing.`;
    return null;
  })();

  const doseWarning: string | null = (() => {
    if (!form.doseMg) return null;
    const ceiling = MAX_DOSE[form.medication];
    if (form.doseMg > ceiling)
      return `This dose (${form.doseMg} mg) exceeds the maximum approved weekly dose for ${
        form.medication === 'semaglutide' ? 'semaglutide' : 'tirzepatide'
      } (${ceiling} mg). Please confirm before continuing.`;
    return null;
  })();

  const valid = form.weight && weightNum > 0 && form.doseMg > 0;

  const handleSubmit = () => {
    if (valid && consented) onSubmit(form);
  };

  // Shared Tailwind classes for text inputs — ensures visibility on the white form card
  const inputCls =
    'w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 bg-white ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm';

  return (
    <>
      {/* ── Hero ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 leading-tight">
          GLP-1 Muscle Protection<br />
          <span className="text-teal-600">Protocol Calculator</span>
        </h1>
        {/* Credibility tagline */}
        <p className="mt-2 text-sm font-semibold text-teal-700">
          Physician-designed protocol generator for patients using GLP-1 therapies.
        </p>
        <p className="mt-2 text-slate-600 text-base leading-relaxed">
          Calculate your personalised protein, fibre, and hydration targets
          to support lean muscle maintenance and manage GI symptoms during GLP-1 therapy.
        </p>
      </div>

      {/* ── How it works ── */}
      <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">
          How it works
        </p>
        <ol className="space-y-3">
          {[
            'Complete the 60-second assessment below',
            'Generate your personalised muscle-protection protocol',
            'Preserve lean mass during GLP-1 therapy',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-slate-700 leading-snug">{text}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Form Card ── */}
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
              className={`flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm`}
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
          {weightWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <span className="text-amber-500 text-sm mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-xs text-amber-700">{weightWarning}</p>
            </div>
          )}
        </div>

        {/* Medication */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            GLP-1 Medication
          </label>
          <select
            value={form.medication}
            onChange={e => setForm(f => ({ ...f, medication: e.target.value as AssessmentInput['medication'] }))}
            className={inputCls}
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
            className={inputCls}
          />
          {doseWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <span className="text-amber-500 text-sm mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-xs text-amber-700">{doseWarning}</p>
            </div>
          )}
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={e => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-teal-600 cursor-pointer"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I understand this tool provides educational nutritional reference information only. It does not
              constitute medical advice or create a physician-patient relationship. I will review these
              recommendations with my prescribing physician.
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
        with your prescribing physician. © 2026 MyoGuard Protocol · myoguard.health ·{' '}
        <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
      </p>
    </>
  );
}
