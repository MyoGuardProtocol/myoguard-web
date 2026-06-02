'use client';

// MyoGuard — Documentation Timeline Toggle
//
// BUILD 5F: Compresses the Documentation Timeline to 3 visible entries by default.
// "Show N earlier entries" expands to reveal all notes.
//
// Client component — handles expand state only.
// Receives DocumentationNote[] pre-sorted newest-first from the server component.
// No data fetching. No Prisma. No exports.
//
// Default: latest 3 entries visible.
// Expanded: all entries visible.
// Maintains newest-first order in both states.

import { useState } from 'react';
import type { DocumentationNote } from '@/src/lib/evidence/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  notes: DocumentationNote[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE = 3;

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentationTimelineToggle({ notes }: Props) {
  const [showAll, setShowAll] = useState(false);

  const visibleNotes = showAll ? notes : notes.slice(0, DEFAULT_VISIBLE);
  const hiddenCount  = notes.length - DEFAULT_VISIBLE;
  const hasMore      = !showAll && hiddenCount > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

      {visibleNotes.map((note, i) => {
        const dateLabel = new Date(note.noteDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        });

        // Primary observation text: impression if available, otherwise note
        const observationText =
          note.overallImpression ?? note.note ?? 'Physician review recorded.';

        // Show divider after each note except the last, and after the last visible
        // note when there are hidden notes below (before the "show more" button).
        const showDivider = i < visibleNotes.length - 1 || hasMore;

        return (
          <div
            key={`${note.assessmentId}-${i}`}
            style={{
              paddingTop:    i > 0 ? '16px' : 0,
              paddingBottom: '16px',
              borderBottom:  showDivider ? '1px solid #1A2744' : 'none',
            }}
          >

            {/* Category label + date */}
            <div
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '10px',
                marginBottom: '6px',
              }}
            >
              <span
                style={{
                  fontSize:      '11px',
                  fontWeight:    '700',
                  color:         '#2DD4BF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Physician Review
              </span>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                {dateLabel}
              </span>
            </div>

            {/* Primary observation text */}
            <p
              style={{
                fontSize:   '13px',
                color:      '#F1F5F9',
                lineHeight: '1.6',
                margin:     0,
              }}
            >
              {observationText}
            </p>

            {/* Additional note — shown when both impression and note are present */}
            {note.note && note.overallImpression && (
              <p
                style={{
                  fontSize:     '12px',
                  color:        '#94A3B8',
                  lineHeight:   '1.6',
                  marginTop:    '4px',
                  marginBottom: 0,
                }}
              >
                {note.note}
              </p>
            )}

            {/* Follow-up days */}
            {note.followUpDays != null && (
              <p
                style={{
                  fontSize:     '12px',
                  color:        '#94A3B8',
                  marginTop:    '4px',
                  marginBottom: 0,
                }}
              >
                Follow-up: {note.followUpDays} days
              </p>
            )}

          </div>
        );
      })}

      {/* ── Show earlier entries toggle ─────────────────────────────────────── */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          style={{
            background:     'transparent',
            border:         'none',
            color:          '#2DD4BF',
            fontSize:       '13px',
            fontWeight:     '600',
            cursor:         'pointer',
            padding:        '12px 0 0 0',
            textAlign:      'left',
            minHeight:      '44px',
            display:        'flex',
            alignItems:     'center',
          }}
        >
          Show {hiddenCount} earlier {hiddenCount === 1 ? 'entry' : 'entries'}
        </button>
      )}

    </div>
  );
}
