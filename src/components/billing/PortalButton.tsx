'use client';

import { useState } from 'react';

interface Props {
  /** Button label */
  label?: string;
}

/**
 * PortalButton
 *
 * Client component — calls POST /api/stripe/portal, then redirects to the
 * Stripe-hosted Customer Portal for subscription management.
 *
 * Used on the billing page when the physician has an active stripeCustomerId.
 */
export default function PortalButton({ label = 'Manage Subscription' }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handlePortal() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/portal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (data.url) {
        window.location.href = data.url;
        // Don't setLoading(false) — navigating away.
      } else {
        setError(data.error ?? 'Unable to open billing portal. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handlePortal}
        disabled={loading}
        style={{
          padding:       '12px 24px',
          borderRadius:  '10px',
          fontSize:      '13px',
          fontWeight:    600,
          cursor:        loading ? 'wait' : 'pointer',
          border:        '1px solid rgba(45,212,191,0.3)',
          background:    'transparent',
          color:         '#2DD4BF',
          transition:    'opacity 0.15s',
          opacity:       loading ? 0.7 : 1,
          whiteSpace:    'nowrap',
        }}
      >
        {loading ? 'Opening portal…' : label}
      </button>

      {error && (
        <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '8px' }}>
          {error}
        </p>
      )}
    </div>
  );
}
