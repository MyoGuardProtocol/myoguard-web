import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import JoinButton from './JoinButton';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

/**
 * /join?ref=DR-OKPALA-472
 *
 * Public landing page. A physician shares this URL with their patients.
 * - Validates the referral code
 * - Shows the physician's name so the patient can confirm
 * - CTA stores the code in sessionStorage and routes to /sign-up → /onboarding
 *
 * The onboarding form reads sessionStorage['myoguard_physician_code'] to
 * pre-fill the physician code field, which is then validated and used to
 * set User.physicianId on the patient's account.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref: rawCode } = await searchParams;
  const code = (rawCode ?? '').trim().toUpperCase();
  const isReferral = !!rawCode;

  // Resolve physician from referral code
  let physician: {
    displayName: string;
    specialty:   string | null;
    clinicName:  string | null;
  } | null = null;

  if (code) {
    const profile = await prisma.physicianProfile.findFirst({
      where:  { referralCode: code, isActive: true },
      select: { displayName: true, specialty: true, clinicName: true },
    });
    if (profile) physician = profile;
  }

  // ── Referral path — Patient Activation Mode (Midnight Silk) ──
  if (isReferral) {
    return (
      <main
        style={{ background: '#080C14', minHeight: '100vh' }}
        className="font-sans flex flex-col items-center justify-center px-4 py-12 relative"
      >
        <a
          href="/"
          className="absolute top-4 left-4 min-h-[44px] flex items-center text-[13px] text-slate-400 hover:text-white transition-colors"
        >
          ← Return to MyoGuard
        </a>

        {/* Logo */}
        <a href="/" className="no-underline mb-6">
          <div className="font-[Georgia,serif] text-[22px] font-black tracking-tight text-center">
            <span className="text-slate-100">Myo</span>
            <span className="text-teal-400">Guard</span>
          </div>
        </a>

        <div className="max-w-md w-full space-y-5">

          {/* Referral context banner */}
          <div className="text-center mb-4">
            <p className="text-sm text-slate-400">Prescribed by your physician</p>
            <p className="text-base font-semibold text-slate-100">MyoGuard Protocol Activation</p>
          </div>

          {physician ? (
            <>
              {/* Primary messaging */}
              <div className="text-center">
                <h1 className="text-lg font-semibold text-slate-100 text-center">
                  Activate Your Clinical Protocol
                </h1>
                <p className="text-sm text-slate-400 text-center mt-1">
                  You are activating a physician-guided muscle protection pathway.
                </p>
              </div>

              {/* Physician confirmation card */}
              <div className="bg-[#0D1421] border border-[#1A2744] rounded-2xl p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-teal-900/30 border border-teal-800/40 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>

                <div>
                  <p className="text-xs font-semibold text-teal-400 uppercase tracking-wide mb-1">
                    You&apos;re joining
                  </p>
                  <p className="text-xl font-bold text-slate-100">{physician.displayName}</p>
                  {(physician.specialty || physician.clinicName) && (
                    <p className="text-sm text-slate-400 mt-1">
                      {[physician.specialty, physician.clinicName].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                <div className="bg-[#080C14] border border-[#1A2744] rounded-xl px-4 py-2 inline-block">
                  <code className="text-xs font-mono text-slate-400 tracking-widest">{code}</code>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">
                  Create your MyoGuard account to link with{' '}
                  {physician.displayName.split(' ').slice(0, 2).join(' ')} and share your muscle
                  protection data securely.
                </p>
              </div>

              {/* CTA — client component unchanged */}
              <JoinButton code={code} />

              <p className="text-center text-xs text-slate-400">
                Already have an account?{' '}
                <Link href="/sign-in" className="text-teal-400 font-medium hover:underline">
                  Sign in
                </Link>
                {' '}and enter your code during setup.
              </p>

              <p className="text-center text-xs text-slate-400">
                Your health data is stored securely and only shared with{' '}
                {physician.displayName.split(' ').slice(0, 2).join(' ')}.
                <br />
                <Link href={`${APP_URL}/privacy`} className="underline hover:text-slate-300">
                  Privacy Policy
                </Link>
              </p>
            </>
          ) : (
            /* Invalid code — referral context preserved */
            <div className="bg-[#0D1421] border border-[#1A2744] rounded-2xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-900/20 border border-red-800/30 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-100">Invalid referral code</h1>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  The code &ldquo;{code}&rdquo; was not found. Please check with your physician and
                  try again.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-teal-400 font-medium hover:underline"
              >
                ← Return to MyoGuard
              </Link>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Non-referral path (no ?ref= param) — unchanged white UI ──
  return (
    <main className="min-h-screen bg-slate-50 font-sans flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-lg mx-auto">
          <Link href="/" className="flex items-baseline gap-1 w-fit">
            <span className="text-xl font-black text-slate-900 tracking-tight">
              Myo<span className="text-teal-600">Guard</span>
            </span>
            <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">No code provided</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Ask your physician for their referral code or link, then visit this page again.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-teal-600 font-medium hover:underline"
            >
              ← Return to MyoGuard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
