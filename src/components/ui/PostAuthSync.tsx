'use client';

import { useEffect, useRef } from 'react';
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
 * It is safe to include on every dashboard render — it does nothing if the key
 * is absent or the user was already signed in when they ran the assessment.
 */
export default function PostAuthSync() {
  const { isSignedIn, isLoaded } = useUser();
  const router    = useRouter();
  const didSync   = useRef(false);   // prevents double-fire in StrictMode

  useEffect(() => {
    if (!isLoaded || !isSignedIn || didSync.current) return;

    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem('myoguard_pending_assessment');
    } catch {
      return; // sessionStorage unavailable
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
        sessionStorage.removeItem('myoguard_pending_assessment');
      });
  }, [isLoaded, isSignedIn, router]);

  return null;
}
