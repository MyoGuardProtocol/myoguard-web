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

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(26,39,68,0.4)',
  border: '1px solid #1A2744',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '14px',
  color: '#F1F5F9',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '600',
  color: '#94A3B8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '8px',
};

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
    <main style={{ minHeight: '100vh', background: '#080C14', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
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
          <Link href="/" style={{ textDecoration: 'none', fontSize: '18px', fontWeight: '900', letterSpacing: '-0.03em', color: '#F8FAFC' }}>
            Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          </Link>
          <Link href="/dashboard" style={{ fontSize: '13px', color: '#94A3B8', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 20px 48px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '6px' }}>
            MyoGuard Protocol
          </p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '400', color: '#F1F5F9', marginBottom: '8px', lineHeight: '1.3' }}>
            Weekly Pulse
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
            Log this week&apos;s metrics to track your protocol adherence and symptom trends over time.
          </p>
        </div>

        {/* Form card */}
        <div style={{ background: '#0D1421', border: '1px solid #1A2744', borderRadius: '20px', overflow: 'hidden' }}>

          {/* Numeric fields */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', borderBottom: '1px solid #1A2744' }}>

            {/* Weight */}
            <div>
              <label style={labelStyle}>
                Body Weight (kg) <span style={{ color: '#475569', fontWeight: '400', textTransform: 'none' }}>optional</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 84.5"
                value={form.avgWeightKg}
                onChange={e => setForm(f => ({ ...f, avgWeightKg: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Protein */}
            <div>
              <label style={labelStyle}>
                Average Daily Protein (g) <span style={{ color: '#475569', fontWeight: '400', textTransform: 'none' }}>optional</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 120"
                value={form.avgProteinG}
                onChange={e => setForm(f => ({ ...f, avgProteinG: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Workouts */}
            <div>
              <label style={labelStyle}>
                Resistance Sessions This Week <span style={{ color: '#475569', fontWeight: '400', textTransform: 'none' }}>optional</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 3"
                min={0}
                max={21}
                value={form.totalWorkouts}
                onChange={e => setForm(f => ({ ...f, totalWorkouts: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Hydration */}
            <div>
              <label style={labelStyle}>
                Average Daily Hydration (L) <span style={{ color: '#475569', fontWeight: '400', textTransform: 'none' }}>optional</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 2.5"
                value={form.avgHydration}
                onChange={e => setForm(f => ({ ...f, avgHydration: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Energy level */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1A2744' }}>
            <label style={labelStyle}>Energy Level This Week</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '8px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setForm(f => ({ ...f, energyLevel: n }))}
                  style={{
                    borderRadius: '10px',
                    border: form.energyLevel === n ? '1px solid #2DD4BF' : '1px solid #1A2744',
                    padding: '10px 0',
                    textAlign: 'center',
                    background: form.energyLevel === n ? 'rgba(45,212,191,0.1)' : 'rgba(26,39,68,0.4)',
                    color: form.energyLevel === n ? '#2DD4BF' : '#94A3B8',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <p style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{n}</p>
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#475569' }}>{SCALE_LABELS[form.energyLevel]}</p>
          </div>

          {/* Nausea level */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1A2744' }}>
            <label style={labelStyle}>Nausea / GI Symptoms This Week</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '8px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setForm(f => ({ ...f, nauseaLevel: n }))}
                  style={{
                    borderRadius: '10px',
                    border: form.nauseaLevel === n ? '1px solid #2DD4BF' : '1px solid #1A2744',
                    padding: '10px 0',
                    textAlign: 'center',
                    background: form.nauseaLevel === n ? 'rgba(45,212,191,0.1)' : 'rgba(26,39,68,0.4)',
                    color: form.nauseaLevel === n ? '#2DD4BF' : '#94A3B8',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <p style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{n}</p>
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#475569' }}>{NAUSEA_LABELS[form.nauseaLevel]}</p>
          </div>

          {/* Notes */}
          <div style={{ padding: '20px 24px', borderBottom: error ? '1px solid #1A2744' : 'none' }}>
            <label style={labelStyle}>
              Notes <span style={{ color: '#475569', fontWeight: '400', textTransform: 'none' }}>optional</span>
            </label>
            <textarea
              placeholder="Any observations, side effects, or wins this week…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: 'none', lineHeight: '1.6' }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #1A2744' }}>
              <p style={{ fontSize: '13px', color: '#FB7185', background: 'rgba(248,113,133,0.08)', border: '1px solid rgba(248,113,133,0.2)', borderRadius: '10px', padding: '12px 14px', margin: 0 }}>
                {error}
              </p>
            </div>
          )}

          {/* Submit */}
          <div style={{ padding: '20px 24px' }}>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: submitting ? 'rgba(45,212,191,0.4)' : '#2DD4BF',
                color: '#080C14',
                fontSize: '14px',
                fontWeight: '700',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {submitting ? 'Saving…' : 'Log Weekly Pulse →'}
            </button>
          </div>

        </div>

        <p style={{ marginTop: '24px', fontSize: '11px', color: '#1A2744', textAlign: 'center' }}>
          © 2026 Meridian Wellness Systems LLC · MyoGuard Protocol
        </p>

      </div>
    </main>
  );
}
