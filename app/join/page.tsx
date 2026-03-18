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

          {/* ── Valid code — show physician confirmation ── */}
          {physician ? (
            <div className="space-y-6">

              {/* Physician card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>

                <div>
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">
                    You&apos;re joining
                  </p>
                  <h1 className="text-xl font-bold text-slate-900">{physician.displayName}</h1>
                  {(physician.specialty || physician.clinicName) && (
                    <p className="text-sm text-slate-500 mt-1">
                      {[physician.specialty, physician.clinicName].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl px-4 py-2 inline-block">
                  <code className="text-xs font-mono text-slate-600 tracking-widest">{code}</code>
                </div>

                <p className="text-sm text-slate-500 leading-relaxed">
                  Create your MyoGuard account to link with {physician.displayName.split(' ').slice(0, 2).join(' ')} and
                  share your muscle protection data securely.
                </p>
              </div>

              {/* CTA — client component handles sessionStorage */}
              <JoinButton code={code} />

              <p className="text-center text-xs text-slate-400">
                Already have an account?{' '}
                <Link href="/sign-in" className="text-teal-600 font-medium hover:underline">
                  Sign in
                </Link>
                {' '}and enter your code during setup.
              </p>
            </div>

          ) : (

            /* ── Invalid or missing code ── */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {code ? 'Invalid referral code' : 'No code provided'}
                </h1>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  {code
                    ? `The code "${code}" was not found. Please check with your physician and try again.`
                    : 'Ask your physician for their referral code or link, then visit this page again.'}
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-teal-600 font-medium hover:underline"
              >
                ← Return to MyoGuard
              </Link>
            </div>
          )}

          {/* Footer note */}
          {physician && (
            <p className="mt-6 text-center text-xs text-slate-400">
              Your health data is stored securely and only shared with {physician.displayName.split(' ').slice(0, 2).join(' ')}.
              <br />
              <Link href={`${APP_URL}/privacy`} className="underline hover:text-slate-600">Privacy Policy</Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
