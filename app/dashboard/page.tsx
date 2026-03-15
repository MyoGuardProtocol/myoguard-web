import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  LOW:      { label: 'Low Risk',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MODERATE: { label: 'Moderate Risk', cls: 'bg-amber-50  text-amber-700  border-amber-200'   },
  HIGH:     { label: 'High Risk',     cls: 'bg-orange-50 text-orange-700 border-orange-200'   },
  CRITICAL: { label: 'Critical Risk', cls: 'bg-red-50    text-red-700    border-red-200'      },
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
      id: true,
      fullName: true,
      subscriptionStatus: true,
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take: 10,
        include: { muscleScore: { select: { score: true, riskBand: true } } },
      },
      weeklyCheckins: {
        orderBy: { weekStart: 'desc' },
        take: 4,
      },
    },
  });

  // User exists in Clerk but not yet synced to DB
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 font-sans flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
          <p className="text-slate-800 font-semibold mb-2">Account setup in progress</p>
          <p className="text-sm text-slate-500 mb-4">Your account is being provisioned. Please try again in a moment.</p>
          <Link href="/" className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors inline-block">
            Back to Calculator
          </Link>
        </div>
      </main>
    );
  }

  const latestAssessment = user.assessments[0];
  const latestScore      = latestAssessment?.muscleScore?.score ?? null;
  const latestBand       = latestAssessment?.muscleScore?.riskBand ?? null;
  const isPremium        = user.subscriptionStatus === 'ACTIVE';

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
          <div className="flex items-center gap-3">
            <span className={`text-xs border rounded-full px-3 py-1 font-medium ${isPremium ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              {isPremium ? '⭐ Premium' : 'Free Plan'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome back{user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track your muscle protection progress here.</p>
        </div>

        {/* Score Summary */}
        {latestScore !== null && latestBand ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">Latest MyoGuard Score</p>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-slate-800">{latestScore}<span className="text-xl text-slate-400 font-normal">/100</span></div>
              <span className={`text-xs font-semibold border rounded-full px-3 py-1 ${RISK_BADGE[latestBand]?.cls ?? ''}`}>
                {RISK_BADGE[latestBand]?.label ?? latestBand}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${latestScore}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Assessed {formatDate(latestAssessment!.assessmentDate)}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
            <p className="text-slate-700 font-semibold mb-2">No assessment yet</p>
            <p className="text-sm text-slate-500 mb-4">Complete the protocol calculator to generate your first MyoGuard Score.</p>
            <Link href="/" className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors inline-block">
              Start Assessment →
            </Link>
          </div>
        )}

        {/* Assessment History */}
        {user.assessments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">Assessment History</p>
            <div className="space-y-3">
              {user.assessments.map((a) => {
                const band = a.muscleScore?.riskBand;
                const score = a.muscleScore?.score;
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{formatDate(a.assessmentDate)}</p>
                      <p className="text-xs text-slate-400">{a.weightKg}kg · {a.proteinGrams}g protein target</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {score !== undefined && score !== null && (
                        <span className="text-sm font-bold text-slate-800">{score}/100</span>
                      )}
                      {band && (
                        <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${RISK_BADGE[band]?.cls ?? ''}`}>
                          {RISK_BADGE[band]?.label ?? band}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weekly Check-in CTA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Weekly Check-in</p>
              <p className="text-sm font-semibold text-slate-800">Log this week&apos;s metrics</p>
              <p className="text-xs text-slate-500 mt-1">
                Track weight, protein adherence, workouts, and hydration week over week.
              </p>
              {user.weeklyCheckins[0] && (
                <p className="text-xs text-slate-400 mt-1">
                  Last check-in: {formatDate(user.weeklyCheckins[0].weekStart)}
                </p>
              )}
            </div>
            <Link href="/checkin" className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
              Check In →
            </Link>
          </div>
        </div>

        {/* Subscription */}
        {!isPremium && (
          <div className="bg-slate-800 rounded-2xl p-5 text-white">
            <p className="font-semibold text-sm mb-1">Upgrade to Premium</p>
            <p className="text-slate-300 text-xs leading-relaxed mb-3">
              Unlock full score trend history, physician report exports, and priority protocol updates.
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

        {/* Recalculate */}
        <div className="text-center">
          <Link href="/" className="text-sm text-teal-600 hover:underline font-medium">
            ← Run a new assessment
          </Link>
        </div>
      </div>
    </main>
  );
}
