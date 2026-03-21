import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">

      {/* Brand header */}
      <div className="mb-6 text-center">
        <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
          Myo<span className="text-teal-600">Guard</span> Protocol
        </Link>
        <p className="text-xs text-slate-500 mt-1">Physician-Formulated · Data-Driven Muscle Protection</p>
      </div>

      {/* Context card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 text-center mb-4">
        <p className="text-sm font-bold text-slate-800 mb-1">Welcome back to MyoGuard</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Sign in to access your saved protocols, weekly check-in history, and progress tracking.
        </p>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-3">
          <span className="text-xs text-slate-400">No account yet?</span>
          <Link href="/sign-up-new" className="text-xs font-semibold text-teal-600 hover:underline">
            Create free account &rarr;
          </Link>
        </div>
      </div>

      {/*
        Do NOT pass routing="path" or path props here.
        Clerk v6 App Router auto-detects path routing from the [[...sign-in]]
        catch-all directory convention — the catch-all is what allows
        /sign-in-new/verify-email-address to resolve (not the routing prop).
        Passing routing="path" activates Clerk's programmatic routing mode,
        which re-evaluates step state on every OTP keypress and can remount
        the OTP inputs mid-input, causing digits to land in the wrong boxes.
        signUpUrl is set on ClerkProvider in app/layout.tsx; signUpUrl here
        ensures the "sign up" link inside the widget goes to the right route.
      */}
      <SignIn
        signUpUrl="/sign-up-new"
        fallbackRedirectUrl="/dashboard"
      />

      <Link
        href="/"
        className="mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        Continue as guest instead
      </Link>
    </div>
  );
}
