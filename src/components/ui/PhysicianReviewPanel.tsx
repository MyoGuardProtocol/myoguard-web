'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExistingReview = {
  overallImpression: string | null;
  followUpDays:      number | null;
  note:              string | null;
  reviewedAt:        string; // ISO — serialized from Date by the server page
};

type Props = {
  assessmentId: string;
  existing:     ExistingReview | null;
};

// ─── Option definitions ───────────────────────────────────────────────────────

const IMPRESSION_OPTIONS = [
  {
    value:       'stable',
    label:       'Stable',
    activeClass: 'bg-emerald-50 border-emerald-400 text-emerald-800',
  },
  {
    value:       'monitoring',
    label:       'Monitoring',
    activeClass: 'bg-amber-50 border-amber-400 text-amber-800',
  },
  {
    value:       'intervention',
    label:       'Needs Intervention',
    activeClass: 'bg-red-50 border-red-400 text-red-800',
  },
] as const;

const FOLLOW_UP_OPTIONS = [
  { value: 7,  label: '1 week'  },
  { value: 14, label: '2 weeks' },
  { value: 21, label: '3 weeks' },
  { value: 30, label: '1 month' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhysicianReviewPanel({ assessmentId, existing }: Props) {
  const [impression, setImpression] = useState<string>(existing?.overallImpression ?? '');
  const [followUp,   setFollowUp]   = useState<number | null>(existing?.followUpDays ?? null);
  const [note,       setNote]       = useState<string>(existing?.note ?? '');

  type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'missing-impression';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  // Tracks the most-recently-saved timestamp — updated optimistically on success
  const [savedAt, setSavedAt] = useState<string | null>(existing?.reviewedAt ?? null);

  const hasExisting = existing !== null || saveStatus === 'saved';

  async function handleSave() {
    if (!impression) {
      setSaveStatus('missing-impression');
      return;
    }
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/physician/review', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId,
          overallImpression: impression,
          ...(followUp != null ? { followUpDays: followUp } : {}),
          ...(note.trim()      ? { note: note.trim() }      : {}),
        }),
      });

      if (!res.ok) throw new Error('save failed');

      const now = new Date().toISOString();
      setSavedAt(now);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Physician Review
        </p>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* "Last reviewed" line — shown when a review exists (prior or just saved) */}
      <div className="mb-4">
        {savedAt ? (
          <p className="text-[11px] text-slate-400">
            Last reviewed {formatDate(savedAt)}
          </p>
        ) : (
          // Reserve the line height so the panel doesn't shift on first save
          <p className="text-[11px] text-transparent select-none" aria-hidden>—</p>
        )}
      </div>

      {/* ── Clinical Impression ───────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-600 mb-2">Clinical Impression</p>
        <div className="flex gap-2 flex-wrap">
          {IMPRESSION_OPTIONS.map(opt => {
            const isActive = impression === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setImpression(opt.value); setSaveStatus('idle'); }}
                className={[
                  'text-xs font-semibold px-3.5 py-2 rounded-lg border transition-colors',
                  isActive
                    ? opt.activeClass
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700',
                ].join(' ')}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Follow-up Interval ───────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-600 mb-2">
          Follow-up Interval
          <span className="text-slate-400 font-normal ml-1">(optional)</span>
        </p>
        <div className="flex gap-2 flex-wrap">
          {FOLLOW_UP_OPTIONS.map(opt => {
            const isActive = followUp === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                // Toggle: clicking the active option clears it
                onClick={() => { setFollowUp(isActive ? null : opt.value); setSaveStatus('idle'); }}
                className={[
                  'text-xs font-semibold px-3.5 py-2 rounded-lg border transition-colors',
                  isActive
                    ? 'bg-teal-50 border-teal-400 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700',
                ].join(' ')}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Clinical Note ─────────────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-600 mb-2">
          Clinical Note
          <span className="text-slate-400 font-normal ml-1">(optional)</span>
        </p>
        <textarea
          rows={3}
          value={note}
          onChange={e => { setNote(e.target.value); setSaveStatus('idle'); }}
          placeholder="Clinical observations, recommendations, or follow-up instructions…"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-none"
        />
      </div>

      {/* ── Save row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          disabled={saveStatus === 'saving'}
          onClick={handleSave}
          className="text-sm font-semibold bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 active:bg-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveStatus === 'saving'
            ? 'Saving…'
            : hasExisting
            ? 'Update Review'
            : 'Save Review'}
        </button>

        {saveStatus === 'saved' && savedAt && (
          <p className="text-xs text-emerald-600 font-medium">
            Saved {formatDate(savedAt)}
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="text-xs text-red-600 font-medium">
            Could not save. Please try again.
          </p>
        )}
        {saveStatus === 'missing-impression' && (
          <p className="text-xs text-amber-600 font-medium">
            Select a clinical impression to save.
          </p>
        )}
      </div>

    </div>
  );
}
