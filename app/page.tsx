"use client";
/**
 * Root landing — hard fork between Physician and Patient tracks.
 * No Clerk, no auth checks, no redirects. Pure navigation.
 */
import Link from 'next/link';

export default function RootPage() {
  return (
    <main
      style={{
        minHeight:     '100vh',
        background:    '#0a0a0a',
        fontFamily:    'system-ui, -apple-system, sans-serif',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        padding:       '64px 24px 48px',
        position:      'relative',
        overflow:      'hidden',
      }}
    >

      {/* ── Radial glow backdrop ── */}
      <div style={{
        position:   'absolute',
        top:        '-120px',
        left:       '50%',
        transform:  'translateX(-50%)',
        width:      '700px',
        height:     '500px',
        background: 'radial-gradient(ellipse at center, rgba(45,212,191,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Wordmark ── */}
      <div style={{ marginBottom: 56, textAlign: 'center', position: 'relative' }}>
        <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', color: '#F8FAFC', margin: 0 }}>
          Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6 }}>
          Protocol Platform
        </p>
      </div>

      {/* ── Hero ── */}
      <div style={{ maxWidth: 680, textAlign: 'center', marginBottom: 56, position: 'relative' }}>
        <h1 style={{
          fontSize:      'clamp(28px, 5vw, 44px)',
          fontWeight:    900,
          letterSpacing: '-0.03em',
          color:         '#F8FAFC',
          margin:        '0 0 20px',
          lineHeight:    1.15,
        }}>
          Protect Muscle.{' '}
          <span style={{ color: '#2DD4BF' }}>Optimize Outcomes.</span>
        </h1>
        <p style={{
          fontSize:   'clamp(14px, 2vw, 17px)',
          color:      'rgba(255,255,255,0.5)',
          lineHeight: 1.7,
          margin:     0,
        }}>
          Physician-guided protocols designed to preserve lean mass, reduce side effects,
          and improve outcomes during GLP-1 therapy.
        </p>
      </div>

      {/* ── Value strip ── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap:                 12,
        width:               '100%',
        maxWidth:            720,
        marginBottom:        56,
        position:            'relative',
      }}>
        {[
          { title: 'Clinical Intelligence',    body: 'Real-time risk scoring and protocol guidance' },
          { title: 'Muscle Preservation',      body: 'Designed to protect lean mass during weight loss' },
          { title: 'Continuous Monitoring',    body: 'Track symptoms, recovery, and adherence over time' },
        ].map(({ title, body }) => (
          <div
            key={title}
            style={{
              background:    'rgba(255,255,255,0.04)',
              border:        '1px solid rgba(255,255,255,0.08)',
              borderRadius:  12,
              padding:       '20px 18px',
              backdropFilter:'blur(12px)',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: '#2DD4BF', margin: '0 0 6px', letterSpacing: '0.02em' }}>
              {title}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>
              {body}
            </p>
          </div>
        ))}
      </div>

      {/* ── CTA cards ── */}
      <div style={{
        display:        'flex',
        gap:            16,
        flexWrap:       'wrap',
        justifyContent: 'center',
        width:          '100%',
        maxWidth:       560,
        marginBottom:   48,
        position:       'relative',
      }}>

        {/* Physician — primary CTA */}
        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <p style={{
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color:         'rgba(45,212,191,0.7)',
            margin:        '0 0 8px 2px',
          }}>
            For Clinicians
          </p>
          <Link
            href="/doctor/sign-in"
            style={{
              background:     '#2DD4BF',
              color:          '#030D0E',
              borderRadius:   16,
              padding:        '28px 24px',
              textDecoration: 'none',
              display:        'flex',
              flexDirection:  'column',
              gap:            10,
              transition:     'opacity 0.15s, box-shadow 0.15s',
              boxShadow:      '0 0 32px rgba(45,212,191,0.15)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity   = '0.9';
              e.currentTarget.style.boxShadow = '0 0 48px rgba(45,212,191,0.28)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity   = '1';
              e.currentTarget.style.boxShadow = '0 0 32px rgba(45,212,191,0.15)';
            }}
          >
            <span style={{ fontSize: 26 }}>🩺</span>
            <p style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>Physician Login</p>
            <p style={{ fontSize: 13, opacity: 0.65, margin: 0, lineHeight: 1.55 }}>
              Monitor patients, review clinical flags, and manage protocols.
            </p>
            <p style={{ fontSize: 12, fontWeight: 800, marginTop: 8, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Sign in →
            </p>
          </Link>
        </div>

        {/* Patient — secondary CTA */}
        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <p style={{
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color:         'rgba(255,255,255,0.3)',
            margin:        '0 0 8px 2px',
          }}>
            For Patients
          </p>
          <Link
            href="/sign-in-new"
            style={{
              background:     'transparent',
              border:         '1px solid rgba(255,255,255,0.12)',
              color:          '#F8FAFC',
              borderRadius:   16,
              padding:        '28px 24px',
              textDecoration: 'none',
              display:        'flex',
              flexDirection:  'column',
              gap:            10,
              transition:     'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background   = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.borderColor  = 'rgba(45,212,191,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background   = 'transparent';
              e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.12)';
            }}
          >
            <span style={{ fontSize: 26 }}>📊</span>
            <p style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>Patient Login</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.55 }}>
              Track your progress and follow your personalized plan.
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, marginTop: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Sign in →
            </p>
          </Link>
          <p style={{
            fontSize:   11,
            color:      'rgba(255,255,255,0.2)',
            marginTop:  8,
            textAlign:  'center',
            lineHeight: 1.5,
          }}>
            Use requires physician oversight and consent.
          </p>
        </div>

      </div>

      {/* ── Trust strip ── */}
      <div style={{
        maxWidth:   600,
        textAlign:  'center',
        marginBottom: 40,
        position:   'relative',
      }}>
        <p style={{
          fontSize:   11,
          color:      'rgba(255,255,255,0.18)',
          lineHeight: 1.7,
          margin:     0,
        }}>
          This platform provides educational guidance and does not replace medical advice.
          Use is subject to patient consent and physician oversight.
        </p>
      </div>

      {/* ── Emergency bypass ── */}
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.1)', textAlign: 'center', position: 'relative' }}>
        Routing issue?{' '}
        <Link href="/doctor/direct-access" style={{ color: 'rgba(45,212,191,0.4)', textDecoration: 'none' }}>
          Direct access →
        </Link>
      </p>

    </main>
  );
}
