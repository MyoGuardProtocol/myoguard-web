'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';

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
  sleepHours?:     number;
  sleepQuality?:   number;
  glp1Stage:       string | null;
  gripStrengthKg:  number | null;
};

type FieldErrors = Partial<Record<keyof Omit<FormData, 'symptoms' | 'sleepHours' | 'sleepQuality' | 'glp1Stage' | 'gripStrengthKg'>, string>>;

/** Map exercise days → activityLevel enum expected by AssessmentInputSchema */
function daysToActivity(days: number): 'sedentary' | 'moderate' | 'active' {
  if (days >= 5) return 'active';
  if (days >= 2) return 'moderate';
  return 'sedentary';
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
    sleepHours:      undefined,
    sleepQuality:    undefined,
    glp1Stage:       null,
    gripStrengthKg:  null,
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
      const days         = parseInt(form.exerciseDaysWk, 10);
      const selectedDrug = GLP1_DRUGS.find(d => d.label === form.drugLabel);
      const isTirz       = form.drugLabel.toLowerCase().includes('mounjaro') ||
                           form.drugLabel.toLowerCase().includes('zepbound');

      const payload: Record<string, unknown> = {
        weight:         form.weightKg,
        unit:           'kg',
        medication:     isTirz ? 'tirzepatide' : 'semaglutide',
        doseMg:         selectedDrug?.value ?? 0,
        activityLevel:  daysToActivity(days),
        symptoms:       form.symptoms,
        exerciseDaysWk: days,
        glp1Stage:      form.glp1Stage ?? undefined,
        gripStrengthKg: form.gripStrengthKg
          ? parseFloat(String(form.gripStrengthKg))
          : undefined,
      };
      if (form.sleepHours   !== undefined) payload.sleepHours   = form.sleepHours;
      if (form.sleepQuality !== undefined) payload.sleepQuality = form.sleepQuality;

      const res = await fetch('/api/assessment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setServerError(json.error ?? 'Could not save assessment. Please try again.');
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

  // ─── Shared inline style helpers ─────────────────────────────────────────
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    boxSizing: 'border-box',
    background: '#0D1421',
    border: `1px solid ${hasError ? '#FB7185' : '#1A2744'}`,
    color: '#F1F5F9',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s',
  });

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <main style={{
      background: '#080C14',
      minHeight: '100vh',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* Focus ring injected globally for this page */}
      <style>{`
        .myg-input:focus { border-color: #2DD4BF !important; }
        .myg-input::placeholder { color: #475569; }
        .myg-select option { background: #0D1421; color: #F1F5F9; }
        .myg-select optgroup { background: #080C14; color: #94A3B8; }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        background: '#060D1E',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 20px',
      }}>
        <div style={{
          maxWidth: '640px', margin: '0 auto',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: '56px',
        }}>
          <a href="/dashboard" style={{
            textDecoration: 'none', fontSize: '18px', fontWeight: '900',
            letterSpacing: '-0.03em', color: '#F8FAFC',
          }}>
            Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          </a>
          <a href="/dashboard" style={{ fontSize: '13px', color: '#94A3B8', textDecoration: 'none' }}>
            ← Dashboard
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 20px 48px' }}>

        {/* ── Heading ── */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            color: '#F1F5F9',
            fontSize: '22px',
            fontWeight: '600',
            marginBottom: '6px',
          }}>
            New Assessment
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
            Enter your current details to generate a fresh MyoGuard Score and muscle-protection protocol.
          </p>
        </div>

        {/* ── Form card ── */}
        <div style={{
          background: '#0D1421',
          border: '1px solid #1A2744',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>

          {/* ── Weight ── */}
          <div>
            <label htmlFor="weightKg" style={{
              display: 'block', fontSize: '13px', fontWeight: '600',
              color: '#F1F5F9', marginBottom: '6px',
            }}>
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
              className="myg-input"
              style={inputStyle(!!fieldErrors.weightKg)}
            />
            {fieldErrors.weightKg && (
              <p style={{ marginTop: '6px', fontSize: '12px', color: '#FB7185',
                display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span aria-hidden>⚠</span> {fieldErrors.weightKg}
              </p>
            )}
          </div>

          {/* ── GLP-1 Medication + Dose ── */}
          <div>
            <label htmlFor="drugLabel" style={{
              display: 'block', fontSize: '13px', fontWeight: '600',
              color: '#F1F5F9', marginBottom: '6px',
            }}>
              GLP-1 Medication &amp; Dose
            </label>
            <select
              id="drugLabel"
              value={form.drugLabel}
              onChange={e => setField('drugLabel', e.target.value)}
              className="myg-input myg-select"
              style={{
                ...inputStyle(!!fieldErrors.drugLabel),
                color: form.drugLabel ? '#F1F5F9' : '#475569',
              }}
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
              <p style={{ marginTop: '6px', fontSize: '12px', color: '#FB7185',
                display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span aria-hidden>⚠</span> {fieldErrors.drugLabel}
              </p>
            )}
            <p style={{ marginTop: '6px', fontSize: '12px', color: '#94A3B8' }}>
              Oral semaglutide (Rybelsus) doses are normalised to injectable equivalents for scoring
              purposes. If your medication is not listed, select the closest equivalent.
            </p>
          </div>

          {/* ── GLP-1 Treatment Stage ── */}
          <div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F1F5F9' }}>
                Treatment Stage
              </span>
              <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '8px', fontWeight: '400' }}>
                Helps calibrate your muscle protection targets
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {([
                { value: 'INITIATION',     label: 'Initiation',      sub: '0–3 months' },
                { value: 'DOSE_ESCALATION', label: 'Dose Escalation', sub: '3–6 months' },
                { value: 'MAINTENANCE',    label: 'Maintenance',     sub: '6+ months' },
                { value: 'DISCONTINUATION', label: 'Discontinuing',  sub: 'Tapering off' },
              ] as const).map(stage => (
                <button
                  key={stage.value}
                  type="button"
                  onClick={() => setFormState(prev => ({ ...prev, glp1Stage: stage.value }))}
                  style={{
                    borderRadius: '10px',
                    border: form.glp1Stage === stage.value ? 'none' : '1px solid #1A2744',
                    background: form.glp1Stage === stage.value ? '#2DD4BF' : '#0D1421',
                    color: form.glp1Stage === stage.value ? '#080C14' : '#94A3B8',
                    fontWeight: form.glp1Stage === stage.value ? 700 : 400,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 'inherit' }}>{stage.label}</div>
                  <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.75 }}>{stage.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Exercise days + Hydration ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            <div>
              <label htmlFor="exerciseDaysWk" style={{
                display: 'block', fontSize: '13px', fontWeight: '600',
                color: '#F1F5F9', marginBottom: '6px',
              }}>
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
                className="myg-input"
                style={inputStyle(!!fieldErrors.exerciseDaysWk)}
              />
              {fieldErrors.exerciseDaysWk ? (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#FB7185',
                  display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                  <span aria-hidden style={{ marginTop: '1px' }}>⚠</span> {fieldErrors.exerciseDaysWk}
                </p>
              ) : (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#94A3B8' }}>
                  Enter a whole number between 0 and 7
                </p>
              )}
            </div>

            <div>
              <label htmlFor="hydrationLitres" style={{
                display: 'block', fontSize: '13px', fontWeight: '600',
                color: '#F1F5F9', marginBottom: '6px',
              }}>
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
                className="myg-input"
                style={inputStyle(!!fieldErrors.hydrationLitres)}
              />
              {fieldErrors.hydrationLitres ? (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#FB7185',
                  display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                  <span aria-hidden style={{ marginTop: '1px' }}>⚠</span> {fieldErrors.hydrationLitres}
                </p>
              ) : (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#94A3B8' }}>
                  Decimals accepted (e.g. 1.5 L)
                </p>
              )}
            </div>
          </div>

          {/* ── Symptoms ── */}
          <div>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: '600',
              color: '#F1F5F9', marginBottom: '10px',
            }}>
              Current Symptoms{' '}
              <span style={{ color: '#94A3B8', fontWeight: '400' }}>(select all that apply)</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {SYMPTOMS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymptom(s)}
                  style={{
                    borderRadius: '99px',
                    border: `1px solid ${form.symptoms.includes(s) ? '#2DD4BF' : '#1A2744'}`,
                    background: form.symptoms.includes(s) ? 'rgba(45,212,191,0.15)' : 'transparent',
                    color: form.symptoms.includes(s) ? '#2DD4BF' : '#94A3B8',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sleep & Recovery (Section C — optional) ── */}
          <div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F1F5F9' }}>
                Sleep &amp; Recovery{' '}
                <span style={{ color: '#94A3B8', fontWeight: '400' }}>(optional — improves score accuracy)</span>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

              <div>
                <label htmlFor="sleepHours" style={{
                  display: 'block', fontSize: '12px', fontWeight: '500',
                  color: '#94A3B8', marginBottom: '6px',
                }}>
                  Hours of sleep / night
                </label>
                <input
                  id="sleepHours"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 7"
                  min={0}
                  max={14}
                  step={0.5}
                  value={form.sleepHours ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setFormState(prev => ({
                      ...prev,
                      sleepHours: v === '' ? undefined : parseFloat(v),
                    }));
                  }}
                  className="myg-input"
                  style={inputStyle(false)}
                />
              </div>

              <div>
                <label htmlFor="sleepQuality" style={{
                  display: 'block', fontSize: '12px', fontWeight: '500',
                  color: '#94A3B8', marginBottom: '6px',
                }}>
                  Sleep quality (1 = poor, 5 = excellent)
                </label>
                <select
                  id="sleepQuality"
                  value={form.sleepQuality ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setFormState(prev => ({
                      ...prev,
                      sleepQuality: v === '' ? undefined : parseInt(v, 10),
                    }));
                  }}
                  className="myg-input myg-select"
                  style={{
                    ...inputStyle(false),
                    color: form.sleepQuality !== undefined ? '#F1F5F9' : '#475569',
                  }}
                >
                  <option value="">Select quality</option>
                  <option value="1">1 — Poor</option>
                  <option value="2">2 — Fair</option>
                  <option value="3">3 — OK</option>
                  <option value="4">4 — Good</option>
                  <option value="5">5 — Excellent</option>
                </select>
              </div>

            </div>
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
              Sleep data activates the recovery modifier in your MyoGuard Score.
              Fewer than 6.5 hours or poor quality (≤ 2) reduces your score by 10 points.
            </p>
          </div>

          {/* ── Grip Strength ── */}
          <div>
            <label htmlFor="gripStrengthKg" style={{
              display: 'block', fontSize: '13px', fontWeight: '600',
              color: '#F1F5F9', marginBottom: '4px',
            }}>
              Grip Strength (kg)
            </label>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px', lineHeight: '1.5' }}>
              Optional — measured with hand dynamometer, dominant hand. Tracks functional muscle decline.
            </p>
            <input
              id="gripStrengthKg"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 28"
              min={5}
              max={80}
              step={0.5}
              value={form.gripStrengthKg ?? ''}
              onChange={e => {
                const v = e.target.value;
                setFormState(prev => ({
                  ...prev,
                  gripStrengthKg: v === '' ? null : parseFloat(v),
                }));
              }}
              className="myg-input"
              style={inputStyle(false)}
            />
          </div>

          {/* ── Activity level hint ── */}
          {form.exerciseDaysWk !== '' && !fieldErrors.exerciseDaysWk && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'rgba(45,212,191,0.07)',
              border: '1px solid rgba(45,212,191,0.2)',
              borderRadius: '12px',
              padding: '12px 16px',
            }}>
              <span style={{ fontSize: '16px' }}>🏋️</span>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>
                <span style={{ fontWeight: '600', color: '#2DD4BF' }}>
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
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: 'rgba(251,113,133,0.08)',
              border: '1px solid rgba(251,113,133,0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
            }}>
              <span style={{ color: '#FB7185', flexShrink: 0, marginTop: '1px' }}>⚠</span>
              <p style={{ fontSize: '13px', color: '#FB7185' }}>{serverError}</p>
            </div>
          )}

          {/* ── Field summary hint on failed submit ── */}
          {submitAttempted && hasErrors && !serverError && (
            <p style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
              Please fix the highlighted fields above before continuing.
            </p>
          )}

          {/* ── Submit ── */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '99px',
              fontWeight: '700',
              fontSize: '14px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#1A2744' : '#2DD4BF',
              color: loading ? '#475569' : '#080C14',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Calculating your score…' : 'Generate My Muscle Protection Plan →'}
          </button>

        </div>

        {/* ── Disclaimer ── */}
        <p style={{
          marginTop: '24px',
          fontSize: '11px',
          color: '#475569',
          textAlign: 'center',
          lineHeight: '1.7',
        }}>
          This tool generates educational nutritional reference data only. It does not constitute
          a physician–patient relationship or individualised medical advice. Review all recommendations
          with your prescribing physician.{' '}
          <Link href="/privacy" style={{ color: '#94A3B8', textDecoration: 'underline' }}>
            Privacy Policy
          </Link>
        </p>

      </div>
    </main>
  );
}
