'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import UserDropdown from './UserDropdown';

type HeaderProps = {
  /** Show the physician entry + auth nav in the top-right (calculator page) */
  showNav?: boolean;
};

/**
 * Shared brand header — used on public/landing pages only.
 *
 * Structure:
 *   1. Trust strip  — slim slate-900 bar, clinical tags (progressive reveal by breakpoint)
 *   2. Main row     — shield + wordmark lockup | nav actions
 *
 * Nav layout (showNav=true):
 *   Signed out — xs   : "I'm a Physician" + "Sign In"
 *   Signed out — sm+  : "I'm a Physician" + "My Dashboard" + "Sign In"
 *   Signed in  — any  : "I'm a Physician" + avatar dropdown (no name shown)
 *
 * During Clerk's load phase the signed-out state is rendered to avoid
 * layout shift — most visitors are guests, and the swap is instant.
 */
export default function Header({ showNav = false }: HeaderProps) {
  const { isSignedIn, isLoaded } = useUser();

  // Route the logo to /dashboard for signed-in users; home for guests.
  // We wait for Clerk to load before switching so there's no href flash.
  const logoHref = isLoaded && isSignedIn ? '/dashboard' : '/';

  return (
    <header className="bg-white border-b border-slate-200 print:hidden">

      {/* ── Institutional trust strip — navy background, teal accents ── */}
      <div className="bg-slate-900 px-6 py-1.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Always visible */}
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <svg className="w-3 h-3 text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6l3 3 5-5" />
              </svg>
              Physician-Formulated
            </span>
            {/* Hidden on xs, visible on sm+ */}
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <svg className="w-3 h-3 text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6l3 3 5-5" />
              </svg>
              Evidence-Based Protocol
            </span>
            {/* Hidden on xs and sm, visible on md+ */}
            <span className="hidden md:flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <svg className="w-3 h-3 text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6l3 3 5-5" />
              </svg>
              GLP-1 Specialist Tool
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:block">myoguard.health</span>
        </div>
      </div>

      {/* ── Main header row ── */}
      <div className="px-6 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">

          {/* Brand lockup — shield icon + wordmark */}
          <Link href={logoHref} className="flex items-center gap-2.5 min-w-0 group">
            {/* Shield mark */}
            <svg
              className="w-7 h-7 text-teal-600 flex-shrink-0 group-hover:text-teal-700 transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2L3.5 5.5v6c0 5.25 3.83 10.16 8.5 11.5C16.67 21.66 20.5 16.75 20.5 11.5v-6L12 2z" />
              <path d="M8.5 12l2.5 2.5 5-5" />
            </svg>
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
            </div>
          </Link>

          {/* Right side — nav actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
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
