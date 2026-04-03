'use client';

/**
 * DashboardHeader — sticky top bar for all authenticated app pages.
 *
 * Spec:
 *   Height  : 64px  (h-16)
 *   Padding : px-6 mobile → px-10 at lg
 *   Left    : Shield (28 px) + "MyoGuard" wordmark + tagline (sm+)
 *   Right   : optional plan indicator + avatar dropdown
 *   Sticky  : top-0 z-50, bg-white, border-b border-gray-200
 *
 * Rules:
 *   • Never shows "Protocol" suffix in the wordmark
 *   • Never shows doctor name or user name
 *   • print:hidden — excluded from PDF / print output
 *
 * Usage:
 *   // Dashboard (knows subscription status from DB)
 *   <DashboardHeader plan={isPremium ? 'premium' : 'free'} />
 *
 *   // All other inner pages (subscription status not fetched)
 *   <DashboardHeader />
 */

import Link from 'next/link';
import UserDropdown from './UserDropdown';

type Plan = 'free' | 'premium' | null;

type DashboardHeaderProps = {
  /**
   * Controls the right-side plan indicator.
   *   'free'    → ghost "Upgrade" button (POST → /api/stripe/checkout)
   *   'premium' → subtle ⭐ Premium badge
   *   null      → nothing shown (default — pages that don't fetch subscription)
   */
  plan?: Plan;
};

export default function DashboardHeader({ plan = null }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-16 bg-white border-b border-gray-200 print:hidden">
      <div className="h-full px-6 lg:px-10 flex items-center justify-between">

        {/* ── Brand lockup ──────────────────────────────────────────────────── */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 group min-w-0"
          aria-label="MyoGuard — go to dashboard"
        >
          {/* Shield mark — 28 px / w-7 h-7 */}
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

          {/* Wordmark + tagline */}
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900 tracking-tight leading-tight">
              Myo<span className="text-teal-600">Guard</span>
            </p>
            {/* Tagline — hidden on xs to keep header single-line on narrow screens */}
            <p className="hidden sm:block text-xs text-gray-500 mt-0.5 leading-tight whitespace-nowrap">
              Physician-Formulated · Data-Driven Muscle Protection
            </p>
          </div>
        </Link>

        {/* ── Right: plan indicator + avatar ────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-shrink-0">

          {/* Premium badge — non-interactive, reassures the user of their plan */}
          {plan === 'premium' && (
            <span className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 select-none whitespace-nowrap">
              ⭐ Premium
            </span>
          )}

          {/* Upgrade button — ghost/outline, subtle; triggers Stripe checkout */}
          {plan === 'free' && (
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-4 py-1.5 hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap"
              >
                Upgrade
              </button>
            </form>
          )}

          {/* Avatar dropdown — returns null when Clerk is loading or user is signed out */}
          <UserDropdown />

        </div>
      </div>
    </header>
  );
}
