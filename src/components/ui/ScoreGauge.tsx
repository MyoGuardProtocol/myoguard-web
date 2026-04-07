'use client';

import { useEffect, useRef } from 'react';

// ─── SVG geometry ─────────────────────────────────────────────────────────────
//
// Semicircular arc — top half only.
// Center (100, 110), radius 80.
// Starts at 9 o'clock, sweeps clockwise to 3 o'clock.
//
const CX = 100;
const CY = 110;
const R  = 80;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

// ─── Band palette ─────────────────────────────────────────────────────────────
// Aligned with the Midnight Executive theme tokens in globals.css.

const BAND_CONFIG: Record<string, {
  stroke:     string;   // arc fill colour
  trackFill:  string;   // background arc colour
  glowClass:  string;   // applied to SVG wrapper for drop-shadow
  labelColour:string;   // CSS colour for the label text
  label:      string;
}> = {
  LOW: {
    stroke:      '#2DD4BF',               // Myo-Teal
    trackFill:   'rgba(45,212,191,0.12)',
    glowClass:   'gauge-glow-low',
    labelColour: '#2DD4BF',
    label:       'Low Risk',
  },
  MODERATE: {
    stroke:      '#F59E0B',               // amber-500
    trackFill:   'rgba(245,158,11,0.12)',
    glowClass:   'gauge-glow-moderate',
    labelColour: '#FCD34D',
    label:       'Moderate Risk',
  },
  HIGH: {
    stroke:      '#FB923C',               // orange-400
    trackFill:   'rgba(251,146,60,0.12)',
    glowClass:   'gauge-glow-high',
    labelColour: '#FDBA74',
    label:       'High Risk',
  },
  CRITICAL: {
    stroke:      '#F43F5E',               // rose-500
    trackFill:   'rgba(244,63,94,0.12)',
    glowClass:   'gauge-glow-critical',
    labelColour: '#FDA4AF',
    label:       'Critical Risk',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  score:       number;   // 0–100
  band:        string;   // 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  leanLossPct: number;   // e.g. 14
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ScoreGauge({ score, band, leanLossPct }: Props) {
  const rounded  = Math.round(score);
  const cfg      = BAND_CONFIG[band] ?? BAND_CONFIG.HIGH;
  const fillRef  = useRef<SVGPathElement>(null);

  // Animate the fill arc via requestAnimationFrame on mount.
  // pathLength="100" normalises dasharray units to percentage-of-arc.
  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.strokeDasharray = `${rounded} 100`;
      return;
    }

    let rafId:  number;
    let start:  number | null = null;
    const DURATION = 900; // ms — slightly longer for a more luxurious feel

    function tick(ts: number) {
      if (start === null) start = ts;
      const t    = Math.min((ts - start) / DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 4);              // ease-out quart
      el!.style.strokeDasharray = `${(rounded * ease).toFixed(2)} 100`;
      if (t < 1) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [rounded]);

  return (
    /*
      Outer wrapper is a flex column so the SVG gauge stacks above the
      band label and lean-loss stat. The gauge-glow-* class adds the
      drop-shadow filter defined in globals.css.
    */
    <div className="flex flex-col items-center gap-3">

      {/* ── SVG gauge ─────────────────────────────────────────────────────── */}
      <div className={cfg.glowClass} style={{ width: '100%' }}>
        <svg
          viewBox="0 0 200 118"
          width="100%"
          role="img"
          aria-label={`MyoGuard Score: ${rounded} out of 100 — ${cfg.label}`}
        >
          <defs>
            {/*
              Radial gradient for the score number text — gives it a subtle
              metallic shimmer against the deep background.
            */}
            <linearGradient id="score-text-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.70)" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* ── Track arc (background) ── */}
          <path
            d={ARC}
            fill="none"
            stroke={cfg.trackFill}
            strokeWidth="11"
            strokeLinecap="round"
          />

          {/* ── Track rim — thin bright line at leading edge for depth ── */}
          <path
            d={ARC}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/*
            Fill arc — animated via RAF in useEffect above.
            pathLength="100" maps 1 dasharray unit → 1% of arc length.
          */}
          <path
            ref={fillRef}
            d={ARC}
            fill="none"
            stroke={cfg.stroke}
            strokeWidth="11"
            strokeLinecap="round"
            pathLength="100"
            style={{ strokeDasharray: '0 100' }}
          />

          {/* ── Score number ──────────────────────────────────────────────────
              Uses Geist Mono via CSS custom property. SVG text doesn't
              support var() in presentation attributes — inline style is
              the only reliable cross-browser approach.
          ── */}
          <text
            x={CX}
            y={78}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="52"
            fontWeight="900"
            fill="url(#score-text-grad)"
            style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
          >
            {rounded}
          </text>

          {/* ── /100 sublabel ── */}
          <text
            x={CX}
            y={101}
            textAnchor="middle"
            fontSize="11"
            fontWeight="400"
            fill="rgba(148,163,184,0.7)"    /* slate-400 @ 70% */
            letterSpacing="1"
            style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
          >
            / 100
          </text>
        </svg>
      </div>

      {/* ── Band label + lean loss ─────────────────────────────────────────── */}
      <div className="text-center space-y-1 pb-1">
        {/* Risk band label */}
        <p
          className="text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: cfg.labelColour }}
        >
          {cfg.label}
        </p>

        {/* Lean loss — monospaced, laboratory precision */}
        <p
          className="text-[11px] tabular-nums"
          style={{
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            color:      'rgba(100, 116, 139, 0.9)',  /* slate-500 */
          }}
        >
          <span style={{ color: cfg.labelColour, opacity: 0.85 }}>{leanLossPct}</span>
          <span>% lean loss risk</span>
        </p>
      </div>

    </div>
  );
}
