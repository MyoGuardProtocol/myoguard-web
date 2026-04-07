/**
 * ClinicalAlert
 *
 * Replaces the standard red/orange band card in the results view with a
 * sophisticated clinical-grade warning card that uses the Midnight Executive
 * glow system from globals.css.
 *
 * Design language:
 *   HIGH / CRITICAL — glowing border, "Medical Action Required" header,
 *                     structured severity indicator, clinical language.
 *   MODERATE        — amber glow, advisory tone.
 *   LOW             — teal affirmation, no warning iconography.
 *
 * Server component — no 'use client' needed.
 */

type Band = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

type Props = {
  band:        Band;
  leanLossPct: number;
  message:     string;
};

// ─── Band config ──────────────────────────────────────────────────────────────

const BAND_CFG: Record<Band, {
  alertClass:   string;   // globals.css utility
  headerColour: string;   // inline CSS colour for heading
  accentColour: string;   // dot / stat colour
  severityBar:  string;   // filled segment colour
  severityPct:  number;   // 0–100 — how full the severity bar is
  headerLabel:  string;   // primary heading text
  badgeText:    string;   // small capsule badge
  icon:         string;   // SVG path data for the icon
}> = {
  CRITICAL: {
    alertClass:   'clinical-alert-critical',
    headerColour: '#FDA4AF',     // rose-300
    accentColour: '#F43F5E',     // rose-500
    severityBar:  '#F43F5E',
    severityPct:  100,
    headerLabel:  'Critical — Immediate Clinical Attention Required',
    badgeText:    'CRITICAL RISK',
    // Circle with exclamation — Medical Action Required
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  HIGH: {
    alertClass:   'clinical-alert-high',
    headerColour: '#FDBA74',     // orange-300
    accentColour: '#FB923C',     // orange-400
    severityBar:  '#FB923C',
    severityPct:  75,
    headerLabel:  'Medical Action Required',
    badgeText:    'HIGH RISK',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  MODERATE: {
    alertClass:   'clinical-alert-moderate',
    headerColour: '#FCD34D',     // amber-300
    accentColour: '#F59E0B',     // amber-500
    severityBar:  '#F59E0B',
    severityPct:  45,
    headerLabel:  'Protocol Adjustment Advised',
    badgeText:    'MODERATE RISK',
    icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  },
  LOW: {
    alertClass:   'clinical-alert-low',
    headerColour: '#2DD4BF',     // Myo-Teal
    accentColour: '#2DD4BF',
    severityBar:  '#2DD4BF',
    severityPct:  15,
    headerLabel:  'Optimal Muscle Preservation Range',
    badgeText:    'LOW RISK',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClinicalAlert({ band, leanLossPct, message }: Props) {
  const cfg = BAND_CFG[band];

  return (
    <div className={`rounded-2xl overflow-hidden ${cfg.alertClass}`}>

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 flex items-start gap-3.5">

        {/* Icon */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${cfg.accentColour}18`, border: `1px solid ${cfg.accentColour}30` }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.75}
            stroke={cfg.accentColour}
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
          </svg>
        </div>

        {/* Header text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: cfg.accentColour }}
            >
              {cfg.badgeText}
            </p>
            {/* Severity indicator dot — pulses on CRITICAL */}
            {(band === 'CRITICAL' || band === 'HIGH') && (
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${band === 'CRITICAL' ? 'animate-pulse' : ''}`}
                style={{ background: cfg.accentColour }}
              />
            )}
          </div>
          <p
            className="text-sm font-semibold leading-snug"
            style={{ color: cfg.headerColour }}
          >
            {cfg.headerLabel}
          </p>
        </div>
      </div>

      {/* ── Severity bar ──────────────────────────────────────────────────── */}
      <div className="mx-5 mb-4">
        {/* Track */}
        <div
          className="h-[3px] w-full rounded-full overflow-hidden"
          style={{ background: `${cfg.accentColour}18` }}
        >
          {/* Fill */}
          <div
            className="h-full rounded-full myg-bar-grow"
            style={{
              width:      `${cfg.severityPct}%`,
              background: `linear-gradient(to right, ${cfg.accentColour}80, ${cfg.accentColour})`,
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p
            className="text-[9px] uppercase tracking-[0.14em]"
            style={{ color: `${cfg.accentColour}70` }}
          >
            Lean Loss Risk Severity
          </p>
          {/* Lean loss percentage — Geist Mono for laboratory precision */}
          <p
            className="text-[11px] tabular-nums font-semibold"
            style={{
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              color:      cfg.accentColour,
            }}
          >
            {leanLossPct}% estimated
          </p>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div
        className="mx-5 mb-4 h-px"
        style={{ background: `${cfg.accentColour}18` }}
      />

      {/* ── Clinical message ──────────────────────────────────────────────── */}
      <div className="px-5 pb-5">
        <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
      </div>

      {/* ── Bottom accent line — HIGH/CRITICAL only ───────────────────────── */}
      {(band === 'HIGH' || band === 'CRITICAL') && (
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(to right, transparent, ${cfg.accentColour}50, transparent)`,
          }}
        />
      )}
    </div>
  );
}
