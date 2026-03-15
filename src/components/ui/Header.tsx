'use client';

import Link from 'next/link';

type HeaderProps = {
  physicianName?: string | null;
  /** Show the My Dashboard + Sign In nav links (shown on the calculator page) */
  showNav?: boolean;
};

/**
 * Shared brand header.
 * physicianName overrides the default "Dr. B, MBBS" badge when a referral
 * slug is active. showNav adds the dashboard/sign-in nav links that appear
 * on the public calculator page.
 */
export default function Header({ physicianName, showNav = false }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">
            Myo<span className="text-teal-600">Guard</span> Protocol
          </span>
          <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 font-medium">
            {physicianName ?? 'Dr. B, MBBS'}
          </span>
          {showNav && (
            <>
              <Link href="/dashboard" className="text-xs bg-teal-600 text-white rounded-full px-3 py-1 font-medium hover:bg-teal-700 transition-colors">
                My Dashboard
              </Link>
              <Link href="/sign-in" className="text-xs border border-slate-200 text-slate-600 rounded-full px-3 py-1 font-medium hover:bg-slate-50 transition-colors">
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
