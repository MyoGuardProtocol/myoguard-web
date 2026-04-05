'use client';

import { useEffect, useRef } from 'react';

// ─── SVG geometry ─────────────────────────────────────────────────────────────
//
// Semicircular arc — top half only.
// Center (100, 100), radius 82.
//
// Sweep direction:  sweep-flag=1 in SVG means increasing SVG-angle (clockwise
// on screen, since SVG has y-axis pointing down).  Starting at 9 o'clock
// (180°) and sweeping clockwise passes through 270° = (100, 18) = top of
// screen, finishing at 3 o'clock (360°/0°).  This produces the top-half arc
// (the "bowl" facing downward) that reads as a gauge dial.
//
// Mnemonic: clock goes 9 → 12 → 3 (left → top → right) when sweeping
// clockwise, so sweep=1 from the left endpoint goes OVER the top.
//
const CX = 100;
const CY = 100;
const R  = 82;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
// = "M 18 100 A 82 82 0 0 1 182 100"

// ─── Band config ──────────────────────────────────────────────────────────────
// Hex values are used directly as SVG stroke colours.
const BAND_STROKE: Record<string, string> = {
  LOW:      '#10b981',  // emerald-500
  MODERATE: '#f59e0b',  // amber-500
  HIGH:     '#f97316',  // orange-500
  CRITICAL: '#ef4444',  // red-500
};

const BAND_LABEL: Record<string, string> = {
  LOW:      'Low Risk',
  MODERATE: 'Moderate Risk',
  HIGH:     'High Risk',
  CRITICAL: 'Critical Risk',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  score:       number;  // 0–100
  band:        string;  // 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  leanLossPct: number;  // e.g. 14
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ScoreGauge({ score, band, leanLossPct }: Props) {
  const rounded   = Math.round(score);
  const stroke    = BAND_STROKE[band] ?? BAND_STROKE.HIGH;
  const bandLabel = BAND_LABEL[band]  ?? 'Unknown';
  const fillRef   = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;

    // Reduced-motion: jump to final value without animation.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.strokeDasharray = `${rounded} 100`;
      return;
    }

    // Animate stroke-dasharray from 0 → rounded via requestAnimationFrame.
    // pathLength="100" on the <path> normalises units so dasharray values
    // map directly to percent-of-arc (e.g. "72 100" = 72% of the arc drawn).
    let rafId: number;
    let start: number | null = null;
    const DURATION = 800; // ms

    function tick(ts: number) {
      if (start === null) start = ts;
      const t    = Math.min((ts - start) / DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3);            // ease-out cubic
      el!.style.strokeDasharray = `${(rounded * ease).toFixed(2)} 100`;
      if (t < 1) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [rounded]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/*
        ViewBox 200 × 108:
          Arc top stroke edge : y = 18 − 6  = 12
          Arc endpoints       : y = 100
          Arc bottom edge     : y = 100 + 6 = 106
          "/100" text         : y = 97  (below the score number)
      */}
      <svg
        viewBox="0 0 200 108"
        width="100%"
        role="img"
        aria-label={`MyoGuard Score: ${rounded} out of 100, ${bandLabel}`}
      >
        {/* ── Track (background arc) ── */}
        <path
          d={ARC}
          fill="none"
          stroke="#334155"       /* slate-700 */
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* ── Fill arc ─────────────────────────────────────────────────────
            Starts empty (strokeDasharray "0 100").  The useEffect above
            animates it to "{rounded} 100" via RAF.  pathLength="100" means
            one unit of dasharray = 1% of the arc, so score=72 → "72 100"
            draws the first 72% of the path (left to ~72% across the top).
        ── */}
        <path
          ref={fillRef}
          d={ARC}
          fill="none"
          stroke={stroke}
          strokeWidth="12"
          strokeLinecap="round"
          pathLength="100"
          style={{ strokeDasharray: '0 100' }}
        />

        {/* ── Score number ─────────────────────────────────────────────────
            font-family set via inline style (CSS custom property) so the
            SVG text reliably inherits Geist Mono across all browsers, since
            SVG presentation attributes do not support var() but inline
            styles do.
        ── */}
        <text
          x={CX}
          y={74}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="44"
          fontWeight="900"
          fill="white"
          style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
        >
          {rounded}
        </text>

        {/* ── /100 label ── */}
        <text
          x={CX}
          y={97}
          textAnchor="middle"
          fontSize="12"
          fontWeight="300"
          fill="#64748b"         /* slate-500 */
        >
          /100
        </text>
      </svg>

      {/* ── Band label + lean loss risk (below SVG) ── */}
      <div className="text-center">
        <p className="text-xs font-bold" style={{ color: stroke }}>
          {bandLabel}
        </p>
        <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
          {leanLossPct}% lean loss risk
        </p>
      </div>
    </div>
  );
}
