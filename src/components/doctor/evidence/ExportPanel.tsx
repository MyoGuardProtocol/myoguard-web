'use client';

// MyoGuard generates clinical evidence.
// Physicians generate clinical decisions.
// Exports preserve observations only.
// Never diagnostic. Never predictive.
// Never directive.
// Export outputs must be deterministic.
// No AI generation.

import { useMemo }                    from 'react';
import posthog                        from 'posthog-js';
import { isAnalyticsEnabled, AnalyticsEvents } from '@/src/lib/posthog';
import type { ClinicalEvidenceRecord }          from '@/src/lib/evidence/types';
import { generatePhysicianSummary }            from '@/src/lib/evidence/export/physicianSummary';
import { generateSOAPNote }                    from '@/src/lib/evidence/export/soapNote';
import { generateTimelineSummary }             from '@/src/lib/evidence/export/timelineSummary';
import CopyButton                              from './CopyButton';

interface ExportPanelProps {
  packet: ClinicalEvidenceRecord;
}

export default function ExportPanel({ packet }: ExportPanelProps) {
  const physicianSummaryText = useMemo(() => generatePhysicianSummary(packet),                       [packet]);
  const soapNoteText         = useMemo(() => generateSOAPNote(packet),                               [packet]);
  const timelineText         = useMemo(() => generateTimelineSummary(packet.documentationNotes),     [packet]);

  function handlePrint() {
    // Track print action — no clinical values in payload
    if (isAnalyticsEnabled) {
      posthog.capture(AnalyticsEvents.EVIDENCE_PRINTED, { source: 'evidence_export_panel' });
    }
    window.print();
  }

  return (
    <div
      className="print:hidden"
      style={{
        background:   '#0D1421',
        border:       '1px solid #1A2744',
        borderRadius: '16px',
        padding:      '20px 24px',
        marginBottom: '16px',
      }}
    >
      {/* Heading */}
      <p
        style={{
          fontSize:      '11px',
          fontWeight:    '700',
          color:         '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom:  '16px',
          marginTop:     0,
        }}
      >
        Export Documentation
      </p>

      {/* Buttons: row on desktop, stacked on mobile via flex-col / sm:flex-row */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-[10px]">

        <CopyButton
          text={physicianSummaryText}
          label="Copy Physician Summary"
          analyticsEvent={AnalyticsEvents.PHYSICIAN_SUMMARY_COPIED}
        />

        <CopyButton
          text={soapNoteText}
          label="Copy SOAP Note"
          analyticsEvent={AnalyticsEvents.SOAP_NOTE_COPIED}
        />

        <CopyButton
          text={timelineText}
          label="Copy Timeline"
          analyticsEvent={AnalyticsEvents.TIMELINE_COPIED}
        />

        {/* Print button — hidden on print to avoid recursive print loops */}
        <button
          onClick={handlePrint}
          className="print:hidden"
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            minHeight:      '44px',
            padding:        '10px 18px',
            background:     '#0D1421',
            border:         '1px solid #1A2744',
            borderRadius:   '10px',
            color:          '#F1F5F9',
            fontSize:       '13px',
            fontWeight:     '500',
            cursor:         'pointer',
            fontFamily:     'system-ui, sans-serif',
            whiteSpace:     'nowrap',
          }}
        >
          Print Evidence Record
        </button>

      </div>
    </div>
  );
}
