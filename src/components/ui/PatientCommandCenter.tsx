'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import PatientDrawer from './PatientDrawer';

// ─── CPT helpers ─────────────────────────────────────────────────────────────

function billingMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function cptKey(patientId: string): string {
  return `myo_cpt_${patientId}_${billingMonth()}`;
}

function loadCptSeconds(patientId: string): number {
  try {
    return parseInt(localStorage.getItem(cptKey(patientId)) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveCptSeconds(patientId: string, seconds: number) {
  try { localStorage.setItem(cptKey(patientId), String(seconds)); } catch { /* noop */ }
}

function fmtMinSec(totalSeconds: number): string {
  const m   = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PatientRow = {
  id:                 string;
  fullName:           string;
  email:              string;
  score:              number | null;
  prevScore:          number | null;
  band:               string;
  flags:              string[];
  leanLossPct:        number | null;
  lastAssessmentDate: string;
  recoveryStatus:     string | null;
  latestAssessmentId: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BAND_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH:     1,
  MODERATE: 2,
  LOW:      3,
};

const BAND_META: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  CRITICAL: { label: 'Critical', color: '#F43F5E', bg: 'rgba(244,63,94,0.12)',  glow: 'rgba(244,63,94,0.35)' },
  HIGH:     { label: 'High',     color: '#FB923C', bg: 'rgba(251,146,60,0.12)', glow: 'rgba(251,146,60,0.35)' },
  MODERATE: { label: 'Moderate', color: '#FCD34D', bg: 'rgba(252,211,77,0.10)', glow: 'rgba(252,211,77,0.3)'  },
  LOW:      { label: 'Low',      color: '#2DD4BF', bg: 'rgba(45,212,191,0.10)', glow: 'rgba(45,212,191,0.3)' },
};

const FLAG_COLOUR: Record<string, string> = {
  'Sleep Critical':  '#F43F5E',
  'Sleep Deficit':   '#FB923C',
  'Protein Deficit': '#F43F5E',
  'Protein Gap':     '#FB923C',
  'Urgent GI Alert': '#FB923C',
  'Grip Decline':    '#F43F5E',
  'Sedentary':       '#FCD34D',
  'Muscle Weakness': '#A78BFA',
  'Fatigue':         '#A78BFA',
  'High Lean Risk':  '#F43F5E',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrendBadge({ score, prev }: { score: number | null; prev: number | null }) {
  if (score == null || prev == null) return <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>—</span>;
  const delta = score - prev;
  const up    = delta > 0;
  const same  = Math.abs(delta) < 0.5;
  if (same) return <span style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', fontSize: 11 }}>→ 0.0</span>;
  return (
    <span style={{ color: up ? '#2DD4BF' : '#F43F5E', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

function BandBadge({ band }: { band: string }) {
  const m = BAND_META[band] ?? BAND_META.LOW;
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      padding:      '2px 9px',
      borderRadius: 99,
      fontSize:     11,
      fontWeight:   700,
      background:   m.bg,
      color:        m.color,
      border:       `1px solid ${m.color}40`,
    }}>
      {m.label}
    </span>
  );
}

function FlagChip({ flag }: { flag: string }) {
  const color = FLAG_COLOUR[flag] ?? 'rgba(255,255,255,0.4)';
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      padding:      '1px 7px',
      borderRadius: 99,
      fontSize:     10,
      fontWeight:   600,
      background:   `${color}18`,
      color:        color,
      border:       `1px solid ${color}40`,
      marginRight:  3,
    }}>
      {flag}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PatientCommandCenter({
  patients,
  isVerified,
}: {
  patients:   PatientRow[];
  isVerified: boolean;
}) {
  const [search,        setSearch]        = useState('');
  const [bandFilter,    setBandFilter]    = useState<string | null>(null);
  const [activePatient, setActivePatient] = useState<PatientRow | null>(null);

  // ── CPT 99470 session timer ─────────────────────────────────────────────────
  const [cptSeconds,    setCptSeconds]    = useState(0);
  const cptSecondsRef   = useRef(0); // stale-closure mirror
  const cptPatientRef   = useRef<string | null>(null);

  // Load accumulated seconds when drawer opens; persist every second
  useEffect(() => {
    if (!activePatient) {
      // Drawer closed — save whatever is in ref and reset display
      if (cptPatientRef.current) {
        saveCptSeconds(cptPatientRef.current, cptSecondsRef.current);
      }
      cptPatientRef.current  = null;
      cptSecondsRef.current  = 0;
      setCptSeconds(0);
      return;
    }

    // New patient opened — load prior accumulated seconds
    const prior = loadCptSeconds(activePatient.id);
    cptPatientRef.current  = activePatient.id;
    cptSecondsRef.current  = prior;
    setCptSeconds(prior);

    const tick = setInterval(() => {
      cptSecondsRef.current += 1;
      setCptSeconds(s => s + 1);
      if (cptPatientRef.current) {
        saveCptSeconds(cptPatientRef.current, cptSecondsRef.current);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [activePatient?.id]);

  const cptEligible = Math.floor(cptSeconds / 60) >= 10;
  // ───────────────────────────────────────────────────────────────────────────

  const searchRef                   = useRef<HTMLInputElement>(null);
  const rowRefs                     = useRef<(HTMLButtonElement | null)[]>([]);

  // Band counts
  const bandCounts = Object.fromEntries(
    ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map(b => [
      b,
      patients.filter(p => p.band === b).length,
    ])
  );

  const criticalPlusHigh = (bandCounts.CRITICAL ?? 0) + (bandCounts.HIGH ?? 0);

  // Filter
  const filtered = patients.filter(p => {
    const matchSearch = !search ||
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    const matchBand = !bandFilter || p.band === bandFilter;
    return matchSearch && matchBand;
  });

  // Keyboard navigation
  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number, patient: PatientRow) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        rowRefs.current[idx + 1]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx === 0) searchRef.current?.focus();
        else rowRefs.current[idx - 1]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActivePatient(patient);
      }
    },
    [],
  );

  // Close drawer on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePatient(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      <PatientDrawer
        patient={activePatient}
        isVerified={isVerified}
        onClose={() => setActivePatient(null)}
      />

      <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '28px 20px' }}>

        {/* ── Attention banner ─────────────────────────────────────────────── */}
        {criticalPlusHigh > 0 && (
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '10px 16px',
            borderRadius: 10,
            background:   'rgba(244,63,94,0.08)',
            border:       '1px solid rgba(244,63,94,0.25)',
            marginBottom: 20,
          }}>
            <span style={{
              width:        8,
              height:       8,
              borderRadius: '50%',
              background:   '#F43F5E',
              flexShrink:   0,
              animation:    'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 13, color: '#FDA4AF', fontWeight: 600 }}>
              {criticalPlusHigh} patient{criticalPlusHigh !== 1 ? 's' : ''} require{criticalPlusHigh === 1 ? 's' : ''} clinical attention
            </span>
          </div>
        )}

        {/* ── CPT 99470 timer banner (verified physicians only) ────────────── */}
        {activePatient && isVerified && (
          <div style={{
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            padding:      '8px 14px',
            borderRadius: 8,
            marginBottom: 12,
            background:   cptEligible ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
            border:       `1px solid ${cptEligible ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
            transition:   'all 0.3s',
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              Reviewing: <strong style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{activePatient.fullName}</strong>
            </span>
            <span style={{
              fontSize:      10,
              fontWeight:    800,
              padding:       '3px 10px',
              borderRadius:  6,
              letterSpacing: '0.07em',
              background:    cptEligible ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
              color:         cptEligible ? '#4ADE80' : 'rgba(255,255,255,0.4)',
              border:        `1px solid ${cptEligible ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}`,
              transition:    'all 0.3s',
            }}>
              {cptEligible
                ? '99470: ELIGIBLE ✓'
                : `99470: PENDING (${fmtMinSec(cptSeconds)} / 10:00)`}
            </span>
          </div>
        )}

        {/* ── Stat bar ─────────────────────────────────────────────────────── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap:                 10,
          marginBottom:        20,
        }}>
          {(['CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as const).map(band => {
            const m       = BAND_META[band];
            const count   = bandCounts[band] ?? 0;
            const isActive = bandFilter === band;
            return (
              <button
                key={band}
                onClick={() => setBandFilter(isActive ? null : band)}
                style={{
                  background:   isActive ? m.bg : 'rgba(255,255,255,0.03)',
                  border:       `1px solid ${isActive ? m.color + '60' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 10,
                  padding:      '12px 16px',
                  cursor:       'pointer',
                  textAlign:    'left',
                  boxShadow:    isActive ? `0 0 12px ${m.glow}` : 'none',
                  transition:   'all 0.15s',
                }}
              >
                <p style={{ fontSize: 10, fontWeight: 700, color: isActive ? m.color : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  {m.label}
                </p>
                <p style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 900, color: isActive ? m.color : 'rgba(255,255,255,0.8)', lineHeight: 1 }}>
                  {count}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <svg
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.35, pointerEvents: 'none' }}
            width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}
          >
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                rowRefs.current[0]?.focus();
              }
            }}
            placeholder="Search patients…"
            style={{
              width:        '100%',
              padding:      '10px 36px',
              background:   'rgba(255,255,255,0.04)',
              border:       '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8,
              color:        '#F8FAFC',
              fontSize:     13,
              outline:      'none',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position:   'absolute',
                right:      10,
                top:        '50%',
                transform:  'translateY(-50%)',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                color:      'rgba(255,255,255,0.4)',
                fontSize:   16,
                padding:    4,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div style={{
          background:   'rgba(255,255,255,0.03)',
          border:       '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          overflow:     'hidden',
        }}>

          {/* Column headers */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: '1fr 100px 80px 120px',
            padding:             '10px 16px',
            background:          'rgba(255,255,255,0.02)',
            borderBottom:        '1px solid rgba(255,255,255,0.06)',
          }}>
            {['Patient', 'Score', 'Trend', 'Status'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              No patients match your search.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((patient, idx) => (
                <button
                  key={patient.id}
                  ref={el => { rowRefs.current[idx] = el; }}
                  onClick={() => setActivePatient(patient)}
                  onKeyDown={e => handleRowKeyDown(e, idx, patient)}
                  aria-pressed={activePatient?.id === patient.id}
                  style={{
                    display:         'grid',
                    gridTemplateColumns: '1fr 100px 80px 120px',
                    alignItems:      'center',
                    width:           '100%',
                    padding:         '13px 16px',
                    background:      activePatient?.id === patient.id
                      ? 'rgba(45,212,191,0.06)'
                      : 'transparent',
                    border:          'none',
                    borderBottom:    '1px solid rgba(255,255,255,0.04)',
                    cursor:          'pointer',
                    textAlign:       'left',
                    transition:      'background 0.12s',
                  }}
                  onMouseEnter={e => {
                    if (activePatient?.id !== patient.id)
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={e => {
                    if (activePatient?.id !== patient.id)
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  {/* Name + flags */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', marginBottom: 3 }}>
                      {patient.fullName}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: patient.flags.length ? 5 : 0 }}>
                      {patient.email}
                    </p>
                    {patient.flags.length > 0 && (
                      <div>
                        {patient.flags.map(f => <FlagChip key={f} flag={f} />)}
                      </div>
                    )}
                  </div>

                  {/* Score */}
                  <div>
                    {patient.score != null ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: '#F8FAFC' }}>
                        {Math.round(patient.score)}
                        <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>/100</span>
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>—</span>
                    )}
                  </div>

                  {/* Trend */}
                  <div>
                    <TrendBadge score={patient.score} prev={patient.prevScore} />
                  </div>

                  {/* Band */}
                  <div>
                    <BandBadge band={patient.band} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer count ─────────────────────────────────────────────────── */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 12, textAlign: 'right' }}>
          {filtered.length} of {patients.length} patients
          {bandFilter ? ` · filtered by ${BAND_META[bandFilter]?.label}` : ''}
        </p>

        {/* Pulse keyframe */}
        <style>{`
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
          input::placeholder { color: rgba(255,255,255,0.25); }
          input:focus { border-color: rgba(45,212,191,0.4) !important; box-shadow: 0 0 0 3px rgba(45,212,191,0.08); }
        `}</style>
      </div>
    </>
  );
}
