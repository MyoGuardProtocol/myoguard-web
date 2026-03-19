'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import UserDropdown from './UserDropdown';

type HeaderProps = {
  physicianName?: string | null;
  /** Show the physician entry + auth nav in the top-right (calculator page) */
  showNav?: boolean;
};

/**
 * Shared brand header.
 *
 * Structure:
 *   1. Institutional trust strip  — slim teal bar with clinical positioning tags
 *   2. Main header row            — logo lockup | physician badge | nav actions
 *
 * Nav layout (showNav=true):
 *   Signed out — Mobile  : "I'm a Physician" + "Sign In"
 *   Signed out — sm+     : "I'm a Physician" + "My Dashboard" + "Sign In"
 *   Signed in  — any     : "I'm a Physician" + <UserDropdown> (avatar + name)
 *
 * During Clerk's load phase the signed-out links are shown to avoid layout
 * shift (most visitors are not signed in; the swap is instantaneous once
 * isLoaded=true).
 */
export default function Header({ physicianName, showNav = false }: HeaderProps) {
  const { isSignedIn, isLoaded } = useUser();
  return (
    <header className="bg-white border-b border-slate-200 print:hidden">

      {/* ── Institutional trust strip ── */}
      <div className="bg-teal-700 px-6 py-1.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {[
              'Physician-Formulated',
              'Evidence-Based Protocol',
              'GLP-1 Specialist Tool',
            ].map((tag, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-teal-100">
                <svg className="w-3 h-3 text-teal-300 flex-shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5" />
                </svg>
                {tag}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-teal-300 font-mono hidden sm:block">myoguard.health</span>
        </div>
      </div>

      {/* ── Main header row ── */}
      <div className="px-6 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">

          {/* Brand lockup */}
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  Myo<span className="text-teal-600">Guard</span>
                </span>
                <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide hidden sm:block">
                Protect Your Muscle During GLP-1 Therapy
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide hidden md:block">
                Preserve lean mass, optimise outcomes, and stay strong while losing weight.
              </p>
            </div>
          </div>

          {/* Right side — physician badge + nav */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Physician attribution badge — desktop only (saves space on mobile) */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
              <span className="text-xs text-slate-600 font-medium">
                {physicianName ?? (process.env.NEXT_PUBLIC_DEFAULT_PHYSICIAN_NAME ?? 'Dr. Onyeka Okpala, MD')}
              </span>
            </div>

            {showNav && (
              <>
                {/* ── Physician entry point ──────────────────────────────────────
                    Always shows full "I'm a Physician" label — including on mobile.
                ─────────────────────────────────────────────────────────────── */}
                <Link
                  href="/doctor"
                  className="inline-flex items-center gap-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 font-medium hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-colors whitespace-nowrap"
                >
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  I&apos;m a Physician
                </Link>

                {/* ── Auth-aware right side ───────────────────────────────────
                    Signed in  → avatar dropdown (UserDropdown)
                    Signed out → "My Dashboard" (sm+) + "Sign In"
                    Loading    → signed-out state (no layout shift for most visitors)
                ─────────────────────────────────────────────────────────────── */}
                {isLoaded && isSignedIn ? (
                  <UserDropdown />
                ) : (
                  <>
                    {/* Hidden on xs — only useful once signed in */}
                    <Link
                      href="/dashboard"
                      className="hidden sm:inline-flex text-xs bg-teal-600 text-white rounded-lg px-3.5 py-1.5 font-semibold hover:bg-teal-700 transition-colors whitespace-nowrap"
                    >
                      My Dashboard
                    </Link>

                    <Link
                      href="/sign-in"
                      className="text-xs border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      Sign In
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
