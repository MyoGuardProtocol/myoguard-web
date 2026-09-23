'use client';

/**
 * src/components/guide/GuideRequestForm.tsx
 *
 * The public Protein Guide request panel.
 *
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
 * It collects one email address and posts it to /api/guide-request, the
 * ESSENTIAL_SERVICE requested-delivery pathway declared in C3F-2. It is not a
 * newsletter sign-up, and nothing here implies it is: there is no checkbox, no
 * "stay in touch", no second field, and no consent language — because no
 * consent is being taken. Asking for a document authorises sending that
 * document, and nothing more.
 *
 * WHY THERE IS NO "unsubscribe anytime" LINE
 * That phrasing belongs to subscriptions, and using it here would tell the
 * person they have joined something they have not. The panel says what is
 * actually true instead: one delivery, no subscription.
 *
 * NEUTRAL OUTCOMES
 * The route answers a suppressed send exactly as it answers a delivered one, so
 * that a hard-bounced or complained address cannot be confirmed by asking for
 * the Guide. This component must not undo that. The success message therefore
 * never asserts that mail was sent — it says what the person can rely on, which
 * is that the request was accepted.
 *
 * WHAT IS MEASURED (C-FUNNEL-2)
 * Two events, neither of which carries the address or anything derived from it:
 * GUIDE_REQUESTED when the person submits, and GUIDE_DELIVERY_SUCCEEDED when
 * the route accepts. The gap between the two is the failure and throttle rate,
 * which is the only thing this surface can honestly report — the neutrality
 * above means the browser is never told whether mail was actually sent, and no
 * event fired from here may pretend otherwise.
 *
 * WHAT FOLLOWS A SUCCESS (C-FUNNEL-2)
 * Founder decision, 23 September 2026: the success state carries one optional
 * onward panel to the public Preliminary Sarcopenia Risk Index (SRI). It is an
 * offer, not a condition — the Guide has already been requested by the time it
 * appears, and it changes nothing about the delivery. The single-link rule on
 * the delivered email is untouched and stays untouched: this panel is on the
 * website, and the email carries no SRI call to action.
 */

import { useState, type CSSProperties, type FormEvent } from 'react';
import posthog from 'posthog-js';
import { isAnalyticsEnabled, AnalyticsEvents } from '@/src/lib/posthog';
import { PreliminarySriLink } from '@/src/components/learn/PreliminarySriLink';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const PANEL_STYLE: CSSProperties = {
  background: '#0D1421',
  border: '1px solid #1A2744',
  borderRadius: '16px',
  padding: '28px 28px 26px',
};

const LABEL_STYLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: '#2DD4BF',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  margin: '0 0 10px 0',
};

const INPUT_STYLE: CSSProperties = {
  flex: '1 1 240px',
  minWidth: 0,
  background: '#080C14',
  border: '1px solid #1A2744',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '0.9375rem',
  color: '#F1F5F9',
  outline: 'none',
  fontFamily: 'inherit',
};

const BUTTON_STYLE: CSSProperties = {
  flex: '0 0 auto',
  background: '#2DD4BF',
  color: '#04211D',
  border: '1px solid #2DD4BF',
  borderRadius: '8px',
  padding: '12px 22px',
  fontSize: '0.9375rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.01em',
};

const NOTE_STYLE: CSSProperties = {
  fontSize: '0.8125rem',
  color: '#64748B',
  lineHeight: 1.7,
  margin: '14px 0 0 0',
};

export function GuideRequestForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;

    setStatus('sending');
    setMessage('');

    // Intent, before the network call, so a request that fails or is throttled
    // is still counted. No property of any kind — not even a hash of the
    // address, which would be a stable identifier by another name.
    if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.GUIDE_REQUESTED);

    try {
      const res = await fetch('/api/guide-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The route's schema is strict: an address and nothing else. Sending
        // anything further would be rejected outright, which is the point.
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        // "Accepted by the governed delivery pathway" — deliberately the
        // furthest this component is allowed to know. A suppressed send
        // arrives here identically to a delivered one, and that is the point.
        if (isAnalyticsEnabled) posthog.capture(AnalyticsEvents.GUIDE_DELIVERY_SUCCEEDED);
        setStatus('sent');
        return;
      }

      // Each failure is reported in the route's own terms. None of them
      // describes the address, and none confirms whether it is known to us.
      if (res.status === 429) {
        setMessage('Too many requests from this address. Please try again later.');
      } else if (res.status === 422) {
        setMessage('That does not look like a valid email address.');
      } else {
        setMessage('The Guide could not be sent just now. Please try again shortly.');
      }
      setStatus('error');
    } catch {
      setMessage('The Guide could not be sent just now. Please try again shortly.');
      setStatus('error');
    }
  }

  // ── Confirmed ──────────────────────────────────────────────────────────────
  //
  // Deliberately compact, and visually a smaller object than the request panel
  // it replaces. The article continues below this point, and a tall celebratory
  // block here would read as though the Guide itself had arrived on the page.
  // It has not: it is in the recipient's inbox, and the copy says so plainly.
  if (status === 'sent') {
    return (
      <section
        aria-live="polite"
        style={{
          background: '#0D1421',
          border: '1px solid #1A2744',
          borderLeft: '3px solid #2DD4BF',
          borderRadius: '12px',
          padding: '18px 22px',
        }}
      >
        <p
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '1.0625rem',
            fontWeight: 700,
            color: '#F1F5F9',
            margin: '0 0 6px 0',
            lineHeight: 1.4,
          }}
        >
          Your Guide is on its way.
        </p>
        <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>
          Check your inbox in the next few minutes.
        </p>

        <div style={{ marginTop: '18px' }}>
          <PreliminarySriLink source="guide_success" />
        </div>
      </section>
    );
  }

  return (
    <section style={PANEL_STYLE}>
      <p style={LABEL_STYLE}>Free educational guide</p>

      {/* The article explains what is happening. The Guide is what you do with
          it — so the ask names the practical material the page does not carry,
          rather than promising a better version of what the reader just read.
          Every item listed is content the Guide actually contains. */}
      <h2
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '1.375rem',
          fontWeight: 700,
          color: '#F1F5F9',
          margin: '0 0 8px 0',
          lineHeight: 1.3,
        }}
      >
        Want the practical version?
      </h2>

      <p
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '1rem',
          color: '#2DD4BF',
          margin: '0 0 14px 0',
          lineHeight: 1.5,
        }}
      >
        Protein-Smart Eating During GLP-1 Weight Loss
      </p>

      <p
        style={{
          fontSize: '0.9375rem',
          color: '#94A3B8',
          lineHeight: 1.8,
          margin: '0 0 8px 0',
          maxWidth: '540px',
        }}
      >
        Get the MyoGuard Protein Guide, including the safety checkpoint, everyday protein foods,
        strategies for low-appetite days, and questions to discuss with your clinician.
      </p>

      <p
        style={{
          fontSize: '0.9375rem',
          color: '#94A3B8',
          lineHeight: 1.8,
          margin: '0 0 20px 0',
          maxWidth: '540px',
        }}
      >
        A physician-led educational guide to help you understand protein, nutrition and muscle
        health during treatment.
      </p>

      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'stretch' }}
      >
        <label htmlFor="guide-email" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          Email address
        </label>
        <input
          id="guide-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={status === 'sending'}
          style={INPUT_STYLE}
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          style={{ ...BUTTON_STYLE, opacity: status === 'sending' ? 0.6 : 1 }}
        >
          {status === 'sending' ? 'Sending…' : 'Send me the Guide'}
        </button>
      </form>

      {status === 'error' && (
        <p
          role="alert"
          style={{ fontSize: '0.875rem', color: '#FBBF24', lineHeight: 1.7, margin: '14px 0 0 0' }}
        >
          {message}
        </p>
      )}

      <p style={NOTE_STYLE}>
        This is a one-time delivery. Requesting the Guide does not subscribe you to anything.
        See our{' '}
        <a href="/privacy" style={{ color: '#94A3B8', textDecoration: 'underline' }}>
          Privacy Policy
        </a>
        .
      </p>
    </section>
  );
}
