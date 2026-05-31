// MyoGuard — Research Registry Overview Card
//
// Displays research registry participation metrics for the platform.
// Async server component — calls getResearchInsights() internally.
// Used exclusively in /doctor/dashboard (RSC context).
//
// Research metrics are platform-wide by institutional design:
// observational studies enroll patients across all physicians.
//
// Vocabulary governance: "observational", "recorded", "identified" only.
// Never predictive. "MyoGuard observes. MyoGuard does not predict."

import type { CSSProperties } from 'react';
import { getResearchInsights } from '@/src/lib/insights/research';

// ─── Design tokens (Midnight Silk) ────────────────────────────────────────────

const card: CSSProperties = {
  background:   '#0D1421',
  border:       '1px solid #1A2744',
  borderRadius: '14px',
  padding:      '20px',
  marginTop:    '16px',
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
  fontSize:     '28px',
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

export default async function RegistryOverviewCard() {
  let research;
  try {
    research = await getResearchInsights();
  } catch {
    // Research layer unavailable — suppress card gracefully
    return null;
  }

  if (research.activeStudyCount === 0) {
    return (
      <div style={card}>
        <p style={eyebrow}>Research Registry</p>
        <p style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic' }}>
          No active observational studies at this time.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <p style={eyebrow}>Research Registry</p>

      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap:                 '16px',
      }}>
        <div>
          <p style={statVal}>{research.activeStudyCount}</p>
          <p style={statLabel}>Active Studies</p>
        </div>

        <div>
          <p style={statVal}>{research.activeCohortSize}</p>
          <p style={statLabel}>Active Cohort</p>
        </div>

        <div>
          <p style={statVal}>
            {research.averageFollowUpDays != null ? research.averageFollowUpDays : '—'}
          </p>
          <p style={statLabel}>Avg Follow-up (Days)</p>
        </div>

        <div>
          <p style={statVal}>{research.longitudinalParticipationRate}%</p>
          <p style={statLabel}>Longitudinal Rate</p>
        </div>
      </div>

      <p style={{
        fontSize:  '10px',
        color:     'rgba(148,163,184,0.3)',
        marginTop: '14px',
        fontStyle: 'italic',
      }}>
        Observational study metrics. {research.totalEnrolledAcrossStudies} total enrolled across{' '}
        {research.activeStudyCount} active {research.activeStudyCount === 1 ? 'study' : 'studies'}.
      </p>
    </div>
  );
}
