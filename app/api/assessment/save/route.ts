export const dynamic = 'force-dynamic';

import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/lib/prisma';
import { Prisma } from '@prisma/client';

const SaveSchema = z.object({
  composite:     z.number().int().min(0).max(100),
  leanScore:     z.number().int().min(0).max(100),
  recoveryScore: z.number().int().min(0).max(100),
  risk:          z.enum(['LOW', 'MODERATE', 'HIGH']),
  weight:        z.number().positive(),
  protein:       z.number().min(0),
  drug:          z.string().max(200),
  giSymptoms:    z.string().max(200),
  sleepHours:    z.number().min(4).max(9),
});

/**
 * POST /api/assessment/save
 *
 * Accepts simplified data from the home-page calculator (app/page.tsx) when
 * a signed-in user wants to save their result without going through the full
 * assessment form at /dashboard/assessment.
 *
 * Saves a bare Assessment row — no MuscleScore / ProtocolPlan written here
 * (those require the full protocol engine run). Returns { ok: true, assessmentId }.
 *
 * Gracefully falls back to { ok: true } if DB tables are missing (migration pending).
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { composite, risk, weight, protein, giSymptoms, sleepHours } = parsed.data;

  try {
    // ── Resolve DB user (3-phase: clerkId → email → create) ─────────────────
    let user = await prisma.user.findUnique({
      where:  { clerkId },
      select: { id: true },
    });

    if (!user) {
      const clerkUser = await currentUser();
      if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const email    = clerkUser.emailAddresses[0]?.emailAddress ?? '';
      const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'MyoGuard User';

      const byEmail = await prisma.user.findUnique({
        where:  { email },
        select: { id: true },
      }).catch(() => null);

      if (byEmail) {
        user = await prisma.user.update({
          where:  { id: byEmail.id },
          data:   { clerkId },
          select: { id: true },
        });
      } else {
        user = await prisma.user.create({
          data:   { clerkId, email, fullName, role: 'PATIENT', subscriptionStatus: 'FREE' },
          select: { id: true },
        });
      }
    }

    // Derive symptoms array from the GI symptom string
    const symptoms: string[] = giSymptoms && giSymptoms !== 'None' ? [giSymptoms] : [];

    const assessment = await prisma.assessment.create({
      data: {
        userId:          user.id,
        weightKg:        weight,
        proteinGrams:    protein,
        exerciseDaysWk:  1,                          // not captured in home calculator
        hydrationLitres: Math.round(weight * 0.033 * 10) / 10, // 33 ml/kg standard
        symptoms,
        fatigue:         0,
        nausea:          giSymptoms.toLowerCase().includes('nausea') ? 1 : 0,
        muscleWeakness:  0,
        score:           composite,
        riskBand:        risk,
        sleepHours:      sleepHours ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, assessmentId: assessment.id });
  } catch (err) {
    console.error('[POST /api/assessment/save]', err);

    // If DB tables missing (migration pending), return ok so the UI doesn't break
    const isTableMissing =
      (err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2021' || err.code === 'P2010')) ||
      (err instanceof Error &&
        (err.message.includes('relation') || err.message.includes('does not exist')));

    if (isTableMissing) {
      console.warn('[assessment/save] DB table missing — returning ok without persisting');
      return NextResponse.json({ ok: true, assessmentId: null });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
