'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import DashboardHeader from '@/src/components/ui/DashboardHeader';

// ─── Symptoms list (mirrors main form + protocol engine) ──────────────────────
const SYMPTOMS = [
  'Constipation',
  'Nausea',
  'Muscle weakness',
  'Fatigue',
  'Reduced appetite',
  'Bloating',
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
  medication: z.enum(['semaglutide', 'tirzepatide'], {
    errorMap: () => ({ message: 'Please select your medication' }),
  }),
  doseMg: z
    .string()
    .min(1, 'Dose is required')
    .refine(
      v => { const n = parseFloat(v); return !isNaN(n) && n > 0; },
      'Please enter a valid weekly dose (e.g. 1.0)',
    ),
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
  medication:      'semaglutide' | 'tirzepatide';
  doseMg:          string;
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

// ─── Shared input class builders ──────────────────────────────────────────────
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

  const [form, setForm] = useState<FormData>({
    weightKg:        '',
    medication:      'semaglutide',
    doseMg:          '',
    exerciseDaysWk:  '',
    hydrationLitres: '',
    symptoms:        [],
  });

  // fieldErrors appear after first submit attempt; revalidate on every change after that
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);

    // Live-revalidate once the user has attempted submission
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
    setForm(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(s)
        ? prev.symptoms.filter(x => x !== s)
        : [...prev.symptoms, s],
    }));
  };

  // ── Validate all fields, return errors map ─────────────────────────────────
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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setServerError('');

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return; // stop — show inline errors

    setLoading(true);
    try {
      const days = parseInt(form.exerciseDaysWk, 10);

      // Build payload that matches AssessmentInputSchema
      const payload = {
        weight:        form.weightKg,           // API expects string
        unit:          'kg' as const,
        medication:    form.medication,
        doseMg:        parseFloat(form.doseMg),
        activityLevel: daysToActivity(days),    // maps 0-7 days → sedentary/moderate/active
        symptoms:      form.symptoms,
      };

      const res  = await fetch('/api/assessment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');

      router.push('/dashboard/results/' + data.assessmentId);
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

      {/* Header */}
      <DashboardHeader />

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-xs font-medium text-slate-500 hover:text-teal-600 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>

        {/* Form — constrained to readable width, centered */}
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

          {/* ── Medication ── */}
          <div>
            <label htmlFor="medication" className="block text-sm font-semibold text-slate-700 mb-1.5">
              GLP-1 Medication
            </label>
            <select
              id="medication"
              value={form.medication}
              onChange={e => setField('medication', e.target.value as FormData['medication'])}
              className={inputCls(!!fieldErrors.medication)}
            >
              <option value="semaglutide">Semaglutide (Ozempic / Wegovy)</option>
              <option value="tirzepatide">Tirzepatide (Zepbound / Mounjaro)</option>
            </select>
            {fieldErrors.medication && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <span aria-hidden>⚠</span> {fieldErrors.medication}
              </p>
            )}
          </div>

          {/* ── Weekly dose ── */}
          <div>
            <label htmlFor="doseMg" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Current Weekly Dose (mg)
            </label>
            <input
              id="doseMg"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 1.0"
              min={0.1}
              step={0.25}
              value={form.doseMg}
              onChange={e => setField('doseMg', e.target.value)}
              className={inputCls(!!fieldErrors.doseMg)}
            />
            {fieldErrors.doseMg && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <span aria-hidden>⚠</span> {fieldErrors.doseMg}
              </p>
            )}
          </div>

          {/* ── Exercise days + Hydration (side by side on ≥sm) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Exercise days */}
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

            {/* Hydration */}
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
