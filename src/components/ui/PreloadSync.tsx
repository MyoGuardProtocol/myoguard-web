'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

/**
 * PreloadSync — invisible, mounts on the patient dashboard.
 *
 * Fires once after Clerk confirms the user is signed in. If the browser
 * holds an mgPreloadId cookie (set when the patient followed an activation
 * URL from a physician's Start Sheet), POSTs to /api/preload/inject which
 * validates, runs the assessment, marks the preload used, clears the cookie,
 * and returns the new assessmentId. On success redirects to /dashboard/report.
 *
 * On expired/already-used: cookie is cleared silently — no interruption.
 * Must not loop: guarded by didSync ref.
 */
export default function PreloadSync() {
  const { isSignedIn, isLoaded } = useUser();
  const router   = useRouter();
  const didSync  = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || didSync.current) return;
    didSync.current = true;

    fetch('/api/preload/inject', { method: 'POST' })
      .then(r => r.json())
      .then((data: { ok?: boolean; reason?: string }) => {
        if (data.ok) {
          router.push('/dashboard/report');
        }
        // reason: 'no_preload' | 'not_found' | 'already_used' | 'expired' → silent exit
      })
      .catch(() => {
        // Network error — swallow silently, never interrupt patient experience
      });
  }, [isLoaded, isSignedIn, router]);

  return null;
}
