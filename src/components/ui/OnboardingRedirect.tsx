'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'loading' | 'complete' | 'incomplete';

/**
 * OnboardingRedirect
 *
 * Mounts invisibly on the dashboard. Confirms onboarding status via a
 * dedicated backend fetch before redirecting — avoids acting on stale
 * server-rendered props when the DB write and page render race each other.
 *
 * Safe guards:
 *  - Server prop `hasProfile` short-circuits the fetch when profile is
 *    already confirmed (avoids a round-trip on every dashboard visit)
 *  - Backend fetch is the authoritative gate: only redirects on explicit false
 *  - On fetch error, fails safe (treats as complete — no redirect)
 *  - AbortController cancels the in-flight fetch if the component unmounts
 *  - didRedirect ref prevents double-fire in React StrictMode
 *  - router.replace() so back-button does not loop to dashboard
 */
export default function OnboardingRedirect({ hasProfile }: { hasProfile: boolean }) {
  const router       = useRouter();
  const didRedirect  = useRef(false);
  // If server already confirmed a profile exists, skip the fetch entirely.
  const [status, setStatus] = useState<Status>(hasProfile ? 'complete' : 'loading');

  useEffect(() => {
    // Server prop is the fast path — profile confirmed, nothing to do.
    if (hasProfile) return;

    const controller = new AbortController();

    fetch('/api/user/onboarding-status', { signal: controller.signal })
      .then(r => r.json())
      .then((data: { hasCompletedOnboarding: boolean }) => {
        setStatus(data.hasCompletedOnboarding ? 'complete' : 'incomplete');
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Network or parse error — fail safe, do not redirect.
        console.error('[OnboardingRedirect] status fetch failed — failing safe, skipping redirect', err);
        setStatus('complete');
      });

    return () => controller.abort();
  }, [hasProfile]);

  useEffect(() => {
    if (status !== 'incomplete' || didRedirect.current) return;
    didRedirect.current = true;
    router.replace('/onboarding');
  }, [status, router]);

  return null;
}
