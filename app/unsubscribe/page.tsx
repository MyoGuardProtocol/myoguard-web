/**
 * /unsubscribe — public confirmation surface for email unsubscribe links.
 *
 * GET IS SIDE-EFFECT FREE. This page validates the token's signature (pure
 * crypto, no writes) and renders a choice. It does not change any preference.
 *
 * That separation is not decoration: corporate mail security scanners, link
 * prefetchers and crawlers routinely follow every URL in an email. If loading
 * this page unsubscribed the recipient, a scanner would opt people out of
 * clinical correspondence they never chose to leave. The mutation lives behind
 * an explicit POST in app/api/communications/unsubscribe.
 *
 * No login required — the recipient exercises the link they were sent.
 */

import type { Metadata } from 'next';
import { verifyUnsubscribeToken } from '@/src/lib/communications/unsubscribeToken';
import UnsubscribeForm from '@/src/components/communications/UnsubscribeForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title:   'Communication preferences · MyoGuard Protocol',
  robots:  { index: false, follow: false },
};

const SHELL  = '#080C14';
const CARD   = '#0D1421';
const BORDER = '#1A2744';
const TEXT   = '#F1F5F9';
const MUTED  = '#94A3B8';
const SERIF  = "Georgia, 'Times New Roman', serif";

/** Plain-language programme names — never raw enum values. */
const PROGRAMME_LABEL: Record<string, string> = {
  CLINICAL_CONTINUITY: 'clinical continuity emails',
  EDUCATIONAL:         'educational updates',
  MARKETING:           'promotional messages',
};

export default async function UnsubscribePage(
  { searchParams }: { searchParams: Promise<{ t?: string }> },
) {
  const { t } = await searchParams;
  const verified = t ? verifyUnsubscribeToken(t) : ({ ok: false, reason: 'malformed' } as const);

  return (
    <main style={{
      minHeight: '100vh', background: SHELL, padding: '64px 20px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 24, color: TEXT }}>
          Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          <span style={{ color: MUTED, fontSize: 15 }}> Protocol</span>
        </p>
        <h1 style={{
          margin: '28px 0 10px', fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: TEXT,
        }}>
          Communication preferences
        </h1>

        {verified.ok ? (
          <>
            <p style={{ margin: '0 0 22px', color: MUTED, fontSize: 14, lineHeight: 1.7 }}>
              This link came from a MyoGuard email. Nothing has changed yet — choose an
              option below to confirm.
            </p>
            <UnsubscribeForm
              token={t as string}
              programmeLabel={PROGRAMME_LABEL[verified.payload.cl] ?? 'these communications'}
            />
          </>
        ) : (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '24px',
          }}>
            {verified.reason === 'secret_unavailable' ? (
              <>
                <p style={{ margin: 0, color: TEXT, fontSize: 14, fontWeight: 600 }}>
                  This service is temporarily unavailable.
                </p>
                <p style={{ margin: '12px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
                  Please try again shortly. Your preferences have not been changed.
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, color: TEXT, fontSize: 14, fontWeight: 600 }}>
                  This link is not valid.
                </p>
                <p style={{ margin: '12px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
                  It may have been altered or truncated by an email client. Open the link
                  directly from the original message, or manage your preferences from{' '}
                  <a href="/settings" style={{ color: '#2DD4BF' }}>communication settings</a>{' '}
                  while signed in.
                </p>
              </>
            )}
          </div>
        )}

        <p style={{ margin: '28px 0 0', color: '#64748B', fontSize: 11, lineHeight: 1.7 }}>
          MyoGuard Protocol · Physician-led Clinical Decision Support<br />
          © 2026 Meridian Wellness Systems LLC · myoguard.health<br />
          Built for the global GLP-1 prescribing community
        </p>
      </div>
    </main>
  );
}
