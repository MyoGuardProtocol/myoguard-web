'use client';

import { useEffect, useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';

interface PhysicianBoundaryProps {
  /** Where to redirect after the patient session is cleared */
  redirectTo: string;
}

/**
 * Detects an active PATIENT Clerk session on a physician-only surface.
 * If a PATIENT session is found, renders a full-page Midnight Silk boundary UI.
 * Returns null otherwise — physician and unauthenticated users pass through.
 *
 * Mount at the top of any physician-only page. Returns null (no output) while
 * the role check is in flight, so the parent's loading gate controls the spinner.
 */
export default function PhysicianBoundary({ redirectTo }: PhysicianBoundaryProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const [isPatient, setIsPatient] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setIsPatient(false); return; }

    fetch('/api/auth/role')
      .then(r => r.json() as Promise<{ role: string | null }>)
      .then(d => setIsPatient(d.role === 'PATIENT'))
      .catch(() => setIsPatient(false));
  }, [isLoaded, isSignedIn]);

  // Not yet resolved — parent's loading gate shows the spinner
  if (isPatient === null) return null;

  // Not a patient session — pass through
  if (!isPatient) return null;

  // PATIENT session detected — render hard boundary
  const handleSignOut = async () => {
    await signOut();
    window.location.href = redirectTo;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: '#080C14', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <span style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '-0.03em', color: '#F8FAFC' }}>
            Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          </span>
          <span style={{ color: '#475569', fontWeight: '300', fontSize: '13px', marginLeft: '4px' }}>
            Protocol
          </span>
        </div>

        {/* Card */}
        <div
          className="flex flex-col gap-6 text-center p-6 sm:p-10"
          style={{ background: '#0D1421', border: '1px solid #1A2744', borderRadius: '20px' }}
        >
          {/* Shield icon */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto flex-shrink-0"
            style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)' }}
          >
            <svg className="w-7 h-7" style={{ color: '#2DD4BF' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>

          {/* Heading + body */}
          <div className="flex flex-col gap-2">
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: '400', color: '#F1F5F9', lineHeight: '1.3' }}>
              Physician access required
            </h1>
            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.7' }}>
              You are currently signed in with a patient account. Physician registration
              requires a separate physician identity.
            </p>
          </div>

          {/* Info box */}
          <div
            className="text-left"
            style={{ background: '#060D1E', border: '1px solid #1A2744', borderRadius: '12px', padding: '16px' }}
          >
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              What this means
            </p>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6' }}>
              MyoGuard Protocol maintains strict separation between patient and physician
              accounts. Sign out of your patient session below to continue as a physician.
            </p>
          </div>

          {/* Primary CTA — sign out + continue */}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white py-3 rounded-xl text-sm font-semibold transition-colors text-center"
          >
            Sign out and continue as physician
          </button>

          {/* Secondary — return to patient dashboard */}
          <a
            href="/dashboard"
            style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}
            className="hover:underline"
          >
            ← Return to my patient dashboard
          </a>

        </div>
      </div>
    </div>
  );
}
