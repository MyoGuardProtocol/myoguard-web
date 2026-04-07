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

function getFlags(
  patient: {
    recoveryStatus: string | null;
    proteinGrams:   number;
    weightKg:       number;
    proteinTargetG: number | null;
    exerciseDaysWk: number;
    symptoms:       string[];
    leanLossEstPct: number | null;
  },
): string[] {
  const flags: string[] = [];

  // Recovery-based flags take priority
  if (patient.recoveryStatus === 'critical') flags.push('Sleep Critical');
  else if (patient.recoveryStatus === 'impaired') flags.push('Sleep Deficit');

  // Protein gap
  const target = patient.proteinTargetG ?? patient.weightKg * 1.4;
  if (patient.proteinGrams < target * 0.9) flags.push('Protein Gap');

  // Activity
  if (patient.exerciseDaysWk <= 1) flags.push('Sedentary');

  // Symptoms
  if (patient.symptoms.includes('Muscle weakness')) flags.push('Muscle Weakness');
  if (patient.symptoms.includes('Fatigue'))         flags.push('Fatigue');

  // Lean risk
  if (patient.leanLossEstPct != null && patient.leanLossEstPct >= 18) flags.push('High Lean Risk');

  return flags.slice(0, 3);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PatientsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, fullName: true, referralSlug: true },
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
        take:    2,
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
          recoveryStatus: latest.recoveryStatus,
          proteinGrams:   latest.proteinGrams,
          weightKg:       latest.weightKg,
          proteinTargetG: ms?.proteinTargetG ?? null,
          exerciseDaysWk: latest.exerciseDaysWk,
          symptoms:       latest.symptoms,
          leanLossEstPct: ms?.leanLossEstPct ?? null,
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
      <PatientCommandCenter patients={patients} />
    </main>
  );
}
