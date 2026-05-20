import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import PhysicianBoundary from '@/src/components/ui/PhysicianBoundary';

/**
 * /doctor/sign-in — Physician-specific sign-in surface.
 *
 * Distinct from the patient /sign-in-new route. Clinical framing, no patient
 * language. Always redirects to /doctor/onboarding after successful auth so
 * new physicians land directly on setup. Existing approved physicians are
 * caught by the server-side role check and routed to /doctor/patients before
 * the Clerk widget is ever rendered.
 *
 * Role routing (server-side, fires before render):
 *   PHYSICIAN         → /doctor/patients
 *   PHYSICIAN_PENDING → /doctor/dashboard
 *   PATIENT           → /doctor  (bounced back to landing — cannot enter flow)
 *   not signed in     → renders Clerk sign-in widget
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
      select: { role: true },
    });

    // Deterministic routing — no fallback to /doctor (that causes a loop for patients)
    const dest =
      user?.role === 'PHYSICIAN' && invite         ? `/doctor/accept-patient?invite=${invite}` :
      user?.role === 'PHYSICIAN'                   ? '/doctor/dashboard' :
      user?.role === 'PHYSICIAN_PENDING' && invite ? `/doctor/onboarding/pending?invite=${invite}` :
      user?.role === 'PHYSICIAN_PENDING'           ? '/doctor/onboarding/pending' :
      !user && invite                              ? `/doctor/onboarding?invite=${invite}` :
      !user                                        ? '/doctor/onboarding' :
      '/doctor/sign-up'; // PATIENT or unrecognised role → physician registration

    if (process.env.NODE_ENV === 'development') {
      console.log('[/doctor/sign-in] routing', {
        route:         '/doctor/sign-in',
        authStatus:    'authenticated',
        role:          user?.role ?? null,
        invite:        invite ?? null,
        finalRedirect: dest,
      });
    }

    redirect(dest);
  }

  // After successful auth, route to accept-patient if invite present, else dashboard
  const redirectAfterAuth = invite
    ? `/doctor/accept-patient?invite=${invite}`
    : '/doctor/dashboard';

  if (process.env.NODE_ENV === 'development') {
    console.log('[/doctor/sign-in] routing', {
      route:              '/doctor/sign-in',
      authStatus:         'unauthenticated',
      invite:             invite ?? null,
      redirectAfterAuth,
      finalRedirect:      'render_clerk_widget',
    });
  }

  // Client-side safeguard for any PATIENT session that slips past server routing
  const signInDest = invite ? `/doctor/sign-in?invite=${invite}` : '/doctor/sign-in';

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center px-6 py-12">

      <PhysicianBoundary redirectTo={signInDest} />

      {/* Brand header */}
      <div className="mb-6 text-center">
        <Link href="/doctor" className="text-xl font-bold text-slate-900 tracking-tight hover:opacity-80 transition-opacity">
          Myo<span className="text-teal-600">Guard</span>
        </Link>
        <p className="text-xs text-slate-500 mt-1 tracking-wide uppercase">Physician Portal</p>
      </div>

      {/* Context card */}
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-4 text-center mb-4">
        <p className="text-sm font-bold text-slate-900 mb-1">Clinical Access</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Sign in to your physician command center. Patient risk scores,
          protocol oversight, and muscle-protection flags — all in one place.
        </p>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-3">
          <span className="text-xs text-slate-400">No physician account?</span>
          <Link href="/doctor/sign-up" className="text-xs font-semibold text-teal-600 hover:underline">
            Register →
          </Link>
        </div>
      </div>

      {/*
        signUpUrl overrides the ClerkProvider-level signUpUrl so the widget's
        internal "sign up" link routes to /doctor/sign-up, not /sign-up-new.
        forceRedirectUrl ensures all new auths land on /doctor/onboarding.
        Do NOT pass routing="path" — Clerk v6 App Router auto-detects path
        routing from the [[...sign-in]] catch-all convention.
      */}
      <SignIn
        routing="path"
        path="/doctor/sign-in"
        signUpUrl={invite ? `/doctor/sign-up?invite=${invite}` : "/doctor/sign-up"}
        forceRedirectUrl={redirectAfterAuth}
        appearance={{
          variables: {
            colorBackground: "#0A0A0A",
            colorInputBackground: "#1e293b",
            colorInputText: "#ffffff",
            colorText: "#ffffff",
            colorTextSecondary: "#94a3b8",
            colorPrimary: "#10B981",
            colorTextOnPrimaryBackground: "#ffffff",
            borderRadius: "0.75rem",
          },
          elements: {
            card: {
              border: "1px solid #1F2937",
              boxShadow: "0 0 40px rgba(0,0,0,0.5)",
            },
            formFieldInput: {
              border: "1px solid #334155",
            },
            primaryButton: {
              backgroundColor: "#10B981",
            },
            footerAction: { display: "none" },
            footerPages: { display: "none" },
            otpCodeFieldInput: {
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              color: "#ffffff",
              caretColor: "#2DD4BF",
            },
            formResendCodeLink: {
              color: "#2DD4BF",
            },
          },
        }}
      />

      <p style={{ textAlign: "center", fontSize: "13px", color: "#94A3B8", marginTop: "16px", lineHeight: "1.6" }}>
        Enter your email above and we will send you a
        6-digit code to sign in instantly.
        No password required.
      </p>

      <p style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "#64748b" }}>
        Not yet registered?{" "}
        <a href="/doctor/sign-up" style={{ color: "#2dd4bf", textDecoration: "underline" }}>
          Apply for physician access
        </a>
      </p>

      <Link
        href="/"
        className="mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        ← Back to MyoGuard
      </Link>
    </div>
  );
}
