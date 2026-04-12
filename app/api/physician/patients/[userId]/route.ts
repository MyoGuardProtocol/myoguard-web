/**
 * GET /api/physician/patients/[userId]
 *
 * Returns a physician's patient's longitudinal assessment and check-in history.
 * Used by the PatientDrawer to populate the deep-dive panel without a full-page
 * navigation.
 *
 * Auth model:
 *   – Requires an active PHYSICIAN Clerk session.
 *   – IDOR: patient must be linked to this physician via physicianId or referralSlug.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, referralSlug: true },
  });
  if (!physician || physician.role !== 'PHYSICIAN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId: patientId } = await params;

  // ── IDOR guard ──────────────────────────────────────────────────────────────
  const orClauses: Record<string, unknown>[] = [{ physicianId: physician.id }];
  if (physician.referralSlug) {
    orClauses.push({ referralSlug: physician.referralSlug });
  }
  const ownership = await prisma.user.findFirst({
    where: { id: patientId, role: 'PATIENT', OR: orClauses },
    select: { id: true },
  });
  if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // ───────────────────────────────────────────────────────────────────────────

  const billingMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const [assessments, checkins, reviewSession] = await Promise.all([
    prisma.assessment.findMany({
      where:   { userId: patientId },
      orderBy: { assessmentDate: 'desc' },
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
        protocolPlan: {
          select: {
            proteinTargetG:   true,
            proteinSources:   true,
            supplementation:  true,
            trainingPlan:     true,
            hydrationTarget:  true,
            electrolyteNotes: true,
            giGuidance:       true,
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
    }),
    prisma.weeklyCheckin.findMany({
      where:   { userId: patientId },
      orderBy: { weekStart: 'desc' },
      take:    8,
      select: {
        id:               true,
        weekStart:        true,
        avgProteinG:      true,
        proteinAdherence: true,
        exerciseAdherence: true,
        sleepHours:       true,
        recoveryStatus:   true,
        energyLevel:      true,
        totalWorkouts:    true,
      },
    }),
    prisma.physicianReviewSession.findUnique({
      where: {
        physicianId_patientId_billingMonth: {
          physicianId: physician.id,
          patientId,
          billingMonth,
        },
      },
      select: { cumulativeSeconds: true },
    }),
  ]);

  return NextResponse.json({
    assessments,
    checkins,
    priorMonthSeconds: reviewSession?.cumulativeSeconds ?? 0,
  });
}
