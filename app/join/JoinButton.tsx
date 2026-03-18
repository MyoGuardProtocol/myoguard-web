'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Stores the physician code in sessionStorage on mount (once per render),
 * then renders a "Sign Up & Link Account" CTA.
 *
 * sessionStorage key: 'myoguard_physician_code'
 * The onboarding form reads this key to pre-fill the physician code field.
 */
export default function JoinButton({ code }: { code: string }) {
  useEffect(() => {
    if (code) {
      sessionStorage.setItem('myoguard_physician_code', code);
    }
  }, [code]);

  return (
    <Link
      href="/sign-up?redirect_url=/onboarding"
      className="w-full inline-flex items-center justify-center gap-2 bg-teal-600 text-white text-base font-semibold px-8 py-4 rounded-2xl hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm"
    >
      Create Account & Link
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </Link>
  );
}
