import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import PhysicianAvatar from '@/src/components/ui/PhysicianAvatar';

/**
 * /doctor/dashboard — Physician command hub.
 *
 * Role routing:
 *   PHYSICIAN         → renders dashboard (command center)
 *   PHYSICIAN_PENDING → renders "Account under review" holding screen
 *   ADMIN             → /admin/physicians
 *   PATIENT           → /dashboard
 *
 * clerkId-fallback (same pattern as /dashboard):
 *   If no DB row is found by clerkId, we look up by email and stamp the new
 *   clerkId onto the existing row. This handles the case where a Clerk account
 *   is deleted+recreated (new userId, same email) without losing role data.
 */

const PHYSICIAN_SELECT = {
  id:       true,
  role:     true,
  fullName: true,
  email:    true,
  physicianOnboarding: {
    select: { country: true, specialty: true, submittedAt: true },
  },
} as const;

type PhysicianRow = Awaited<ReturnType<typeof fetchByClerkId>>;

function fetchByClerkId(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId }, select: PHYSICIAN_SELECT });
}

export default async function DoctorDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // ── Phase 1: fast path — look up by clerkId ──────────────────────────────
  let user: PhysicianRow | null = await fetchByClerkId(userId);

  // ── Phase 2: email-fallback — handles clerkId mismatch after Clerk account
  //    recreation (same email, new Clerk userId) ─────────────────────────────
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) redirect('/sign-in');

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';

    if (email) {
      const byEmail = await prisma.user.findUnique({
        where:  { email },
        select: { id: true },
      }).catch(() => null);

      if (byEmail) {
        // Attach the new clerkId so Phase 1 hits on the next request.
        user = await prisma.user.update({
          where:  { id: byEmail.id },
          data:   { clerkId: userId },
          select: PHYSICIAN_SELECT,
        }).catch(() => null);
      }
    }
  }

  // Still no row → new physician (webhook hasn't fired yet or first visit)
  if (!user) redirect('/doctor/onboarding');

  // ── Role routing ──────────────────────────────────────────────────────────
  if (user.role === 'ADMIN')   redirect('/admin/physicians');
  if (user.role === 'PATIENT') redirect('/dashboard');

  // ── PHYSICIAN_PENDING ─────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50 font-sans">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900 tracking-tight">
              Myo<span className="text-teal-600">Guard</span>
            </span>
            <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 font-semibold">
              Pending Verification
            </span>
            <PhysicianAvatar
              fullName={user.fullName}
              email={user.email}
              role={user.role}
            />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-5">

        {/* ── Status card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-5">

          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">Account under review</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              {user.fullName ? `Thank you, ${user.fullName}.` : 'Thank you.'} Your physician account
              has been submitted and is under review. We verify all accounts within{' '}
              <strong className="text-slate-700">24 hours</strong>.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">What happens next</p>
            {[
              'Our team will verify your credentials',
              'You\'ll receive a confirmation email once approved',
              'Full patient dashboard access will be unlocked',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex-shrink-0 flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-600">{item}</p>
              </div>
            ))}
          </div>

          <a
            href="mailto:hello@myoguard.health?subject=Physician%20Account%20Verification"
            className="inline-flex items-center gap-2 text-sm text-teal-600 font-medium hover:underline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Contact us to expedite verification
          </a>
        </div>

        {/* ── Submitted profile summary ── */}
        {user.physicianOnboarding && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Submitted Profile
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-3">
                <dt className="text-slate-400 w-28 flex-shrink-0">Name</dt>
                <dd className="text-slate-800 font-medium">{user.fullName}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-slate-400 w-28 flex-shrink-0">Email</dt>
                <dd className="text-slate-700 break-all">{user.email}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-slate-400 w-28 flex-shrink-0">Country</dt>
                <dd className="text-slate-700">{user.physicianOnboarding.country}</dd>
              </div>
              {user.physicianOnboarding.specialty && (
                <div className="flex gap-3">
                  <dt className="text-slate-400 w-28 flex-shrink-0">Specialty</dt>
                  <dd className="text-slate-700">{user.physicianOnboarding.specialty}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="text-slate-400 w-28 flex-shrink-0">Submitted</dt>
                <dd className="text-slate-500 text-xs mt-0.5">
                  {user.physicianOnboarding.submittedAt.toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="text-center">
          <SignOutButton redirectUrl="/">
            <button className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
