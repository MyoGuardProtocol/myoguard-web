'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

// ── Props are fully optional so existing call sites that pass activePath +
// displayName continue to work, and new call sites with no props also work.
type PhysicianNavProps = {
  activePath?:  string;   // legacy prop — overrides pathname detection if supplied
  displayName?: string;   // legacy prop — overrides Clerk name if supplied
};

const NAV_LINKS = [
  { href: '/doctor/dashboard', label: 'Dashboard' },
  { href: '/doctor/patients',  label: 'Patients'  },
  { href: '/doctor/start',     label: 'Start Sheet'},
];

export default function PhysicianNav({ activePath, displayName }: PhysicianNavProps = {}) {
  const pathname = usePathname();
  const { user } = useUser();

  // Use the explicit activePath prop when supplied (legacy pages), otherwise
  // fall back to the URL from usePathname() for new pages that don't pass it.
  const currentPath = activePath ?? pathname;

  // Display name priority: explicit prop → Clerk full name → Clerk email → fallback
  const nameToShow =
    displayName ??
    user?.fullName ??
    user?.emailAddresses[0]?.emailAddress ??
    'Physician';

  const initial = nameToShow.charAt(0).toUpperCase();

  return (
    <nav
      style={{
        background:   '#060D1E',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position:     'sticky',
        top:          0,
        zIndex:       50,
      }}
    >
      <div
        style={{
          maxWidth:   '64rem',
          margin:     '0 auto',
          padding:    '0 20px',
          display:    'flex',
          alignItems: 'center',
          height:     56,
          gap:        28,
        }}
      >
        {/* Wordmark */}
        <Link href="/doctor/patients" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', color: '#F8FAFC' }}>
            Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          </span>
          <span
            style={{
              marginLeft:    6,
              fontSize:      10,
              fontWeight:    400,
              color:         'rgba(255,255,255,0.35)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
            }}
          >
            Physician
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {NAV_LINKS.map(({ href, label }) => {
            const active = currentPath === href || currentPath.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                style={{
                  textDecoration: 'none',
                  padding:        '6px 12px',
                  borderRadius:   6,
                  fontSize:       13,
                  fontWeight:     active ? 600 : 400,
                  color:          active ? '#2DD4BF' : 'rgba(255,255,255,0.55)',
                  background:     active ? 'rgba(45,212,191,0.08)' : 'transparent',
                  position:       'relative' as const,
                  transition:     'color 0.15s, background 0.15s',
                }}
              >
                {label}
                {active && (
                  <span
                    style={{
                      position:     'absolute',
                      bottom:       -1,
                      left:         12,
                      right:        12,
                      height:       2,
                      background:   '#2DD4BF',
                      borderRadius: 1,
                      boxShadow:    '0 0 8px rgba(45,212,191,0.5)',
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Identity pill */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            padding:        '5px 12px',
            borderRadius:   99,
            background:     'rgba(255,255,255,0.06)',
            border:         '1px solid rgba(255,255,255,0.08)',
            flexShrink:     0,
          }}
        >
          <div
            style={{
              width:           28,
              height:          28,
              borderRadius:    '50%',
              background:      'linear-gradient(135deg,#2DD4BF,#0D9488)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        11,
              fontWeight:      800,
              color:           '#fff',
              flexShrink:      0,
            }}
          >
            {initial}
          </div>
          <span
            style={{
              fontSize:      12,
              color:         'rgba(255,255,255,0.7)',
              maxWidth:      140,
              overflow:      'hidden',
              textOverflow:  'ellipsis',
              whiteSpace:    'nowrap' as const,
            }}
          >
            {nameToShow}
          </span>
        </div>
      </div>
    </nav>
  );
}
