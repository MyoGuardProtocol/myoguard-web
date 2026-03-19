import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import PostAuthSync from '@/src/components/ui/PostAuthSync';
import AssessmentHeroPlaceholder from '@/src/components/ui/AssessmentHeroPlaceholder';
import ContributingFactors, { type Factor, type ImpactLevel } from '@/src/components/ui/ContributingFactors';

// ─── Module-level DB helper ───────────────────────────────────────────────────
// Defined at module scope so TypeScript can infer the return type via
// Awaited<ReturnType<typeof fetchDashboardUser>>.

const USER_SELECT = {
  id:                 true,
  fullName:           true,
  role:               true,
  physicianId:        true,
  subscriptionStatus: true,
  // GLP-1 medication/dose data (set via /onboarding — may be null if skipped)
  profile: {
    select: {
      glp1Medication: true,
      glp1DoseMg:     true,
      glp1Stage:      true,
    },
  },
  assessments: {
    orderBy: { assessmentDate: 'desc' as const },
    take:    10,
    // include returns ALL Assessment scalar fields (weightKg, proteinGrams,
    // exerciseDaysWk, hydrationLitres, symptoms, fatigue, muscleWeakness, nausea)
    // plus the selected relation fields below.
    include: {
      muscleScore: {
        select: {
          score:          true,
          riskBand:       true,
          leanLossEstPct: true,
          proteinTargetG: true,
        },
      },
    },
  },
  weeklyCheckins: {
    orderBy: { weekStart: 'desc' as const },
    take:    1,
    select:  { id: true, weekStart: true },
  },
} as const;

async function fetchDashboardUser(clerkId: string) {
  return prisma.user.findUnique({
    where:  { clerkId },
    select: USER_SELECT,
  });
}

type DashboardUser = NonNullable<Awaited<ReturnType<typeof fetchDashboardUser>>>;
// ─────────────────────────────────────────────────────────────────────────────

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

// ─── Contributing-factor derivation ──────────────────────────────────────────
// Translates raw DB fields from the latest Assessment + UserProfile into the
// five Factor objects rendered by <ContributingFactors />.

type LatestAssessment = NonNullable<DashboardUser['assessments'][number]>;
type UserProfile      = NonNullable<DashboardUser['profile']>;

function deriveFactors(
  a:       LatestAssessment,
  profile: UserProfile | null,
): Factor[] {
  // ── 1. Protein ────────────────────────────────────────────────────────────
  const proteinMin = Math.round(a.weightKg * 1.4);   // standard muscle-protective floor
  const gapG       = Math.round(a.proteinGrams - proteinMin);
  const gapPct     = a.proteinGrams / proteinMin;

  const proteinImpact: ImpactLevel =
    gapPct >= 1.0 ? 'LOW' : gapPct >= 0.9 ? 'MODERATE' : 'HIGH';

  const proteinState = gapPct >= 1.0
    ? `${Math.round(a.proteinGrams)}g / day · +${gapG}g above minimum`
    : `${Math.round(a.proteinGrams)}g / day · ${gapG}g below minimum`;

  const proteinDetail = gapPct >= 1.0
    ? `Your protein target meets the muscle-protective minimum of ${proteinMin}g/day for your body weight. Keep it up.`
    : `Your current protein intake is below the ${proteinMin}g/day minimum needed to protect muscle during GLP-1 therapy. Prioritise protein at every meal.`;

  // ── 2. Activity ───────────────────────────────────────────────────────────
  const activityDays   = a.exerciseDaysWk;
  const activityLevel  = activityDays >= 5 ? 'active' : activityDays >= 3 ? 'moderate' : 'sedentary';
  const activityLabel  = activityLevel === 'active'    ? 'Active (5+ days / week)'
                       : activityLevel === 'moderate'  ? 'Moderately Active (3–4 days / week)'
                       : 'Sedentary (< 2 days / week)';
  const activityImpact: ImpactLevel = activityLevel === 'active' ? 'LOW'
                                    : activityLevel === 'moderate' ? 'MODERATE'
                                    : 'HIGH';
  const activityDetail = activityLevel === 'active'
    ? 'Your exercise frequency is the strongest protective factor against GLP-1-associated muscle loss. Maintain or increase resistance training.'
    : activityLevel === 'moderate'
    ? 'Moderate activity provides good muscle protection. Adding 1–2 more resistance sessions per week can meaningfully reduce your lean mass risk.'
    : 'Sedentary activity is the biggest single driver of muscle loss during GLP-1 therapy. Starting with 2× weekly resistance sessions has the highest impact on your score.';

  // ── 3. GLP-1 Dose ────────────────────────────────────────────────────────
  const HIGH_DOSE_THRESHOLDS: Record<string, number> = {
    semaglutide: 1.0, tirzepatide: 5.0,
  };

  let glp1State:  string;
  let glp1Impact: ImpactLevel;
  let glp1Detail: string;

  if (!profile || !profile.glp1Medication || !profile.glp1DoseMg) {
    glp1State  = 'Profile not set up';
    glp1Impact = 'MODERATE';
    glp1Detail = 'Complete your profile to get a personalised GLP-1 dose risk analysis.';
  } else {
    const medName     = profile.glp1Medication.includes('tirzepatide') ? 'Tirzepatide' : 'Semaglutide';
    const medKey      = medName.toLowerCase() as 'semaglutide' | 'tirzepatide';
    const threshold   = HIGH_DOSE_THRESHOLDS[medKey] ?? 1.0;
    const isHighDose  = profile.glp1DoseMg > threshold;
    const stage       = profile.glp1Stage ?? '';
    const stageLabel  = stage === 'MAINTENANCE' ? 'maintenance phase'
                      : stage === 'DOSE_ESCALATION' ? 'dose-escalation phase'
                      : stage === 'INITIATION' ? 'initiation phase'
                      : 'active treatment';

    glp1State  = `${medName} ${profile.glp1DoseMg}mg · ${stageLabel}`;
    glp1Impact = isHighDose ? 'HIGH' : 'MODERATE';
    glp1Detail = isHighDose
      ? `At ${profile.glp1DoseMg}mg, ${medName} significantly suppresses appetite, making it harder to hit protein targets. Extra focus on high-protein, low-volume foods is essential.`
      : `At ${profile.glp1DoseMg}mg, ${medName} provides moderate appetite suppression. Hitting your protein target is achievable with consistent meal planning.`;
  }

  // ── 4. Symptoms ──────────────────────────────────────────────────────────
  const musculoSymptoms = ['Muscle weakness', 'Fatigue'];
  const giSymptoms      = ['Nausea', 'Constipation', 'Bloating', 'Reduced appetite'];

  const hasMusculo = a.symptoms.some(s => musculoSymptoms.includes(s));
  const hasGI      = a.symptoms.some(s => giSymptoms.includes(s));

  const symptomsImpact: ImpactLevel = hasMusculo ? 'HIGH' : hasGI ? 'MODERATE' : 'LOW';

  const topSymptoms = a.symptoms.slice(0, 3);
  const symptomsState = topSymptoms.length
    ? topSymptoms.join(' · ')
    : 'None reported';

  const symptomsDetail = hasMusculo
    ? 'Fatigue and muscle weakness are early signs of sarcopenic change during GLP-1 therapy. Prioritising protein and resistance training is critical right now.'
    : hasGI
    ? 'GI symptoms like nausea and constipation can reduce your ability to eat enough protein. Smaller, high-protein meals and increased hydration can help.'
    : 'No concerning symptoms reported. This positively supports your muscle-protection profile.';

  // ── 5. Hydration ─────────────────────────────────────────────────────────
  const hydrationState  = `${a.hydrationLitres.toFixed(1)}L / day target`;
  const hydrationImpact: ImpactLevel = 'LOW';
  const hydrationDetail = `Aim for ${a.hydrationLitres.toFixed(1)}L of water daily. Adequate hydration supports muscle protein synthesis and reduces GLP-1 GI side effects.`;

  return [
    { icon: '🍗', label: 'Protein Intake',  state: proteinState,   detail: proteinDetail,   impact: proteinImpact   },
    { icon: '🏃', label: 'Activity Level',  state: activityLabel,  detail: activityDetail,  impact: activityImpact  },
    { icon: '💊', label: 'GLP-1 Dose',      state: glp1State,      detail: glp1Detail,      impact: glp1Impact      },
    { icon: '⚡', label: 'Symptoms',        state: symptomsState,  detail: symptomsDetail,  impact: symptomsImpact  },
    { icon: '💧', label: 'Hydration',       state: hydrationState, detail: hydrationDetail, impact: hydrationImpact },
  ];
}
// ─────────────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // ── Fetch user ─────────────────────────────────────────────────────────────
  // Two-phase load:
  //   1. fetchDashboardUser  — fast DB read (indexed by clerkId)
  //   2. upsert fallback     — first-login / webhook-race guard: if no row yet,
  //      provision one immediately from Clerk's currentUser() so the dashboard
  //      never blocks on the webhook.
  // Both phases are wrapped in try/catch with specific error logging.
  // A DB timeout (ETIMEDOUT, ENOTFOUND) or missing row does NOT crash the
  // page — we render a limited but functional dashboard shell instead of 503.
  let user: DashboardUser | null = null;
  let dbError: string | null = null;

  try {
    user = await fetchDashboardUser(userId);
    if (user) {
      // Happy path — row exists
    } else {
      // No row yet (first login before webhook fires, or webhook missed).
      // Provision the row synchronously so the dashboard loads immediately.
      console.log('[dashboard] no user row — provisioning from currentUser()');
      const clerkUser = await currentUser();
      if (!clerkUser) redirect('/sign-in-new');

      const email     = clerkUser.emailAddresses[0]?.emailAddress ?? '';
      const firstName = clerkUser.firstName ?? '';
      const lastName  = clerkUser.lastName  ?? '';
      const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'MyoGuard User';

      try {
        user = await prisma.user.upsert({
          where:  { clerkId: userId },
          update: {},
          create: { clerkId: userId, email, fullName, role: 'PATIENT', subscriptionStatus: 'FREE' },
          select: USER_SELECT,
        });
        console.log('[dashboard] provisioned new user row for', email);
      } catch (upsertErr: unknown) {
        const msg = upsertErr instanceof Error ? upsertErr.message : String(upsertErr);
        console.error('[dashboard] prisma.user.upsert FAILED:', msg);
        dbError = msg;
      }
    }
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error('[dashboard] fetchDashboardUser FAILED:', msg);
    dbError = msg;
  }

  // ── DB unavailable — render a limited but functional shell ───────────────
  // We do NOT redirect away or show a hard 503. The user is authenticated and
  // their session is valid; the DB being temporarily unreachable should not
  // log them out or prevent them using the app at all.
  if (!user) {
    // Decode a display name from the Clerk session if available (no DB needed)
    let shellName: string | null = null;
    try {
      const clerkUser = await currentUser();
      shellName = clerkUser?.firstName ?? null;
    } catch { /* ignore */ }

    const isTimeout = dbError?.includes('ETIMEDOUT') || dbError?.includes('timeout') || dbError?.includes('ENOTFOUND');

    return (
      <main className="min-h-screen bg-slate-50 font-sans">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div>
              <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight hover:opacity-80 transition-opacity">
                Myo<span className="text-teal-600">Guard</span>
              </Link>
              <p className="text-xs text-slate-500 mt-0.5">Physician-Formulated · Data-Driven Muscle Protection</p>
            </div>
            <span className="text-xs border rounded-full px-3 py-1 font-medium bg-slate-100 text-slate-500 border-slate-200">
              Free Plan
            </span>
          </div>
        </header>

        <div className="max-w-xl mx-auto px-5 py-8 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Welcome back{shellName ? `, ${shellName}` : ''}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Your muscle-protection dashboard</p>
          </div>

          {/* DB unavailable notice — friendly, not a hard error */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              {isTimeout ? 'Database connection timed out' : 'Profile data temporarily unavailable'}
            </p>
            <p className="text-xs text-amber-700 leading-relaxed mb-3">
              {isTimeout
                ? 'We could not reach the database within 8 seconds. This usually means the Supabase project is paused (free tier auto-pauses after inactivity) or outbound port 6543 is blocked on this network.'
                : 'Your assessment history and saved data could not be loaded right now. You can still take a new assessment.'}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href="/dashboard"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                ↻ Retry
              </a>
              <Link
                href="/"
                className="text-xs font-medium text-amber-700 hover:underline"
              >
                Take a new assessment →
              </Link>
            </div>
          </div>

          {/* Keep quick actions functional — don't block on DB */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/checkin"
              className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-teal-300 hover:shadow-sm transition-all"
            >
              <span className="text-xl mb-2 block">📋</span>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">Weekly check-in</p>
              <p className="text-xs text-slate-500 leading-snug">Log this week&apos;s metrics</p>
            </Link>
            <Link
              href="/"
              className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-teal-300 hover:shadow-sm transition-all"
            >
              <span className="text-xl mb-2 block">🔄</span>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">New assessment</p>
              <p className="text-xs text-slate-500 leading-snug">Run your first assessment</p>
            </Link>
          </div>
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
  const isPhysician      = user.role === 'PHYSICIAN';

  // Derive factors only when an assessment exists
  const factors = latestAssessment
    ? deriveFactors(latestAssessment, user.profile ?? null)
    : [];

  // ── Connected physician display name (patients only) ─────────────────────
  // user.physicianId is an informal FK to User.id (no Prisma @relation).
  // Resolve: physician User → referralSlug → PhysicianProfile.displayName.
  let connectedPhysicianName: string | null = null;
  if (!isPhysician && user.physicianId) {
    try {
      const physicianUser = await prisma.user.findUnique({
        where:  { id: user.physicianId },
        select: { referralSlug: true, fullName: true },
      });
      if (physicianUser?.referralSlug) {
        const profile = await prisma.physicianProfile.findUnique({
          where:  { slug: physicianUser.referralSlug },
          select: { displayName: true },
        });
        connectedPhysicianName = profile?.displayName ?? physicianUser.fullName ?? null;
      } else {
        connectedPhysicianName = physicianUser?.fullName ?? null;
      }
    } catch {
      // Non-critical — omit the banner on DB error
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      {/* Silently syncs a pending guest assessment to the DB after first login */}
      <PostAuthSync />

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

        {/* ── Connected physician banner (patients with a linked physician) ── */}
        {connectedPhysicianName && (
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3">
            <span className="text-lg flex-shrink-0">👨‍⚕️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">
                Under Physician Care
              </p>
              <p className="text-sm font-medium text-teal-900 mt-0.5">
                Connected to {connectedPhysicianName}
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 flex-shrink-0 uppercase tracking-wide">
              Active
            </span>
          </div>
        )}

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
          /* No score yet — client component reads sessionStorage to decide
             between skeleton (pending sync) and the true empty state.       */
          <AssessmentHeroPlaceholder />
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── CONTRIBUTING FACTORS ── only when a score exists */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {factors.length > 0 && <ContributingFactors factors={factors} />}

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

        {/* ── Physician Portal CTA (physicians only) ── */}
        {isPhysician && (
          <Link
            href="/doctor/start"
            className="flex items-center gap-4 bg-teal-50 border border-teal-200 rounded-2xl px-5 py-4 hover:border-teal-400 hover:shadow-sm transition-all"
          >
            <span className="text-2xl flex-shrink-0">👨‍⚕️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-teal-800">Physician Portal</p>
              <p className="text-xs text-teal-600 leading-snug mt-0.5">
                View your referral link, patient activity, and practice tools
              </p>
            </div>
            <span className="text-xs font-semibold text-teal-600 flex-shrink-0">Open →</span>
          </Link>
        )}

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
