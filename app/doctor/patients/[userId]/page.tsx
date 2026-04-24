import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import Link from 'next/link';
import ContributingFactors, { type Factor, type ImpactLevel } from '@/src/components/ui/ContributingFactors';
import PhysicianNav from '@/src/components/ui/PhysicianNav';
import PhysicianReviewPanel from '@/src/components/ui/PhysicianReviewPanel';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_META: Record<string, {
  label:   string;
  colour:  string;
  bg:      string;
  border:  string;
  dot:     string;
  track:   string;
}> = {
  LOW:      { label: 'Low Risk',      colour: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', track: 'bg-emerald-500' },
  MODERATE: { label: 'Moderate Risk', colour: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   track: 'bg-amber-500'   },
  HIGH:     { label: 'High Risk',     colour: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  dot: 'bg-orange-500',  track: 'bg-orange-500'  },
  CRITICAL: { label: 'Critical Risk', colour: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     track: 'bg-red-500'     },
};

// ─── DB query shape ───────────────────────────────────────────────────────────

const PATIENT_SELECT = {
  id:       true,
  fullName: true,
  email:    true,
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
    include: {
      muscleScore: {
        select: {
          score:          true,
          riskBand:       true,
          leanLossEstPct: true,
          proteinTargetG: true,
          explanation:    true,
        },
      },
      physicianReview: {
        select: {
          overallImpression: true,
          followUpDays:      true,
          note:              true,
          reviewedAt:        true,
        },
      },
    },
  },
} as const;

async function fetchPatient(userId: string) {
  return prisma.user.findUnique({
    where:  { id: userId },
    select: PATIENT_SELECT,
  });
}

type Patient         = NonNullable<Awaited<ReturnType<typeof fetchPatient>>>;
type PatientAssmt    = Patient['assessments'][number];
type PatientProfile  = NonNullable<Patient['profile']>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const HIGH_DOSE_THRESHOLDS: Record<string, number> = {
  semaglutide: 1.0,
  tirzepatide: 5.0,
};

/**
 * Derives the 5 muscle-protection factor cards from the latest assessment.
 * Mirrors the same logic used on the patient-facing dashboard so the physician
 * sees exactly the same risk breakdown the patient sees.
 */
function deriveFactors(
  a:       PatientAssmt,
  profile: PatientProfile | null,
): Factor[] {
  // ── 1. Protein ────────────────────────────────────────────────────────────
  const proteinMin = Math.round(a.weightKg * 1.4);
  const gapG       = Math.round(a.proteinGrams - proteinMin);
  const gapPct     = a.proteinGrams / proteinMin;

  const proteinImpact: ImpactLevel =
    gapPct >= 1.0 ? 'LOW' : gapPct >= 0.9 ? 'MODERATE' : 'HIGH';

  const proteinState = gapPct >= 1.0
    ? `${Math.round(a.proteinGrams)}g / day · +${gapG}g above minimum`
    : `${Math.round(a.proteinGrams)}g / day · ${gapG}g below minimum`;

  const proteinDetail = gapPct >= 1.0
    ? `Patient is meeting the ${proteinMin}g/day minimum for their body weight. Protein intake is not a current concern.`
    : `Patient is below the ${proteinMin}g/day minimum needed to preserve muscle on GLP-1 therapy. Consider a protein counselling referral.`;

  // ── 2. Activity ───────────────────────────────────────────────────────────
  const activityDays  = a.exerciseDaysWk;
  const activityLevel = activityDays >= 5 ? 'active' : activityDays >= 3 ? 'moderate' : 'sedentary';
  const activityLabel = activityLevel === 'active'
    ? 'Active (5+ days / week)'
    : activityLevel === 'moderate'
    ? 'Moderately Active (3–4 days / week)'
    : 'Sedentary (< 2 days / week)';

  const activityImpact: ImpactLevel = activityLevel === 'active'   ? 'LOW'
                                    : activityLevel === 'moderate' ? 'MODERATE'
                                    : 'HIGH';

  const activityDetail = activityLevel === 'active'
    ? 'Exercise frequency is within the protective range. Patient is maintaining adequate resistance stimulus.'
    : activityLevel === 'moderate'
    ? 'Patient exercises 3–4 days/week. Adding 1–2 resistance sessions can further reduce lean mass risk.'
    : 'Patient is sedentary — the strongest independent predictor of GLP-1-associated sarcopenia. Exercise referral is strongly indicated.';

  // ── 3. GLP-1 Dose ─────────────────────────────────────────────────────────
  let glp1State:  string;
  let glp1Impact: ImpactLevel;
  let glp1Detail: string;

  if (!profile || !profile.glp1Medication || !profile.glp1DoseMg) {
    glp1State  = 'Profile not completed';
    glp1Impact = 'MODERATE';
    glp1Detail = 'Patient has not completed their medication profile. Encourage profile setup for full risk analysis.';
  } else {
    const medName    = profile.glp1Medication.includes('tirzepatide') ? 'Tirzepatide' : 'Semaglutide';
    const medKey     = medName.toLowerCase() as 'semaglutide' | 'tirzepatide';
    const threshold  = HIGH_DOSE_THRESHOLDS[medKey] ?? 1.0;
    const isHighDose = profile.glp1DoseMg > threshold;
    const stage      = profile.glp1Stage ?? '';
    const stageLabel = stage === 'MAINTENANCE'     ? 'maintenance phase'
                     : stage === 'DOSE_ESCALATION' ? 'dose-escalation phase'
                     : stage === 'INITIATION'      ? 'initiation phase'
                     : 'active treatment';

    glp1State  = `${medName} ${profile.glp1DoseMg}mg · ${stageLabel}`;
    glp1Impact = isHighDose ? 'HIGH' : 'MODERATE';
    glp1Detail = isHighDose
      ? `${medName} at ${profile.glp1DoseMg}mg causes significant appetite suppression, making adequate protein intake harder to achieve without dietary intervention.`
      : `${medName} at ${profile.glp1DoseMg}mg provides moderate appetite suppression. Protein targets should be achievable with standard dietary counselling.`;
  }

  // ── 4. Symptoms ───────────────────────────────────────────────────────────
  const musculoSymptoms = ['Muscle weakness', 'Fatigue'];
  const giSymptoms      = ['Nausea', 'Constipation', 'Bloating', 'Reduced appetite'];

  const hasMusculo = a.symptoms.some(s => musculoSymptoms.includes(s));
  const hasGI      = a.symptoms.some(s => giSymptoms.includes(s));

  const symptomsImpact: ImpactLevel = hasMusculo ? 'HIGH' : hasGI ? 'MODERATE' : 'LOW';
  const topSymptoms = a.symptoms.slice(0, 3);
  const symptomsState = topSymptoms.length ? topSymptoms.join(' · ') : 'None reported';

  const symptomsDetail = hasMusculo
    ? 'Fatigue or muscle weakness present — early markers of sarcopenic change. Consider strength/function assessment and HbA1c/vitamin D panel.'
    : hasGI
    ? 'GI symptoms present. These can reduce dietary compliance and protein intake. Consider anti-nausea management or dose timing adjustment.'
    : 'No concerning symptoms reported. Symptom burden is not currently contributing to muscle risk.';

  // ── 5. Hydration ──────────────────────────────────────────────────────────
  const hydrationState  = `${a.hydrationLitres.toFixed(1)}L / day reported`;
  const hydrationImpact: ImpactLevel = 'LOW';
  const hydrationDetail = `Target ${a.hydrationLitres.toFixed(1)}L daily. Adequate hydration supports muscle protein synthesis and reduces GI side effect burden.`;

  return [
    { icon: '🍗', label: 'Protein Intake',  state: proteinState,   detail: proteinDetail,   impact: proteinImpact   },
    { icon: '🏃', label: 'Activity Level',  state: activityLabel,  detail: activityDetail,  impact: activityImpact  },
    { icon: '💊', label: 'GLP-1 Dose',      state: glp1State,      detail: glp1Detail,      impact: glp1Impact      },
    { icon: '⚡', label: 'Symptoms',        state: symptomsState,  detail: symptomsDetail,  impact: symptomsImpact  },
    { icon: '💧', label: 'Hydration',       state: hydrationState, detail: hydrationDetail, impact: hydrationImpact },
  ];
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  // Physician guard — fetch id for ownership verification
  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, referralSlug: true, fullName: true },
  });
  if (!physician) redirect('/dashboard');
  if (physician.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (physician.role !== 'PHYSICIAN') redirect('/dashboard');

  // Resolve physician display name
  const physicianSlug = physician.referralSlug;
  let displayName = physician.fullName ?? 'Physician';
  if (physicianSlug) {
    const profile = await prisma.physicianProfile.findUnique({
      where:  { slug: physicianSlug },
      select: { displayName: true },
    });
    if (profile?.displayName) displayName = profile.displayName;
  }

  // Fetch the patient
  const { userId: patientId } = await params;

  // ── Security: verify this patient is linked to this physician ─────────────
  // Check at DB level to prevent IDOR — physicians can only view patients who
  // are explicitly linked to them via physicianId (new) or referralSlug (legacy).
  const ownershipCheck = await prisma.user.findFirst({
    where: {
      id:   patientId,
      role: 'PATIENT',
      OR: [
        { physicianId: physician.id },
        ...(physicianSlug ? [{ referralSlug: physicianSlug }] : []),
      ],
    },
    select: { id: true },
  });
  if (!ownershipCheck) redirect('/doctor/patients');
  // ─────────────────────────────────────────────────────────────────────────

  const patient = await fetchPatient(patientId);

  if (!patient) notFound();

  const latest      = patient.assessments[0];
  const history     = patient.assessments;   // all 10 (or fewer)
  const factors     = latest ? deriveFactors(latest, patient.profile ?? null) : [];

  const latestScore = latest?.muscleScore?.score ?? null;
  const latestBand  = latest?.muscleScore?.riskBand ?? null;
  const prevScore   = patient.assessments[1]?.muscleScore?.score ?? null;
  const delta       = latestScore !== null && prevScore !== null
    ? Math.round(latestScore - prevScore)
    : null;

  const band = latestBand ?? 'LOW';
  const rm   = RISK_META[band] ?? RISK_META.LOW;

  // ── Clinical escalation derivation (physician-only) ────────────────────────
  const latestMs       = latest?.muscleScore;
  const proteinDeficit = latestMs
    ? (latestMs.proteinTargetG ?? 0) - (latest?.proteinGrams ?? 0)
    : 0;
  const escalate =
    proteinDeficit > 30 ||
    (latest?.exerciseDaysWk ?? 0) < 2 ||
    (latestMs?.leanLossEstPct ?? 0) > 25;

  return (
    <main className="min-h-screen bg-slate-50 font-sans">

      <PhysicianNav activePath="/doctor/patients" displayName={displayName} />

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* ── Breadcrumb + patient name ────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 print:hidden">
              <Link href="/doctor/patients" className="hover:text-teal-600 transition-colors">
                Patient Overview
              </Link>
              <span>/</span>
              <span className="text-slate-600 font-medium">{patient.fullName || 'Unknown Patient'}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">
              {patient.fullName || 'Unknown Patient'}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{patient.email}</p>
          </div>
          <Link
            href="/doctor/patients"
            className="flex-shrink-0 text-xs text-teal-600 hover:underline font-medium mt-1 print:hidden"
          >
            ← All Patients
          </Link>
        </div>

        {/* ── No assessments fallback ──────────────────────────────────────── */}
        {!latest && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-slate-700 font-semibold mb-1">No assessments on record</p>
            <p className="text-sm text-slate-500">
              This patient has not completed an assessment yet.
            </p>
          </div>
        )}

        {latest && (
          <>
            {/* ── Score hero card ──────────────────────────────────────────── */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white">
              {/* Eyebrow */}
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Latest MyoGuard Score · {shortDate(latest.assessmentDate)}
              </p>

              {/* Score row */}
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <p className="text-6xl font-black font-mono tabular-nums leading-none text-white">
                    {latestScore !== null ? Math.round(latestScore) : '—'}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">/100</p>
                </div>

                <div className="text-right space-y-2">
                  {/* Risk band pill */}
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${rm.bg} ${rm.colour} ${rm.border}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${rm.dot}`} />
                    {rm.label}
                  </span>

                  {/* Delta */}
                  {delta !== null && (
                    <p className={`text-sm font-semibold font-mono ${
                      delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '→ No change'} from last
                    </p>
                  )}
                </div>
              </div>

              {/* Score progress track */}
              {latestScore !== null && (
                <div className="h-2 rounded-full bg-slate-700 overflow-hidden mb-4">
                  <div
                    className={`h-full rounded-full ${rm.track}`}
                    style={{ width: `${Math.round(latestScore)}%` }}
                  />
                </div>
              )}

              {/* Clinical stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'Lean Loss Risk',
                    value: latest.muscleScore?.leanLossEstPct != null
                      ? `${latest.muscleScore.leanLossEstPct.toFixed(1)}%`
                      : '—',
                  },
                  {
                    label: 'Protein Target',
                    value: latest.muscleScore?.proteinTargetG != null
                      ? `${Math.round(latest.muscleScore.proteinTargetG)}g/day`
                      : '—',
                  },
                  {
                    label: 'Body Weight',
                    value: `${latest.weightKg}kg`,
                  },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-sm font-bold font-mono text-white tabular-nums">{stat.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Escalation Alert (physician-only) ───────────────────────── */}
            {escalate && (
              <div style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: '16px', padding: '20px 24px',
                marginBottom: '16px',
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700',
                  color: '#FB7185', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: '8px' }}>
                  ⚠ Clinical Escalation Alert
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {proteinDeficit > 30 && (
                    <p style={{ fontSize: '13px', color: '#fca5a5' }}>
                      Critical protein deficit: −{Math.round(proteinDeficit)}g/day below target
                      ({latest?.proteinGrams}g reported, {latestMs?.proteinTargetG}g required)
                    </p>
                  )}
                  {(latest?.exerciseDaysWk ?? 0) < 2 && (
                    <p style={{ fontSize: '13px', color: '#fca5a5' }}>
                      Insufficient resistance stimulus: {latest?.exerciseDaysWk} session(s)/week
                      — minimum 2 required
                    </p>
                  )}
                  {(latestMs?.leanLossEstPct ?? 0) > 25 && (
                    <p style={{ fontSize: '13px', color: '#fca5a5' }}>
                      Elevated lean mass loss risk: {latestMs?.leanLossEstPct}% estimated
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Suggested Clinical Actions (physician-only) ──────────────── */}
            <div style={{
              background: '#0D1421', border: '1px solid #1A2744',
              borderRadius: '16px', padding: '20px 24px',
              marginBottom: '16px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: '700',
                color: '#94A3B8', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: '16px' }}>
                Suggested Clinical Actions
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {proteinDeficit > 30 && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700',
                      color: '#FB7185', background: 'rgba(248,113,133,0.12)',
                      padding: '3px 8px', borderRadius: '99px',
                      flexShrink: 0, marginTop: '2px' }}>URGENT</span>
                    <p style={{ fontSize: '13px', color: '#F1F5F9', lineHeight: '1.5' }}>
                      Increase daily protein to {latestMs?.proteinTargetG}g/day.
                      Consider structured supplementation — whey protein or dietitian referral.
                    </p>
                  </div>
                )}
                {(latest?.exerciseDaysWk ?? 0) < 2 && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700',
                      color: '#FB7185', background: 'rgba(248,113,133,0.12)',
                      padding: '3px 8px', borderRadius: '99px',
                      flexShrink: 0, marginTop: '2px' }}>URGENT</span>
                    <p style={{ fontSize: '13px', color: '#F1F5F9', lineHeight: '1.5' }}>
                      Prescribe structured resistance training — minimum 2 sessions/week,
                      compound movements prioritised.
                    </p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700',
                    color: '#2DD4BF', background: 'rgba(45,212,191,0.12)',
                    padding: '3px 8px', borderRadius: '99px',
                    flexShrink: 0, marginTop: '2px' }}>MONITOR</span>
                  <p style={{ fontSize: '13px', color: '#F1F5F9', lineHeight: '1.5' }}>
                    Schedule nutritional labs at next visit: Ferritin, B12, Vitamin D,
                    Zinc, Magnesium, Thiamine — particularly if on GLP-1 for 3+ months.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700',
                    color: '#94A3B8', background: 'rgba(148,163,184,0.12)',
                    padding: '3px 8px', borderRadius: '99px',
                    flexShrink: 0, marginTop: '2px' }}>ROUTINE</span>
                  <p style={{ fontSize: '13px', color: '#F1F5F9', lineHeight: '1.5' }}>
                    Monthly MyoGuard reassessment recommended to track protocol
                    response across dose escalation steps.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Assessment snapshot ──────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Assessment Snapshot
                </p>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Protein',      value: `${Math.round(latest.proteinGrams)}g/day`         },
                  { label: 'Activity',     value: `${latest.exerciseDaysWk} day${latest.exerciseDaysWk !== 1 ? 's' : ''}/wk` },
                  { label: 'Hydration',    value: `${latest.hydrationLitres.toFixed(1)}L/day`        },
                  { label: 'Symptoms',     value: latest.symptoms.length ? `${latest.symptoms.length} reported` : 'None' },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold font-mono text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Symptoms list */}
              {latest.symptoms.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-2">Reported Symptoms</p>
                  <div className="flex flex-wrap gap-2">
                    {latest.symptoms.map(sym => (
                      <span
                        key={sym}
                        className="text-[11px] font-medium bg-slate-100 text-slate-600 rounded-full px-2.5 py-1"
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Score explanation */}
              {latest.muscleScore?.explanation && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1.5">Score Explanation</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {latest.muscleScore.explanation}
                  </p>
                </div>
              )}
            </div>

            {/* ── Contributing Factors ─────────────────────────────────────── */}
            <ContributingFactors factors={factors} />

            {/* ── Physician Review ─────────────────────────────────────────── */}
            <PhysicianReviewPanel
              assessmentId={latest.id}
              existing={latest.physicianReview ? {
                overallImpression: latest.physicianReview.overallImpression,
                followUpDays:      latest.physicianReview.followUpDays,
                note:              latest.physicianReview.note,
                reviewedAt:        latest.physicianReview.reviewedAt.toISOString(),
              } : null}
            />
          </>
        )}

        {/* ── Assessment history ───────────────────────────────────────────── */}
        {history.length > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Assessment History
              </p>
              <div className="flex-1 h-px bg-slate-200" />
              <p className="text-[11px] text-slate-400 flex-shrink-0">
                Last {history.length} records
              </p>
            </div>

            <div className="space-y-2">
              {history.map((a, i) => {
                const sc   = a.muscleScore;
                const b    = (sc?.riskBand ?? 'LOW') as string;
                const meta = RISK_META[b] ?? RISK_META.LOW;
                const isLatest = i === 0;

                return (
                  <Link
                    key={a.id}
                    href={`/dashboard/results/${a.id}`}
                    className={`flex items-center gap-4 rounded-xl px-4 py-3 cursor-pointer transition-colors hover:bg-teal-50 hover:border-teal-200 ${
                      isLatest ? 'bg-slate-50 border border-slate-200' : ''
                    }`}
                  >
                    {/* Score */}
                    <p className="text-xl font-black font-mono tabular-nums text-slate-800 w-10 flex-shrink-0">
                      {sc?.score != null ? Math.round(sc.score) : '—'}
                    </p>

                    {/* Band pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.colour} ${meta.border} flex-shrink-0`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>

                    {/* Date */}
                    <p className="text-xs text-slate-400 flex-1 text-right">
                      {shortDate(a.assessmentDate)}
                      {isLatest && (
                        <span className="ml-2 text-[10px] bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5 font-semibold">
                          Latest
                        </span>
                      )}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer nav ──────────────────────────────────────────────────── */}
        <div className="pt-2 print:hidden">
          <Link href="/doctor/patients" className="text-sm text-teal-600 hover:underline font-medium">
            ← All Patients
          </Link>
        </div>

      </div>
    </main>
  );
}
