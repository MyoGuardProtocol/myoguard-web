// MyoGuard — CCC Clinical Practice Updates
//
// Physician-facing, read-only list of Founder-approved Evidence Register
// entries, rendered inside Section A of /doctor/practice-intelligence.
//
// Receives display models from getClinicalPracticeUpdates() and renders only
// what they carry — the Founder decision rationale and public-interest
// rationale never reach this component. No Prisma access, no client state,
// no edit, approve, publish or delete controls. Pure presentational.
//
// Styling reuses the existing Section A bulletin box and Section C cards
// (Midnight Silk). Order is readiness priority, never a ranking of evidence.

import type { CSSProperties } from 'react';
import type { ClinicalPracticeUpdate } from '@/src/lib/practiceUpdates/clinicalPracticeUpdates';

interface Props {
  updates: readonly ClinicalPracticeUpdate[];
}

export const EMPTY_STATE_TEXT = 'No approved clinical practice updates are available at this time.';

// ─── Design tokens (Midnight Silk, as used on this page) ──────────────────────

const bulletinBox: CSSProperties = {
  background:   'rgba(45,212,191,0.04)',
  border:       '1px solid rgba(45,212,191,0.12)',
  borderRadius: '10px',
  padding:      '16px 20px',
};

const bulletinLabel: CSSProperties = {
  fontSize:      '11px',
  fontWeight:    600,
  color:         '#2DD4BF',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom:  '6px',
};

const card: CSSProperties = {
  background:   'rgba(255,255,255,0.02)',
  border:       '1px solid #1A2744',
  borderRadius: '12px',
  padding:      '18px 20px',
};

const chipRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' };

const chipPrimary: CSSProperties = {
  fontSize:      '11px',
  fontWeight:    600,
  color:         '#2DD4BF',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  background:    'rgba(45,212,191,0.08)',
  border:        '1px solid rgba(45,212,191,0.18)',
  borderRadius:  '6px',
  padding:       '2px 8px',
};

const chipSecondary: CSSProperties = {
  fontSize:     '11px',
  fontWeight:   600,
  color:        '#94A3B8',
  background:   'rgba(255,255,255,0.03)',
  border:       '1px solid #1A2744',
  borderRadius: '6px',
  padding:      '2px 8px',
};

const eyebrow: CSSProperties = {
  fontSize:      '10px',
  fontWeight:    700,
  color:         '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  margin:        '14px 0 4px',
};

const body: CSSProperties = { fontSize: '12px', color: '#94A3B8', lineHeight: 1.6, margin: 0 };
const muted: CSSProperties = { fontSize: '12px', color: '#64748B', lineHeight: 1.6, margin: 0 };

const visuallyHidden: CSSProperties = {
  position:   'absolute',
  width:      '1px',
  height:     '1px',
  overflow:   'hidden',
  clip:       'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClinicalPracticeUpdates({ updates }: Props) {
  if (updates.length === 0) {
    return (
      <div style={bulletinBox}>
        <p style={bulletinLabel}>Institutional Bulletin</p>
        <p style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', lineHeight: 1.6 }}>
          {EMPTY_STATE_TEXT}
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul
        aria-label="Approved clinical practice updates"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        {updates.map(u => {
          const headingId = `cpu-${u.id}`;
          return (
            <li key={u.id}>
              <article aria-labelledby={headingId} style={card}>
                <div style={chipRow}>
                  <span style={chipPrimary}>{u.practiceClassificationLabel}</span>
                  <span style={chipSecondary}>{u.evidenceTypeLabel} · {u.evidenceQualityLabel}</span>
                  {u.explainerHref ? (
                    // Present only when the central selector reports the article publicly exposable.
                    <a href={u.explainerHref} style={{ ...chipSecondary, color: '#2DD4BF', textDecoration: 'underline' }}>
                      {u.explainerStatus}
                    </a>
                  ) : (
                    <span style={chipSecondary}>{u.explainerStatus}</span>
                  )}
                </div>

                <h3
                  id={headingId}
                  style={{ fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: 600, color: '#F1F5F9', margin: '0 0 6px' }}
                >
                  {u.title}
                </h3>

                <p style={body}>{u.clinicalRelevance}</p>

                <p style={eyebrow}>Key limitations</p>
                <ul style={{ ...muted, paddingLeft: '18px' }}>
                  {u.limitations.map((l, i) => <li key={i}>{l}</li>)}
                </ul>

                <p style={eyebrow}>Product consideration only</p>
                <p style={muted}>{u.productConsideration}</p>

                {u.persistenceThemeLabels.length > 0 && (
                  <>
                    <p style={eyebrow}>Themes</p>
                    <div style={{ ...chipRow, marginBottom: 0 }}>
                      {u.persistenceThemeLabels.map(t => <span key={t} style={chipSecondary}>{t}</span>)}
                    </div>
                  </>
                )}

                <p style={eyebrow}>Source</p>
                <p style={{ ...muted, overflowWrap: 'anywhere' }}>
                  {u.source.href ? (
                    <a href={u.source.href} target="_blank" rel="noopener noreferrer" style={{ color: '#2DD4BF' }}>
                      {u.source.label}
                      <span style={visuallyHidden}> (opens in a new tab)</span>
                    </a>
                  ) : (
                    u.source.label
                  )}
                </p>

                <p style={{ ...muted, marginTop: '14px' }}>
                  Last reviewed <time dateTime={u.lastReviewedAt}>{u.lastReviewedLabel}</time>
                  {' · '}
                  Review due <time dateTime={u.reviewDueAt}>{u.reviewDueLabel}</time>
                </p>
              </article>
            </li>
          );
        })}
      </ul>

      <p style={{ ...muted, marginTop: '14px' }}>
        Founder-approved evidence summaries supporting physician-led Clinical Decision Support.
        They inform, and do not replace, clinical judgement.
      </p>
    </div>
  );
}
