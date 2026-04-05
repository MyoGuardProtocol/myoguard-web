import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';

/**
 * /doctor — Physician portal landing page.
 *
 * Signed-in physicians are routed directly to their portal without seeing
 * this marketing page. Signed-in patients may view it per policy — they are
 * not automatically redirected. Unauthenticated visitors see the full page.
 *
 * Mobile-first: all elements use full-width tap targets, readable font sizes,
 * and stack vertically on xs screens. The feature grid goes 1-col on mobile,
 * 3-col on sm+.
 */
export default async function DoctorLandingPage() {
  const { userId } = await auth();

  if (userId) {
    const user = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true },
    });
    if (user?.role === 'PHYSICIAN')         redirect('/doctor/patients');
    if (user?.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
    // PATIENT or unknown → fall through and render the landing page
  }
  return (
    <main className="min-h-screen bg-white font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-slate-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900 tracking-tight">
              Myo<span className="text-teal-600">Guard</span>
            </span>
            <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
          </Link>
          <Link
            href="/sign-in"
            className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors whitespace-nowrap"
          >
            Sign in →
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full text-center space-y-7">

          {/* Tag */}
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-3.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
            Physician Portal
          </span>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight tracking-tight">
              Built for Physicians.<br />Designed for Speed.
            </h1>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed">
              Monitor your GLP-1 patients&apos; muscle health in real-time. Clinical-grade risk
              scores, personalised protocols, and flag-based prioritisation — in under 60 seconds.
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Link
              href="/doctor/sign-in"
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white text-base font-semibold px-8 py-4 rounded-2xl hover:bg-slate-800 active:bg-slate-950 transition-colors shadow-sm min-h-[52px]"
            >
              Continue as Physician
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/doctor/sign-up"
              className="w-full inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-8 py-3.5 rounded-2xl hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-colors min-h-[48px]"
            >
              New to MyoGuard? Create account
            </Link>
            <p className="text-xs text-slate-400">
              Sign in with Google or email link — no password required
            </p>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-5 flex-wrap pt-1">
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

          {/* Feature grid — 1 col on mobile, 3 col on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
            {[
              { icon: '🧬', label: 'MyoGuard Score', detail: 'Per-patient muscle risk 0–100' },
              { icon: '🚩', label: 'Clinical Flags', detail: 'Protein deficit, fatigue, weakness' },
              { icon: '📊', label: 'Risk Bands', detail: 'Low → Critical prioritisation' },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                <div className="text-xl">{f.icon}</div>
                <p className="text-sm font-semibold text-slate-700">{f.label}</p>
                <p className="text-xs text-slate-500 leading-snug">{f.detail}</p>
              </div>
            ))}
          </div>

          {/* Patient flow separator */}
          <p className="text-xs text-slate-400 pt-2">
            Are you a patient?{' '}
            <Link href="/" className="text-teal-600 font-medium hover:underline">
              Take the assessment →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
