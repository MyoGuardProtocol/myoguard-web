import { auth }            from '@clerk/nextjs/server';
import { redirect }        from 'next/navigation';
import { prisma }          from '@/src/lib/prisma';
import { runHealthChecks } from '@/src/lib/health';
import type { CheckStatus } from '@/src/lib/health';
import Link                from 'next/link';

export const dynamic   = 'force-dynamic';
export const revalidate = 0;

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CheckStatus, { bg: string; text: string; dot: string; label: string }> = {
  ok:    { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'OK'    },
  warn:  { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'WARN'  },
  error: { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'ERROR' },
};

function StatusBadge({ status }: { status: CheckStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HealthPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in-new');

  // ADMIN role check — degrade gracefully when DB is unreachable so the
  // health page is still reachable precisely when it is most needed.
  let passedAdminCheck = false;
  let dbCheckFailed    = false;

  try {
    const user = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true },
    });
    passedAdminCheck = user?.role === 'ADMIN';
  } catch {
    dbCheckFailed    = true;
    passedAdminCheck = true; // allow any authenticated user when DB is down
  }

  if (!passedAdminCheck) redirect('/dashboard');

  const report = await runHealthChecks();

  const overallBanner: Record<CheckStatus, { border: string; bg: string; text: string; label: string }> = {
    ok:    { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', label: 'All systems operational'             },
    warn:  { border: 'border-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-800',   label: 'Warnings detected — review below'    },
    error: { border: 'border-red-200',     bg: 'bg-red-50',     text: 'text-red-800',     label: 'Errors detected — action required'   },
  };
  const banner = overallBanner[report.overall];

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-2xl mx-auto px-5 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
              Admin
            </Link>
            <span className="text-slate-300">›</span>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">System Health</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">System Health</h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date(report.timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' })}
            {' · '}
            <span className="font-mono text-xs">{report.environment}</span>
          </p>
        </div>

        {/* DB degraded notice */}
        {dbCheckFailed && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-red-800">Database unreachable — showing degraded health view</p>
            <p className="text-xs text-red-600 mt-0.5">Admin role check was bypassed. Showing health status for all authenticated users.</p>
          </div>
        )}

        {/* Overall banner */}
        <div className={`border rounded-2xl px-5 py-4 mb-6 ${banner.border} ${banner.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusBadge status={report.overall} />
              <span className={`text-sm font-semibold ${banner.text}`}>{banner.label}</span>
            </div>
            <a
              href="/admin/health"
              className="text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-lg px-3 py-1.5 hover:border-slate-300 transition-colors"
            >
              ↻ Refresh
            </a>
          </div>
        </div>

        {/* Individual checks */}
        <div className="space-y-2">
          {report.checks.map((check) => (
            <div
              key={check.name}
              className={`bg-white border rounded-xl px-5 py-3.5 flex items-start justify-between gap-4 ${
                check.status === 'error' ? 'border-red-200'
                : check.status === 'warn'  ? 'border-amber-200'
                : 'border-slate-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-0.5">{check.name}</p>
                <p className="text-sm text-slate-600 leading-snug">{check.message}</p>
                {check.detail && (
                  <p className="text-xs text-slate-400 font-mono mt-1 leading-relaxed">{check.detail}</p>
                )}
              </div>
              <div className="flex-shrink-0 mt-0.5">
                <StatusBadge status={check.status} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            JSON API: <span className="font-mono text-slate-500">/api/health</span>
          </p>
          <Link
            href="/admin/physicians"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← Admin home
          </Link>
        </div>

      </div>
    </main>
  );
}
