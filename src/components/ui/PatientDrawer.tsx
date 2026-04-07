'use client';

import { useEffect, useState } from 'react';
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

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;

  const W = 320, H = 80, PAD = 8;
  const min  = Math.min(...scores) - 5;
  const max  = Math.max(...scores) + 5;
  const range = max - min || 1;

  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((s - min) / range) * (H - PAD * 2);
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area     = `M${pts[0][0]},${H} ` + pts.map(([x, y]) => `L${x},${y}`).join(' ') + ` L${pts[pts.length - 1][0]},${H} Z`;
  const latest   = pts[pts.length - 1];
  const first    = scores[0];
  const last     = scores[scores.length - 1];
  const delta    = last - first;
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
        {/* Glow dot on latest point */}
        <circle cx={latest[0]} cy={latest[1]} r="5" fill={trendCol} opacity="0.3" />
        <circle cx={latest[0]} cy={latest[1]} r="3" fill={trendCol} />
        <text x={latest[0] - 2} y={latest[1] - 9} fill={trendCol} fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="middle">
          {Math.round(last)}
        </text>
      </svg>
    </div>
  );
}

// ─── Adherence bar ────────────────────────────────────────────────────────────

function AdherenceBar({ label, pct }: { label: string; pct: number | null }) {
  if (pct == null) return null;
  const capped  = Math.min(pct, 100);
  const color   = capped >= 100 ? '#2DD4BF' : capped >= 75 ? '#FCD34D' : '#F43F5E';
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

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function PatientDrawer({
  patient,
  onClose,
}: {
  patient: PatientRow | null;
  onClose: () => void;
}) {
  const [assessments, setAssessments] = useState<DrawerAssessment[]>([]);
  const [checkins,    setCheckins]    = useState<DrawerCheckin[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!patient) return;
    let active = true;
    setLoading(true);
    setError(null);
    setAssessments([]);
    setCheckins([]);

    fetch(`/api/physician/patients/${patient.id}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setAssessments(data.assessments ?? []);
        setCheckins(data.checkins ?? []);
      })
      .catch(() => {
        if (active) setError('Failed to load patient data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [patient?.id]);

  const open    = patient !== null;
  const latest  = assessments[0] ?? null;
  const ms      = latest?.muscleScore ?? null;
  const scores  = assessments.map(a => a.muscleScore?.score ?? a.muscleScore?.score).filter((s): s is number => s != null);
  const latestCheckin = checkins[0] ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.55)',
          zIndex:     40,
          opacity:    open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          bottom:     0,
          width:      '100%',
          maxWidth:   460,
          background: '#060D1E',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          zIndex:     50,
          display:    'flex',
          flexDirection: 'column',
          transform:  open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflowY:  'auto',
        }}
      >
        {patient && (
          <>
            {/* ── Header ────────────────────────────────────────────────── */}
            <div style={{
              padding:      '18px 20px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display:      'flex',
              alignItems:   'flex-start',
              justifyContent: 'space-between',
              flexShrink:   0,
            }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                  Deep Dive
                </p>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                  {patient.fullName}
                </h2>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{patient.email}</p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border:     '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 8,
                  color:      'rgba(255,255,255,0.6)',
                  cursor:     'pointer',
                  fontSize:   18,
                  width:      32,
                  height:     32,
                  display:    'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-label="Close drawer"
              >
                ×
              </button>
            </div>

            {/* ── Body ──────────────────────────────────────────────────── */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>

              {loading && (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
                  Loading…
                </p>
              )}

              {error && (
                <p style={{ color: '#F43F5E', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>{error}</p>
              )}

              {!loading && !error && (
                <>
                  {/* Current score highlight */}
                  <div style={{
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'space-between',
                    background:   'rgba(255,255,255,0.03)',
                    border:       '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    padding:      '16px 18px',
                    marginBottom: 20,
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

                  {/* Adherence trends from check-ins */}
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

                  {/* Clinical note — score explanation */}
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

                  {/* Recent check-in summary table */}
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
                            display:      'flex',
                            justifyContent: 'space-between',
                            alignItems:   'center',
                            padding:      '8px 12px',
                            borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none',
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
                                  fontSize:   10,
                                  fontWeight: 700,
                                  color:      c.recoveryStatus === 'critical' ? '#F43F5E' : c.recoveryStatus === 'impaired' ? '#FB923C' : '#2DD4BF',
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
              padding:      '14px 20px',
              borderTop:    '1px solid rgba(255,255,255,0.07)',
              display:      'flex',
              flexDirection: 'column',
              gap:          8,
              flexShrink:   0,
              background:   '#060D1E',
            }}>
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
