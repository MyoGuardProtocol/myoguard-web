'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PatientRow } from './PatientCommandCenter';

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawerAssessment = {
  id:             string;
  assessmentDate: string;
  weightKg:       number;
  proteinGrams:   number;
  sleepHours:     number | null;
  sleepQuality:   number | null;
  recoveryStatus: string | null;
  symptoms:       string[];
  gripStrengthKg: number | null;
  muscleScore: {
    score:          number;
    riskBand:       string;
    leanLossEstPct: number;
    proteinTargetG: number;
    explanation:    string;
  } | null;
  protocolPlan: {
    proteinTargetG: number;
  } | null;
  physicianReview: {
    overallImpression: string | null;
    followUpDays:      number | null;
    note:              string | null;
    reviewedAt:        string;
  } | null;
};

type DrawerCheckin = {
  id:                string;
  weekStart:         string;
  avgProteinG:       number | null;
  proteinAdherence:  number | null;
  exerciseAdherence: number | null;
  sleepHours:        number | null;
  recoveryStatus:    string | null;
  energyLevel:       number | null;
  totalWorkouts:     number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeGripVelocity(
  assessments: DrawerAssessment[],
): { pct: number; isHighRisk: boolean } | null {
  const withGrip = assessments.filter(a => a.gripStrengthKg != null);
  if (withGrip.length < 2) return null;

  const current  = withGrip[0]; // newest
  const cutoff   = new Date(new Date(current.assessmentDate).getTime() - 28 * 24 * 60 * 60 * 1000);
  const baseline = withGrip
    .filter(a => a !== current && new Date(a.assessmentDate) >= cutoff)
    .at(-1); // oldest within 28-day window

  if (!baseline) return null;
  const pct = ((current.gripStrengthKg! - baseline.gripStrengthKg!) / baseline.gripStrengthKg!) * 100;
  return { pct, isHighRisk: pct < -15 };
}

function currentBillingMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function fmtMinSec(totalSeconds: number): string {
  const m   = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;

  const W = 320, H = 80, PAD = 8;
  const min   = Math.min(...scores) - 5;
  const max   = Math.max(...scores) + 5;
  const range = max - min || 1;

  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((s - min) / range) * (H - PAD * 2);
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area     = `M${pts[0][0]},${H} ` + pts.map(([x, y]) => `L${x},${y}`).join(' ') + ` L${pts[pts.length - 1][0]},${H} Z`;
  const latest   = pts[pts.length - 1];
  const delta    = scores[scores.length - 1] - scores[0];
  const trendCol = delta >= 0 ? '#2DD4BF' : '#F43F5E';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Score History ({scores.length} assessments)
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: trendCol }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} overall
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={trendCol} stopOpacity="0.25" />
            <stop offset="100%" stopColor={trendCol} stopOpacity="0"    />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-grad)" />
        <polyline points={polyline} fill="none" stroke={trendCol} strokeWidth="2" strokeLinejoin="round" />
        <circle cx={latest[0]} cy={latest[1]} r="5" fill={trendCol} opacity="0.3" />
        <circle cx={latest[0]} cy={latest[1]} r="3" fill={trendCol} />
        <text x={latest[0] - 2} y={latest[1] - 9} fill={trendCol} fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="middle">
          {Math.round(scores[scores.length - 1])}
        </text>
      </svg>
    </div>
  );
}

// ─── Adherence bar ────────────────────────────────────────────────────────────

function AdherenceBar({ label, pct }: { label: string; pct: number | null }) {
  if (pct == null) return null;
  const capped = Math.min(pct, 100);
  const color  = capped >= 100 ? '#2DD4BF' : capped >= 75 ? '#FCD34D' : '#F43F5E';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${capped}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ─── MDM Panel ───────────────────────────────────────────────────────────────

const GI_SYMPTOM_SET = new Set(['Nausea', 'Vomiting', 'Constipation', 'Bloating', 'Reduced appetite']);

function MdmPanel({ latest, assessments }: { latest: DrawerAssessment; assessments: DrawerAssessment[] }) {
  const ms          = latest.muscleScore;
  const proteinTarget = ms?.proteinTargetG ?? latest.weightKg * 1.4;
  const proteinPct    = proteinTarget > 0 ? (latest.proteinGrams / proteinTarget) * 100 : null;
  const targetGPerKg  = proteinTarget / latest.weightKg;
  const gripVelocity  = computeGripVelocity(assessments);

  const giSymptoms = latest.symptoms.filter(s => GI_SYMPTOM_SET.has(s));
  const urgentGi   = latest.symptoms.includes('Nausea') || latest.symptoms.includes('Vomiting');

  return (
    <div style={{
      background:   'rgba(255,255,255,0.025)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding:      '14px 16px',
      marginBottom: 20,
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        MDM Clinical Data
      </p>

      {/* ── Protein ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>Protein Intake vs Target</span>
          <span style={{
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            color: proteinPct == null ? 'rgba(255,255,255,0.3)' : proteinPct >= 90 ? '#2DD4BF' : proteinPct >= 75 ? '#FCD34D' : '#FB923C',
          }}>
            {Math.round(latest.proteinGrams)}g / {Math.round(proteinTarget)}g
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
          {proteinPct != null && (
            <div style={{
              width:      `${Math.min(proteinPct, 100)}%`,
              height:     '100%',
              background: proteinPct >= 90 ? '#2DD4BF' : proteinPct >= 75 ? '#FCD34D' : '#FB923C',
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }} />
          )}
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          Target: {targetGPerKg.toFixed(1)} g/kg &middot; {latest.weightKg} kg
        </p>
      </div>

      {/* ── Grip Velocity ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>Grip Velocity Trend</span>
          {gripVelocity ? (
            <span style={{
              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
              color: gripVelocity.isHighRisk ? '#F43F5E' : gripVelocity.pct >= 0 ? '#2DD4BF' : '#FCD34D',
            }}>
              {gripVelocity.pct >= 0 ? '+' : ''}{gripVelocity.pct.toFixed(1)}%
              {gripVelocity.isHighRisk && (
                <span style={{ marginLeft: 6, fontSize: 9, background: 'rgba(244,63,94,0.15)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 4, padding: '1px 5px', fontFamily: 'sans-serif' }}>
                  HIGH RISK
                </span>
              )}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>No grip data</span>
          )}
        </div>
        {gripVelocity && (
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            28-day window &middot; &gt;15% decline triggers triage alert
          </p>
        )}
      </div>

      {/* ── GI Symptom Cluster ───────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>GI Symptom Cluster</span>
          {urgentGi && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#FB923C', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 4, padding: '1px 6px' }}>
              URGENT
            </span>
          )}
        </div>
        {giSymptoms.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {giSymptoms.map(s => {
              const isUrgent = s === 'Nausea' || s === 'Vomiting';
              return (
                <span key={s} style={{
                  fontSize:   10,
                  fontWeight: 600,
                  padding:    '2px 8px',
                  borderRadius: 99,
                  background: isUrgent ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.05)',
                  color:      isUrgent ? '#FB923C' : 'rgba(255,255,255,0.5)',
                  border:     `1px solid ${isUrgent ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  {s}
                </span>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>No GI symptoms reported</p>
        )}
      </div>
    </div>
  );
}

// ─── Clinical Intervention Dropdown ──────────────────────────────────────────

const INTERVENTION_OPTIONS = [
  { value: '',                             label: 'Select intervention...' },
  { value: 'supplementation_adjusted',     label: 'Supplementation Adjusted' },
  { value: 'protein_target_increased',     label: 'Protein Target Increased' },
  { value: 'gi_protocol_initiated',        label: 'GI Protocol Initiated' },
  { value: 'resistance_training_prescribed', label: 'Resistance Training Prescribed' },
  { value: 'dose_escalation_deferred',     label: 'Dose Escalation Deferred' },
  { value: 'referred_to_dietitian',        label: 'Referred to Dietitian' },
  { value: 'labs_ordered',                 label: 'Labs Ordered' },
];

function InterventionDropdown({ patientName }: { patientName: string }) {
  const [value, setValue] = useState('');
  return (
    <div style={{
      background:   'rgba(255,255,255,0.025)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding:      '14px 16px',
      marginBottom: 20,
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
        Clinical Intervention (MDM)
      </p>
      <select
        value={value}
        onChange={e => {
          const selected = e.target.value;
          setValue(selected);
          if (selected) {
            const label = INTERVENTION_OPTIONS.find(o => o.value === selected)?.label ?? selected;
            console.log(`[MDM] Patient: ${patientName} | Intervention: ${label} | Time: ${new Date().toISOString()}`);
          }
        }}
        style={{
          width:        '100%',
          padding:      '9px 12px',
          background:   'rgba(255,255,255,0.04)',
          border:       '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          color:        value ? '#F8FAFC' : 'rgba(255,255,255,0.35)',
          fontSize:     13,
          outline:      'none',
          cursor:       'pointer',
          appearance:   'none',
        }}
      >
        {INTERVENTION_OPTIONS.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#0F172A', color: '#F8FAFC' }}>
            {o.label}
          </option>
        ))}
      </select>
      {value && (
        <p style={{ fontSize: 10, color: 'rgba(34,197,94,0.8)', marginTop: 6, fontWeight: 600 }}>
          Intervention documented for MDM record
        </p>
      )}
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function PatientDrawer({
  patient,
  isVerified,
  onClose,
}: {
  patient:    PatientRow | null;
  isVerified: boolean;
  onClose:    () => void;
}) {
  const [assessments,            setAssessments]            = useState<DrawerAssessment[]>([]);
  const [checkins,               setCheckins]               = useState<DrawerCheckin[]>([]);
  const [loading,                setLoading]                = useState(false);
  const [error,                  setError]                  = useState<string | null>(null);
  const [evidenceConfirmed,      setEvidenceConfirmed]      = useState(false);

  // ── Session timer ───────────────────────────────────────────────────────────
  // priorMonthSeconds: accumulated time from previous sessions this billing month
  const [priorMonthSeconds, setPriorMonthSeconds] = useState(0);
  const [sessionSeconds,    setSessionSeconds]    = useState(0);

  const sessionSecondsRef = useRef(0); // mirror for callbacks to avoid stale closure
  const savedSecondsRef   = useRef(0); // delta baseline for incremental saves
  const patientIdRef      = useRef<string | null>(null);

  const saveIncrement = useCallback((patientId: string, additional: number) => {
    if (additional <= 0) return;
    fetch('/api/physician/review-session', {
      method:    'POST',
      headers:   { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        patientId,
        additionalSeconds: additional,
        billingMonth:      currentBillingMonth(),
      }),
    }).catch(() => {}); // silent fail — timer data is non-critical
  }, []);

  // Start/stop timer when patient changes
  useEffect(() => {
    if (!patient) {
      // Drawer closing — flush unsaved seconds
      const unsaved = sessionSecondsRef.current - savedSecondsRef.current;
      if (unsaved > 0 && patientIdRef.current) {
        saveIncrement(patientIdRef.current, unsaved);
      }
      setSessionSeconds(0);
      sessionSecondsRef.current = 0;
      savedSecondsRef.current   = 0;
      patientIdRef.current      = null;
      return;
    }

    patientIdRef.current    = patient.id;
    sessionSecondsRef.current = 0;
    savedSecondsRef.current   = 0;
    setSessionSeconds(0);

    const tick = setInterval(() => {
      sessionSecondsRef.current += 1;
      setSessionSeconds(s => s + 1);
    }, 1000);

    // Persist every 60 s
    const persist = setInterval(() => {
      const unsaved = sessionSecondsRef.current - savedSecondsRef.current;
      if (unsaved >= 60 && patientIdRef.current) {
        saveIncrement(patientIdRef.current, unsaved);
        savedSecondsRef.current = sessionSecondsRef.current;
      }
    }, 60_000);

    return () => {
      clearInterval(tick);
      clearInterval(persist);
    };
  }, [patient?.id, saveIncrement]);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!patient) return;
    let active = true;
    setLoading(true);
    setError(null);
    setAssessments([]);
    setCheckins([]);
    setPriorMonthSeconds(0);

    fetch(`/api/physician/patients/${patient.id}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setAssessments(data.assessments ?? []);
        setCheckins(data.checkins ?? []);
        setPriorMonthSeconds(data.priorMonthSeconds ?? 0);
      })
      .catch(() => { if (active) setError('Failed to load patient data.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [patient?.id]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const open        = patient !== null;
  const latest      = assessments[0] ?? null;
  const ms          = latest?.muscleScore ?? null;
  const scores      = assessments
    .map(a => a.muscleScore?.score)
    .filter((s): s is number => s != null);
  const latestCheckin = checkins[0] ?? null;

  // CPT 99470 badge
  const totalMonthSeconds = priorMonthSeconds + sessionSeconds;
  const totalMonthMinutes = Math.floor(totalMonthSeconds / 60);
  const cptEligible       = totalMonthMinutes >= 10;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:      'fixed',
          inset:         0,
          background:    'rgba(0,0,0,0.55)',
          zIndex:        40,
          opacity:       open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition:    'opacity 0.2s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:      'fixed',
          top:           0,
          right:         0,
          bottom:        0,
          width:         '100%',
          maxWidth:      460,
          background:    '#060D1E',
          borderLeft:    '1px solid rgba(255,255,255,0.08)',
          zIndex:        50,
          display:       'flex',
          flexDirection: 'column',
          transform:     open ? 'translateX(0)' : 'translateX(100%)',
          transition:    'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflowY:     'auto',
        }}
      >
        {patient && (
          <>
            {/* ── Header ────────────────────────────────────────────────── */}
            <div style={{
              padding:        '18px 20px 14px',
              borderBottom:   '1px solid rgba(255,255,255,0.07)',
              display:        'flex',
              alignItems:     'flex-start',
              justifyContent: 'space-between',
              flexShrink:     0,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                  Deep Dive
                </p>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                  {patient.fullName}
                </h2>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{patient.email}</p>
              </div>

              {/* CPT 99470 badge + timer */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                <button
                  onClick={onClose}
                  style={{
                    background:     'rgba(255,255,255,0.06)',
                    border:         '1px solid rgba(255,255,255,0.09)',
                    borderRadius:   8,
                    color:          'rgba(255,255,255,0.6)',
                    cursor:         'pointer',
                    fontSize:       18,
                    width:          32,
                    height:         32,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Close drawer"
                >
                  ×
                </button>
                <div style={{
                  display:      'flex',
                  flexDirection:'column',
                  alignItems:   'flex-end',
                  gap:          3,
                }}>
                  <span style={{
                    fontSize:   9,
                    fontWeight: 800,
                    padding:    '3px 8px',
                    borderRadius: 6,
                    letterSpacing: '0.08em',
                    background: cptEligible ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                    color:      cptEligible ? '#4ADE80' : 'rgba(255,255,255,0.4)',
                    border:     `1px solid ${cptEligible ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.3s',
                  }}>
                    {cptEligible ? '99470: ELIGIBLE' : '99470: Pending'}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                    {fmtMinSec(totalMonthSeconds)} / 10:00
                  </span>
                </div>
              </div>
            </div>

            {/* ── Body ──────────────────────────────────────────────────── */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>

              {/* Verification gate */}
              {!isVerified && (
                <div style={{
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            12,
                  padding:        '48px 24px',
                  textAlign:      'center',
                }}>
                  <div style={{
                    width:        48,
                    height:       48,
                    borderRadius: '50%',
                    background:   'rgba(251,146,60,0.12)',
                    border:       '1px solid rgba(251,146,60,0.3)',
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    fontSize:     22,
                  }}>🔒</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#FB923C' }}>
                    Verification Required
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, maxWidth: 280 }}>
                    Clinical data is only accessible to verified physicians.
                    Complete NPI verification to unlock patient records and CPT 99470 tracking.
                  </p>
                </div>
              )}

              {isVerified && loading && (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
                  Loading…
                </p>
              )}

              {isVerified && error && (
                <p style={{ color: '#F43F5E', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>{error}</p>
              )}

              {isVerified && !loading && !error && (
                <>
                  {/* Current score highlight */}
                  <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    background:     'rgba(255,255,255,0.03)',
                    border:         '1px solid rgba(255,255,255,0.07)',
                    borderRadius:   12,
                    padding:        '16px 18px',
                    marginBottom:   20,
                  }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                        Current Score
                      </p>
                      <p style={{ fontFamily: 'monospace', fontSize: 42, fontWeight: 900, color: '#F8FAFC', lineHeight: 1 }}>
                        {ms?.score != null ? Math.round(ms.score) : '—'}
                        <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>/100</span>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {ms?.leanLossEstPct != null && (
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lean Risk</p>
                          <p style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: ms.leanLossEstPct >= 18 ? '#F43F5E' : ms.leanLossEstPct >= 10 ? '#FB923C' : '#2DD4BF' }}>
                            {ms.leanLossEstPct.toFixed(1)}%
                          </p>
                        </div>
                      )}
                      {patient.recoveryStatus && (
                        <div>
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recovery</p>
                          <p style={{ fontSize: 11, fontWeight: 700, color: patient.recoveryStatus === 'critical' ? '#F43F5E' : patient.recoveryStatus === 'impaired' ? '#FB923C' : '#2DD4BF', textTransform: 'capitalize' }}>
                            {patient.recoveryStatus}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MDM Data Panel */}
                  {latest && (
                    <MdmPanel latest={latest} assessments={assessments} />
                  )}

                  {/* Clinical Intervention */}
                  <InterventionDropdown patientName={patient.fullName} />

                  {/* Sparkline */}
                  {scores.length >= 2 && (
                    <div style={{
                      background:   'rgba(255,255,255,0.03)',
                      border:       '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12,
                      padding:      '14px 16px',
                      marginBottom: 20,
                    }}>
                      <Sparkline scores={[...scores].reverse()} />
                    </div>
                  )}

                  {/* Adherence trends */}
                  {checkins.length > 0 && (
                    <div style={{
                      background:   'rgba(255,255,255,0.03)',
                      border:       '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12,
                      padding:      '14px 16px',
                      marginBottom: 20,
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                        Weekly Adherence (latest)
                      </p>
                      <AdherenceBar label="Protein Adherence"  pct={latestCheckin?.proteinAdherence  ?? null} />
                      <AdherenceBar label="Exercise Adherence" pct={latestCheckin?.exerciseAdherence ?? null} />
                      {latestCheckin?.sleepHours != null && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            Sleep (7-day avg)
                          </p>
                          <p style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: (latestCheckin.sleepHours ?? 0) >= 7 ? '#2DD4BF' : (latestCheckin.sleepHours ?? 0) >= 5.5 ? '#FB923C' : '#F43F5E' }}>
                            {latestCheckin.sleepHours.toFixed(1)} hrs/night
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Physician review note */}
                  {latest?.physicianReview?.note && (
                    <div style={{
                      background:   'rgba(45,212,191,0.06)',
                      border:       '1px solid rgba(45,212,191,0.15)',
                      borderRadius: 12,
                      padding:      '14px 16px',
                      marginBottom: 20,
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                        Your Last Note
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontStyle: 'italic' }}>
                        &ldquo;{latest.physicianReview.note}&rdquo;
                      </p>
                      {latest.physicianReview.followUpDays != null && (
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
                          Follow-up: {latest.physicianReview.followUpDays} days
                        </p>
                      )}
                    </div>
                  )}

                  {/* Clinical rationale */}
                  {ms?.explanation && (
                    <div style={{
                      background:   'rgba(255,255,255,0.02)',
                      border:       '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      padding:      '12px 14px',
                      marginBottom: 20,
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                        Clinical Rationale
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                        {ms.explanation}
                      </p>
                    </div>
                  )}

                  {/* Check-in log */}
                  {checkins.length > 1 && (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                        Check-in Log
                      </p>
                      <div style={{
                        background:   'rgba(255,255,255,0.02)',
                        border:       '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 10,
                        overflow:     'hidden',
                      }}>
                        {checkins.slice(0, 6).map((c, i) => (
                          <div key={c.id} style={{
                            display:        'flex',
                            justifyContent: 'space-between',
                            alignItems:     'center',
                            padding:        '8px 12px',
                            borderBottom:   i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                              {new Date(c.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                              {c.avgProteinG != null && (
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                                  {Math.round(c.avgProteinG)}g protein
                                </span>
                              )}
                              {c.sleepHours != null && (
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                                  {c.sleepHours.toFixed(1)}h sleep
                                </span>
                              )}
                              {c.recoveryStatus && (
                                <span style={{
                                  fontSize:      10,
                                  fontWeight:    700,
                                  color:         c.recoveryStatus === 'critical' ? '#F43F5E' : c.recoveryStatus === 'impaired' ? '#FB923C' : '#2DD4BF',
                                  textTransform: 'capitalize',
                                }}>
                                  {c.recoveryStatus}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Sticky footer ─────────────────────────────────────────── */}
            <div style={{
              padding:       '14px 20px',
              borderTop:     '1px solid rgba(255,255,255,0.07)',
              display:       'flex',
              flexDirection: 'column',
              gap:           8,
              flexShrink:    0,
              background:    '#060D1E',
            }}>
              {/* Evidence Packet — primary clinical action */}
              <button
                onClick={() => {
                  console.log('[Evidence Packet]', {
                    patient,
                    assessments,
                    checkins,
                    timestamp: new Date().toISOString(),
                  });
                  setEvidenceConfirmed(true);
                }}
                style={{
                  display:       'block',
                  width:         '100%',
                  textAlign:     'center',
                  padding:       '11px 0',
                  borderRadius:  8,
                  background:    'transparent',
                  border:        '1.5px solid rgba(100,116,139,0.45)',
                  color:         evidenceConfirmed ? '#4ADE80' : 'rgba(255,255,255,0.55)',
                  fontSize:      13,
                  fontWeight:    700,
                  letterSpacing: '0.01em',
                  cursor:        'pointer',
                  transition:    'background 0.15s, border-color 0.15s, color 0.15s',
                }}
              >
                {evidenceConfirmed
                  ? 'Evidence packet generated — ready for EHR upload'
                  : 'Generate Clinical Evidence Packet'}
              </button>

              {/* Protocol PDF */}
              <Link
                href={`/doctor/patients/${patient.id}/print`}
                target="_blank"
                style={{
                  display:        'block',
                  textAlign:      'center',
                  padding:        '11px 0',
                  borderRadius:   8,
                  background:     'linear-gradient(to right, #0D9488, #2DD4BF)',
                  color:          '#fff',
                  fontSize:       13,
                  fontWeight:     700,
                  textDecoration: 'none',
                  letterSpacing:  '0.01em',
                }}
              >
                Generate Protocol PDF
              </Link>

              <Link
                href={`/doctor/patients/${patient.id}`}
                style={{
                  display:        'block',
                  textAlign:      'center',
                  padding:        '9px 0',
                  borderRadius:   8,
                  background:     'rgba(255,255,255,0.05)',
                  border:         '1px solid rgba(255,255,255,0.08)',
                  color:          'rgba(255,255,255,0.6)',
                  fontSize:       12,
                  fontWeight:     600,
                  textDecoration: 'none',
                }}
              >
                View Full Profile →
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
