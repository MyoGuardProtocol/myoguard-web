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
 * Assessment intake form — Homepage Update 1.
 *
 * UI/UX improvements:
 *   - Clinical headline and value-proposition hero
 *   - Muscle-loss risk insight callout (evidence-based framing)
 *   - Restructured "How it works" with step icons and detail text
 *   - Section-labelled form card with visual dividers
 *   - Dynamic submit button label (idle hint vs. active CTA)
 *
 * Logic: zero changes — all state, validation, and submission
 * behaviour is identical to the previous version.
 */
export default function AssessmentForm({ onSubmit }: AssessmentFormProps) {
  const [form, setForm] = useState<AssessmentInput>({
    weight:        '',
    unit:          'kg',
    doseMg:        0,
    medication:    'semaglutide',
    activityLevel: 'sedentary',
    symptoms:      [],
    sleepHours:    undefined,
    sleepQuality:  undefined,
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

  // Shared Tailwind classes for text inputs
  const inputCls =
    'w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 bg-white ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm';

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          HERO — Clinical headline + value proposition
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-6">

        {/* Eyebrow label */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-700 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
            Physician-Designed Protocol
          </span>
        </div>

        {/* Primary headline */}
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
          Preserve Your Muscle Mass<br />
          <span className="text-teal-600">During GLP-1 Therapy</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-3 text-base text-slate-600 leading-relaxed max-w-xl">
          Generate a personalised muscle-protection protocol — including protein, fibre,
          and hydration targets — based on your weight, medication, and activity level.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MUSCLE-LOSS INSIGHT CALLOUT
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center mt-0.5">
            <svg className="w-4 h-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold text-amber-900 mb-1">
              Up to 25–40% of GLP-1 weight loss can be lean muscle
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Without targeted nutritional support, GLP-1 therapy accelerates the loss of
              lean muscle alongside fat. This tool calculates the specific protein, fibre,
              and hydration targets your body needs to minimise that risk.
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — Three-step process with icons
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            How It Works
          </p>
        </div>
        <div className="px-5 py-4">
          <ol className="space-y-4">
            {[
              {
                icon: (
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                ),
                title:  'Complete the 60-second assessment',
                detail: 'Enter your body weight, GLP-1 medication and dose, activity level, and any current symptoms.',
              },
              {
                icon: (
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title:  'Receive your personalised protocol',
                detail: 'Get your MyoGuard Score, daily protein target, fibre guidance, and hydration baseline — calibrated to your inputs.',
              },
              {
                icon: (
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                ),
                title:  'Protect lean mass throughout treatment',
                detail: 'Review your protocol with your prescribing physician and track progress via your MyoGuard dashboard.',
              },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
                  {step.icon}
                </div>
                <div className="pt-0.5">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{step.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ASSESSMENT FORM CARD
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Card header */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
          <p className="text-sm font-bold text-slate-700">Your Assessment</p>
          <span className="ml-auto text-[11px] text-slate-400 font-medium">~60 seconds</span>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Section A: Body & Medication ── */}
          <div className="space-y-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Body &amp; Medication
            </p>

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
                  className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
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
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* ── Section B: Lifestyle & Symptoms ── */}
          <div className="space-y-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Lifestyle &amp; Symptoms
            </p>

            {/* Activity */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Activity Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'sedentary', label: 'Sedentary', sub: 'Little/no exercise' },
                  { value: 'moderate',  label: 'Moderate',  sub: '3–5× / week' },
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Current Symptoms{' '}
                <span className="text-slate-400 font-normal">(select all that apply)</span>
              </label>
              <p className="text-xs text-slate-400 mb-2.5 leading-snug">
                Symptom data improves the accuracy of your muscle-risk score and GI guidance.
              </p>
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
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* ── Section C: Recovery & Sleep ── */}
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Recovery &amp; Sleep
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Optional — improves score accuracy. Sleep deprivation blunts muscle protein synthesis.
              </p>
            </div>

            {/* Sleep hours — numeric input with Geist Mono display */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Average Nightly Sleep
                <span className="ml-1.5 text-slate-400 font-normal text-xs">(hours)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 7.0"
                  min={0}
                  max={14}
                  step={0.5}
                  value={form.sleepHours ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                    setForm(f => ({ ...f, sleepHours: v }));
                  }}
                  className={
                    inputCls +
                    ' font-mono tabular-nums pr-14'
                  }
                  style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none select-none">
                  hrs
                </span>
              </div>
              {/* Contextual warning for critically low sleep */}
              {form.sleepHours !== undefined && form.sleepHours < 5.5 && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                  <span className="text-orange-500 text-sm mt-0.5 flex-shrink-0">⚠</span>
                  <p className="text-xs text-orange-700 leading-relaxed">
                    <span className="font-semibold">Severe sleep deficit detected.</span>{' '}
                    Fewer than 5.5 hours significantly blunts MPS and may elevate your risk band.
                  </p>
                </div>
              )}
            </div>

            {/* Sleep quality — premium 1-5 slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">
                  Sleep Quality
                </label>
                {/* Live readout in Geist Mono */}
                <span
                  className="text-xs tabular-nums font-semibold px-2 py-0.5 rounded-md"
                  style={{
                    fontFamily:      'var(--font-geist-mono), ui-monospace, monospace',
                    background:      form.sleepQuality !== undefined ? 'rgba(45,212,191,0.12)' : 'transparent',
                    color:           form.sleepQuality !== undefined ? '#2DD4BF' : '#94a3b8',
                    border:          form.sleepQuality !== undefined ? '1px solid rgba(45,212,191,0.3)' : 'none',
                  }}
                >
                  {form.sleepQuality !== undefined
                    ? ['', 'Poor', 'Fair', 'Average', 'Good', 'Excellent'][form.sleepQuality]
                    : 'Not set'}
                </span>
              </div>

              {/* Custom styled range slider */}
              <div className="relative py-1">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={form.sleepQuality ?? 3}
                  onChange={e => setForm(f => ({ ...f, sleepQuality: parseInt(e.target.value) }))}
                  onMouseDown={() => {
                    // Set quality on first interaction if untouched
                    if (form.sleepQuality === undefined) {
                      setForm(f => ({ ...f, sleepQuality: 3 }));
                    }
                  }}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer
                    bg-gradient-to-r from-red-300 via-amber-300 to-emerald-400
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-teal-400
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-5
                    [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-2
                    [&::-moz-range-thumb]:border-teal-400
                    [&::-moz-range-thumb]:shadow-md"
                />
                {/* Scale labels */}
                <div className="flex justify-between mt-1.5 px-0.5">
                  {['1\nPoor', '2\nFair', '3\nAvg', '4\nGood', '5\nExcellent'].map((label, i) => (
                    <span
                      key={i}
                      className="text-[9px] text-slate-400 text-center leading-tight whitespace-pre"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Biological alert — shown when quality is impaired */}
              {form.sleepQuality !== undefined && form.sleepQuality < 3 && (
                <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs text-orange-800 leading-relaxed">
                      <span className="font-bold">Biological Alert:</span>{' '}
                      Insufficient recovery blunts Muscle Protein Synthesis by ~18%. Poor sleep quality
                      will apply a 10-point penalty to your MyoGuard Score.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* ── Consent — custom visual checkbox (bypasses iOS Safari -webkit-appearance) ── */}
          <button
            type="button"
            onClick={() => setConsented(c => !c)}
            aria-pressed={consented}
            className={`w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1 ${
              consented
                ? 'border-teal-400 bg-teal-50'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                consented ? 'bg-teal-600 border-teal-600' : 'bg-white border-slate-400'
              }`}
            >
              {consented && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </span>
            <span className="text-xs text-slate-600 leading-relaxed">
              I understand this tool provides educational nutritional reference information only. It does not
              constitute medical advice or create a physician-patient relationship. I will review these
              recommendations with my prescribing physician.
            </span>
          </button>

          {/* ── Submit ── */}
          <button
            onClick={handleSubmit}
            disabled={!valid || !consented}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              valid && consented
                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {valid && consented ? (
              <>
                Generate My Muscle Protection Protocol
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </>
            ) : (
              'Complete the form above to continue'
            )}
          </button>

        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div className="mt-6 px-1">
        <p className="text-xs text-slate-400 text-center leading-relaxed">
          This tool generates educational nutritional reference data only. It does not constitute
          a physician-patient relationship or individualised medical advice. Review all recommendations
          with your prescribing physician.
        </p>
        <p className="text-xs text-slate-400 text-center mt-1">
          © 2026 MyoGuard Protocol · myoguard.health ·{' '}
          <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
        </p>
      </div>
    </>
  );
}
