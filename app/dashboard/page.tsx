/**
 * /dashboard — Patient entry point.
 *
 * Server component: role check fires before render.
 *   PHYSICIAN / PHYSICIAN_PENDING / ADMIN → /doctor/dashboard
 *   PATIENT (or no DB row yet)            → patient dashboard
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';

export default async function PatientDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // ── Role check ────────────────────────────────────────────────────────────
  const dbUser = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: {
      role:     true,
      fullName: true,
      assessments: {
        select: {
          score:          true,
          riskBand:       true,
          assessmentDate: true,
          protocolPlan: {
            select: { proteinTargetG: true },
          },
        },
        orderBy: { assessmentDate: 'desc' },
        take: 1,
      },
    },
  }).catch(() => null);

  if (
    dbUser?.role === 'PHYSICIAN' ||
    dbUser?.role === 'PHYSICIAN_PENDING' ||
    dbUser?.role === 'ADMIN'
  ) {
    redirect('/doctor/onboarding');
  }

  const clerkUser  = await currentUser();
  const firstName  = clerkUser?.firstName
    ?? dbUser?.fullName?.split(' ')[0]
    ?? 'there';

  const latest        = dbUser?.assessments?.[0] ?? null;
  const score         = latest ? Math.round(latest.score) : null;
  const riskBand      = latest?.riskBand ?? null;
  const proteinTarget = latest?.protocolPlan?.proteinTargetG
    ? Math.round(latest.protocolPlan.proteinTargetG)
    : null;

  const riskColors: Record<string, { text: string; bg: string; border: string }> = {
    LOW:      { text: 'text-teal-700',  bg: 'bg-teal-50',  border: 'border-teal-200' },
    MODERATE: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    HIGH:     { text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200' },
    CRITICAL: { text: 'text-red-800',   bg: 'bg-red-100',  border: 'border-red-300' },
  };
  const riskCfg = riskBand ? riskColors[riskBand] : null;

  // ── Time-based greeting ───────────────────────────────────────────────────
  const hour      = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const today     = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Myo<span className="text-teal-600">Guard</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Home">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </Link>
            <SignOutButton redirectUrl="/">
              <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* ── Hero greeting ── */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{today}</p>
          <h1 className="text-3xl font-bold text-slate-900">
            Good {timeOfDay}, {firstName}.
          </h1>
          <p className="text-sm text-slate-500 mt-1">Your muscle-protection dashboard</p>
        </div>

        {/* ── Score card ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-6">
            MyoGuard Score
          </p>

          {score !== null && riskCfg && riskBand ? (
            <div className="flex flex-col gap-5">
              <div className="flex items-end gap-4">
                <span className={`text-7xl font-black leading-none ${riskCfg.text}`}>{score}</span>
                <div className="flex flex-col gap-1 pb-1">
                  <span className="text-slate-400 text-lg">/100</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${riskCfg.bg} ${riskCfg.text} border ${riskCfg.border}`}>
                    {riskBand === 'LOW'      ? 'Low Risk'
                      : riskBand === 'MODERATE' ? 'Moderate Risk'
                      : riskBand === 'HIGH'     ? 'High Risk'
                      : 'Critical'}
                  </span>
                </div>
              </div>

              {/* Gradient progress bar */}
              <div className="w-full h-3 rounded-full overflow-hidden bg-slate-100">
                <div
                  className="h-3 rounded-full transition-all duration-700"
                  style={{
                    width:      `${score}%`,
                    background: 'linear-gradient(to right, #ef4444, #f59e0b, #14b8a6)',
                  }}
                />
              </div>

              <p className="text-xs text-slate-400">
                Last assessed{' '}
                {new Date(latest!.assessmentDate).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-700">No assessment on file</p>
                <p className="text-sm text-slate-400 mt-1">Takes 3 minutes. No account upgrade needed.</p>
              </div>
              <Link
                href="/dashboard/assessment"
                className="bg-teal-600 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                Take your first assessment →
              </Link>
            </div>
          )}
        </div>

        {/* ── Three action cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Card 1 — New Assessment (primary) */}
          <Link
            href="/dashboard/assessment"
            className="bg-teal-600 text-white rounded-2xl shadow-sm p-5 flex flex-col gap-3 hover:bg-teal-700 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold">New Assessment</p>
              <p className="text-xs text-teal-100 mt-0.5 leading-relaxed">
                Generate a fresh MyoGuard Score and updated protocol
              </p>
            </div>
            <span className="text-teal-200 text-xs font-medium group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>

          {/* Card 2 — My Protocol */}
          <Link
            href="/dashboard/report"
            className="bg-white border border-teal-200 rounded-2xl shadow-sm p-5 flex flex-col gap-3 hover:bg-teal-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">My Protocol</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                View your personalised protein, fibre and supplement targets
              </p>
            </div>
            <span className="text-teal-600 text-xs font-medium group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>

          {/* Card 3 — Weekly Check-in */}
          <Link
            href="/dashboard/checkin"
            className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-3 hover:bg-slate-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Weekly Check-in</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Log this week — takes 60 seconds
              </p>
            </div>
            <span className="text-slate-400 text-xs font-medium group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>

        </div>

        {/* ── Info strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-400 mb-1">Protein target</p>
            <p className="text-sm font-semibold text-slate-700">
              {proteinTarget ? `${proteinTarget} g/day` : '1.6 g/kg body weight'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-400 mb-1">Next check-in</p>
            <p className="text-sm font-semibold text-slate-700">
              {latest ? 'Due this week' : 'Complete assessment first'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-400 mb-1">Physician linked</p>
            <p className="text-sm font-semibold text-slate-700">Not yet linked</p>
          </div>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 mt-10 px-6 py-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            MyoGuard Clinical Oversight · For educational use only · Not a substitute for medical advice
          </p>
          <Link href="/privacy" className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline">
            Privacy Policy
          </Link>
        </div>
      </footer>

    </div>
  );
}
