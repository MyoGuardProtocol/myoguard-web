import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <div className="w-full flex flex-col items-center gap-5">

      {/* Context card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 text-center">
        <p className="text-sm font-bold text-slate-800 mb-1">
          Welcome back to MyoGuard
        </p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Sign in to access your saved protocols, weekly check-in history,
          and progress tracking.
        </p>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-3">
          <span className="text-xs text-slate-400">No account yet?</span>
          <Link href="/sign-up" className="text-xs font-semibold text-teal-600 hover:underline">
            Create free account →
          </Link>
        </div>
      </div>

      {/* Clerk sign-in widget
          routing="path" + path="/sign-in" are required when using [[...sign-in]]
          catch-all routes.  Without them Clerk defaults to virtual routing and
          handles sign-in ↔ sign-up switching internally (never navigates away),
          causing the loop.  With path routing Clerk emits real navigations so
          multi-step flows and "Create account" links go to the correct URLs. */}
      <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/dashboard" />

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
