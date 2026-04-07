'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

/**
 * ReferralSync — invisible, mounts on the patient dashboard.
 *
 * Fires once after sign-in. If the browser holds a mgReferredBy cookie
 * (set when the patient scanned a physician's QR code), POSTs to
 * /api/referral/link which links their User row to that physician
 * and clears the cookie. Silent on failure — referral linking is
 * best-effort and should never interrupt the patient experience.
 */
export default function ReferralSync() {
  const { isSignedIn, isLoaded } = useUser();
  const didSync = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || didSync.current) return;
    didSync.current = true;

    fetch('/api/referral/link', { method: 'POST' }).catch(() => {
      // Best-effort — swallow network errors silently
    });
  }, [isLoaded, isSignedIn]);

  return null;
}
