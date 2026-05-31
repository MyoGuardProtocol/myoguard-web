// MyoGuard — Cohort Overview Card
//
// Displays signal distribution summary for the physician's patient cohort.
// All metrics are physician-scoped. No platform-wide aggregates.
//
// Used inside PatientCommandCenter ('use client'). No server APIs used here.
//
// Vocabulary governance: "observed", "recorded", "measured" only.
// Never predictive. "MyoGuard observes. MyoGuard does not predict."

import type { CSSProperties } from 'react';
import type { PhysicianScopedIntelligence } from '@/src/lib/insights/physician-scoped';

interface Props {
  data: PhysicianScopedIntelligence;
}

// ─── Design tokens (Midnight Silk) ────────────────────────────────────────────

const card: CSSProperties = {
  background:   '#0D1421',
  border:       '1px solid #1A2744',
  borderRadius: '14px',
  padding:      '20px',
  flex:         '1 1 0',
  minWidth:     0,
};

const eyebrow: CSSProperties = {
  fontSize:      '10px',
  fontWeight:    700,
  color:         '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  marginBottom:  '14px',
};

const sectionLabel: CSSProperties = {
  fontSize:      '10px',
  fontWeight:    600,
  color:         'rgba(148,163,184,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom:  '8px',
};

// ─── Sub-component ────────────────────────────────────────────────────────────

function DistRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: '7px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.7)' }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
        <div style={{
          height:     '3px',
          width:      `${pct}%`,
          background: color,
          borderRadius: '2px',
          transition: 'width 0.3s',
          minWidth:   value > 0 ? '2px' : '0',
        }} />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CohortOverviewCard({ data }: Props) {
  const total = data.totalPatients;

  if (total === 0) {
    return (
      <div style={card}>
        <p style={eyebrow}>Cohort Overview</p>
        <p style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic' }}>
          No patients enrolled. Cohort signals will appear once patients submit assessments.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <p style={eyebrow}>Cohort Overview</p>

      {/* Continuity distribution */}
      <p style={sectionLabel}>Continuity</p>
      <div style={{ marginBottom: '14px' }}>
        <DistRow label="Active"       value={data.patientsActive}             total={total} color="#2DD4BF" />
        <DistRow label="Concern"      value={data.patientsConcern}            total={total} color="#FCD34D" />
        <DistRow label="At Risk"      value={data.patientsRequiringAttention} total={total} color="#FB923C" />
        <DistRow label="Pending Data" value={data.patientsInsufficient}       total={total} color="#475569" />
      </div>

      {/* Trajectory distribution */}
      <p style={sectionLabel}>SRI Trajectory</p>
      <div>
        <DistRow label="Stable"    value={data.trajectoryDistribution.stable}          total={total} color="#2DD4BF" />
        <DistRow label="Positive"  value={data.trajectoryDistribution.positive_trend}  total={total} color="#34D399" />
        <DistRow label="Variable"  value={data.trajectoryDistribution.variable}        total={total} color="#FCD34D" />
        <DistRow label="Declining" value={data.trajectoryDistribution.declining_trend} total={total} color="#F43F5E" />
      </div>
    </div>
  );
}
