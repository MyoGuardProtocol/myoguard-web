/**
 * WeeklyFocusCard
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure display component — no DB calls, no hooks, no 'use client'.
 * Receives pre-computed WeeklyProtocolFocus from the dashboard server component.
 *
 * Three render states:
 *   1. hasData = false  → "Start tracking" prompt (no check-ins yet)
 *   2. checkinOverdue   → focus + overdue banner
 *   3. Normal           → full focus card
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Link from 'next/link';
import type { WeeklyProtocolFocus, FocusPriority, AdherenceGrade } from '@/src/lib/adaptiveProtocol';

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  focus:                WeeklyProtocolFocus | null;
  hasData:              boolean;
  daysSinceLastCheckin: number | null;
};

// ─── Style maps ───────────────────────────────────────────────────────────────

const PRIORITY_CARD: Record<FocusPriority, {
  border:      string;
  bg:          string;
  headerBg:    string;
  headerText:  string;
  dot:         string;
  label:       string;
}> = {
  URGENT:      { border: 'border-red-200',     bg: 'bg-red-50',      headerBg: 'bg-red-100',     headerText: 'text-red-700',     dot: 'bg-red-500',     label: 'Urgent'      },
  HIGH:        { border: 'border-amber-200',   bg: 'bg-amber-50',    headerBg: 'bg-amber-100',   headerText: 'text-amber-700',   dot: 'bg-amber-500',   label: 'High'        },
  NORMAL:      { border: 'border-teal-200',    bg: 'bg-white',       headerBg: 'bg-teal-50',     headerText: 'text-teal-700',    dot: 'bg-teal-500',    label: 'Focus'       },
  MAINTENANCE: { border: 'border-emerald-200', bg: 'bg-emerald-50',  headerBg: 'bg-emerald-100', headerText: 'text-emerald-700', dot: 'bg-emerald-500', label: 'On track'    },
};

const GRADE_CHIP: Record<AdherenceGrade, { text: string; bg: string; border: string }> = {
  GOOD:    { text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  FAIR:    { text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200'   },
  POOR:    { text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200'     },
  UNKNOWN: { text: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-200'   },
};

const GRADE_LABEL: Record<AdherenceGrade, string> = {
  GOOD:    'On track',
  FAIR:    'Improving',
  POOR:    'Needs work',
  UNKNOWN: 'No data',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricPill({
  icon,
  label,
  value,
  grade,
}: {
  icon:  string;
  label: string;
  value: string;
  grade: AdherenceGrade;
}) {
  const chip = GRADE_CHIP[grade];
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${chip.bg} ${chip.border}`}>
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-xs font-semibold text-slate-800 truncate">{value}</p>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${chip.text}`}>
        {GRADE_LABEL[grade]}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeeklyFocusCard({ focus, hasData, daysSinceLastCheckin }: Props) {

  // ── State 1: No check-in data at all ──────────────────────────────────────
  if (!hasData || !focus) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              This Week&apos;s Protocol Focus
            </p>
          </div>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-slate-800 mb-1.5">
            Start tracking to get personalised guidance
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Log your first weekly check-in and MyoGuard will analyse your protein adherence,
            training consistency, and symptoms to generate a tailored weekly focus — updated
            automatically as your data builds.
          </p>
          <Link
            href="/checkin"
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            Log your first check-in →
          </Link>
        </div>
      </div>
    );
  }

  const { priority, primaryFocus, supportingItems, positiveNote, snapshot } = focus;
  const style = PRIORITY_CARD[priority];

  // Days-overdue guard — rendered as a banner inside the card
  const isOverdue = daysSinceLastCheckin !== null && daysSinceLastCheckin >= 7;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${style.bg} ${style.border}`}>

      {/* ── Header ── */}
      <div className={`px-5 pt-4 pb-3 border-b ${style.border} ${style.headerBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
            <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${style.headerText}`}>
              This Week&apos;s Protocol Focus
            </p>
            <span className={`text-[9px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${style.headerText} border-current opacity-60`}>
              {style.label}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {snapshot.weeksAnalysed} week{snapshot.weeksAnalysed !== 1 ? 's' : ''} of data
          </span>
        </div>
      </div>

      <div className="px-5 pt-5 pb-5 space-y-4">

        {/* ── Overdue banner ── */}
        {isOverdue && (
          <div className="flex items-center gap-2.5 bg-amber-100 border border-amber-200 rounded-xl px-4 py-2.5">
            <span className="text-sm flex-shrink-0">📋</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">
                Check-in overdue — {daysSinceLastCheckin} days since last log
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Log this week to refresh your protocol focus.
              </p>
            </div>
            <Link
              href="/checkin"
              className="flex-shrink-0 text-[11px] font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 rounded-lg px-2.5 py-1 transition-colors"
            >
              Log →
            </Link>
          </div>
        )}

        {/* ── Primary focus ── */}
        <div>
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0 mt-0.5">{primaryFocus.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 leading-snug mb-1.5">
                {primaryFocus.title}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {primaryFocus.detail}
              </p>
            </div>
          </div>
        </div>

        {/* ── Metric pills — 3 supporting items ── */}
        {supportingItems.length > 0 && (
          <div className="space-y-2">
            {/* Protein adherence pill — always first if data exists */}
            {snapshot.proteinGrade !== 'UNKNOWN' && (
              <MetricPill
                icon="🥩"
                label="Protein"
                value={
                  snapshot.proteinAvgG !== null
                    ? `${Math.round(snapshot.proteinAvgG)}g / ${Math.round(snapshot.proteinTargetG)}g target (${Math.round(snapshot.proteinPct ?? 0)}%)`
                    : `Target: ${Math.round(snapshot.proteinTargetG)}g/day`
                }
                grade={snapshot.proteinGrade}
              />
            )}

            {/* Dynamic supporting items (workouts, hydration, energy, weight) */}
            {supportingItems.map((item, i) => {
              // Skip "Protein" from supporting items since we show it above
              if (item.title === 'Protein') return null;
              return (
                <MetricPill
                  key={i}
                  icon={item.icon}
                  label={item.title}
                  value={item.detail}
                  grade={
                    item.priority === 'MAINTENANCE' ? 'GOOD'    :
                    item.priority === 'NORMAL'      ? 'FAIR'    :
                    item.priority === 'HIGH'        ? 'POOR'    :
                    item.priority === 'URGENT'      ? 'POOR'    : 'UNKNOWN'
                  }
                />
              );
            })}
          </div>
        )}

        {/* ── Positive note ── */}
        {positiveNote && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3">
            <span className="text-sm flex-shrink-0">✅</span>
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">
              {positiveNote}
            </p>
          </div>
        )}

        {/* ── Footer CTA ── */}
        <div className="flex items-center justify-between pt-1">
          <Link
            href="/checkin"
            className="text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors"
          >
            {isOverdue ? '→ Log overdue check-in' : '→ Log this week\'s check-in'}
          </Link>
          <Link
            href="/dashboard/journey"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            View full journey
          </Link>
        </div>
      </div>
    </div>
  );
}
