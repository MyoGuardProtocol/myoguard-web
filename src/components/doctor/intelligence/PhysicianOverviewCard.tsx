// MyoGuard — Physician Overview Card
//
// Displays physician-level signal aggregates for the patient panel.
// Physician-scoped: all metrics reflect the authenticated physician's patients only.
//
// Used inside PatientCommandCenter ('use client'). No server APIs used here.
//
// Vocabulary governance: observational only. Never predictive.
// "MyoGuard observes. MyoGuard does not predict."

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

const statVal: CSSProperties = {
  fontFamily:   'monospace',
  fontSize:     '28px',
  fontWeight:   900,
  color:        '#2DD4BF',
  lineHeight:   1,
  marginBottom: '5px',
};

const statLabel: CSSProperties = {
  fontSize:      '10px',
  fontWeight:    600,
  color:         'rgba(148,163,184,0.6)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhysicianOverviewCard({ data }: Props) {
  const reviewColor     = data.reviewRequiredCount    > 0 ? '#FB923C' : '#2DD4BF';
  const inactiveColor   = data.inactiveCount           > 0 ? '#FCD34D' : '#2DD4BF';
  const adherenceColor  = data.persistentDeficitCount  > 0 ? '#FB923C' : '#2DD4BF';

  const pendingData = data.totalPatients - data.patientsWithIntelligence;

  return (
    <div style={card}>
      <p style={eyebrow}>Physician Overview</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <div>
          <p style={statVal}>{data.totalPatients}</p>
          <p style={statLabel}>Total Patients</p>
        </div>

        <div>
          <p style={{ ...statVal, color: reviewColor }}>{data.reviewRequiredCount}</p>
          <p style={statLabel}>Review Signals</p>
        </div>

        <div>
          <p style={{ ...statVal, color: inactiveColor }}>{data.inactiveCount}</p>
          <p style={statLabel}>Continuity Concern</p>
        </div>

        <div>
          <p style={{ ...statVal, color: adherenceColor }}>{data.persistentDeficitCount}</p>
          <p style={statLabel}>Adherence Concerns</p>
        </div>
      </div>

      {pendingData > 0 && (
        <p style={{ fontSize: '11px', color: '#64748B', marginTop: '12px', fontStyle: 'italic' }}>
          {pendingData} patient{pendingData !== 1 ? 's' : ''} pending sufficient data for intelligence signals.
        </p>
      )}
    </div>
  );
}
