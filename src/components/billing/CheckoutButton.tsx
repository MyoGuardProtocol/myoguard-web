'use client';

import { useState } from 'react';

interface Props {
  /** Stripe plan identifier passed to /api/stripe/checkout */
  planType: 'physician' | 'practice';
  /** Button label */
  label?: string;
  /** 'primary' renders solid teal; 'default' renders teal-tinted ghost */
  variant?: 'primary' | 'default';
}

/**
 * CheckoutButton
 *
 * Client component — calls POST /api/stripe/checkout with the given planType,
 * then redirects to the Stripe-hosted checkout URL.
 *
 * Handles loading state and surface-level error messages.
 * No PHI is passed to or from this component.
 */
export default function CheckoutButton({
  planType,
  label = 'Subscribe',
  variant = 'default',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planType }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (data.url) {
        window.location.href = data.url;
        // Don't setLoading(false) — the page is navigating away.
      } else {
        setError(data.error ?? 'Unable to start checkout. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  const isPrimary = variant === 'primary';

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        style={{
          width:          '100%',
          padding:        '15px 20px',
          borderRadius:   '12px',
          fontSize:       '14px',
          fontWeight:     700,
          cursor:         loading ? 'wait' : 'pointer',
          border:         'none',
          background:     isPrimary ? '#2DD4BF' : 'rgba(45,212,191,0.12)',
          color:          isPrimary ? '#080C14' : '#2DD4BF',
          transition:     'opacity 0.15s',
          opacity:        loading ? 0.7 : 1,
          letterSpacing:  '0.01em',
        }}
      >
        {loading ? 'Redirecting to Stripe…' : label}
      </button>

      {error && (
        <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '8px', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
