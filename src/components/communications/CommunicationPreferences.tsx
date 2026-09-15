'use client';

import { useState } from 'react';

type State = 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'NEVER_SET' | 'BLOCKED';

type Props = {
  initialState: State;
  /** False when the Clerk primary email is unverified or does not match. */
  canSubscribe: boolean;
  consentText:  string;
};

const CARD   = '#0D1421';
const BORDER = '#1A2744';
const ACCENT = '#2DD4BF';
const TEXT   = '#F1F5F9';
const MUTED  = '#94A3B8';

const DESCRIPTION: Record<State, string> = {
  SUBSCRIBED:
    'You are currently receiving these. You can stop them at any time.',
  UNSUBSCRIBED:
    'You are not receiving these. You asked us to stop.',
  NEVER_SET:
    'You are not receiving these. We do not send them unless you ask us to.',
  BLOCKED:
    'These are paused for a delivery reason rather than a choice you made — for ' +
    'example, mail to your address could not be delivered. Turning them on here ' +
    'will not resume them until that is resolved.',
};

export default function CommunicationPreferences({
  initialState, canSubscribe, consentText,
}: Props) {
  const [state, setState]   = useState<State>(initialState);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');

  async function change(action: 'subscribe' | 'unsubscribe') {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/communications/preferences', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, programme: 'CLINICAL_CONTINUITY' }),
      });
      const data = await res.json() as { ok?: boolean; state?: State; error?: string };
      if (res.ok && data.ok && data.state) setState(data.state);
      else if (data.error === 'unverified') {
        setError('We could not confirm your email address, so we have not turned these on.');
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const on = state === 'SUBSCRIBED';

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, color: TEXT, fontSize: 15, fontWeight: 600 }}>
            Clinical continuity emails
          </p>
          <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
            The Weekly Pulse check-in reminder and the monthly Longitudinal Summary of
            your recorded protocol data.
          </p>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: on ? ACCENT : MUTED, paddingTop: 3,
        }}>
          {on ? 'On' : 'Off'}
        </span>
      </div>

      <p style={{ margin: '14px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
        {DESCRIPTION[state]}
      </p>

      {!on && canSubscribe && (
        <p style={{
          margin: '14px 0 0', padding: '12px 14px', borderRadius: 8,
          background: '#0A1018', border: `1px solid ${BORDER}`,
          color: MUTED, fontSize: 12, lineHeight: 1.7,
        }}>
          {consentText}
        </p>
      )}

      {!canSubscribe && !on && (
        <p style={{ margin: '14px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
          To turn these on, your email address needs to be confirmed on your account
          first. Once it is, this option will become available here.
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        {on ? (
          <button
            onClick={() => change('unsubscribe')}
            disabled={busy}
            style={{
              padding: '11px 20px', borderRadius: 9, cursor: busy ? 'wait' : 'pointer',
              background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`,
              fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Working…' : 'Turn off'}
          </button>
        ) : (
          <button
            onClick={() => change('subscribe')}
            disabled={busy || !canSubscribe}
            style={{
              padding: '11px 20px', borderRadius: 9,
              cursor: busy || !canSubscribe ? 'not-allowed' : 'pointer',
              background: canSubscribe ? ACCENT : 'transparent',
              color: canSubscribe ? '#04211E' : MUTED,
              border: canSubscribe ? 'none' : `1px solid ${BORDER}`,
              fontSize: 13, fontWeight: 700, opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Working…' : 'Turn on'}
          </button>
        )}
      </div>

      {error && (
        <p style={{ margin: '14px 0 0', color: '#F87171', fontSize: 13 }}>{error}</p>
      )}
    </div>
  );
}
