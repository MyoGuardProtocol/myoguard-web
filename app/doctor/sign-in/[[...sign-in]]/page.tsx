import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import SessionPoller from '@/src/components/ui/SessionPoller';

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
export default async function PhysicianSignInPage() {
  const { userId } = await auth();

  if (userId) {
    const user = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true },
    });
    if (user?.role === 'PHYSICIAN')         redirect('/doctor/dashboard');
    if (user?.role === 'PHYSICIAN_PENDING') redirect('/doctor/onboarding/pending');
    if (!user)                              redirect('/doctor/onboarding');
    // PATIENT or unrecognised role → back to physician landing
    redirect('/doctor');
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center px-6 py-12">

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
        signUpUrl="/doctor/sign-up"
        forceRedirectUrl="/doctor/dashboard"
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
          },
        }}
      />

      <p style={{ textAlign: "center", fontSize: "13px", color: "#94A3B8", marginTop: "16px" }}>
        After clicking the link in your email,
        return to this tab — you will be signed in automatically.
      </p>

      <SessionPoller />

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
