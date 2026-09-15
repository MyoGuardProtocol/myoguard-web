/**
 * /settings — the authenticated communication preference centre.
 *
 * This is the destination every governed clinical email footer has pointed at
 * since BUILD 4B. Until now it returned 404: the promise existed, the page did
 * not. Phase 1D-C3C makes it real.
 *
 * Identity comes from the Clerk session server-side. Nothing about which person
 * this page describes is client-supplied, so there is no parameter to alter in
 * order to see or change someone else's preferences.
 *
 * Structure only — Midnight Silk tokens applied per CLAUDE.md. Aesthetic
 * refinement is Gemini's.
 */

import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import { deriveRecipientIdentity } from '@/src/lib/communications/identity';
import { verifyRecipientEmail } from '@/src/lib/communications/recipientVerification';
import { readPreference } from '@/src/lib/communications/preferenceService';
import { CURRENT_WORDING } from '@/src/lib/communications/consentWording';
import CommunicationPreferences from '@/src/components/communications/CommunicationPreferences';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title:  'Settings · MyoGuard Protocol',
  robots: { index: false, follow: false },
};

const SHELL  = '#080C14';
const CARD   = '#0D1421';
const BORDER = '#1A2744';
const TEXT   = '#F1F5F9';
const MUTED  = '#94A3B8';
const SERIF  = "Georgia, 'Times New Roman', serif";

export default async function SettingsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: { email: true },
  });

  const identity = user?.email ? deriveRecipientIdentity(user.email) : null;

  // Both are read-only. Verification decides whether "Turn on" is offered at
  // all, so an unverifiable address produces an explained state rather than a
  // button that would fail.
  const preference = identity
    ? await readPreference({
        recipientKey:       identity.recipientKey,
        channel:            'EMAIL',
        communicationClass: 'CLINICAL_CONTINUITY',
      })
    : null;

  const verification = user?.email
    ? await verifyRecipientEmail({ clerkUserId: clerkId, destinationEmail: user.email })
    : { verified: false as const, code: 'recipient_identity_unavailable' as const, detail: '' };

  return (
    <main style={{
      minHeight: '100vh', background: SHELL, padding: '56px 20px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 22, color: TEXT }}>
          Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          <span style={{ color: MUTED, fontSize: 14 }}> Protocol</span>
        </p>

        <h1 style={{
          margin: '26px 0 4px', fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: TEXT,
        }}>
          Settings
        </h1>
        <p style={{ margin: '0 0 32px', color: MUTED, fontSize: 13 }}>
          {user?.email ?? 'Account'}
        </p>

        <p style={{
          margin: '0 0 14px', fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: MUTED,
        }}>
          Communications
        </p>

        {identity && preference ? (
          <CommunicationPreferences
            initialState={preference.effective}
            canSubscribe={verification.verified}
            consentText={CURRENT_WORDING.text}
          />
        ) : (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px',
          }}>
            <p style={{ margin: 0, color: TEXT, fontSize: 14, fontWeight: 600 }}>
              Communication settings are temporarily unavailable.
            </p>
            <p style={{ margin: '10px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
              Please try again shortly. Nothing has been changed.
            </p>
          </div>
        )}

        {/* Necessary messages — described accurately, deliberately not a toggle. */}
        <div style={{
          marginTop: 14, background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '22px',
        }}>
          <p style={{ margin: 0, color: TEXT, fontSize: 15, fontWeight: 600 }}>
            Necessary messages
          </p>
          <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
            Messages about your account and sign-in, reports you request, and your
            physician&rsquo;s workflow are part of using MyoGuard and are managed separately
            from the optional communications above. They are not controlled by this
            setting, and turning off optional communications does not stop them.
          </p>
          <p style={{ margin: '10px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
            Sign-in and verification emails are sent by our authentication provider and
            are not controlled from this page.
          </p>
        </div>

        <p style={{ margin: '24px 0 0', color: MUTED, fontSize: 12, lineHeight: 1.7 }}>
          For questions about your data, see our{' '}
          <a href="/privacy" style={{ color: '#2DD4BF' }}>Privacy Policy</a> or contact{' '}
          <a href="mailto:privacy@myoguard.health" style={{ color: '#2DD4BF' }}>
            privacy@myoguard.health
          </a>.
        </p>

        <p style={{ margin: '28px 0 0', color: '#64748B', fontSize: 11, lineHeight: 1.7 }}>
          MyoGuard Protocol · Physician-led Clinical Decision Support<br />
          © 2026 Meridian Wellness Systems LLC · myoguard.health<br />
          Built for the global GLP-1 prescribing community
        </p>
      </div>
    </main>
  );
}
