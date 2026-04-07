/**
 * Root landing — hard fork between Physician and Patient tracks.
 * No Clerk, no auth checks, no redirects. Pure navigation.
 */
import Link from 'next/link';

export default function RootPage() {
  return (
    <main
      style={{
        minHeight:       '100vh',
        background:      '#050A15',
        fontFamily:      'system-ui, -apple-system, sans-serif',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '24px',
      }}
    >
      {/* Wordmark */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', color: '#F8FAFC', margin: 0 }}>
          Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>
          Protocol Platform
        </p>
      </div>

      {/* Choice cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 560 }}>

        {/* Physician track */}
        <Link
          href="/doctor/sign-in"
          style={{
            flex:            '1 1 240px',
            background:      '#2DD4BF',
            color:           '#030D0E',
            borderRadius:    16,
            padding:         '32px 28px',
            textDecoration:  'none',
            display:         'flex',
            flexDirection:   'column',
            gap:             10,
            transition:      'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <span style={{ fontSize: 28 }}>🩺</span>
          <p style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Physician Login</p>
          <p style={{ fontSize: 13, opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
            Access your patient command center, risk scores, and clinical flags.
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, marginTop: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Sign in →
          </p>
        </Link>

        {/* Patient track */}
        <Link
          href="/sign-in"
          style={{
            flex:            '1 1 240px',
            background:      'rgba(255,255,255,0.06)',
            border:          '1px solid rgba(255,255,255,0.1)',
            color:           '#F8FAFC',
            borderRadius:    16,
            padding:         '32px 28px',
            textDecoration:  'none',
            display:         'flex',
            flexDirection:   'column',
            gap:             10,
            transition:      'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          <span style={{ fontSize: 28 }}>📊</span>
          <p style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Patient Login</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
            Track your muscle health, view your MyoGuard score, and follow your protocol.
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, marginTop: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Sign in →
          </p>
        </Link>

      </div>

      {/* Emergency bypass link */}
      <p style={{ marginTop: 48, fontSize: 11, color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
        Routing issue?{' '}
        <Link href="/doctor/direct-access" style={{ color: '#2DD4BF', textDecoration: 'none' }}>
          Direct access →
        </Link>
      </p>
    </main>
  );
}
