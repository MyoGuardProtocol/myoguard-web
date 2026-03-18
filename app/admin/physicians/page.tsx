import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import ApproveButton from './ApproveButton';

/**
 * /admin/physicians — Admin-only view of PHYSICIAN_PENDING accounts.
 *
 * Shows submitted profile data for each pending physician and an "Approve"
 * button that calls POST /api/admin/upgrade-physician.
 *
 * Protected: middleware.ts requires session; this page enforces ADMIN role.
 */
export default async function AdminPhysiciansPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const admin = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { role: true, fullName: true },
  });

  if (!admin || admin.role !== 'ADMIN') redirect('/dashboard');

  const pending = await prisma.user.findMany({
    where:   { role: 'PHYSICIAN_PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id:        true,
      fullName:  true,
      email:     true,
      createdAt: true,
      physicianOnboarding: {
        select: {
          country:       true,
          specialty:     true,
          licenseNumber: true,
          submittedAt:   true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 font-sans">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-xl font-black text-slate-900 tracking-tight">
              Myo<span className="text-teal-600">Guard</span>
              <span className="text-slate-400 font-light text-sm ml-0.5">Protocol</span>
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">Admin · Physician Approvals</p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-3 py-1 font-medium">
            {admin.fullName ?? 'Admin'}
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Pending Physician Accounts</h1>
            <p className="text-slate-500 text-sm mt-1">
              {pending.length === 0
                ? 'All caught up — no pending accounts.'
                : `${pending.length} account${pending.length === 1 ? '' : 's'} awaiting approval.`}
            </p>
          </div>
          {pending.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
              {pending.length} pending
            </span>
          )}
        </div>

        {/* Empty state */}
        {pending.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-slate-700 font-semibold">No pending accounts</p>
            <p className="text-slate-400 text-sm mt-1">New physician sign-ups will appear here for review.</p>
          </div>
        )}

        {/* Pending physician cards */}
        {pending.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{p.fullName}</p>
                <p className="text-xs text-slate-500 break-all">{p.email}</p>
              </div>
              <span className="text-[10px] font-mono text-slate-400 flex-shrink-0 pt-0.5">
                {p.id.slice(0, 12)}…
              </span>
            </div>

            {/* Onboarding details */}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {p.physicianOnboarding?.country && (
                <>
                  <dt className="text-slate-400 text-xs">Country</dt>
                  <dd className="text-slate-700 text-xs">{p.physicianOnboarding.country}</dd>
                </>
              )}
              {p.physicianOnboarding?.specialty && (
                <>
                  <dt className="text-slate-400 text-xs">Specialty</dt>
                  <dd className="text-slate-700 text-xs">{p.physicianOnboarding.specialty}</dd>
                </>
              )}
              {p.physicianOnboarding?.licenseNumber && (
                <>
                  <dt className="text-slate-400 text-xs">Licence</dt>
                  <dd className="text-slate-700 text-xs font-mono">{p.physicianOnboarding.licenseNumber}</dd>
                </>
              )}
              <dt className="text-slate-400 text-xs">Applied</dt>
              <dd className="text-slate-500 text-xs">
                {(p.physicianOnboarding?.submittedAt ?? p.createdAt).toLocaleDateString('en-GB', {
                  day:   'numeric',
                  month: 'short',
                  year:  'numeric',
                })}
              </dd>
            </dl>

            {/* Approve button (client component) */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <a
                href={`mailto:${p.email}?subject=Your%20MyoGuard%20Physician%20Account%20is%20Approved`}
                className="text-xs text-slate-500 hover:text-teal-600 font-medium transition-colors"
              >
                ✉ Email physician
              </a>
              <ApproveButton userId={p.id} />
            </div>
          </div>
        ))}

        {/* Navigation */}
        <div className="text-center">
          <Link href="/dashboard" className="text-sm text-teal-600 hover:underline font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
