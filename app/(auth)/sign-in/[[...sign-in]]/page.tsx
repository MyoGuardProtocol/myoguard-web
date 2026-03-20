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

      {/* Clerk sign-in widget.
          No routing/path/signUpUrl props — Clerk v6 App Router auto-detects
          path routing from the [[...sign-in]] catch-all segment convention.
          Explicit routing props conflict with Next.js 16 / React 19 concurrent
          rendering and caused the sign-in ↔ sign-up visible loop.
          signUpUrl and signInUrl are controlled via ClerkProvider in layout.tsx
          and NEXT_PUBLIC_CLERK_SIGN_IN_URL / SIGN_UP_URL env vars. */}
      <SignIn fallbackRedirectUrl="/dashboard" />

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
