import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        background: '#080C14',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '40px 20px',
        fontFamily: 'sans-serif',
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#ffffff',
          textDecoration: 'none',
          letterSpacing: '-0.5px',
        }}
      >
        Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
      </Link>

      <p
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '80px',
          fontWeight: 'bold',
          color: '#2DD4BF',
          opacity: 0.4,
          lineHeight: 1,
          margin: '8px 0 0',
        }}
      >
        404
      </p>

      <p style={{ color: '#ffffff', fontSize: '18px', margin: 0 }}>
        Page not found
      </p>

      <Link
        href="/"
        style={{ color: '#94A3B8', fontSize: '14px', marginTop: '8px', textDecoration: 'none' }}
      >
        ← Back to home
      </Link>
    </main>
  );
}
