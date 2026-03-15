import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import CopyButton from './CopyButton';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

export default async function DoctorStartPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Look up the physician profile linked to this user
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true, referralSlug: true, fullName: true },
  });

  // Redirect non-physicians to dashboard
  if (!user || user.role !== 'PHYSICIAN') {
    redirect('/dashboard');
  }

  const slug = user.referralSlug;
  const referralUrl = slug ? `${APP_URL}/?ref=${slug}` : null;

  let physician = null;
  if (slug) {
    physician = await prisma.physicianProfile.findUnique({
      where: { slug },
      select: { displayName: true, clinicName: true, specialty: true, slug: true },
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
              Myo<span className="text-teal-600">Guard</span> Protocol
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
          </div>
          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 font-medium">
            {physician?.displayName ?? user.fullName ?? 'Physician Portal'}
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-slate-800">Physician Start Sheet</h1>
          <p className="text-slate-500 text-sm mt-1">
            Everything you need to refer patients to the MyoGuard Protocol.
          </p>
        </div>

        {/* Referral Link */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">Your Referral Link</p>

          {referralUrl ? (
            <>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <code className="text-sm text-slate-700 flex-1 break-all">{referralUrl}</code>
                <CopyButton text={referralUrl} />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Share this link with patients. Their assessments will be attributed to your profile.
              </p>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-700 font-medium">No referral slug assigned</p>
              <p className="text-xs text-amber-600 mt-1">
                Contact <a href="mailto:hello@myoguard.health" className="underline">hello@myoguard.health</a> to have a referral slug created for your account.
              </p>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-4">How It Works</p>
          <ol className="space-y-4">
            {[
              {
                n:    '1',
                head: 'Share your link',
                body: `Send patients ${referralUrl ?? 'your personalised referral URL'} via email, WhatsApp, or your patient portal.`,
              },
              {
                n:    '2',
                head: 'Patients complete the assessment',
                body: 'They enter their GLP-1 medication, dose, weight, activity level, and current symptoms. No account required.',
              },
              {
                n:    '3',
                head: 'Protocol generated instantly',
                body: 'A personalised protein, fibre, and hydration protocol plus a MyoGuard Score are calculated and displayed in seconds.',
              },
            ].map(step => (
              <li key={step.n} className="flex gap-4">
                <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{step.head}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Profile Summary */}
        {physician && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">Your Profile</p>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-slate-500 w-32 flex-shrink-0">Display name</dt>
                <dd className="text-slate-800 font-medium">{physician.displayName}</dd>
              </div>
              {physician.clinicName && (
                <div className="flex gap-2">
                  <dt className="text-slate-500 w-32 flex-shrink-0">Clinic</dt>
                  <dd className="text-slate-800">{physician.clinicName}</dd>
                </div>
              )}
              {physician.specialty && (
                <div className="flex gap-2">
                  <dt className="text-slate-500 w-32 flex-shrink-0">Specialty</dt>
                  <dd className="text-slate-800">{physician.specialty}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-slate-500 w-32 flex-shrink-0">Slug</dt>
                <dd className="text-slate-600 font-mono text-xs">{physician.slug}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-400">
              To update your profile details, contact <a href="mailto:hello@myoguard.health" className="underline hover:text-slate-600">hello@myoguard.health</a>.
            </p>
          </div>
        )}

        {/* Patient Panel placeholder */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">Patient Activity</p>
          <div className="text-center py-6">
            <p className="text-sm text-slate-500">Patient panel coming in Phase 2.</p>
            <p className="text-xs text-slate-400 mt-1">Assessment completions and score distributions will appear here once your patients complete assessments via your referral link.</p>
          </div>
        </div>

        {/* Nav */}
        <div className="text-center">
          <Link href="/dashboard" className="text-sm text-teal-600 hover:underline font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
