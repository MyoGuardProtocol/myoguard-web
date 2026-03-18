'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * AssessmentHeroPlaceholder
 *
 * Rendered by the dashboard server component when the user has no saved
 * assessment score yet. Prevents the misleading "No assessment yet" card
 * from appearing briefly when the user has actually just signed up with a
 * pending guest assessment that PostAuthSync is about to save.
 *
 * State machine:
 *
 *  'loading'  — SSR / pre-hydration: render skeleton (safe default)
 *  'syncing'  — sessionStorage has 'myoguard_pending_assessment': keep skeleton
 *               while PostAuthSync posts and router.refresh() is in flight
 *  'empty'    — sessionStorage is clear: show the real "No assessment yet" card
 *
 * Transition timing:
 *  - New user (no pending):  loading → empty in one microtask (imperceptible)
 *  - Post-sign-up user:      loading → syncing → [server refresh unmounts this]
 *
 * The skeleton intentionally matches the journey hero card dimensions so
 * there is no layout shift when the real card appears.
 */
export default function AssessmentHeroPlaceholder() {
  const [status, setStatus] = useState<'loading' | 'syncing' | 'empty'>('loading');

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('myoguard_pending_assessment');
      setStatus(pending ? 'syncing' : 'empty');
    } catch {
      // sessionStorage unavailable (private browsing) — skip straight to empty
      setStatus('empty');
    }
  }, []);

  // ── Skeleton ── shown while 'loading' or 'syncing' ──────────────────────
  if (status !== 'empty') {
    return (
      <div
        className="bg-slate-900 rounded-2xl p-5"
        role="status"
        aria-label="Loading your assessment score"
      >
        {/* Eyebrow */}
        <div className="h-2.5 w-32 bg-slate-700 rounded-full mb-4 animate-pulse" />

        {/* Score row */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="h-12 w-20 bg-slate-700 rounded-lg animate-pulse" />
          </div>
          <div className="h-7 w-24 bg-slate-700 rounded-full animate-pulse" />
        </div>

        {/* Progress track */}
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden mb-3">
          {/* Shimmer sweep */}
          <div className="h-full w-1/3 bg-slate-600 rounded-full animate-pulse" />
        </div>

        {/* CTA row */}
        <div className="flex items-center justify-between">
          <div className="h-3 w-36 bg-slate-700 rounded animate-pulse" />
          <div className="h-3 w-20 bg-slate-700 rounded animate-pulse" />
        </div>

        {/* Screen-reader hint for post-auth users */}
        {status === 'syncing' && (
          <p className="sr-only">
            Saving your assessment — your score will appear in a moment.
          </p>
        )}
      </div>
    );
  }

  // ── Empty state ── only shown when no pending sync exists ───────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
      <p className="text-2xl mb-2">📊</p>
      <p className="text-slate-700 font-semibold mb-1">No assessment yet</p>
      <p className="text-sm text-slate-500 mb-4 leading-relaxed">
        Complete the protocol calculator to generate your first MyoGuard Score.
      </p>
      <Link
        href="/"
        className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors inline-block"
      >
        Start Assessment →
      </Link>
    </div>
  );
}
