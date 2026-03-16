import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';

const RISK_META: Record<string, {
  label:   string;
  colour:  string;
  bg:      string;
  border:  string;
  dot:     string;
}> = {
  LOW:      { label: 'Low Risk',      colour: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  MODERATE: { label: 'Moderate Risk', colour: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  HIGH:     { label: 'High Risk',     colour: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  dot: 'bg-orange-500'  },
  CRITICAL: { label: 'Critical Risk', colour: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500'     },
};

const SCORE_TRACK: Record<string, string> = {
  LOW:      'bg-emerald-500',
  MODERATE: 'bg-amber-500',
  HIGH:     'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      id:                 true,
      fullName:           true,
      subscriptionStatus: true,
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take:    10,
        include: { muscleScore: { select: { score: true, riskBand: true } } },
      },
      weeklyCheckins: {
        orderBy: { weekStart: 'desc' },
        take:    1,
        select:  { id: true, weekStart: true },
      },
    },
  });

  // User exists in Clerk but not yet synced to DB
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 font-sans flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
          <p className="text-slate-800 font-semibold mb-2">Account setup in progress</p>
          <p className="text-sm text-slate-500 mb-4">
            Your account is being provisioned. Please try again in a moment.
          </p>
          <Link
            href="/"
            className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors inline-block"
          >
            Back to Calculator
          </Link>
        </div>
      </main>
    );
  }

  const latestAssessment = user.assessments[0];
  const latestScore      = latestAssessment?.muscleScore?.score ?? null;
  const latestBand       = latestAssessment?.muscleScore?.riskBand ?? null;
  const prevScore        = user.assessments[1]?.muscleScore?.score ?? null;
  const delta            = latestScore !== null && prevScore !== null
    ? Math.round(latestScore - prevScore)
    : null;
  const isPremium        = user.subscriptionStatus === 'ACTIVE';
  const firstName        = user.fullName?.split(' ')[0] ?? null;

  return (
    <main className="min-h-screen bg-slate-50 font-sans">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
              Myo<span className="text-teal-600">Guard</span>
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
          </div>
          <span className={`text-xs border rounded-full px-3 py-1 font-medium ${
            isPremium
              ? 'bg-teal-50 text-teal-700 border-teal-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {isPremium ? '⭐ Premium' : 'Free Plan'}
          </span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 py-8 space-y-4">

        {/* ── Welcome ── */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Your muscle-protection dashboard
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── JOURNEY HERO ── primary CTA if they have a score */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {latestScore !== null && latestBand ? (
          <Link
            href="/dashboard/journey"
            className="block bg-slate-900 hover:bg-slate-800 rounded-2xl p-5 transition-colors group"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.15em] mb-1">
                  Your MyoGuard Journey
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-5xl font-black text-white tabular-nums leading-none">
                    {Math.round(latestScore)}
                  </span>
                  <span className="text-xl text-slate-500 font-light">/100</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 mt-1">
                {/* Risk badge */}
                {(() => {
                  const rm = RISK_META[latestBand] ?? RISK_META.HIGH;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${rm.bg} ${rm.border} ${rm.colour}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rm.dot}`} />
                      {rm.label}
                    </span>
                  );
                })()}
                {/* Delta */}
                {delta !== null && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    delta > 0
                      ? 'bg-emerald-900/60 text-emerald-400 border-emerald-700'
                      : delta < 0
                      ? 'bg-red-900/60 text-red-400 border-red-700'
                      : 'bg-slate-700 text-slate-400 border-slate-600'
                  }`}>
                    {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {Math.abs(delta)} pts
                  </span>
                )}
              </div>
            </div>

            {/* Score track */}
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${SCORE_TRACK[latestBand] ?? 'bg-teal-500'}`}
                style={{ width: `${Math.round(latestScore)}%` }}
              />
            </div>

            {/* CTA row */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {latestScore < 80
                  ? `${80 - Math.round(latestScore)} points from Low Risk`
                  : 'In the optimal Low Risk zone ✓'}
              </p>
              <span className="text-xs font-semibold text-teal-400 group-hover:text-teal-300 transition-colors flex items-center gap-1">
                View journey →
              </span>
            </div>
          </Link>
        ) : (
          /* No score yet */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-slate-700 font-semibold mb-1">No assessment yet</p>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              Complete the protocol calculator to generate your first MyoGuard Score.
            </p>
            <Link
              href="/"
              className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors inline-block"
            >
              Start Assessment →
            </Link>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── QUICK ACTIONS ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/checkin"
            className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-teal-300 hover:shadow-sm transition-all group"
          >
            <span className="text-xl mb-2 block">📋</span>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">Weekly check-in</p>
            <p className="text-xs text-slate-500 leading-snug">
              {user.weeklyCheckins[0]
                ? `Last: ${formatDate(user.weeklyCheckins[0].weekStart)}`
                : 'Log this week\'s metrics'}
            </p>
          </Link>
          <Link
            href="/"
            className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-teal-300 hover:shadow-sm transition-all group"
          >
            <span className="text-xl mb-2 block">🔄</span>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">New assessment</p>
            <p className="text-xs text-slate-500 leading-snug">
              {latestAssessment
                ? `Last: ${formatDate(latestAssessment.assessmentDate)}`
                : 'Run your first assessment'}
            </p>
          </Link>
        </div>

        {/* ── Physician Report CTA ── */}
        {latestScore !== null && (
          <Link
            href="/dashboard/report"
            className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl flex-shrink-0">🩺</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Physician Report</p>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">
                Print or share a clinical summary with your doctor
              </p>
            </div>
            <span className="text-xs font-semibold text-teal-600 flex-shrink-0">View →</span>
          </Link>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── ASSESSMENT HISTORY ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {user.assessments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Assessment history
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {user.assessments.slice(0, 5).map((a) => {
                const band  = a.muscleScore?.riskBand;
                const score = a.muscleScore?.score;
                const rm    = band ? (RISK_META[band] ?? RISK_META.HIGH) : null;
                return (
                  <Link key={a.id} href={`/dashboard/results/${a.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(a.assessmentDate)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {a.weightKg}kg · {a.proteinGrams}g protein target
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {score != null && (
                        <span className="text-sm font-bold text-slate-800 tabular-nums">
                          {Math.round(score)}/100
                        </span>
                      )}
                      {rm && band && (
                        <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${rm.bg} ${rm.border} ${rm.colour}`}>
                          {rm.label}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {user.assessments.length > 5 && (
                <div className="px-5 py-3 text-center">
                  <Link href="/dashboard/journey" className="text-xs text-teal-600 hover:underline font-medium">
                    View full history in Journey →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Subscription upgrade ── */}
        {!isPremium && latestScore !== null && (
          <div className="bg-slate-800 rounded-2xl p-5 text-white">
            <p className="font-semibold text-sm mb-1">Upgrade to Premium</p>
            <p className="text-slate-400 text-xs leading-relaxed mb-3">
              Unlock physician report exports, advanced trend analytics, and priority protocol updates.
            </p>
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Upgrade Now →
              </button>
            </form>
          </div>
        )}

      </div>
    </main>
  );
}
