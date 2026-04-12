/**
 * /doctor/patients — Physician Command Center
 *
 * Thin server shell: authenticate → fetch patients → shape PatientRow[] →
 * pass to PatientCommandCenter (client component).
 *
 * Auth: PHYSICIAN role only.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import PhysicianNav from '@/src/components/ui/PhysicianNav';
import PatientCommandCenter, { type PatientRow } from '@/src/components/ui/PatientCommandCenter';
import PatientGrowthCard from '@/src/components/ui/PatientGrowthCard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH:     1,
  MODERATE: 2,
  LOW:      3,
};

const RECOVERY_ORDER: Record<string, number> = {
  critical: 0,
  impaired: 1,
  optimal:  2,
};

// Returns true when the most recent grip reading has declined > 15 % from the
// oldest grip baseline found within the preceding 28 days.
function hasGripVelocityDecline(
  assessments: { gripStrengthKg: number | null; assessmentDate: Date }[],
): boolean {
  const withGrip = assessments.filter(a => a.gripStrengthKg != null);
  if (withGrip.length < 2) return false;

  // assessments are ordered desc (newest first)
  const current  = withGrip[0];
  const windowMs = 28 * 24 * 60 * 60 * 1000;
  const cutoff   = new Date(current.assessmentDate.getTime() - windowMs);

  const baseline = withGrip
    .filter(a => a !== current && a.assessmentDate >= cutoff)
    .at(-1); // oldest within window

  if (!baseline) return false;

  const declinePct = ((baseline.gripStrengthKg! - current.gripStrengthKg!) / baseline.gripStrengthKg!) * 100;
  return declinePct > 15;
}

// Returns true when the 3 most recent ProgressLog entries all fall below 75 % of the
// protein target AND were logged within a 72-hour window (consecutive-day proxy).
function has72hProteinDeficit(
  logs:   { logDate: Date; proteinGrams: number }[],
  target: number,
): boolean {
  if (logs.length < 3) return false;
  const sorted = [...logs].sort((a, b) => b.logDate.getTime() - a.logDate.getTime());
  const top3   = sorted.slice(0, 3);
  if (!top3.every(l => l.proteinGrams < target * 0.75)) return false;
  // All three entries must span no more than 72 hours
  const spanMs = top3[0].logDate.getTime() - top3[2].logDate.getTime();
  return spanMs <= 72 * 60 * 60 * 1000;
}

function getFlags(
  patient: {
    recoveryStatus:    string | null;
    proteinGrams:      number;
    weightKg:          number;
    proteinTargetG:    number | null;
    exerciseDaysWk:    number;
    symptoms:          string[];
    leanLossEstPct:    number | null;
    recentProteinLogs: { logDate: Date; proteinGrams: number }[];
    gripAssessments:   { gripStrengthKg: number | null; assessmentDate: Date }[];
  },
): string[] {
  const priority: string[] = [];
  const flags:    string[] = [];

  // ── Priority override: Urgent GI Alert ────────────────────────────────────
  // Fires when Nausea + Constipation co-present, or Vomiting is reported.
  // Always occupies the first flag slot regardless of other conditions.
  const hasNausea       = patient.symptoms.includes('Nausea');
  const hasConstipation = patient.symptoms.includes('Constipation');
  const hasVomiting     = patient.symptoms.includes('Vomiting');
  if ((hasNausea && hasConstipation) || hasVomiting) priority.push('Urgent GI Alert');

  // ── Recovery-based flags ──────────────────────────────────────────────────
  if (patient.recoveryStatus === 'critical')      flags.push('Sleep Critical');
  else if (patient.recoveryStatus === 'impaired') flags.push('Sleep Deficit');

  // ── Protein ───────────────────────────────────────────────────────────────
  const target = patient.proteinTargetG ?? patient.weightKg * 1.4;
  if (has72hProteinDeficit(patient.recentProteinLogs, target)) {
    flags.push('Protein Deficit');
  } else if (patient.proteinGrams < target * 0.9) {
    flags.push('Protein Gap');
  }

  // ── Activity ──────────────────────────────────────────────────────────────
  if (patient.exerciseDaysWk <= 1) flags.push('Sedentary');

  // ── Symptoms ──────────────────────────────────────────────────────────────
  if (patient.symptoms.includes('Muscle weakness')) flags.push('Muscle Weakness');
  if (patient.symptoms.includes('Fatigue'))         flags.push('Fatigue');

  // ── Grip velocity ─────────────────────────────────────────────────────────
  if (hasGripVelocityDecline(patient.gripAssessments)) flags.push('Grip Decline');

  // ── Lean risk ─────────────────────────────────────────────────────────────
  if (patient.leanLossEstPct != null && patient.leanLossEstPct >= 18) flags.push('High Lean Risk');

  // Priority flags are always shown first; total capped at 3
  return [...priority, ...flags].slice(0, 3);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PatientsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, fullName: true, referralSlug: true, isVerified: true },
  });

  if (!physician)                            redirect('/dashboard');
  if (physician.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (physician.role !== 'PHYSICIAN')         redirect('/dashboard');

  // Build OR clause for patient lookup
  const orClauses: Record<string, unknown>[] = [{ physicianId: physician.id }];
  if (physician.referralSlug) {
    orClauses.push({ referralSlug: physician.referralSlug });
  }

  const rawPatients = await prisma.user.findMany({
    where: { role: 'PATIENT', OR: orClauses },
    select: {
      id:       true,
      fullName: true,
      email:    true,
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take:    10,
        select: {
          id:             true,
          assessmentDate: true,
          weightKg:       true,
          proteinGrams:   true,
          exerciseDaysWk: true,
          hydrationLitres:true,
          symptoms:       true,
          riskBand:       true,
          recoveryStatus: true,
          gripStrengthKg: true,
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
      progressLogs: {
        orderBy: { logDate: 'desc' },
        take:    3,
        select: {
          logDate:      true,
          proteinGrams: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Shape into PatientRow[]
  const patients: PatientRow[] = rawPatients
    .filter(p => p.assessments[0] != null)
    .map(p => {
      const latest  = p.assessments[0]!;
      const prev    = p.assessments[1] ?? null;
      const ms      = latest.muscleScore;

      return {
        id:                 p.id,
        fullName:           p.fullName,
        email:              p.email,
        score:              ms?.score          ?? null,
        prevScore:          prev?.muscleScore?.score ?? null,
        band:               (ms?.riskBand as string)  ?? latest.riskBand as string,
        flags:              getFlags({
          recoveryStatus:    latest.recoveryStatus,
          proteinGrams:      latest.proteinGrams,
          weightKg:          latest.weightKg,
          proteinTargetG:    ms?.proteinTargetG ?? null,
          exerciseDaysWk:    latest.exerciseDaysWk,
          symptoms:          latest.symptoms,
          leanLossEstPct:    ms?.leanLossEstPct ?? null,
          recentProteinLogs: p.progressLogs,
          gripAssessments:   p.assessments,
        }),
        leanLossPct:        ms?.leanLossEstPct         ?? null,
        lastAssessmentDate: latest.assessmentDate.toISOString(),
        recoveryStatus:     latest.recoveryStatus,
        latestAssessmentId: latest.id,
      } as PatientRow;
    });

  // Sort: band (CRITICAL first) → recovery (critical first) → lower score first
  patients.sort((a, b) => {
    const bandDiff = (RISK_ORDER[a.band] ?? 99) - (RISK_ORDER[b.band] ?? 99);
    if (bandDiff !== 0) return bandDiff;
    const recDiff = (RECOVERY_ORDER[a.recoveryStatus ?? ''] ?? 99)
                  - (RECOVERY_ORDER[b.recoveryStatus ?? ''] ?? 99);
    if (recDiff !== 0) return recDiff;
    return (a.score ?? 100) - (b.score ?? 100);
  });

  return (
    <main style={{ minHeight: '100vh', background: '#050A15' }}>
      <PhysicianNav />
      <div className="max-w-6xl mx-auto px-6 py-6">
        <PatientGrowthCard
          doctorId={physician.id}
          doctorName={physician.fullName}
        />
      </div>
      <PatientCommandCenter patients={patients} isVerified={physician.isVerified} />
    </main>
  );
}
