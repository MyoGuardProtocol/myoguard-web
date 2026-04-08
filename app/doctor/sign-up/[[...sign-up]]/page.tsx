import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

/**
 * /doctor/sign-up — Physician-specific sign-up surface.
 *
 * Distinct from the patient /sign-up-new route. Clinical framing, no patient
 * language. Always redirects to /doctor/onboarding after successful auth.
 * Signed-in users are routed away before the Clerk widget renders.
 *
 * Role routing (server-side, fires before render):
 *   PHYSICIAN         → /doctor/patients
 *   PHYSICIAN_PENDING → /doctor/dashboard
 *   PATIENT           → /doctor  (bounced back to landing — cannot enter flow)
 *   not signed in     → renders Clerk sign-up widget
 */
export default async function PhysicianSignUpPage() {
  const { userId } = await auth();

  if (userId) {
    const user = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true },
    });
    if (user?.role === 'PHYSICIAN')         redirect('/doctor/patients');
    if (user?.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
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

      {/* Professional review notice */}
      <div className="w-full max-w-sm bg-teal-50 border border-teal-200 rounded-2xl px-5 py-3 text-center mb-3">
        <p className="text-xs text-teal-800 leading-relaxed font-medium">
          This platform is intended for healthcare professionals.
          Accounts may be reviewed before full access is granted.
        </p>
      </div>

      {/* Context card */}
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-4 text-center mb-4">
        <p className="text-sm font-bold text-slate-900 mb-1">Create Physician Account</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Register for clinical access. After sign-up you will complete your
          professional profile — including specialty and medical licence.
        </p>
        <ul className="mt-3 space-y-1.5 text-left">
          {[
            'Patient risk dashboard and muscle scores',
            'Clinical flags — protein deficit, fatigue, weakness',
            'Protocol review and physician notes',
          ].map(b => (
            <li key={b} className="flex items-start gap-2 text-xs text-slate-500">
              <span className="text-teal-600 font-bold mt-0.5 flex-shrink-0">✓</span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-3">
          <span className="text-xs text-slate-400">Already registered?</span>
          <Link href="/doctor/sign-in" className="text-xs font-semibold text-teal-600 hover:underline">
            Sign in →
          </Link>
        </div>
      </div>

      {/*
        routing="path" + path="/doctor/sign-up" are required for Clerk's
        multi-step flow (email verification, etc.) to work correctly in
        Next.js App Router with a catch-all [[...sign-up]] route.
        Without these, Clerk defaults to hash-based routing and the
        verification step breaks, leaving users without a valid session.
      */}
      <SignUp
        routing="path"
        path="/doctor/sign-up"
        signInUrl="/doctor/sign-in"
        forceRedirectUrl="/doctor/dashboard"
      />

      <Link
        href="/"
        className="mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        ← Back to MyoGuard
      </Link>
    </div>
  );
}
