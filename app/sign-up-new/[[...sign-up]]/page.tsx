import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignUpPage() {
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
        <p className="text-sm font-bold text-slate-800 mb-1">Create your free MyoGuard account</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Save your protocol, track weekly progress, and share your results with your physician — all in one place.
        </p>
        <ul className="mt-3 space-y-1 text-left">
          {[
            'Save and revisit your protocol anytime',
            'Track score changes week over week',
            'Share your report with your physician',
          ].map(b => (
            <li key={b} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="text-teal-500 font-bold mt-0.5 flex-shrink-0">✓</span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-3">
          <span className="text-xs text-slate-400">Already have an account?</span>
          <Link href="/sign-in-new" className="text-xs font-semibold text-teal-600 hover:underline">
            Sign in →
          </Link>
        </div>
      </div>

      {/*
        routing="path" + path="/sign-up-new" are REQUIRED here.
        Without them Clerk cannot serve sub-paths like
        /sign-up-new/verify-email-address (OTP step), returning 404.
        The [[...sign-up]] catch-all folder handles those sub-paths.
        signInUrl points to the matching catch-all sign-in route.
      */}
      <SignUp
        routing="path"
        path="/sign-up-new"
        signInUrl="/sign-in-new"
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
