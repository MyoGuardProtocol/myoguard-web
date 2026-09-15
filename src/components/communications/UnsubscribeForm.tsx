'use client';

import { useState } from 'react';

type Props = {
  token: string;
  /** Plain-language name of the programme this link came from. */
  programmeLabel: string;
};

type Outcome =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; scope: 'class' | 'all_optional' }
  | { kind: 'error'; message: string };

const CARD   = '#0D1421';
const BORDER = '#1A2744';
const ACCENT = '#2DD4BF';
const TEXT   = '#F1F5F9';
const MUTED  = '#94A3B8';

/**
 * The mutation lives behind an explicit button press, never a page load — see
 * the note in app/unsubscribe/page.tsx about mail scanners.
 */
export default function UnsubscribeForm({ token, programmeLabel }: Props) {
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  async function submit(scope: 'class' | 'all_optional') {
    setOutcome({ kind: 'working' });
    try {
      const res = await fetch('/api/communications/unsubscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, scope }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) setOutcome({ kind: 'done', scope });
      else setOutcome({ kind: 'error', message: data.error ?? 'Something went wrong.' });
    } catch {
      setOutcome({ kind: 'error', message: 'Unable to connect. Please try again.' });
    }
  }

  if (outcome.kind === 'done') {
    return (
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '24px',
      }}>
        <p style={{ margin: 0, color: ACCENT, fontSize: 14, fontWeight: 600 }}>
          {outcome.scope === 'all_optional'
            ? 'You have been unsubscribed from all optional communications.'
            : `You have been unsubscribed from ${programmeLabel}.`}
        </p>
        <p style={{ margin: '12px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
          This takes effect immediately. You will still receive necessary messages about
          your account, security, reports you request, and your physician&rsquo;s workflow —
          those are managed separately from optional recurring communications.
        </p>
        <p style={{ margin: '12px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
          If you change your mind, you can turn these back on from{' '}
          <a href="/settings" style={{ color: ACCENT }}>communication settings</a> while
          signed in. For your protection, this link can only stop messages — it cannot
          start them.
        </p>
      </div>
    );
  }

  const busy = outcome.kind === 'working';

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '24px',
    }}>
      <p style={{ margin: '0 0 18px', color: TEXT, fontSize: 14, lineHeight: 1.7 }}>
        Choose what you would like to stop receiving.
      </p>

      <button
        onClick={() => submit('class')}
        disabled={busy}
        style={{
          width: '100%', padding: '13px 18px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
          background: ACCENT, color: '#04211E', border: 'none',
          fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Working…' : `Unsubscribe from ${programmeLabel}`}
      </button>

      <button
        onClick={() => submit('all_optional')}
        disabled={busy}
        style={{
          width: '100%', marginTop: 10, padding: '13px 18px', borderRadius: 10,
          cursor: busy ? 'wait' : 'pointer', background: 'transparent', color: TEXT,
          border: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 600, opacity: busy ? 0.6 : 1,
        }}
      >
        Unsubscribe from all optional communications
      </button>

      <p style={{ margin: '16px 0 0', color: MUTED, fontSize: 12, lineHeight: 1.7 }}>
        Optional communications are clinical continuity emails, educational updates, and
        promotional messages. Necessary account, security, requested report, and physician
        workflow messages are not affected by either choice.
      </p>

      {outcome.kind === 'error' && (
        <p style={{ margin: '14px 0 0', color: '#F87171', fontSize: 13 }}>{outcome.message}</p>
      )}
    </div>
  );
}
