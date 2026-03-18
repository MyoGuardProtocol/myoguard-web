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
 * While syncing, renders a subtle toast so the user knows something is
 * happening and the "No assessment yet" state isn't a dead-end.
 *
 * It is safe to include on every dashboard render — it does nothing if the
 * key is absent or the user was already signed in when they ran the assessment.
 */
export default function PostAuthSync() {
  const { isSignedIn, isLoaded } = useUser();
  const router   = useRouter();
  const didSync  = useRef(false);           // prevents double-fire in StrictMode
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || didSync.current) return;

    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem('myoguard_pending_assessment');
    } catch {
      return; // sessionStorage unavailable (private browsing edge case)
    }

    if (!pending) return;
    didSync.current = true;

    let formData: unknown;
    try {
      const parsed = JSON.parse(pending) as { formData: unknown };
      formData = parsed.formData;
    } catch {
      sessionStorage.removeItem('myoguard_pending_assessment');
      return;
    }

    setSyncing(true);

    fetch('/api/assessment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(formData),
    })
      .then(() => {
        sessionStorage.removeItem('myoguard_pending_assessment');
        // Refresh the server component so the newly saved assessment appears.
        router.refresh();
      })
      .catch(() => {
        // Silently discard — the user can always re-run the assessment.
        sessionStorage.removeItem('myoguard_pending_assessment');
        setSyncing(false);
      });
  }, [isLoaded, isSignedIn, router]);

  if (!syncing) return null;

  // Subtle fixed toast — visible only while the POST is in flight.
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
