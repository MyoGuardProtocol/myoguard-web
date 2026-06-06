'use client';
/**
 * PhysicianNavLinks — unified physician navigation for the doctor-facing experience.
 *
 * Client component: reads current pathname via usePathname() for active state.
 * Included by: /doctor/dashboard, /doctor/patients, /doctor/practice-intelligence
 *
 * Standard physician navigation (in order):
 *   Dashboard | My Patients | Start Sheet | Invite Patients | Practice Intelligence
 *
 * Mobile: overflowX auto on the nav container; links are nowrap so they scroll
 * rather than wrap or clip on narrow viewports.
 */
import Link            from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Dashboard',             href: '/doctor/dashboard' },
  { label: 'My Patients',           href: '/doctor/patients' },
  { label: 'Start Sheet',           href: '/doctor/start-sheet' },
  { label: 'Invite Patients',       href: '/doctor/start' },
  { label: 'Practice Intelligence', href: '/doctor/practice-intelligence' },
] as const;

export default function PhysicianNavLinks() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Physician navigation"
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '2px',
        flex:           1,
        justifyContent: 'center',
        overflowX:      'auto',
        scrollbarWidth: 'none', // Firefox
      }}
    >
      {NAV_ITEMS.map(({ label, href }) => {
        // Dashboard active only on exact match to avoid false positives
        // on /doctor/patients/*, /doctor/start-sheet/*, etc.
        const active =
          pathname === href ||
          (href !== '/doctor/dashboard' && pathname.startsWith(href + '/'));

        return (
          <Link
            key={href}
            href={href}
            style={{
              padding:        '6px 12px',
              borderRadius:   '8px',
              fontSize:       '0.8125rem',
              fontWeight:     500,
              textDecoration: 'none',
              whiteSpace:     'nowrap',
              flexShrink:     0,
              color:          active ? '#2DD4BF' : 'rgba(255,255,255,0.55)',
              background:     active ? 'rgba(45,212,191,0.08)' : 'transparent',
              transition:     'color 0.15s, background 0.15s',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
