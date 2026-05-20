import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import PhysicianBoundary from '@/src/components/ui/PhysicianBoundary';

/**
 * /doctor/sign-in — Physician-specific sign-in surface.
 *
 * Role routing (server-side, fires before render):
 *   PHYSICIAN         → /doctor/patients (CCC), or accept-patient if invite pending
 *   PHYSICIAN_PENDING → /doctor/onboarding/pending
 *   PATIENT           → /doctor/sign-up (bounced — cannot enter physician flow)
 *   not signed in     → renders Clerk OTP widget
 *
 * Invite resolution order:
 *   1. URL ?invite= param (existing physician following report link)
 *   2. DB PhysicianPatientInvitation (newly-approved physician — no URL invite)
 */
export default async function PhysicianSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { userId } = await auth();
  const { invite } = await searchParams;

  if (userId) {
    const user = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true, id: true },
    });

    // For approved physician with no URL invite — check DB for a stored pending invitation
    // created during sign-up (new physician approved after patient sent them a report link).
    let storedInvite: string | null = null;
    if (user?.role === 'PHYSICIAN' && !invite) {
      try {
        const pending = await prisma.physicianPatientInvitation.findFirst({
          where:  { claimedByUserId: user.id, status: 'PENDING' },
          select: { shareToken: true },
        });
        storedInvite = pending?.shareToken ?? null;
      } catch {
        // Non-fatal — proceed without stored invite
      }
    }

    const effectiveInvite = invite ?? storedInvite;

    const dest =
      user?.role === 'PHYSICIAN' && effectiveInvite ? `/doctor/accept-patient?invite=${effectiveInvite}` :
      user?.role === 'PHYSICIAN'                    ? '/doctor/patients' :
      user?.role === 'PHYSICIAN_PENDING' && invite  ? `/doctor/onboarding/pending?invite=${invite}` :
      user?.role === 'PHYSICIAN_PENDING'            ? '/doctor/onboarding/pending' :
      !user && invite                               ? `/doctor/onboarding?invite=${invite}` :
      !user                                         ? '/doctor/onboarding' :
      '/doctor/sign-up'; // PATIENT or unrecognised role → physician registration

    if (process.env.NODE_ENV === 'development') {
      console.log('[/doctor/sign-in] routing', {
        route:          '/doctor/sign-in',
        authStatus:     'authenticated',
        role:           user?.role ?? null,
        invite:         invite ?? null,
        storedInvite,
        effectiveInvite,
        finalRedirect:  dest,
      });
    }

    redirect(dest);
  }

  // After successful auth, route to accept-patient if invite present, else CCC
  const redirectAfterAuth = invite
    ? `/doctor/accept-patient?invite=${invite}`
    : '/doctor/patients';

  const signInDest = invite ? `/doctor/sign-in?invite=${invite}` : '/doctor/sign-in';

  if (process.env.NODE_ENV === 'development') {
    console.log('[/doctor/sign-in] routing', {
      route:             '/doctor/sign-in',
      authStatus:        'unauthenticated',
      invite:            invite ?? null,
      redirectAfterAuth,
      finalRedirect:     'render_clerk_widget',
    });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#080C14',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Client-side safeguard for PATIENT sessions that slip past server routing */}
      <PhysicianBoundary redirectTo={signInDest} />

      {/* Logo */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <Link href="/doctor" style={{ textDecoration: 'none', display: 'inline-block' }}>
          <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#F8FAFC' }}>
            Myo<span style={{ color: '#2DD4BF' }}>Guard</span>
          </span>
          <span style={{ color: '#475569', fontWeight: 300, fontSize: '13px', marginLeft: '4px' }}>Protocol</span>
        </Link>
        <p style={{ fontSize: '11px', color: '#475569', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          Physician Portal
        </p>
      </div>

      {/* Context card */}
      <div
        style={{
          width: '100%', maxWidth: '380px',
          background: '#0D1421',
          border: '1px solid #1A2744',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '16px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: 600, color: '#F1F5F9', marginBottom: '6px' }}>
          Clinical Command Center
        </p>
        <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6', margin: 0 }}>
          Sign in to access patient risk scores, protocol oversight, and muscle-protection flags.
        </p>
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1A2744', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#475569' }}>No physician account?</span>
          <Link
            href={invite ? `/doctor/sign-up?invite=${invite}` : '/doctor/sign-up'}
            style={{ fontSize: '12px', fontWeight: 600, color: '#2DD4BF', textDecoration: 'none' }}
          >
            Register →
          </Link>
        </div>
      </div>

      {/*
        signUpUrl overrides the Clerk widget's internal "sign up" link so it
        routes to /doctor/sign-up, not the global /sign-up-new.
        forceRedirectUrl ensures all new auths land on the correct physician path.
        routing="path" uses the [[...sign-in]] catch-all convention.
      */}
      <SignIn
        routing="path"
        path="/doctor/sign-in"
        signUpUrl={invite ? `/doctor/sign-up?invite=${invite}` : '/doctor/sign-up'}
        forceRedirectUrl={redirectAfterAuth}
        appearance={{
          variables: {
            colorBackground:              '#0D1421',
            colorInputBackground:         '#060D1E',
            colorInputText:               '#F1F5F9',
            colorText:                    '#F1F5F9',
            colorTextSecondary:           '#94A3B8',
            colorPrimary:                 '#2DD4BF',
            colorTextOnPrimaryBackground: '#080C14',
            borderRadius:                 '0.75rem',
          },
          elements: {
            card: {
              border:     '1px solid #1A2744',
              boxShadow:  'none',
            },
            formFieldInput: {
              border: '1px solid #1A2744',
            },
            primaryButton: {
              backgroundColor: '#2DD4BF',
              color:           '#080C14',
            },
            footerAction:  { display: 'none' },
            footerPages:   { display: 'none' },
            otpCodeFieldInput: {
              backgroundColor: '#060D1E',
              border:          '1px solid #1A2744',
              color:           '#F1F5F9',
              caretColor:      '#2DD4BF',
            },
            formResendCodeLink: {
              color: '#2DD4BF',
            },
          },
        }}
      />

      <p style={{ textAlign: 'center', fontSize: '12px', color: '#475569', marginTop: '16px', lineHeight: '1.6', maxWidth: '320px' }}>
        Enter your email and we&apos;ll send a 6-digit access code. No password required.
      </p>

      <Link
        href="/"
        style={{ marginTop: '24px', fontSize: '12px', color: '#334155', textDecoration: 'none' }}
      >
        ← Back to MyoGuard
      </Link>
    </div>
  );
}
