'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import DashboardHeader from '@/src/components/ui/DashboardHeader';

// ─── Symptoms list ───────────────────────────────────────────────────────────
const SYMPTOMS = [
  'Constipation',
  'Nausea',
  'Muscle weakness',
  'Fatigue',
  'Reduced appetite',
  'Bloating',
];

// ─── GLP-1 drug + dose catalogue ─────────────────────────────────────────────
const GLP1_DRUGS = [
  // Semaglutide injectable
  { label: 'Ozempic 0.25 mg/wk — initiation dose',      value: 0.25, max: 2.0,  type: 'injectable' },
  { label: 'Ozempic 0.5 mg/wk — standard maintenance',  value: 0.5,  max: 2.0,  type: 'injectable' },
  { label: 'Ozempic 1.0 mg/wk — full dose',             value: 1.0,  max: 2.0,  type: 'injectable' },
  { label: 'Ozempic 2.0 mg/wk — maximum',               value: 2.0,  max: 2.0,  type: 'injectable' },
  // Wegovy (higher dose semaglutide)
  { label: 'Wegovy 0.25 mg/wk — initiation',            value: 0.25, max: 2.4,  type: 'injectable' },
  { label: 'Wegovy 0.5 mg/wk',                          value: 0.5,  max: 2.4,  type: 'injectable' },
  { label: 'Wegovy 1.0 mg/wk',                          value: 1.0,  max: 2.4,  type: 'injectable' },
  { label: 'Wegovy 1.7 mg/wk',                          value: 1.7,  max: 2.4,  type: 'injectable' },
  { label: 'Wegovy 2.4 mg/wk — maximum',                value: 2.4,  max: 2.4,  type: 'injectable' },
  // Oral semaglutide
  { label: 'Rybelsus 3 mg/day — initiation (oral)',     value: 0.1,  max: 0.5,  type: 'oral' },
  { label: 'Rybelsus 7 mg/day (oral)',                  value: 0.23, max: 0.5,  type: 'oral' },
  { label: 'Rybelsus 14 mg/day — maximum (oral)',       value: 0.46, max: 0.5,  type: 'oral' },
  // Tirzepatide
  { label: 'Mounjaro/Zepbound 2.5 mg/wk — initiation', value: 2.5,  max: 15,   type: 'injectable' },
  { label: 'Mounjaro/Zepbound 5 mg/wk',                value: 5,    max: 15,   type: 'injectable' },
  { label: 'Mounjaro/Zepbound 7.5 mg/wk',              value: 7.5,  max: 15,   type: 'injectable' },
  { label: 'Mounjaro/Zepbound 10 mg/wk',               value: 10,   max: 15,   type: 'injectable' },
  { label: 'Mounjaro/Zepbound 12.5 mg/wk',             value: 12.5, max: 15,   type: 'injectable' },
  { label: 'Mounjaro/Zepbound 15 mg/wk — maximum',     value: 15,   max: 15,   type: 'injectable' },
  // Liraglutide
  { label: 'Victoza 0.6 mg/day — initiation',          value: 0.6,  max: 1.8,  type: 'injectable' },
  { label: 'Victoza 1.2 mg/day',                       value: 1.2,  max: 1.8,  type: 'injectable' },
  { label: 'Victoza 1.8 mg/day — maximum',             value: 1.8,  max: 1.8,  type: 'injectable' },
  // Saxenda
  { label: 'Saxenda 0.6 mg/day — initiation',          value: 0.6,  max: 3.0,  type: 'injectable' },
  { label: 'Saxenda 1.2 mg/day',                       value: 1.2,  max: 3.0,  type: 'injectable' },
  { label: 'Saxenda 1.8 mg/day',                       value: 1.8,  max: 3.0,  type: 'injectable' },
  { label: 'Saxenda 2.4 mg/day',                       value: 2.4,  max: 3.0,  type: 'injectable' },
  { label: 'Saxenda 3.0 mg/day — maximum',             value: 3.0,  max: 3.0,  type: 'injectable' },
  // Dulaglutide
  { label: 'Trulicity 0.75 mg/wk — initiation',        value: 0.75, max: 4.5,  type: 'injectable' },
  { label: 'Trulicity 1.5 mg/wk',                      value: 1.5,  max: 4.5,  type: 'injectable' },
  { label: 'Trulicity 3.0 mg/wk',                      value: 3.0,  max: 4.5,  type: 'injectable' },
  { label: 'Trulicity 4.5 mg/wk — maximum',            value: 4.5,  max: 4.5,  type: 'injectable' },
];

// ─── Client-side validation schema ───────────────────────────────────────────
const FormSchema = z.object({
  weightKg: z
    .string()
    .min(1, 'Weight is required')
    .refine(
      v => { const n = parseFloat(v); return !isNaN(n) && n >= 30 && n <= 250; },
      'Please enter a weight between 30 and 250 kg',
    ),
  drugLabel: z.string().min(1, 'Please select your GLP-1 medication and dose'),
  exerciseDaysWk: z
    .string()
    .min(1, 'Please enter a number between 0 and 7')
    .refine(
      v => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 7; },
      'Please enter a number between 0 and 7',
    ),
  hydrationLitres: z
    .string()
    .min(1, 'Please enter your average daily water intake')
    .refine(
      v => { const n = parseFloat(v); return !isNaN(n) && n >= 0.1 && n <= 15; },
      'Please enter a value between 0.1 and 15 litres (e.g. 2.5)',
    ),
});

type FormData = {
  weightKg:        string;
  drugLabel:       string;
  exerciseDaysWk:  string;
  hydrationLitres: string;
  symptoms:        string[];
};

type FieldErrors = Partial<Record<keyof Omit<FormData, 'symptoms'>, string>>;

/** Map exercise days → activityLevel enum expected by AssessmentInputSchema */
function daysToActivity(days: number): 'sedentary' | 'moderate' | 'active' {
  if (days >= 5) return 'active';
  if (days >= 2) return 'moderate';
  return 'sedentary';
}

// ─── Shared input class builders ─────────────────────────────────────────────
const baseInput =
  'w-full border rounded-lg px-4 py-3 text-sm text-slate-800 bg-white ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors';

function inputCls(hasError: boolean) {
  return `${baseInput} ${
    hasError
      ? 'border-red-400 focus:ring-red-300 bg-red-50/30'
      : 'border-slate-300 focus:ring-teal-400'
  }`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AssessmentPage() {
  const router = useRouter();

  const [form, setFormState] = useState<FormData>({
    weightKg:        '',
    drugLabel:       '',
    exerciseDaysWk:  '',
    hydrationLitres: '',
    symptoms:        [],
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // ── Helpers ──────────────────────────────────────────────────────────────
  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    const next = { ...form, [key]: value };
    setFormState(next);

    if (submitAttempted && key !== 'symptoms') {
      const partial = FormSchema.shape[key as keyof typeof FormSchema.shape];
      const result  = partial.safeParse(value);
      setFieldErrors(prev => ({
        ...prev,
        [key]: result.success ? undefined : result.error.errors[0]?.message,
      }));
    }
  };

  const toggleSymptom = (s: string) => {
    setFormState(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(s)
        ? prev.symptoms.filter(x => x !== s)
        : [...prev.symptoms, s],
    }));
  };

  const validate = (): FieldErrors => {
    const result = FormSchema.safeParse(form);
    if (result.success) return {};
    const errs: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof FieldErrors;
      if (!errs[key]) errs[key] = issue.message;
    }
    return errs;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setServerError('');

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const weight       = parseFloat(form.weightKg);
      const days         = parseInt(form.exerciseDaysWk, 10);
      const selectedDrug = GLP1_DRUGS.find(d => d.label === form.drugLabel);
      const doseMg       = selectedDrug?.value ?? 0;
      const isTirz       = form.drugLabel.toLowerCase().includes('mounjaro') ||
                           form.drugLabel.toLowerCase().includes('zepbound');

      // Derive a composite score locally (50-point base, adjusted by exercise and dose adherence)
      const exerciseBonus  = Math.min(days * 5, 25);
      const doseRatio      = selectedDrug ? doseMg / selectedDrug.max : 0.5;
      const composite      = Math.min(100, Math.round(50 + exerciseBonus + doseRatio * 25));
      const leanScore      = Math.min(100, Math.round(40 + exerciseBonus + doseRatio * 20));
      const recoveryScore  = Math.min(100, Math.round(50 + exerciseBonus * 0.8));
      const risk: 'LOW' | 'MODERATE' | 'HIGH' =
        composite >= 70 ? 'LOW' : composite >= 45 ? 'MODERATE' : 'HIGH';

      const giSymptoms = form.symptoms.filter(s =>
        ['Nausea', 'Constipation', 'Bloating'].includes(s)
      ).join(', ') || 'None';

      const payload = {
        composite,
        leanScore,
        recoveryScore,
        risk,
        weight,
        protein:    Math.round(weight * 1.6),
        drug:       isTirz ? 'tirzepatide' : 'semaglutide',
        giSymptoms,
        sleepHours: 7,
      };

      const res = await fetch('/api/assessment/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Save failed:', text);
        setServerError('Could not save assessment. Please try again.');
        return;
      }

      const json = await res.json();
      console.log("[assessment] API response:", json);
      if (!json.ok) {
        setServerError(json.detail ?? json.error ?? 'Failed to save assessment');
        return;
      }
      router.push('/dashboard/report');
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasErrors = Object.values(fieldErrors).some(Boolean);

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50 font-sans">

      <DashboardHeader />

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8">

        <div className="mb-8">
          <Link href="/dashboard" className="text-xs font-medium text-slate-500 hover:text-teal-600 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="max-w-xl mx-auto">

          <div className="mb-8">
            <h1 className="text-xl font-semibold text-slate-800">New Assessment</h1>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">
              Enter your current details to generate a fresh MyoGuard Score and muscle-protection protocol.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">

          {/* ── Weight ── */}
          <div>
            <label htmlFor="weightKg" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Current Body Weight (kg)
            </label>
            <input
              id="weightKg"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 89"
              min={30}
              max={250}
              value={form.weightKg}
              onChange={e => setField('weightKg', e.target.value)}
              className={inputCls(!!fieldErrors.weightKg)}
            />
            {fieldErrors.weightKg && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <span aria-hidden>⚠</span> {fieldErrors.weightKg}
              </p>
            )}
          </div>

          {/* ── GLP-1 Medication + Dose (grouped select) ── */}
          <div>
            <label htmlFor="drugLabel" className="block text-sm font-semibold text-slate-700 mb-1.5">
              GLP-1 Medication &amp; Dose
            </label>
            <select
              id="drugLabel"
              value={form.drugLabel}
              onChange={e => setField('drugLabel', e.target.value)}
              className={inputCls(!!fieldErrors.drugLabel)}
            >
              <option value="">Select your GLP-1 medication and dose</option>
              <optgroup label="Ozempic (semaglutide injectable — diabetes)">
                {GLP1_DRUGS.filter(d => d.label.startsWith('Ozempic')).map(d => (
                  <option key={d.label} value={d.label}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="Wegovy (semaglutide injectable — weight loss)">
                {GLP1_DRUGS.filter(d => d.label.startsWith('Wegovy')).map(d => (
                  <option key={d.label} value={d.label}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="Rybelsus (semaglutide oral tablet)">
                {GLP1_DRUGS.filter(d => d.label.startsWith('Rybelsus')).map(d => (
                  <option key={d.label} value={d.label}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="Mounjaro / Zepbound (tirzepatide)">
                {GLP1_DRUGS.filter(d => d.label.startsWith('Mounjaro')).map(d => (
                  <option key={d.label} value={d.label}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="Victoza (liraglutide — diabetes)">
                {GLP1_DRUGS.filter(d => d.label.startsWith('Victoza')).map(d => (
                  <option key={d.label} value={d.label}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="Saxenda (liraglutide — weight loss)">
                {GLP1_DRUGS.filter(d => d.label.startsWith('Saxenda')).map(d => (
                  <option key={d.label} value={d.label}>{d.label}</option>
                ))}
              </optgroup>
              <optgroup label="Trulicity (dulaglutide)">
                {GLP1_DRUGS.filter(d => d.label.startsWith('Trulicity')).map(d => (
                  <option key={d.label} value={d.label}>{d.label}</option>
                ))}
              </optgroup>
            </select>
            {fieldErrors.drugLabel && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <span aria-hidden>⚠</span> {fieldErrors.drugLabel}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              Oral semaglutide (Rybelsus) doses are normalised to injectable equivalents for scoring
              purposes. If your medication is not listed, select the closest equivalent.
            </p>
          </div>

          {/* ── Exercise days + Hydration ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            <div>
              <label htmlFor="exerciseDaysWk" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Exercise Days / Week
              </label>
              <input
                id="exerciseDaysWk"
                type="number"
                inputMode="numeric"
                placeholder="e.g. 3"
                min={0}
                max={7}
                step={1}
                value={form.exerciseDaysWk}
                onChange={e => setField('exerciseDaysWk', e.target.value)}
                className={inputCls(!!fieldErrors.exerciseDaysWk)}
              />
              {fieldErrors.exerciseDaysWk ? (
                <p className="mt-1.5 text-xs text-red-500 flex items-start gap-1">
                  <span aria-hidden className="mt-px">⚠</span> {fieldErrors.exerciseDaysWk}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">Enter a whole number between 0 and 7</p>
              )}
            </div>

            <div>
              <label htmlFor="hydrationLitres" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Water Intake (litres / day)
              </label>
              <input
                id="hydrationLitres"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 2.5"
                min={0.1}
                max={15}
                step={0.1}
                value={form.hydrationLitres}
                onChange={e => setField('hydrationLitres', e.target.value)}
                className={inputCls(!!fieldErrors.hydrationLitres)}
              />
              {fieldErrors.hydrationLitres ? (
                <p className="mt-1.5 text-xs text-red-500 flex items-start gap-1">
                  <span aria-hidden className="mt-px">⚠</span> {fieldErrors.hydrationLitres}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">Decimals accepted (e.g. 1.5 L)</p>
              )}
            </div>
          </div>

          {/* ── Symptoms ── */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Current Symptoms{' '}
              <span className="text-slate-400 font-normal">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map(s => (
                <button
                  key={s}
                  type="button"
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

          {/* ── Activity level hint ── */}
          {form.exerciseDaysWk !== '' && !fieldErrors.exerciseDaysWk && (
            <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
              <span className="text-sm">🏋️</span>
              <p className="text-xs text-teal-700">
                <span className="font-semibold">
                  {daysToActivity(parseInt(form.exerciseDaysWk, 10)) === 'active'
                    ? 'Active'
                    : daysToActivity(parseInt(form.exerciseDaysWk, 10)) === 'moderate'
                    ? 'Moderately active'
                    : 'Sedentary'}
                </span>{' '}
                — used to calibrate your muscle-protection protocol
              </p>
            </div>
          )}

          {/* ── Server error ── */}
          {serverError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <span className="text-red-500 mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* ── Field summary hint on failed submit ── */}
          {submitAttempted && hasErrors && !serverError && (
            <p className="text-xs text-slate-500 text-center">
              Please fix the highlighted fields above before continuing.
            </p>
          )}

          {/* ── Submit ── */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
              loading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
            }`}
          >
            {loading ? 'Calculating your score…' : 'Generate My Muscle Protection Plan →'}
          </button>

          </div>

          <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
            This tool generates educational nutritional reference data only. It does not constitute
            a physician–patient relationship or individualised medical advice. Review all recommendations
            with your prescribing physician.{' '}
            <Link href="/privacy" className="underline hover:text-slate-600 transition-colors">
              Privacy Policy
            </Link>
          </p>

        </div>
      </div>
    </main>
  );
}
