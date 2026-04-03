import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import PostAuthSync from '@/src/components/ui/PostAuthSync';
import OnboardingRedirect from '@/src/components/ui/OnboardingRedirect';
import AssessmentHeroPlaceholder from '@/src/components/ui/AssessmentHeroPlaceholder';
import ContributingFactors, { type Factor, type ImpactLevel } from '@/src/components/ui/ContributingFactors';
import WeeklyFocusCard from '@/src/components/ui/WeeklyFocusCard';
import DashboardHeader from '@/src/components/ui/DashboardHeader';
import {
  generateWeeklyFocus,
  type CheckinWindow,
  type ProtocolTargets,
  type RiskBand as AdaptiveRiskBand,
} from '@/src/lib/adaptiveProtocol';

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
      // ProtocolPlan supplies the targets used by the weekly focus engine.
      // Only present on assessments saved after the protocol persistence build.
      protocolPlan: {
        select: {
          proteinTargetG:  true,
          hydrationTarget: true,
        },
      },
    },
  },
  // 4 weeks needed for trend analysis in the weekly focus engine.
  weeklyCheckins: {
    orderBy: { weekStart: 'desc' as const },
    take:    4,
    select: {
      id:            true,
      weekStart:     true,
      avgProteinG:   true,
      totalWorkouts: true,
      avgHydration:  true,
      avgWeightKg:   true,
      energyLevel:   true,
      nauseaLevel:   true,
    },
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
  // Three-phase load — handles every first-login race condition safely:
  //
  //   Phase 1 — fetchDashboardUser (findUnique by clerkId, indexed)
  //     Happy path: row exists and is up-to-date. Done.
  //
  //   Phase 2a — findUnique by email
  //     The Clerk webhook may have already created the row using the email
  //     as the primary key before the clerkId was attached (or the row was
  //     seeded manually). If so, UPDATE that row to stamp the current clerkId
  //     so Phase 1 works on every subsequent visit.
  //     This is the fix for: "Unique constraint failed on the fields: (email)"
  //     — the old upsert(where:{clerkId}) always fell through to CREATE when
  //     Phase 1 missed, hitting the unique email constraint on the existing row.
  //
  //   Phase 2b — create
  //     Neither clerkId nor email exists in the DB. Truly new user.
  //
  // All phases are wrapped in try/catch. A DB error does NOT crash the page;
  // we render a limited but functional dashboard shell instead of 503.
  let user: DashboardUser | null = null;
  let dbError: string | null = null;

  try {
    user = await fetchDashboardUser(userId);

    if (!user) {
      // Phases 2a/2b — need the Clerk identity to resolve email + display name
      console.log('[dashboard] no row by clerkId — checking email / provisioning');
      const clerkUser = await currentUser();
      if (!clerkUser) redirect('/sign-in-new');

      const email     = clerkUser.emailAddresses[0]?.emailAddress ?? '';
      const firstName = clerkUser.firstName ?? '';
      const lastName  = clerkUser.lastName  ?? '';
      const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'MyoGuard User';

      try {
        // Phase 2a — does a row already exist for this email?
        const byEmail = await prisma.user.findUnique({
          where:  { email },
          select: { id: true },
        });

        if (byEmail) {
          // Row exists (created by webhook or seed) but lacks this clerkId.
          // Attach the clerkId so future lookups hit Phase 1 directly.
          console.log('[dashboard] found row by email — attaching clerkId for', email);
          user = await prisma.user.update({
            where:  { id: byEmail.id },
            data:   { clerkId: userId },
            select: USER_SELECT,
          });
        } else {
          // Phase 2b — no row by clerkId, no row by email: safe to create.
          console.log('[dashboard] provisioning new user row for', email);
          user = await prisma.user.create({
            data:   { clerkId: userId, email, fullName, role: 'PATIENT', subscriptionStatus: 'FREE' },
            select: USER_SELECT,
          });
        }
      } catch (provisionErr: unknown) {
        const msg = provisionErr instanceof Error ? provisionErr.message : String(provisionErr);
        console.error('[dashboard] user provisioning FAILED:', msg);
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
        <DashboardHeader />

        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8 space-y-8">

          {/* ── Welcome ── */}
          <div>
            <h1 className="text-xl font-semibold text-slate-800">
              Welcome back{shellName ? `, ${shellName}` : ''}
            </h1>
            <p className="text-slate-500 text-sm mt-1">Your muscle-protection dashboard</p>
          </div>

          {/* DB unavailable notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-5">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              {isTimeout ? 'Database connection timed out' : 'Profile data temporarily unavailable'}
            </p>
            <p className="text-xs text-amber-700 leading-relaxed mb-4">
              {isTimeout
                ? 'We could not reach the database within 8 seconds. This usually means the Supabase project is paused (free tier auto-pauses after inactivity) or outbound port 6543 is blocked on this network.'
                : 'Your assessment history and saved data could not be loaded right now. You can still take a new assessment.'}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href="/dashboard"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-3 py-2 transition-colors"
              >
                ↻ Retry
              </a>
              <Link href="/dashboard/assessment" className="text-xs font-medium text-amber-700 hover:underline">
                Take a new assessment →
              </Link>
            </div>
          </div>

          {/* Quick actions — always available even when DB is down */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm">
            <Link
              href="/checkin"
              className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">📋</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Check-in</p>
                  <p className="text-xs text-slate-500">Log metrics</p>
                </div>
              </div>
              <span className="text-slate-300 text-sm">→</span>
            </Link>
            <Link
              href="/dashboard/assessment"
              className="flex items-center justify-between bg-green-600 hover:bg-green-700 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🔄</span>
                <div>
                  <p className="text-sm font-semibold text-white">Assess</p>
                  <p className="text-xs text-green-200">New assessment</p>
                </div>
              </div>
              <span className="text-green-300 text-sm">→</span>
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
  // Extract first actual given name, skipping honorifics so "Dr Onyeka Okpala"
  // produces "Onyeka" not "Dr" in the greeting.
  const HONORIFICS       = ['Dr', 'Dr.', 'Prof', 'Prof.', 'Mr', 'Mrs', 'Ms', 'Miss'];
  const nameParts        = (user.fullName ?? '').split(' ').filter(Boolean);
  const firstName        = nameParts.find(p => !HONORIFICS.includes(p)) ?? nameParts[0] ?? null;
  const isPhysician      = user.role === 'PHYSICIAN';

  // Derive factors only when an assessment exists
  const factors = latestAssessment
    ? deriveFactors(latestAssessment, user.profile ?? null)
    : [];

  // ── Weekly protocol focus ─────────────────────────────────────────────────
  // Computed server-side from the last 4 check-ins + the latest protocol plan.
  // Always rendered — WeeklyFocusCard handles the zero-data empty state itself.
  const latestPlan        = latestAssessment?.protocolPlan  ?? null;
  const latestMuscleScore = latestAssessment?.muscleScore   ?? null;

  const checkinWindow: CheckinWindow[] = user.weeklyCheckins.map(c => ({
    weekStart:     c.weekStart,
    avgProteinG:   c.avgProteinG   ?? null,
    totalWorkouts: c.totalWorkouts ?? null,
    avgHydration:  c.avgHydration  ?? null,
    avgWeightKg:   c.avgWeightKg   ?? null,
    energyLevel:   c.energyLevel   ?? null,
    nauseaLevel:   c.nauseaLevel   ?? null,
  }));

  // Only compute when we have protocol targets (requires a completed assessment)
  const weeklyFocus = latestMuscleScore
    ? generateWeeklyFocus(checkinWindow, {
        proteinTargetG:  latestPlan?.proteinTargetG  ?? latestMuscleScore.proteinTargetG,
        hydrationTarget: latestPlan?.hydrationTarget ?? 2.5,
        riskBand:        latestMuscleScore.riskBand   as AdaptiveRiskBand,
      } satisfies ProtocolTargets)
    : null;

  const daysSinceLastCheckin = user.weeklyCheckins[0]
    ? Math.floor((Date.now() - user.weeklyCheckins[0].weekStart.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const hasCheckinData =
    weeklyFocus !== null && weeklyFocus.snapshot.weeksAnalysed > 0;
  // ─────────────────────────────────────────────────────────────────────────

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
      {/* Redirects first-time users (no profile) to /onboarding to complete setup */}
      <OnboardingRedirect hasProfile={!!user.profile} />

      {/* ── Header ── */}
      <DashboardHeader plan={isPremium ? 'premium' : 'free'} />

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8">

        {/* ── Welcome ── */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-800">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Your muscle-protection dashboard</p>
        </div>

        {/* ── Physician banner (full width, above grid) ── */}
        {connectedPhysicianName && (
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-xl px-5 py-4 mb-8">
            <span className="text-lg flex-shrink-0">👨‍⚕️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">
                Under Physician Care
              </p>
              <p className="text-sm font-medium text-teal-900 mt-0.5">
                Connected to {connectedPhysicianName}
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 flex-shrink-0 uppercase tracking-wide">
              Active
            </span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TWO-COLUMN GRID
            Left (main):    score hero · factors · weekly focus · history
            Right (sidebar): actions · portal · report · upgrade
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

          {/* ── Main column ───────────────────────────────────────────────── */}
          <div className="space-y-8">

            {/* Score hero */}
            {latestScore !== null && latestBand ? (
              <Link
                href="/dashboard/journey"
                className="block bg-slate-900 hover:bg-slate-800 rounded-xl p-8 transition-colors group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.15em] mb-2">
                      Your MyoGuard Journey
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-6xl font-black text-white tabular-nums leading-none">
                        {Math.round(latestScore)}
                      </span>
                      <span className="text-2xl text-slate-500 font-light">/100</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 mt-1">
                    {(() => {
                      const rm = RISK_META[latestBand] ?? RISK_META.HIGH;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${rm.bg} ${rm.border} ${rm.colour}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rm.dot}`} />
                          {rm.label}
                        </span>
                      );
                    })()}
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

                <div className="h-2 rounded-full bg-slate-700 overflow-hidden mb-4">
                  <div
                    className={`h-full rounded-full transition-all ${SCORE_TRACK[latestBand] ?? 'bg-teal-500'}`}
                    style={{ width: `${Math.round(latestScore)}%` }}
                  />
                </div>

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
              <AssessmentHeroPlaceholder />
            )}

            {/* Contributing factors */}
            {factors.length > 0 && <ContributingFactors factors={factors} />}

            {/* Weekly protocol focus */}
            {latestScore !== null && (
              <WeeklyFocusCard
                focus={weeklyFocus}
                hasData={hasCheckinData}
                daysSinceLastCheckin={daysSinceLastCheckin}
              />
            )}

            {/* Assessment history */}
            {user.assessments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-700">Assessment History</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {user.assessments.slice(0, 5).map((a) => {
                    const band  = a.muscleScore?.riskBand;
                    const score = a.muscleScore?.score;
                    const rm    = band ? (RISK_META[band] ?? RISK_META.HIGH) : null;
                    return (
                      <Link key={a.id} href={`/dashboard/results/${a.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {formatDate(a.assessmentDate)}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
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
                    <div className="px-6 py-4 text-center">
                      <Link href="/dashboard/journey" className="text-xs text-teal-600 hover:underline font-medium">
                        View full history in Journey →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Quick actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/dashboard/assessment"
                  className="flex items-center justify-between w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
                >
                  New Assessment
                  <span>→</span>
                </Link>
                <Link
                  href="/checkin"
                  className="flex items-center justify-between w-full border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-5 py-2.5 font-medium text-sm transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span>📋</span>
                    Weekly Check-in
                  </span>
                  <span className="text-slate-400 text-xs tabular-nums">
                    {user.weeklyCheckins[0] ? formatDate(user.weeklyCheckins[0].weekStart) : '→'}
                  </span>
                </Link>
              </div>
              {latestAssessment && (
                <p className="text-xs text-slate-400 mt-4 text-center">
                  Last assessed {formatDate(latestAssessment.assessmentDate)}
                </p>
              )}
            </div>

            {/* Physician portal (physicians only) */}
            {isPhysician && (
              <Link
                href="/doctor/start"
                className="block bg-white rounded-xl shadow-sm p-6 border border-teal-100 hover:border-teal-300 hover:shadow transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">👨‍⚕️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-teal-800 mb-1">Physician Portal</p>
                    <p className="text-xs text-teal-600 leading-snug">
                      Referral link, patient activity, and practice tools
                    </p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-teal-600 mt-4 text-right">Open →</p>
              </Link>
            )}

            {/* Physician report */}
            {latestScore !== null && (
              <Link
                href="/dashboard/report"
                className="block bg-white rounded-xl shadow-sm p-6 hover:shadow transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">🩺</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 mb-1">Physician Report</p>
                    <p className="text-xs text-slate-500 leading-snug">
                      Print or share a clinical summary with your doctor
                    </p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-teal-600 mt-4 text-right">View report →</p>
              </Link>
            )}

            {/* Upgrade (free users with a score) */}
            {!isPremium && latestScore !== null && (
              <div className="bg-slate-900 rounded-xl p-6 text-white">
                <p className="font-semibold text-sm mb-2">Upgrade to Premium</p>
                <p className="text-slate-400 text-xs leading-relaxed mb-5">
                  Unlock physician report exports, advanced trend analytics, and priority protocol updates.
                </p>
                <form action="/api/stripe/checkout" method="POST">
                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
                  >
                    Upgrade Now →
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
