import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import PhysicianNav from '@/src/components/ui/PhysicianNav';

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

/** Lower number = higher priority in list. */
const RISK_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH:     1,
  MODERATE: 2,
  LOW:      3,
};

const BAND_STYLE: Record<string, {
  label:      string;
  pill:       string;
  dot:        string;
  bar:        string;     // left border accent on card
  track:      string;     // score progress bar
  statBg:     string;
  statText:   string;
  statBorder: string;     // individual band-coloured border for summary cells
}> = {
  CRITICAL: {
    label:      'Critical',
    pill:       'bg-red-50    text-red-700    border-red-200',
    dot:        'bg-red-500',
    bar:        'border-l-red-400',
    track:      'bg-red-500',
    statBg:     'bg-red-50',
    statText:   'text-red-700',
    statBorder: 'border-red-200',
  },
  HIGH: {
    label:      'High',
    pill:       'bg-orange-50 text-orange-700 border-orange-200',
    dot:        'bg-orange-500',
    bar:        'border-l-orange-400',
    track:      'bg-orange-500',
    statBg:     'bg-orange-50',
    statText:   'text-orange-700',
    statBorder: 'border-orange-200',
  },
  MODERATE: {
    label:      'Moderate',
    pill:       'bg-amber-50  text-amber-700  border-amber-200',
    dot:        'bg-amber-500',
    bar:        'border-l-amber-400',
    track:      'bg-amber-500',
    statBg:     'bg-amber-50',
    statText:   'text-amber-700',
    statBorder: 'border-amber-200',
  },
  LOW: {
    label:      'Low',
    pill:       'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot:        'bg-emerald-500',
    bar:        'border-l-emerald-400',
    track:      'bg-emerald-500',
    statBg:     'bg-emerald-50',
    statText:   'text-emerald-700',
    statBorder: 'border-emerald-200',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type PatientAssessment = {
  weightKg:       number;
  proteinGrams:   number;
  exerciseDaysWk: number;
  symptoms:       string[];
  muscleScore:    { score: number; riskBand: string; leanLossEstPct: number } | null;
};

/**
 * Derives up to 2 short clinical flag strings from the latest assessment.
 * Flags are shown on the patient card to surface the most actionable issues.
 */
function getFlags(a: PatientAssessment): string[] {
  const flags: string[] = [];

  // Protein deficit vs 1.4g/kg floor
  if (a.proteinGrams < a.weightKg * 1.26) flags.push('Protein deficit');

  // Activity
  if (a.exerciseDaysWk <= 1) flags.push('Sedentary');

  // High-impact symptoms first
  if (a.symptoms.includes('Muscle weakness')) flags.push('Muscle weakness');
  if (a.symptoms.includes('Fatigue'))         flags.push('Fatigue');

  // Lean-mass risk
  const leanLoss = a.muscleScore?.leanLossEstPct ?? 0;
  if (leanLoss >= 18) flags.push('High lean-loss risk');

  // GI — lower priority
  if (a.symptoms.includes('Nausea'))       flags.push('Nausea');
  if (a.symptoms.includes('Constipation')) flags.push('Constipation');

  return flags.slice(0, 2);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PatientListPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Physician auth guard — fetch id for secure patient queries
  const physician = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { id: true, role: true, referralSlug: true, fullName: true },
  });
  // PHYSICIAN_PENDING gets the holding screen, not the full list
  if (!physician) redirect('/dashboard');
  if (physician.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (physician.role !== 'PHYSICIAN') redirect('/dashboard');

  // Resolve physician profile for display name
  const physicianSlug = physician.referralSlug;
  let physicianProfile: { displayName: string } | null = null;
  if (physicianSlug) {
    physicianProfile = await prisma.physicianProfile.findUnique({
      where:  { slug: physicianSlug },
      select: { displayName: true },
    });
  }

  const displayName = physicianProfile?.displayName ?? physician.fullName ?? 'Physician';

  /**
   * Patient query strategy:
   *
   * Primary:  User.physicianId = this physician's DB User.id
   *           (set when a patient enters the physician's code during onboarding)
   *
   * Legacy:   User.referralSlug = this physician's referralSlug
   *           (patients who linked via the ?ref=slug URL before physicianId existed)
   *
   * Both are scoped to this physician — no patient can appear on another
   * physician's list.
   */
  const orClauses: Record<string, unknown>[] = [
    { physicianId: physician.id },
  ];
  if (physicianSlug) {
    orClauses.push({ referralSlug: physicianSlug });
  }

  const whereClause = {
    role:        'PATIENT' as const,
    assessments: { some: {} },
    OR:          orClauses,
  };

  const rawPatients = await prisma.user.findMany({
    where:  whereClause,
    select: {
      id:       true,
      fullName: true,
      email:    true,
      assessments: {
        orderBy: { assessmentDate: 'desc' as const },
        take:    1,
        include: {
          muscleScore: {
            select: { score: true, riskBand: true, leanLossEstPct: true },
          },
        },
      },
    },
    take: 200,
  });

  // Shape + sort by risk (Critical → High → Moderate → Low), then by score asc
  const patients = rawPatients
    .map(p => {
      const latest = p.assessments[0] ?? null;
      return { ...p, latest };
    })
    .filter(p => p.latest !== null)
    .sort((a, b) => {
      const bandA = a.latest!.muscleScore?.riskBand ?? 'LOW';
      const bandB = b.latest!.muscleScore?.riskBand ?? 'LOW';
      const orderDiff = (RISK_ORDER[bandA] ?? 3) - (RISK_ORDER[bandB] ?? 3);
      if (orderDiff !== 0) return orderDiff;
      // Same band: lower score first (worse patients surface first)
      return (a.latest!.muscleScore?.score ?? 100) - (b.latest!.muscleScore?.score ?? 100);
    });

  // Summary counts
  const counts = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
  for (const p of patients) {
    const band = (p.latest?.muscleScore?.riskBand ?? 'LOW') as keyof typeof counts;
    if (band in counts) counts[band]++;
  }
  const needsAttention = counts.CRITICAL + counts.HIGH;

  return (
    <main className="min-h-screen bg-slate-50 font-sans">

      <PhysicianNav activePath="/doctor/patients" displayName={displayName} />

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* ── Page title + nav ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Patient Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Sorted by highest risk first · {patients.length} linked patient{patients.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/doctor/start"
            className="flex-shrink-0 text-xs text-teal-600 hover:underline font-medium mt-1"
          >
            ← Start Sheet
          </Link>
        </div>

        {/* ── Summary stats ─────────────────────────────────────────────── */}
        {patients.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {(['CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as const).map(band => {
              const s = BAND_STYLE[band];
              return (
                <div
                  key={band}
                  className={`rounded-xl border p-3 text-center ${s.statBg} ${s.statBorder}`}
                >
                  <p className={`font-mono text-3xl font-black tabular-nums leading-none ${s.statText}`}>
                    {counts[band]}
                  </p>
                  <p className={`text-[11px] font-semibold mt-1.5 ${s.statText}`}>
                    {s.label} Risk
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Attention banner ──────────────────────────────────────────── */}
        {needsAttention > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
            <p className="text-sm text-red-700 font-medium">
              {needsAttention} patient{needsAttention !== 1 ? 's' : ''} need
              {needsAttention === 1 ? 's' : ''} clinical attention (High or Critical risk)
            </p>
          </div>
        )}

        {/* ── Patient list ──────────────────────────────────────────────── */}
        {patients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-2xl mb-3">👥</p>
            <p className="text-slate-700 font-semibold mb-1">No patients yet</p>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              Share your referral link and patients will appear here once they complete an assessment.
            </p>
            <Link
              href="/doctor/start"
              className="inline-block bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors"
            >
              Get Your Referral Link →
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {patients.map(p => {
              const a        = p.latest!;
              const band     = (a.muscleScore?.riskBand ?? 'LOW') as string;
              const score    = a.muscleScore?.score ?? null;
              const s        = BAND_STYLE[band] ?? BAND_STYLE.LOW;
              const flags    = getFlags(a);
              const isCritical = band === 'CRITICAL';
              const isHigh     = band === 'HIGH';
              const needsAttn  = isCritical || isHigh;

              return (
                <Link
                  key={p.id}
                  href={`/doctor/patients/${p.id}`}
                  className={`block bg-white rounded-2xl border border-slate-200 border-l-4 ${s.bar} shadow-sm hover:shadow-md hover:border-slate-300 transition-all px-5 py-4`}
                >
                  <div className="flex items-start gap-4">

                    {/* Score badge */}
                    <div className="flex-shrink-0 text-center w-14">
                      <p className={`font-mono text-2xl font-black tabular-nums leading-none ${needsAttn ? 'text-slate-800' : 'text-slate-600'}`}>
                        {score !== null ? Math.round(score) : '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">/100</p>
                    </div>

                    {/* Name + risk + flags */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                          {p.fullName || 'Unknown Patient'}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${s.pill}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label} Risk
                        </span>
                      </div>

                      {/* Score track */}
                      {score !== null && (
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2 w-full max-w-[200px]">
                          <div
                            className={`h-full rounded-full ${s.track}`}
                            style={{ width: `${Math.round(score)}%` }}
                          />
                        </div>
                      )}

                      {/* Flags row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {flags.map(f => (
                          <span
                            key={f}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium"
                          >
                            <span className={`w-1 h-1 rounded-full flex-shrink-0 ${needsAttn ? 'bg-orange-400' : 'bg-slate-300'}`} />
                            {f}
                          </span>
                        ))}
                        {flags.length === 0 && (
                          <span className="text-[11px] text-slate-400">No major flags</span>
                        )}
                        <span className="text-[11px] text-slate-400 ml-auto">
                          {shortDate(a.assessmentDate)}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <span className="text-slate-400 text-sm flex-shrink-0 mt-0.5">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}


      </div>
    </main>
  );
}
