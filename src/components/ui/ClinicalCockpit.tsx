/**
 * ClinicalCockpit — Physician Command Center
 *
 * Renders SRI Engine v2 outputs for the patient detail view.
 * Answers three clinical questions:
 *   1. Is SRI improving or worsening?
 *   2. Is the intervention working?
 *   3. Is GI intolerance blocking success?
 *
 * TOP LAYER    — SRI Trajectory, Lean Mass Velocity, GI Constraint, Protein Target
 * SECONDARY    — Recovery/Sleep, Grip Strength, GLP-1 Stage, Alerts Panel
 *
 * Server component — no 'use client'.
 */

import type { CSSProperties } from 'react';

// ── Prop types ────────────────────────────────────────────────────────────────

export type CockpitAssmt = {
  assessmentDate:  Date;
  sleepHours:      number | null;
  sleepQuality:    number | null;
  glp1Stage:       string | null;
  gripStrengthKg:  number | null;
  muscleScore: {
    score:                  number;
    riskBand:               string;
    leanLossEstPct:         number;
    proteinTargetG:         number;
    proteinStandardG:       number | null;
    proteinStepTargetG:     number | null;
    giSeverity:             string | null;
    leanVelocityFlag:       string | null;
    leanVelocityPct:        number | null;
    stageMultiplierApplied: number | null;
  } | null;
};

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  rose:        '#FB7185',
  roseBg:      'rgba(251,113,133,0.10)',
  roseBorder:  'rgba(251,113,133,0.22)',
  teal:        '#2DD4BF',
  tealBg:      'rgba(45,212,191,0.10)',
  tealBorder:  'rgba(45,212,191,0.22)',
  amber:       '#F59E0B',
  amberBg:     'rgba(245,158,11,0.10)',
  orange:      '#FB923C',
  orangeBg:    'rgba(251,146,60,0.10)',
  slate:       '#94A3B8',
  slateBg:     'rgba(148,163,184,0.07)',
  slateBorder: 'rgba(148,163,184,0.15)',
  card:        '#0D1421',
  border:      '#1A2744',
  text:        '#F1F5F9',
  muted:       '#64748B',
  mono:        "'ui-monospace', 'SFMono-Regular', 'Menlo', monospace",
};

// ── Style helpers ─────────────────────────────────────────────────────────────

const card: CSSProperties = {
  background:   C.card,
  border:       `1px solid ${C.border}`,
  borderRadius: '14px',
  padding:      '20px',
};

const eyebrow: CSSProperties = {
  fontSize:       '10px',
  fontWeight:     700,
  color:          C.muted,
  textTransform:  'uppercase',
  letterSpacing:  '0.10em',
  marginBottom:   '14px',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function bandLineColor(band: string): string {
  return band === 'LOW'      ? C.teal
       : band === 'MODERATE' ? C.amber
       : band === 'HIGH'     ? C.orange
       : C.rose;
}

// ── 1. SRI Trajectory SVG chart ───────────────────────────────────────────────

function SriTrajectoryChart({
  points,
}: {
  points: { score: number; date: Date; band: string }[];
}) {
  if (points.length < 2) {
    return (
      <div style={{ padding: '18px 0', textAlign: 'center', color: C.muted }}>
        <p style={{ fontSize: '13px' }}>2+ assessments required for trajectory</p>
      </div>
    );
  }

  const W = 400, H = 90;
  const px = 6, ptop = 12, pbot = 8;
  const cw = W - px * 2;
  const ch = H - ptop - pbot;
  const xs = cw / (points.length - 1);

  const pts = points.map((p, i) => ({
    x:     px + i * xs,
    y:     ptop + ch * (1 - Math.min(100, Math.max(0, p.score)) / 100),
    score: p.score,
    date:  p.date,
    band:  p.band,
  }));

  const lineColor   = bandLineColor(points[points.length - 1].band);
  const polylineStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const chartBot    = H - pbot;
  const areaStr     = `${pts[0].x.toFixed(1)},${chartBot} ${polylineStr} ${pts[pts.length - 1].x.toFixed(1)},${chartBot}`;

  const last  = pts[pts.length - 1];
  const prev  = pts[pts.length - 2];
  const delta = Math.round(last.score - prev.score);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Subtle reference lines at 25 / 50 / 75 */}
        {[25, 50, 75].map(v => (
          <line
            key={v}
            x1={px}     y1={ptop + ch * (1 - v / 100)}
            x2={W - px} y2={ptop + ch * (1 - v / 100)}
            stroke="rgba(148,163,184,0.08)" strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <polygon points={areaStr} fill={`${lineColor}12`} />

        {/* Trend line */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data point dots */}
        {pts.map((p, i) => {
          const isLast = i === pts.length - 1;
          return (
            <circle
              key={i}
              cx={p.x} cy={p.y}
              r={isLast ? 5 : 3}
              fill={isLast ? lineColor : `${lineColor}60`}
            />
          );
        })}
      </svg>

      {/* Date range + delta badge */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginTop:      '10px',
      }}>
        <span style={{ fontSize: '11px', color: C.muted }}>
          {shortDate(points[0].date)} → {shortDate(points[points.length - 1].date)}
        </span>
        <span style={{
          fontSize:   '12px',
          fontWeight: 700,
          padding:    '3px 10px',
          borderRadius: '99px',
          color:       delta > 0 ? C.teal  : delta < 0 ? C.rose  : C.slate,
          background:  delta > 0 ? C.tealBg : delta < 0 ? C.roseBg : C.slateBg,
        }}>
          {delta > 0
            ? `+${delta} → Improving`
            : delta < 0
            ? `${delta} → Declining`
            : '→ Stable'}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClinicalCockpit({ assessments }: { assessments: CockpitAssmt[] }) {
  const latest = assessments[0];
  const ms     = latest?.muscleScore ?? null;

  if (!latest || !ms) return null;

  // Chronological (oldest first) for the trajectory chart
  const chrono = [...assessments].reverse();

  // ── 1. SRI Trajectory points
  const trajectoryPts = chrono
    .filter(a => a.muscleScore?.score != null)
    .map(a => ({
      score: a.muscleScore!.score,
      date:  a.assessmentDate,
      band:  a.muscleScore!.riskBand,
    }));

  // ── 2. Lean velocity
  const velFlag = ms.leanVelocityFlag ?? 'insufficient_data';
  const velPct  = ms.leanVelocityPct;

  let daysBetween: number | null = null;
  if (assessments.length >= 2) {
    daysBetween = Math.round(
      (assessments[0].assessmentDate.getTime() - assessments[1].assessmentDate.getTime())
      / (1000 * 60 * 60 * 24),
    );
  }

  const VEL_LABEL: Record<string, string> = {
    insufficient_data: 'Insufficient data',
    stable:            'Stable',
    concerning:        'Concerning',
    critical_review:   'Critical Review',
  };

  const velColor = (velFlag === 'concerning' || velFlag === 'critical_review')
    ? C.rose
    : velFlag === 'stable'
    ? C.teal
    : C.slate;

  const velBg = (velFlag === 'concerning' || velFlag === 'critical_review')
    ? C.roseBg
    : velFlag === 'stable'
    ? C.tealBg
    : C.slateBg;

  // ── 3. GI constraint
  const giSev = ms.giSeverity ?? 'none';
  const GI_LABEL: Record<string, string> = {
    none:     'Intact',
    mild:     'Mild impact',
    moderate: 'Impaired',
    severe:   'Limited',
  };

  const giLabelColor =
    giSev === 'none'     ? C.teal
    : giSev === 'mild'   ? C.amber
    : giSev === 'moderate' ? C.orange
    : C.rose;

  const giBg =
    giSev === 'none'     ? C.tealBg
    : giSev === 'mild'   ? C.amberBg
    : giSev === 'moderate' ? C.orangeBg
    : C.roseBg;

  // ── 6. Grip strength — last 3 readings (assessments are desc order)
  const gripReadings = assessments
    .filter(a => a.gripStrengthKg != null)
    .slice(0, 3)
    .map(a => ({ kg: a.gripStrengthKg!, date: a.assessmentDate }));

  // assessments[0] = newest. diff > 0 means newest > oldest → improving
  let gripDir: 'improving' | 'declining' | 'stable' | null = null;
  if (gripReadings.length >= 2) {
    const diff = gripReadings[0].kg - gripReadings[gripReadings.length - 1].kg;
    gripDir = diff > 0.5 ? 'improving' : diff < -0.5 ? 'declining' : 'stable';
  }

  const gripColor =
    gripDir === 'improving' ? C.teal
    : gripDir === 'declining' ? C.rose
    : C.slate;

  const gripBg =
    gripDir === 'improving' ? C.tealBg
    : gripDir === 'declining' ? C.roseBg
    : C.slateBg;

  const gripBorder =
    gripDir === 'improving' ? C.tealBorder
    : gripDir === 'declining' ? C.roseBorder
    : C.slateBorder;

  const gripArrow =
    gripDir === 'improving' ? '↑'
    : gripDir === 'declining' ? '↓'
    : '→';

  // ── 7. GLP-1 stage
  const glp1Stage = latest.glp1Stage;
  const STAGE_NOTE: Record<string, string> = {
    INITIATION:      'High sensitivity mode active',
    DOSE_ESCALATION: 'Peak risk window',
    MAINTENANCE:     'Stabilized phase',
    DISCONTINUATION: 'Rebound risk monitoring',
  };

  // ── 8. Alerts
  const alerts: string[] = [];
  if (velFlag === 'concerning')      alerts.push('Lean mass velocity: concerning rate of change');
  if (velFlag === 'critical_review') alerts.push('Lean mass velocity: critical review required');
  if (giSev === 'severe')            alerts.push('Severe GI intolerance — protocol absorption limited');
  if (ms.proteinStepTargetG != null) alerts.push('Step protein target active — GI-driven accommodation');
  if (latest.sleepHours != null && latest.sleepHours < 6)
                                     alerts.push('Sleep below 6 hours — anabolic recovery impaired');

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
        <p style={{
          fontSize:      '10px',
          fontWeight:    700,
          color:         '#334155',
          textTransform: 'uppercase',
          letterSpacing: '0.13em',
          flexShrink:    0,
        }}>
          Clinical Command Center
        </p>
        <div style={{ flex: 1, height: '1px', background: C.border }} />
      </div>

      {/* ════ TOP LAYER ═══════════════════════════════════════════════════════ */}

      {/* 1. SRI Trajectory — full width */}
      <div style={card}>
        <p style={eyebrow}>SRI Trajectory — The Trend</p>
        <SriTrajectoryChart points={trajectoryPts} />
      </div>

      {/* 2 + 4. Lean Mass Velocity | Protein Target */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        {/* 2. Lean Mass Velocity */}
        <div style={card}>
          <p style={eyebrow}>Lean Mass Velocity</p>

          <div style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '6px',
            background:   velBg,
            border:       `1px solid ${velColor}30`,
            borderRadius: '8px',
            padding:      '7px 12px',
            marginBottom: '12px',
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: velColor, flexShrink: 0,
            }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: velColor }}>
              {VEL_LABEL[velFlag] ?? velFlag}
            </span>
          </div>

          {velPct != null && (
            <p style={{
              fontSize:    '24px',
              fontWeight:  900,
              color:       C.rose,
              fontFamily:  'Georgia, serif',
              marginBottom:'3px',
            }}>
              +{velPct.toFixed(1)}%
            </p>
          )}

          <p style={{ fontSize: '11px', color: C.muted, lineHeight: 1.5 }}>
            {velPct != null ? 'Δ lean loss estimate vs. prior' : 'No delta available'}
          </p>

          {daysBetween != null && (
            <p style={{ fontSize: '11px', color: C.muted, marginTop: '5px' }}>
              {daysBetween} day{daysBetween !== 1 ? 's' : ''} between assessments
            </p>
          )}
        </div>

        {/* 4. Protein Target */}
        <div style={card}>
          <p style={eyebrow}>Protein Target</p>

          {ms.proteinStandardG != null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '10px', color: C.muted, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Clinical Protein Floor
                </p>
                <p style={{ fontSize: '24px', fontWeight: 900, color: C.text, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
                  {Math.round(ms.proteinStandardG)}g
                  <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'system-ui', fontWeight: 400 }}> /day</span>
                </p>
              </div>

              {Math.round(ms.proteinTargetG) !== Math.round(ms.proteinStandardG) && (
                <div style={{ paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: '10px', color: C.muted, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Aggressive Target
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: C.teal, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
                    {Math.round(ms.proteinTargetG)}g
                    <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'system-ui', fontWeight: 400 }}> /day</span>
                  </p>
                </div>
              )}

              {ms.proteinStepTargetG != null && (
                <div style={{
                  padding:      '8px 10px',
                  background:   C.roseBg,
                  border:       `1px solid ${C.roseBorder}`,
                  borderRadius: '8px',
                }}>
                  <p style={{
                    fontSize:      '9px',
                    fontWeight:    700,
                    color:         C.rose,
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    marginBottom:  '3px',
                  }}>
                    Step Target Active
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: C.rose, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
                    {ms.proteinStepTargetG}g
                    <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'system-ui', fontWeight: 400 }}> this week</span>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '20px', fontWeight: 700, color: C.text, fontFamily: 'Georgia, serif' }}>
              {Math.round(ms.proteinTargetG)}g
              <span style={{ fontSize: '12px', color: C.muted, fontFamily: 'system-ui', fontWeight: 400 }}>/day</span>
            </p>
          )}
        </div>
      </div>

      {/* 3. GI Constraint — full width */}
      <div style={card}>
        <p style={eyebrow}>Nutrient Absorption & GI Constraint</p>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          {/* Status badge */}
          <div>
            <p style={{ fontSize: '10px', color: C.muted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Absorption Status
            </p>
            <span style={{
              display:      'inline-block',
              fontSize:     '14px',
              fontWeight:   700,
              color:        giLabelColor,
              background:   giBg,
              border:       `1px solid ${giLabelColor}30`,
              padding:      '6px 16px',
              borderRadius: '8px',
            }}>
              {GI_LABEL[giSev] ?? giSev}
            </span>
          </div>

          {/* Interpretation */}
          <div style={{ flex: 1, minWidth: '160px', paddingTop: '2px' }}>
            {(giSev === 'moderate' || giSev === 'severe') && (
              <p style={{ fontSize: '12px', color: giSev === 'severe' ? C.rose : C.orange, lineHeight: 1.6, marginBottom: ms.proteinStepTargetG != null ? '6px' : 0 }}>
                GI intolerance impacting protocol efficiency
              </p>
            )}
            {ms.proteinStepTargetG != null && (
              <p style={{ fontSize: '12px', color: C.orange, lineHeight: 1.6 }}>
                Step target active — temporary protein accommodation in effect
              </p>
            )}
            {giSev === 'none' && (
              <p style={{ fontSize: '12px', color: C.muted }}>No GI constraint on protein absorption</p>
            )}
            {giSev === 'mild' && ms.proteinStepTargetG == null && (
              <p style={{ fontSize: '12px', color: C.muted }}>Mild GI impact — monitor dietary compliance</p>
            )}
          </div>
        </div>
      </div>

      {/* ════ SECONDARY LAYER ════════════════════════════════════════════════ */}

      {/* 5 + 7. Recovery/Sleep | GLP-1 Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        {/* 5. Recovery / Sleep */}
        <div style={card}>
          <p style={eyebrow}>Recovery & Sleep</p>

          {latest.sleepHours != null ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                <p style={{
                  fontSize:   '26px',
                  fontWeight: 900,
                  fontFamily: 'Georgia, serif',
                  lineHeight: 1,
                  color:      latest.sleepHours < 6 ? C.rose
                            : latest.sleepHours >= 7 ? C.teal
                            : C.slate,
                }}>
                  {latest.sleepHours.toFixed(1)}
                </p>
                <p style={{ fontSize: '12px', color: C.muted }}>hrs/night</p>
              </div>

              {latest.sleepHours < 6 && (
                <p style={{ fontSize: '11px', color: C.rose, marginBottom: '8px', lineHeight: 1.5 }}>
                  Below 6h — anabolic recovery impaired
                </p>
              )}

              {latest.sleepQuality != null && (
                <div>
                  <p style={{ fontSize: '10px', color: C.muted, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Quality
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map(i => {
                      const filled = i <= (latest.sleepQuality ?? 0);
                      const segColor = filled
                        ? (latest.sleepQuality! >= 4 ? C.teal
                         : latest.sleepQuality! >= 3 ? C.amber
                         : C.rose)
                        : C.slateBg;
                      return (
                        <div key={i} style={{
                          width: '22px', height: '5px',
                          borderRadius: '3px',
                          background: segColor,
                        }} />
                      );
                    })}
                    <span style={{ fontSize: '11px', color: C.muted, marginLeft: '5px' }}>
                      {latest.sleepQuality}/5
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: C.muted }}>Data pending</p>
          )}
        </div>

        {/* 7. GLP-1 Stage */}
        <div style={card}>
          <p style={eyebrow}>GLP-1 Stage Context</p>

          {glp1Stage ? (
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>
                {glp1Stage.replace(/_/g, ' ')}
              </p>
              {STAGE_NOTE[glp1Stage] && (
                <div style={{
                  fontSize:     '12px',
                  color:        C.muted,
                  background:   C.slateBg,
                  border:       `1px solid ${C.slateBorder}`,
                  borderRadius: '8px',
                  padding:      '8px 10px',
                  lineHeight:   1.55,
                  marginBottom: ms.stageMultiplierApplied != null && ms.stageMultiplierApplied > 1.0 ? '8px' : 0,
                }}>
                  {STAGE_NOTE[glp1Stage]}
                </div>
              )}
              {ms.stageMultiplierApplied != null && ms.stageMultiplierApplied > 1.0 && (
                <p style={{ fontSize: '11px', color: C.rose, lineHeight: 1.5 }}>
                  {ms.stageMultiplierApplied.toFixed(2)}× risk multiplier applied to SRI
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: C.muted }}>No stage data recorded</p>
          )}
        </div>
      </div>

      {/* 6. Grip Strength — full width */}
      <div style={card}>
        <p style={eyebrow}>Functional Marker — Grip Strength</p>

        {gripReadings.length === 0 ? (
          <p style={{ fontSize: '13px', color: C.muted }}>No grip strength data recorded</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Direction badge */}
            {gripDir && (
              <div style={{ marginBottom: '14px' }}>
                <span style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  gap:          '6px',
                  background:   gripBg,
                  border:       `1px solid ${gripBorder}`,
                  borderRadius: '8px',
                  padding:      '6px 14px',
                }}>
                  <span style={{ fontSize: '18px', color: gripColor, lineHeight: 1 }}>
                    {gripArrow}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: gripColor }}>
                    {gripDir === 'improving' ? 'Improving'
                     : gripDir === 'declining' ? 'Declining'
                     : 'Stable'}
                  </span>
                </span>
              </div>
            )}

            {/* Last 3 readings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {gripReadings.map((g, i) => (
                <div key={i} style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  padding:        '8px 12px',
                  borderRadius:   '8px',
                  background:     i === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border:         `1px solid ${i === 0 ? C.border : 'transparent'}`,
                }}>
                  <span style={{ fontSize: '12px', color: C.muted }}>
                    {shortDate(g.date)}
                    {i === 0 && (
                      <span style={{
                        fontSize: '9px', fontWeight: 600, color: C.teal,
                        marginLeft: '7px', textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        Latest
                      </span>
                    )}
                  </span>
                  <span style={{
                    fontSize:   '15px',
                    fontWeight: 700,
                    fontFamily: 'Georgia, serif',
                    color:      i === 0 ? gripColor : C.muted,
                  }}>
                    {g.kg.toFixed(1)} kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 8. Alerts Panel — full width */}
      <div style={card}>
        <p style={eyebrow}>Clinical Observations</p>

        {alerts.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: C.teal, fontSize: '15px' }}>✓</span>
            <p style={{ fontSize: '13px', color: C.muted }}>No immediate alerts</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.map((alert, i) => (
              <div key={i} style={{
                display:     'flex',
                alignItems:  'flex-start',
                gap:         '10px',
                padding:     '10px 12px',
                background:  C.roseBg,
                border:      `1px solid ${C.roseBorder}`,
                borderLeft:  `3px solid ${C.rose}`,
                borderRadius:'8px',
              }}>
                <span style={{ color: C.rose, fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>
                  ⚠
                </span>
                <p style={{ fontSize: '12px', color: '#FDA4AF', lineHeight: 1.55 }}>
                  {alert}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
