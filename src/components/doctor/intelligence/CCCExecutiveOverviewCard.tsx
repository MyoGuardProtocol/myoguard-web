// MyoGuard — Clinical Command Center Executive Overview Card
//
// Physician-scoped executive summary for /doctor/dashboard.
// Four-metric stat panel: active patients, review signals,
// continuity concerns, recent activity.
//
// Data is pre-computed server-side and passed as serialized props.
// No Prisma access. No client state. Pure presentational.
//
// Vocabulary governance: observational only.
// "MyoGuard observes. MyoGuard does not predict."

import type { CSSProperties } from 'react';
import type { PhysicianExecutiveSummary } from '@/src/lib/insights/physician-scoped';

interface Props {
  data: PhysicianExecutiveSummary;
}

// ─── Design tokens (Midnight Silk) ────────────────────────────────────────────

const card: CSSProperties = {
  background:   '#0D1421',
  border:       '1px solid #1A2744',
  borderRadius: '14px',
  padding:      '20px',
  marginBottom: '20px',
};

const eyebrow: CSSProperties = {
  fontSize:      '10px',
  fontWeight:    700,
  color:         '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  marginBottom:  '16px',
};

const statVal: CSSProperties = {
  fontFamily:   'monospace',
  fontSize:     '32px',
  fontWeight:   900,
  color:        '#2DD4BF',
  lineHeight:   1,
  marginBottom: '5px',
};

const statLabel: CSSProperties = {
  fontSize:      '10px',
  fontWeight:    600,
  color:         'rgba(148,163,184,0.55)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CCCExecutiveOverviewCard({ data }: Props) {
  const reviewColor     = data.reviewRequiredCount    > 0 ? '#FB923C' : '#2DD4BF';
  const atRiskColor     = data.patientsRequiringAttention > 0 ? '#FCD34D' : '#2DD4BF';

  return (
    <div style={card}>
      <p style={eyebrow}>Practice at a Glance</p>

      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap:                 '16px',
      }}>
        <div>
          <p style={statVal}>{data.totalPatients}</p>
          <p style={statLabel}>Active Patients</p>
        </div>

        <div>
          <p style={{ ...statVal, color: reviewColor }}>{data.reviewRequiredCount}</p>
          <p style={statLabel}>Review Signals</p>
        </div>

        <div>
          <p style={{ ...statVal, color: atRiskColor }}>{data.patientsRequiringAttention}</p>
          <p style={statLabel}>Continuity Concerns</p>
        </div>

        <div>
          <p style={statVal}>{data.patientsActive}</p>
          <p style={statLabel}>Recent Activity</p>
        </div>
      </div>

      {data.totalPatients === 0 && (
        <p style={{ fontSize: '12px', color: '#64748B', marginTop: '14px', fontStyle: 'italic' }}>
          No patients enrolled yet. Invite patients to activate clinical intelligence.
        </p>
      )}
    </div>
  );
}
