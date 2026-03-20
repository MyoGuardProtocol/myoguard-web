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
        routing="path" + path="/sign-in-new" are REQUIRED here.
        Without them Clerk cannot serve sub-paths like
        /sign-in-new/verify-email-address (OTP step), returning 404.
        The [[...sign-in]] catch-all folder handles those sub-paths.
        signUpUrl points to the matching catch-all sign-up route.
      */}
      <SignIn
        routing="path"
        path="/sign-in-new"
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
