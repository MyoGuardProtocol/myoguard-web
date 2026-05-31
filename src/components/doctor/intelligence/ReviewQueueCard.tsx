// MyoGuard — Review Queue Card
//
// Displays physician-signal review observations for the physician's patient cohort.
// Replaces the "Coming Soon" placeholder block in PatientCommandCenter.
//
// Physician-scoped: counts reflect only the authenticated physician's patients.
// Used inside PatientCommandCenter ('use client'). No server APIs used here.
//
// Vocabulary governance: "identified", "observed", "recorded" — never urgency language.
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
  marginBottom: '20px',
};

const eyebrow: CSSProperties = {
  fontSize:      '10px',
  fontWeight:    700,
  color:         '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  marginBottom:  '4px',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewQueueCard({ data }: Props) {
  const hasSignals = data.reviewRequiredCount > 0 || data.inactiveCount > 0 || data.persistentDeficitCount > 0;
  const total      = data.totalPatients;

  const reviewRecommendedOnly = data.reviewRequiredCount - data.reviewThresholdCount;

  const signalStats = [
    {
      label:   'Threshold Crossed',
      value:   data.reviewThresholdCount,
      color:   data.reviewThresholdCount > 0 ? '#F43F5E' : '#2DD4BF',
      sub:     'Physician signal — threshold level',
    },
    {
      label:   'Review Recommended',
      value:   reviewRecommendedOnly,
      color:   reviewRecommendedOnly > 0 ? '#FB923C' : '#2DD4BF',
      sub:     'Physician signal — recommended',
    },
    {
      label:   'Continuity Concern',
      value:   data.inactiveCount,
      color:   data.inactiveCount > 0 ? '#FCD34D' : '#2DD4BF',
      sub:     'Continuity signal — concern observed',
    },
  ];

  return (
    <div style={card}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <p style={eyebrow}>Intelligence Signals</p>
          <p style={{ fontSize: '11px', color: 'rgba(148,163,184,0.6)', margin: 0 }}>
            Physician-signal review observations for your patient cohort
          </p>
        </div>
        {hasSignals && (
          <span style={{
            fontSize:     '10px',
            fontWeight:   700,
            color:        '#FB923C',
            background:   'rgba(251,146,60,0.1)',
            border:       '1px solid rgba(251,146,60,0.25)',
            borderRadius: '999px',
            padding:      '3px 10px',
            whiteSpace:   'nowrap',
            flexShrink:   0,
          }}>
            {data.reviewRequiredCount} identified
          </span>
        )}
      </div>

      {/* Body */}
      {total === 0 ? (
        <p style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic' }}>
          No patients enrolled yet. Invite patients to activate intelligence signals.
        </p>
      ) : !hasSignals ? (
        <p style={{ fontSize: '13px', color: '#2DD4BF' }}>
          No review signals observed across {total} patient{total !== 1 ? 's' : ''}. Continuity active.
        </p>
      ) : (
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap:                 '10px',
        }}>
          {signalStats.map(item => (
            <div key={item.label} style={{
              background:   'rgba(255,255,255,0.03)',
              border:       '1px solid rgba(26,39,68,0.8)',
              borderRadius: '10px',
              padding:      '12px 14px',
            }}>
              <p style={{
                fontFamily:   'monospace',
                fontSize:     '24px',
                fontWeight:   900,
                color:        item.color,
                lineHeight:   1,
                marginBottom: '5px',
              }}>
                {item.value}
              </p>
              <p style={{
                fontSize:      '10px',
                fontWeight:    700,
                color:         'rgba(148,163,184,0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom:  '3px',
              }}>
                {item.label}
              </p>
              <p style={{ fontSize: '10px', color: 'rgba(148,163,184,0.4)', fontStyle: 'italic' }}>
                {item.sub}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p style={{
        fontSize:    '10px',
        color:       'rgba(148,163,184,0.3)',
        marginTop:   '12px',
        fontStyle:   'italic',
      }}>
        Intelligence signals are observational. All clinical decisions remain with the treating physician.
      </p>
    </div>
  );
}
