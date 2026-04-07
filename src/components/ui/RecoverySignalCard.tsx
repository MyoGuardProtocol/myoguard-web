/**
 * RecoverySignalCard
 *
 * Displays the computed recovery status on the results dashboard.
 * Renders nothing when no sleep data was collected (backward compatible
 * with all assessments created before Mission 4).
 *
 * Styling: Midnight Executive theme — glass-card surface, Geist Mono for all
 * numeric data, glow accents from globals.css clinical-alert utilities.
 *
 * Tooltip: when recovery is impaired or critical, an inline biological alert
 * shows the MPS impact statement and (on hover) a detailed tooltip appears
 * on the info icon.
 *
 * Server-safe: no 'use client' — pure presentational, no hooks.
 */

import type { RecoveryStatus } from '@/src/types';

type Props = {
  sleepHours:     number | null | undefined;
  sleepQuality:   number | null | undefined;
  recoveryStatus: RecoveryStatus | string | null | undefined;
  /** Whether the 10-pt penalty was applied to this result */
  penaltyApplied?: boolean;
  /** Whether the critical band override was triggered */
  criticalOverride?: boolean;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const QUALITY_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

const STATUS_CFG = {
  optimal: {
    alertClass:   'clinical-alert-low',
    accentColour: '#2DD4BF',
    headerColour: '#2DD4BF',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    label:        'Optimal Recovery',
    badge:        'RECOVERY: OPTIMAL',
    showAlert:    false,
  },
  impaired: {
    alertClass:   'clinical-alert-high',
    accentColour: '#FB923C',
    headerColour: '#FDBA74',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    label:        'Recovery Impaired',
    badge:        'RECOVERY: IMPAIRED',
    showAlert:    true,
  },
  critical: {
    alertClass:   'clinical-alert-critical',
    accentColour: '#F43F5E',
    headerColour: '#FDA4AF',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    label:        'Critical Recovery Deficit',
    badge:        'RECOVERY: CRITICAL',
    showAlert:    true,
  },
} satisfies Record<string, {
  alertClass: string; accentColour: string; headerColour: string;
  icon: string; label: string; badge: string; showAlert: boolean;
}>;

// ─── Quality dot strip ────────────────────────────────────────────────────────

function QualityDots({ quality, accent }: { quality: number; accent: string }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <div
          key={n}
          className="w-2.5 h-2.5 rounded-full transition-all"
          style={{
            background: n <= quality ? accent : 'rgba(255,255,255,0.1)',
            boxShadow:  n <= quality ? `0 0 4px ${accent}60` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecoverySignalCard({
  sleepHours,
  sleepQuality,
  recoveryStatus,
  penaltyApplied   = false,
  criticalOverride = false,
}: Props) {
  // No sleep data collected — don't render the card at all
  if (sleepHours == null && sleepQuality == null) return null;

  const status = (recoveryStatus as keyof typeof STATUS_CFG) ?? 'optimal';
  const cfg    = STATUS_CFG[status] ?? STATUS_CFG.optimal;

  const hoursDisplay   = sleepHours   != null ? sleepHours.toFixed(1)          : '—';
  const qualityDisplay = sleepQuality != null ? QUALITY_LABELS[sleepQuality]   : '—';

  return (
    <div className={`rounded-2xl overflow-hidden ${cfg.alertClass}`}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-0 flex items-start gap-3.5">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
          style={{ background: `${cfg.accentColour}18`, border: `1px solid ${cfg.accentColour}30` }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.75} stroke={cfg.accentColour} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          {/* Badge */}
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1"
            style={{ color: cfg.accentColour }}
          >
            {cfg.badge}
          </p>
          {/* Label */}
          <p className="text-sm font-semibold leading-snug" style={{ color: cfg.headerColour }}>
            {cfg.label}
          </p>
        </div>
      </div>

      {/* ── Stats grid (Geist Mono for all numbers) ───────────────────────── */}
      <div className="mx-5 mt-4 grid grid-cols-2 gap-3">

        {/* Sleep hours */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: `${cfg.accentColour}0D`, border: `1px solid ${cfg.accentColour}20` }}
        >
          <p
            className="text-[9px] uppercase tracking-[0.14em] mb-1"
            style={{ color: `${cfg.accentColour}80` }}
          >
            Avg. Nightly Sleep
          </p>
          <p
            className="text-2xl font-black tabular-nums leading-none"
            style={{
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              color:      cfg.headerColour,
            }}
          >
            {hoursDisplay}
            <span className="text-sm font-medium ml-1" style={{ color: `${cfg.accentColour}80` }}>
              hrs
            </span>
          </p>
          {/* Low-hours indicator bar */}
          {sleepHours != null && (
            <div
              className="mt-2 h-[3px] rounded-full overflow-hidden"
              style={{ background: `${cfg.accentColour}18` }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width:      `${Math.min(100, (sleepHours / 9) * 100)}%`,
                  background: `linear-gradient(to right, ${cfg.accentColour}80, ${cfg.accentColour})`,
                }}
              />
            </div>
          )}
          <p
            className="text-[9px] mt-1"
            style={{ color: `${cfg.accentColour}60` }}
          >
            Target: 7–9 hrs
          </p>
        </div>

        {/* Sleep quality */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: `${cfg.accentColour}0D`, border: `1px solid ${cfg.accentColour}20` }}
        >
          <p
            className="text-[9px] uppercase tracking-[0.14em] mb-1"
            style={{ color: `${cfg.accentColour}80` }}
          >
            Sleep Quality
          </p>
          <p
            className="text-2xl font-black tabular-nums leading-none"
            style={{
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              color:      cfg.headerColour,
            }}
          >
            {sleepQuality ?? '—'}
            <span className="text-sm font-medium ml-1" style={{ color: `${cfg.accentColour}80` }}>
              /5
            </span>
          </p>
          {sleepQuality != null && (
            <div className="mt-2">
              <QualityDots quality={sleepQuality} accent={cfg.accentColour} />
            </div>
          )}
          <p
            className="text-[9px] mt-1"
            style={{ color: `${cfg.accentColour}60` }}
          >
            {qualityDisplay}
          </p>
        </div>
      </div>

      {/* ── Score modifier badges ─────────────────────────────────────────── */}
      {(penaltyApplied || criticalOverride) && (
        <div className="mx-5 mt-3 flex flex-wrap gap-2">
          {penaltyApplied && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide"
              style={{
                background:   `${cfg.accentColour}18`,
                border:       `1px solid ${cfg.accentColour}35`,
                color:        cfg.headerColour,
                fontFamily:   'var(--font-geist-mono), ui-monospace, monospace',
              }}
            >
              <span>−10 pts</span>
              <span style={{ color: `${cfg.accentColour}80`, fontFamily: 'inherit' }}>score penalty applied</span>
            </span>
          )}
          {criticalOverride && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide"
              style={{
                background: 'rgba(244,63,94,0.12)',
                border:     '1px solid rgba(244,63,94,0.30)',
                color:      '#FDA4AF',
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              }}
            >
              CRITICAL band override active
            </span>
          )}
        </div>
      )}

      {/* ── Biological alert (impaired / critical only) ────────────────────── */}
      {cfg.showAlert && (
        <div className="mx-5 mt-4">
          <div
            className="rounded-xl px-4 py-3.5"
            style={{ background: `${cfg.accentColour}0C`, border: `1px solid ${cfg.accentColour}22` }}
          >
            {/* Alert header with tooltip trigger */}
            <div className="flex items-start gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={1.75} stroke={cfg.accentColour}
                className="w-4 h-4 flex-shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1"
                  style={{ color: cfg.accentColour }}
                >
                  Biological Alert
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Insufficient recovery blunts{' '}
                  <span className="font-semibold text-slate-300">
                    Muscle Protein Synthesis by ~18%
                  </span>
                  . Sleep deprivation suppresses GH and IGF-1 secretion, elevates cortisol, and
                  compounds the catabolic effect of your GLP-1 dose.
                </p>
              </div>
            </div>

            {/* Critical-specific compound deficit message */}
            {criticalOverride && (
              <p className="mt-2.5 text-xs leading-relaxed" style={{ color: '#FDA4AF' }}>
                Combined sleep deprivation and protein deficit removes both primary anabolic inputs
                simultaneously. This triggers an automatic{' '}
                <span
                  className="font-bold"
                  style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
                >
                  CRITICAL
                </span>{' '}
                risk classification regardless of other inputs.
              </p>
            )}

            {/* Intervention recommendations */}
            <div
              className="mt-3 pt-3 space-y-1.5"
              style={{ borderTop: `1px solid ${cfg.accentColour}20` }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{ color: `${cfg.accentColour}70` }}
              >
                Recommended Interventions
              </p>
              {[
                'Target 7–9 hours of uninterrupted sleep per night',
                'Maintain consistent sleep/wake times — circadian rhythm consistency amplifies GH release',
                'Avoid screens 60 min before bed; blue light suppresses melatonin secretion',
                'Magnesium glycinate 200–400mg before sleep — supports muscle relaxation and sleep depth',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div
                    className="flex-shrink-0 w-1 h-1 rounded-full mt-1.5"
                    style={{ background: cfg.accentColour }}
                  />
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="pb-5" />
    </div>
  );
}
