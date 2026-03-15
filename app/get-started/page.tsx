import Link from 'next/link';

/**
 * /get-started — auth entry page.
 * Replaces the bare Clerk sign-in screen as the destination for the
 * "Sign In" header link. Presents three clear options so users understand
 * exactly what they're choosing and why.
 */
export default function GetStartedPage() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans">

      {/* ── Brand header ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
            Myo<span className="text-teal-600">Guard</span> Protocol
          </Link>
          <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-slate-800 mb-2">
              Get started with MyoGuard
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Create an account to save your protocol, track your progress over time,
              and share your results with your physician.
            </p>
          </div>

          {/* Option cards */}
          <div className="space-y-3">

            {/* Create account — primary */}
            <Link
              href="/sign-up"
              className="flex items-center justify-between w-full bg-teal-600 hover:bg-teal-700 text-white rounded-2xl px-5 py-4 transition-colors group"
            >
              <div>
                <p className="font-bold text-sm">Create free account</p>
                <p className="text-xs text-teal-200 mt-0.5">Save protocol · Track progress · Share with physician</p>
              </div>
              <span className="text-lg group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>

            {/* Sign in — secondary */}
            <Link
              href="/sign-in"
              className="flex items-center justify-between w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-2xl px-5 py-4 transition-colors group"
            >
              <div>
                <p className="font-bold text-sm">Sign in</p>
                <p className="text-xs text-slate-400 mt-0.5">Access your saved protocols and progress</p>
              </div>
              <span className="text-slate-400 text-lg group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>

            {/* Continue as guest — tertiary */}
            <Link
              href="/"
              className="flex items-center justify-between w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl px-5 py-4 transition-colors group"
            >
              <div>
                <p className="font-semibold text-sm">Continue as guest</p>
                <p className="text-xs text-slate-400 mt-0.5">View your protocol without saving — data is not retained</p>
              </div>
              <span className="text-slate-300 text-lg group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>

          </div>

          {/* Footer note */}
          <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
            No credit card required. Free accounts include protocol history and weekly check-ins.
          </p>
        </div>
      </div>

      <p className="pb-6 text-xs text-slate-400 text-center">
        © 2026 MyoGuard Protocol ·{' '}
        <Link href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy Policy</Link>
      </p>
    </main>
  );
}
