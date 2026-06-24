'use client';

// MyoGuard generates clinical evidence.
// Physicians generate clinical decisions.
// Exports preserve observations only.
// Never diagnostic. Never predictive.
// Never directive.
// Export outputs must be deterministic.
// No AI generation.

import { useState, useCallback, useRef } from 'react';
import posthog from 'posthog-js';
import { isAnalyticsEnabled } from '@/src/lib/posthog';

interface CopyButtonProps {
  text:           string;
  label:          string;
  analyticsEvent?: string;
}

type CopyState = 'idle' | 'copied' | 'error';

export default function CopyButton({ text, label, analyticsEvent }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle');
  const timerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    let success = false;

    // Primary: Clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        // Fall through to execCommand fallback
      }
    }

    // Fallback: textarea + execCommand
    if (!success) {
      try {
        const textarea    = document.createElement('textarea');
        textarea.value    = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity  = '0';
        textarea.style.top      = '0';
        textarea.style.left     = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setState('copied');
      // Track successful copy — no clinical values in payload
      if (analyticsEvent && isAnalyticsEnabled) {
        posthog.capture(analyticsEvent, { source: 'evidence_export_panel' });
      }
      timerRef.current = setTimeout(() => setState('idle'), 2500);
    } else {
      setState('error');
      timerRef.current = setTimeout(() => setState('idle'), 4000);
    }
  }, [text, analyticsEvent]);

  const displayLabel =
    state === 'copied' ? 'Copied ✓' :
    state === 'error'  ? 'Copy failed — select and copy manually' :
    label;

  const isCopied = state === 'copied';
  const isError  = state === 'error';

  return (
    <button
      onClick={handleCopy}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '44px',
        padding:        '10px 18px',
        background:     isCopied ? 'rgba(45,212,191,0.12)' : '#0D1421',
        border:         `1px solid ${isCopied ? '#2DD4BF' : isError ? '#F87171' : '#1A2744'}`,
        borderRadius:   '10px',
        color:          isCopied ? '#2DD4BF' : isError ? '#F87171' : '#F1F5F9',
        fontSize:       '13px',
        fontWeight:     '500',
        cursor:         'pointer',
        fontFamily:     'system-ui, sans-serif',
        transition:     'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
        whiteSpace:     'nowrap',
      }}
    >
      {displayLabel}
    </button>
  );
}
