'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

/**
 * PostAuthSync — mounts invisibly on the dashboard.
 *
 * When a guest user completes the assessment and then signs in or signs up,
 * their formData is sitting in sessionStorage under "myoguard_pending_assessment".
 * This component detects that, POSTs it to /api/assessment, clears the key,
 * then refreshes the dashboard so the newly-saved assessment is visible.
 *
 * On failure the sessionStorage key is PRESERVED so the user can retry.
 * A visible error state is shown with a manual retry button.
 *
 * It is safe to include on every dashboard render — it does nothing if the
 * key is absent or the user was already signed in when they ran the assessment.
 */
export default function PostAuthSync() {
  const { isSignedIn, isLoaded } = useUser();
  const router   = useRouter();
  const didSync  = useRef(false);           // prevents double-fire in StrictMode
  const [syncing, setSyncing] = useState(false);
  const [failed,  setFailed]  = useState(false);

  function attemptSync() {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem('myoguard_pending_assessment');
    } catch {
      return; // sessionStorage unavailable (private browsing edge case)
    }

    if (!pending) return;

    let formData: unknown;
    try {
      const parsed = JSON.parse(pending) as { formData: unknown };
      formData = parsed.formData;
    } catch {
      // Corrupt data — nothing we can do; clear it
      sessionStorage.removeItem('myoguard_pending_assessment');
      return;
    }

    setSyncing(true);
    setFailed(false);

    fetch('/api/assessment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(formData),
    })
      .then(async (res) => {
        if (!res.ok) {
          // Server returned an error — log it but keep sessionStorage so the user can retry
          const text = await res.text().catch(() => '(no body)');
          console.error(
            `[PostAuthSync] /api/assessment returned ${res.status}:`,
            text,
          );
          setSyncing(false);
          setFailed(true);
          return;
        }
        // Success — clear state and pending data, then refresh dashboard data.
        // setSyncing(false) must come BEFORE router.refresh():
        // router.refresh() returns void and does not unmount this component,
        // so without this call syncing stays true and the spinner hangs forever.
        sessionStorage.removeItem('myoguard_pending_assessment');
        setSyncing(false);
        router.refresh();
      })
      .catch((err) => {
        // Network error — keep sessionStorage intact so the user can retry
        console.error('[PostAuthSync] fetch failed:', err);
        setSyncing(false);
        setFailed(true);
      });
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn || didSync.current) return;
    didSync.current = true;
    attemptSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  // Nothing to show — no pending sync in progress or failed
  if (!syncing && !failed) return null;

  if (failed) {
    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg">
        <span>⚠ Could not save your assessment.</span>
        <button
          onClick={() => {
            didSync.current = false; // allow re-attempt
            attemptSync();
          }}
          className="underline hover:no-underline text-red-200 hover:text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Syncing in progress — subtle spinner toast
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
      {/* Spinner */}
      <svg
        className="w-3.5 h-3.5 animate-spin text-teal-400 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      Saving your assessment…
    </div>
  );
}
