import Link from 'next/link';

/**
 * PhysicianNav
 *
 * Shared navigation bar for all authenticated /doctor/* pages.
 * Server component — no client boundary needed.
 *
 * Props:
 *  activePath   — caller passes the tab key that should appear active.
 *                 Use '/doctor/patients' for both the list and detail pages
 *                 so the Patients tab stays highlighted when drilling into a patient.
 *  displayName  — physician display name (PhysicianProfile.displayName preferred,
 *                 falls back to User.fullName). Non-clickable identity pill.
 */

type Props = {
  activePath:  string;
  displayName: string;
};

const NAV_ITEMS = [
  { label: 'Patients',          href: '/doctor/patients' },
  { label: 'Tools & Referrals', href: '/doctor/start'    },
] as const;

export default function PhysicianNav({ activePath, displayName }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 print:hidden">
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">

          {/* Wordmark — links to the physician home (patient list) */}
          <Link
            href="/doctor/patients"
            className="flex items-baseline gap-1 hover:opacity-75 transition-opacity flex-shrink-0"
          >
            <span className="text-base font-black text-slate-900 tracking-tight">
              Myo<span className="text-teal-600">Guard</span>
            </span>
            <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
          </Link>

          {/* Primary nav — desktop only; physician tool is desktop-first */}
          <nav className="hidden sm:flex items-center h-full">
            {NAV_ITEMS.map(({ label, href }) => {
              const isActive = activePath === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'relative inline-flex items-center h-full px-4 text-sm transition-colors',
                    isActive
                      ? 'font-semibold text-slate-900'
                      : 'font-medium text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  {label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-teal-500"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side — identity pill + sign out */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {displayName && (
              <span className="hidden sm:block text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 leading-none select-none">
                {displayName}
              </span>
            )}
            <Link
              href="/sign-out"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap"
            >
              Sign out
            </Link>
          </div>

        </div>
      </div>
    </header>
  );
}
