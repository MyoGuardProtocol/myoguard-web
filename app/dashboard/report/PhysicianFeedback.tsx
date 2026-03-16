'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Impression  = 'stable' | 'monitoring' | 'intervention';
type FollowUpDay = 7 | 14 | 21 | 30;
type SaveState   = 'idle' | 'saving' | 'saved' | 'error';

export interface InitialFeedback {
  overallImpression: Impression | null;
  followUpDays:      FollowUpDay | null;
  note:              string;
  reviewedAt:        string; // ISO-8601 — serialised from Date on server
}

interface Props {
  assessmentId:    string;
  initialFeedback: InitialFeedback | null;
}

// Represents the last state that was successfully persisted to the DB.
// The print version always renders this — never transient editing state.
interface SavedSnapshot {
  impression: Impression | null;
  followUp:   FollowUpDay | null;
  note:       string;
  reviewedAt: string | null;
}

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
  // summary strip + print indicator colour
  stripDot:    string;
  stripText:   string;
  stripBg:     string;
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
    stripDot:   'bg-emerald-500',
    stripText:  'text-emerald-800',
    stripBg:    'bg-emerald-50',
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
    stripDot:   'bg-amber-500',
    stripText:  'text-amber-800',
    stripBg:    'bg-amber-50',
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
    stripDot:   'bg-red-500',
    stripText:  'text-red-800',
    stripBg:    'bg-red-50',
    printDot:   'bg-red-500',
  },
];

const FOLLOW_UP_DAYS: FollowUpDay[] = [7, 14, 21, 30];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day:   'numeric',
      month: 'short',
      year:  'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhysicianFeedback({ assessmentId, initialFeedback }: Props) {

  // ── Saved snapshot — the last confirmed-persisted state ───────────────────
  // Print version reads from here; never from live editing state.
  const [savedSnapshot, setSavedSnapshot] = useState<SavedSnapshot>({
    impression: initialFeedback?.overallImpression ?? null,
    followUp:   initialFeedback?.followUpDays      ?? null,
    note:       initialFeedback?.note              ?? '',
    reviewedAt: initialFeedback?.reviewedAt        ?? null,
  });

  // ── Live editing state ────────────────────────────────────────────────────
  const [impression, setImpression] = useState<Impression | null>(savedSnapshot.impression);
  const [followUp,   setFollowUp]   = useState<FollowUpDay | null>(savedSnapshot.followUp);
  const [note,       setNote]       = useState<string>(savedSnapshot.note);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dirty-state detection ─────────────────────────────────────────────────
  // True when any live value differs from what was last saved to DB.
  const isDirty =
    impression          !== savedSnapshot.impression ||
    followUp            !== savedSnapshot.followUp   ||
    note.trim()         !== savedSnapshot.note.trim();

  const hasValue = impression !== null || followUp !== null || note.trim().length > 0;

  // Save is only possible when there is at least one value AND something changed.
  const canSave = hasValue && isDirty;

  // ── Unsaved-changes protection ────────────────────────────────────────────
  // Native browser beforeunload fires when the user tries to leave or refresh
  // with uncommitted edits. The warning text is browser-controlled (cannot be
  // customised in modern browsers), but the dialog is shown.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && saveState !== 'saving') {
        e.preventDefault();
        // returnValue required by legacy browser spec; modern browsers ignore the value
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, saveState]);

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!canSave || saveState === 'saving') return;

    setSaveState('saving');

    // Clear any pending auto-reset timer from a previous saved state
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    try {
      const res = await fetch('/api/report/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          assessmentId,
          overallImpression: impression,
          followUpDays:      followUp,
          note:              note.trim() || null,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        console.error('[PhysicianFeedback] save failed', payload);
        setSaveState('error');
        return;
      }

      const data = await res.json() as { reviewedAt: string };

      // Update the saved snapshot — from this point isDirty becomes false
      setSavedSnapshot({
        impression,
        followUp,
        note:      note.trim(),
        reviewedAt: data.reviewedAt,
      });
      setSaveState('saved');

      // Auto-reset to idle after 4 s
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 4000);
    } catch (err) {
      console.error('[PhysicianFeedback] network error', err);
      setSaveState('error');
    }
  }, [assessmentId, canSave, followUp, impression, note, saveState]);

  // ── Derived display values ────────────────────────────────────────────────
  const savedImpressionOpt = IMPRESSION_OPTIONS.find(o => o.value === savedSnapshot.impression);

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
          <div className="flex items-center gap-2.5">
            {/* "Last reviewed" timestamp — only shown when a saved record exists */}
            {savedSnapshot.reviewedAt && (
              <div className="flex items-center gap-1 text-[9px] text-slate-500">
                {/* Clock icon */}
                <svg className="w-3 h-3 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                  <circle cx="6" cy="6" r="5" />
                  <path strokeLinecap="round" d="M6 3.5V6l1.5 1.5" />
                </svg>
                <span>Last reviewed {formatDate(savedSnapshot.reviewedAt)}</span>
              </div>
            )}
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] border border-slate-200 rounded px-2 py-0.5">
              For Official Use
            </span>
          </div>
        </div>

        {/* ── Saved-review summary strip ────────────────────────────────────── */}
        {/* Visible only when a review has been saved. Shows the persisted       */}
        {/* impression, follow-up, and date at a glance before the editable form.*/}
        {savedSnapshot.reviewedAt && (
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {/* Impression badge */}
              {savedImpressionOpt ? (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${savedImpressionOpt.stripBg}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${savedImpressionOpt.stripDot}`} />
                  <span className={`text-[10px] font-semibold ${savedImpressionOpt.stripText}`}>
                    {savedImpressionOpt.label}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 italic">Impression not recorded</span>
              )}

              {/* Divider */}
              <span className="text-slate-300 text-[10px] select-none" aria-hidden="true">·</span>

              {/* Follow-up */}
              {savedSnapshot.followUp ? (
                <span className="text-[10px] text-slate-600 font-medium">
                  Follow-up in {savedSnapshot.followUp} days
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 italic">Follow-up not recorded</span>
              )}

              {/* Divider */}
              <span className="text-slate-300 text-[10px] select-none" aria-hidden="true">·</span>

              {/* Reviewed date */}
              <span className="text-[10px] text-slate-500">
                {formatDate(savedSnapshot.reviewedAt)}
              </span>

              {/* Unsaved-changes indicator */}
              {isDirty && (
                <>
                  <span className="text-slate-300 text-[10px] select-none" aria-hidden="true">·</span>
                  <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                    {/* Pencil icon */}
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 1.5l2 2-6 6-2.5.5.5-2.5 6-6z" />
                    </svg>
                    Unsaved changes
                  </span>
                </>
              )}
            </div>
          </div>
        )}

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
              onClick={handleSave}
              disabled={!canSave || saveState === 'saving'}
              aria-disabled={!canSave || saveState === 'saving'}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                saveState === 'saving'
                  ? 'border-teal-200 bg-teal-50 text-teal-500 cursor-wait'
                  : saveState === 'saved'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : saveState === 'error'
                  ? 'border-red-300 bg-red-50 text-red-700 cursor-pointer hover:bg-red-100'
                  : canSave
                  ? 'border-teal-400 bg-teal-600 text-white hover:bg-teal-700 cursor-pointer'
                  : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none'
              }`}
            >
              {/* ── State-specific icon ── */}
              {saveState === 'saving' && (
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0 animate-spin"
                  fill="none" viewBox="0 0 14 14"
                  stroke="currentColor" strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" d="M7 1a6 6 0 1 1-4.243 1.757" />
                </svg>
              )}
              {saveState === 'saved' && (
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
                  fill="none" viewBox="0 0 14 14"
                  stroke="currentColor" strokeWidth={2.2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 7l4 4 6-6" />
                </svg>
              )}
              {saveState === 'error' && (
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
                  fill="none" viewBox="0 0 14 14"
                  stroke="currentColor" strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 2v5m0 2.5v.5M2.5 12h9L7 2 2.5 12z" />
                </svg>
              )}
              {saveState === 'idle' && !canSave && (
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
                  fill="none" viewBox="0 0 14 14"
                  stroke="currentColor" strokeWidth={1.8}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6V4.5a3 3 0 00-6 0V6M4 6h6a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 0110 13H4a1.5 1.5 0 01-1.5-1.5v-4A1.5 1.5 0 014 6z" />
                </svg>
              )}

              {/* ── Label ── */}
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved'  && 'Physician review saved'}
              {saveState === 'error'  && 'Save failed — retry'}
              {saveState === 'idle'   && 'Save Physician Review'}
            </button>

            {/* Contextual helper text */}
            {saveState === 'idle' && !canSave && !savedSnapshot.reviewedAt && (
              <p className="text-[10px] text-slate-400 leading-tight">
                Select an impression, follow-up timing, or add a note to enable saving
              </p>
            )}
            {saveState === 'idle' && !canSave && savedSnapshot.reviewedAt && (
              <p className="text-[10px] text-slate-400 leading-tight">
                No changes to save
              </p>
            )}
            {saveState === 'error' && (
              <p className="text-[10px] text-red-400 leading-tight">
                Could not reach the server.{' '}
                <button
                  type="button"
                  onClick={handleSave}
                  className="underline font-semibold hover:text-red-600 transition-colors"
                >
                  Try again →
                </button>
              </p>
            )}
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PRINT VERSION — hidden on screen, visible in print/PDF                */}
      {/*                                                                        */}
      {/* Always renders from savedSnapshot — the last confirmed-persisted      */}
      {/* state — so transient editing, saving, or error UI never appears in    */}
      {/* the printed/exported document.                                        */}
      {/*                                                                        */}
      {/* If no review has been saved, falls back to blank annotation lines so  */}
      {/* the physician can complete the review by hand after printing.         */}
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

          {/* Overall impression — reads from savedSnapshot */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
              Overall Impression
            </p>
            <div className="flex items-center gap-5">
              {IMPRESSION_OPTIONS.map(opt => {
                const isSelected = savedSnapshot.impression === opt.value;
                return (
                  <div key={opt.value} className="flex items-center gap-1.5">
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
              {savedSnapshot.impression === null && (
                <span className="text-[10px] text-slate-400 italic">Not recorded</span>
              )}
            </div>
          </div>

          {/* Recommended follow-up — reads from savedSnapshot */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
              Recommended Follow-Up
            </p>
            <div className="flex items-center gap-5">
              {FOLLOW_UP_DAYS.map(days => {
                const isSelected = savedSnapshot.followUp === days;
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
              {savedSnapshot.followUp === null && (
                <span className="text-[10px] text-slate-400 italic">Not recorded</span>
              )}
            </div>
          </div>

          {/* Physician note — reads from savedSnapshot */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Physician Note
            </p>
            {savedSnapshot.note.trim().length > 0 ? (
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                {savedSnapshot.note}
              </p>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="border-b border-slate-300 h-4 w-full" />
                <div className="border-b border-slate-300 h-4 w-full" />
                <div className="border-b border-slate-300 h-4 w-3/4" />
              </div>
            )}
          </div>

          {/* Signature + reviewed date */}
          <div className="flex items-end justify-between pt-2 border-t border-slate-200">
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-48 h-6" />
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Physician signature</p>
            </div>
            <div className="space-y-1 text-right">
              {savedSnapshot.reviewedAt ? (
                <>
                  <p className="text-[11px] font-semibold text-slate-700">
                    {formatDate(savedSnapshot.reviewedAt)}
                  </p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Date reviewed</p>
                </>
              ) : (
                <>
                  <div className="border-b border-slate-400 w-28 h-6" />
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Date reviewed</p>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
