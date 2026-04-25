'use client';

import Link from 'next/link';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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

      <p style={{ color: '#ffffff', fontSize: '18px', margin: '8px 0 0' }}>
        Something went wrong
      </p>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          onClick={reset}
          style={{
            background: '#2DD4BF',
            color: '#080C14',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>

        <Link
          href="/"
          style={{
            color: '#94A3B8',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
