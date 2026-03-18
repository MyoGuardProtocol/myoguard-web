import Link from 'next/link';

/**
 * /doctor — Physician portal landing page.
 *
 * Public (no auth required). The CTA routes to /sign-in with a redirect back
 * to /doctor/onboarding so physicians land directly on their setup form after
 * authenticating via Google or magic-link email (no password friction).
 */
export default function DoctorLandingPage() {
  return (
    <main className="min-h-screen bg-white font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-slate-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900 tracking-tight">
              Myo<span className="text-teal-600">Guard</span>
            </span>
            <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
          </Link>
          <Link
            href="/sign-in"
            className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
          >
            Already have an account? Sign in →
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full text-center space-y-8">

          {/* Tag */}
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-3.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
            Physician Portal
          </span>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 leading-tight tracking-tight">
              Built for Physicians.<br />Designed for Speed.
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed">
              Monitor your GLP-1 patients&apos; muscle health in real-time. Clinical-grade risk
              scores, personalised protocols, and flag-based prioritisation — in under 60 seconds.
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Link
              href="/sign-in?redirect_url=/doctor/onboarding"
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white text-base font-semibold px-8 py-4 rounded-2xl hover:bg-slate-800 active:bg-slate-950 transition-colors shadow-sm"
            >
              Continue as Physician
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <p className="text-xs text-slate-400">
              Sign in with Google or email link — no password required
            </p>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 flex-wrap pt-2">
            {[
              'Physician-Formulated',
              'Evidence-Based',
              'GLP-1 Specialist Tool',
            ].map(tag => (
              <span key={tag} className="flex items-center gap-1.5 text-xs text-slate-500">
                <svg
                  className="w-3.5 h-3.5 text-teal-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 12 12"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 6l3 3 5-5" />
                </svg>
                {tag}
              </span>
            ))}
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-3 gap-3 pt-2 text-left">
            {[
              { icon: '🧬', label: 'MyoGuard Score', detail: 'Per-patient muscle risk 0–100' },
              { icon: '🚩', label: 'Clinical Flags', detail: 'Protein deficit, fatigue, weakness' },
              { icon: '📊', label: 'Risk Bands', detail: 'Low → Critical prioritisation' },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 rounded-xl p-3 space-y-1">
                <div className="text-lg">{f.icon}</div>
                <p className="text-xs font-semibold text-slate-700">{f.label}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
