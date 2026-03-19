import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div className="w-full flex flex-col items-center gap-5">

      {/* Context card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 text-center">
        <p className="text-sm font-bold text-slate-800 mb-1">
          Create your free MyoGuard account
        </p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Save your protocol, track weekly progress, and share your results
          with your physician — all in one place.
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
          <Link href="/sign-in" className="text-xs font-semibold text-teal-600 hover:underline">
            Sign in →
          </Link>
        </div>
      </div>

      {/* Clerk sign-up widget
          routing="path" + path="/sign-up" mirror the sign-in fix above.
          Clerk needs to know its base URL to emit correct navigations for
          multi-step flows and to point its "Sign in" link at /sign-in. */}
      <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/dashboard" />

      {/* Guest fallback */}
      <Link
        href="/"
        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        Continue as guest instead
      </Link>
    </div>
  );
}
