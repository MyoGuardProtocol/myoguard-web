'use client';

import Link from 'next/link';

type HeaderProps = {
  physicianName?: string | null;
  /** Show the My Dashboard + Sign In nav links (shown on the calculator page) */
  showNav?: boolean;
};

/**
 * Shared brand header.
 *
 * Structure:
 *   1. Institutional trust strip  — slim teal bar with clinical positioning tags
 *   2. Main header row            — logo lockup | physician badge | nav actions
 *
 * physicianName overrides the default "Dr. B, MBBS" badge when a referral
 * slug is active. showNav adds the dashboard/sign-in nav links that appear
 * on the public calculator page.
 */
export default function Header({ physicianName, showNav = false }: HeaderProps) {
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
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">

          {/* Brand lockup */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  Myo<span className="text-teal-600">Guard</span>
                </span>
                <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide">
                Protect Your Muscle During GLP-1 Therapy
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide">
                Preserve lean mass, optimise outcomes, and stay strong while losing weight.
              </p>
            </div>
          </div>

          {/* Right side — physician badge + nav */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Physician attribution badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
              <span className="text-xs text-slate-600 font-medium">
                {physicianName ?? (process.env.NEXT_PUBLIC_DEFAULT_PHYSICIAN_NAME ?? 'Dr. Onyeka Okpala, MD')}
              </span>
            </div>

            {showNav && (
              <>
                <Link
                  href="/dashboard"
                  className="text-xs bg-teal-600 text-white rounded-lg px-3.5 py-1.5 font-semibold hover:bg-teal-700 transition-colors"
                >
                  My Dashboard
                </Link>
                <Link
                  href="/sign-in"
                  className="text-xs border border-slate-200 text-slate-600 rounded-lg px-3.5 py-1.5 font-medium hover:bg-slate-50 transition-colors"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
