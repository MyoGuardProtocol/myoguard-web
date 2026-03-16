'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Impression  = 'stable' | 'monitoring' | 'intervention';
type FollowUpDay = 7 | 14 | 21 | 30;

// ─── Impression option definitions ───────────────────────────────────────────

interface ImpressionOption {
  value:       Impression;
  label:       string;
  description: string;
  // idle styles
  idleBorder:  string;
  // selected styles
  selBorder:   string;
  selBg:       string;
  selText:     string;
  selDot:      string;
  selNoteBg:   string;
  // print indicator colour
  printDot:    string;
}

const IMPRESSION_OPTIONS: ImpressionOption[] = [
  {
    value:      'stable',
    label:      'Stable',
    description:'Patient on track; continue current protocol.',
    idleBorder: 'border-slate-200 hover:border-slate-300',
    selBorder:  'border-emerald-400',
    selBg:      'bg-emerald-50',
    selText:    'text-emerald-800',
    selDot:     'bg-emerald-500',
    selNoteBg:  'bg-emerald-100',
    printDot:   'bg-emerald-500',
  },
  {
    value:      'monitoring',
    label:      'Needs Monitoring',
    description:'Concerning signals present; close follow-up warranted.',
    idleBorder: 'border-slate-200 hover:border-slate-300',
    selBorder:  'border-amber-400',
    selBg:      'bg-amber-50',
    selText:    'text-amber-800',
    selDot:     'bg-amber-500',
    selNoteBg:  'bg-amber-100',
    printDot:   'bg-amber-500',
  },
  {
    value:      'intervention',
    label:      'Requires Intervention',
    description:'Immediate clinical action indicated at this review.',
    idleBorder: 'border-slate-200 hover:border-slate-300',
    selBorder:  'border-red-400',
    selBg:      'bg-red-50',
    selText:    'text-red-800',
    selDot:     'bg-red-500',
    selNoteBg:  'bg-red-100',
    printDot:   'bg-red-500',
  },
];

const FOLLOW_UP_DAYS: FollowUpDay[] = [7, 14, 21, 30];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhysicianFeedback() {
  const [impression, setImpression] = useState<Impression | null>(null);
  const [followUp,   setFollowUp]   = useState<FollowUpDay | null>(null);
  const [note,       setNote]       = useState('');

  const selectedOption = IMPRESSION_OPTIONS.find(o => o.value === impression);

  // ── Determine save-button intent (disabled until at least one field is touched)
  const isDirty = impression !== null || followUp !== null || note.trim().length > 0;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SCREEN VERSION — hidden in print/PDF                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="print:hidden border border-slate-200 rounded-xl overflow-hidden">

        {/* ── Panel header ── */}
        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-5 py-3.5">
          <div>
            <p className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em]">
              Physician Review
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Record your clinical impression of this report
            </p>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] border border-slate-200 rounded px-2 py-0.5">
            For Official Use
          </span>
        </div>

        <div className="px-5 py-5 space-y-6">

          {/* ── 1. Overall impression ── */}
          <fieldset>
            <legend className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
              Overall Impression
            </legend>

            {/*
              Custom button pattern — avoids iOS Safari -webkit-appearance stripping
              that makes native radio inputs invisible on mobile.
            */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {IMPRESSION_OPTIONS.map(opt => {
                const isSelected = impression === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setImpression(isSelected ? null : opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      isSelected
                        ? `${opt.selBorder} ${opt.selBg}`
                        : `bg-white ${opt.idleBorder}`
                    }`}
                  >
                    {/* Indicator row */}
                    <div className="flex items-center gap-2 mb-1.5">
                      {/* Radio circle */}
                      <span
                        aria-hidden="true"
                        className={`flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? `${opt.selDot} border-transparent`
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                        )}
                      </span>
                      <span className={`text-xs font-bold ${isSelected ? opt.selText : 'text-slate-700'}`}>
                        {opt.label}
                      </span>
                    </div>
                    <p className={`text-[10px] leading-snug ml-5.5 ${isSelected ? opt.selText : 'text-slate-400'}`}>
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ── 2. Recommended follow-up timing ── */}
          <fieldset>
            <legend className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
              Recommended Follow-Up
            </legend>
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UP_DAYS.map(days => {
                const isSelected = followUp === days;
                return (
                  <button
                    key={days}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setFollowUp(isSelected ? null : days)}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'border-teal-400 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {days} days
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ── 3. Physician note ── */}
          <div>
            <label
              htmlFor="physician-note"
              className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2"
            >
              Physician Note
              <span className="ml-1.5 normal-case font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="physician-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Clinical observations, medication notes, referral decisions, or follow-up instructions…"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300 resize-none leading-relaxed"
              style={{ WebkitAppearance: 'none' }}
            />
          </div>

          {/* ── 4. Save action ── */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed select-none"
            >
              {/* Lock icon */}
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 14 14" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6V4.5a3 3 0 00-6 0V6M4 6h6a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 0110 13H4a1.5 1.5 0 01-1.5-1.5v-4A1.5 1.5 0 014 6z" />
              </svg>
              Save Physician Review
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Persistence wiring comes next
            </p>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PRINT VERSION — hidden on screen, visible in print/PDF                */}
      {/* Renders either the recorded values (if any field touched) or a blank   */}
      {/* annotation block for the physician to complete by hand.               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block border border-slate-300 rounded-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-5 py-3">
          <p className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em]">
            Physician Review
          </p>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] border border-slate-200 rounded px-2 py-0.5">
            For Official Use
          </span>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Overall impression */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
              Overall Impression
            </p>
            <div className="flex items-center gap-5">
              {IMPRESSION_OPTIONS.map(opt => {
                const isSelected = impression === opt.value;
                return (
                  <div key={opt.value} className="flex items-center gap-1.5">
                    {/* Filled or hollow circle */}
                    <span
                      className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                        isSelected
                          ? `${opt.printDot} border-transparent`
                          : 'bg-white border-slate-400'
                      }`}
                    />
                    <span className={`text-[11px] font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                      {opt.label}
                    </span>
                  </div>
                );
              })}
              {impression === null && (
                <span className="text-[10px] text-slate-400 italic">Not recorded</span>
              )}
            </div>
          </div>

          {/* Recommended follow-up */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
              Recommended Follow-Up
            </p>
            <div className="flex items-center gap-5">
              {FOLLOW_UP_DAYS.map(days => {
                const isSelected = followUp === days;
                return (
                  <div key={days} className="flex items-center gap-1.5">
                    <span
                      className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                        isSelected
                          ? 'bg-teal-600 border-transparent'
                          : 'bg-white border-slate-400'
                      }`}
                    />
                    <span className={`text-[11px] font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                      {days} days
                    </span>
                  </div>
                );
              })}
              {followUp === null && (
                <span className="text-[10px] text-slate-400 italic">Not recorded</span>
              )}
            </div>
          </div>

          {/* Physician note */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Physician Note
            </p>
            {note.trim().length > 0 ? (
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                {note}
              </p>
            ) : (
              /* Blank annotation lines for hand-writing */
              <div className="space-y-2 pt-1">
                <div className="border-b border-slate-300 h-4 w-full" />
                <div className="border-b border-slate-300 h-4 w-full" />
                <div className="border-b border-slate-300 h-4 w-3/4" />
              </div>
            )}
          </div>

          {/* Signature line */}
          <div className="flex items-end justify-between pt-2 border-t border-slate-200">
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-48 h-6" />
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Physician signature</p>
            </div>
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-28 h-6" />
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Date reviewed</p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
