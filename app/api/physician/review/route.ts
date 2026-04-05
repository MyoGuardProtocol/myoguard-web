export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/lib/prisma';

// ─── Validation ───────────────────────────────────────────────────────────────

const ReviewSchema = z.object({
  assessmentId:      z.string().min(1),
  overallImpression: z.enum(['stable', 'monitoring', 'intervention']),
  followUpDays:      z.number().int().refine(v => [7, 14, 21, 30].includes(v)).optional(),
  note:              z.string().max(2000).trim().optional(),
});

// ─── POST /api/physician/review ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // ── Physician guard ───────────────────────────────────────────────────────
  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, referralSlug: true },
  });

  if (!physician || physician.role !== 'PHYSICIAN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ReviewSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { assessmentId, overallImpression, followUpDays, note } = parsed.data;

  // ── Resolve assessment → patient ──────────────────────────────────────────
  const assessment = await prisma.assessment.findUnique({
    where:  { id: assessmentId },
    select: { userId: true },
  });

  if (!assessment) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const patientId = assessment.userId;

  // ── Ownership check — mirrors /doctor/patients/[userId]/page.tsx exactly ──
  // A physician may only review a patient linked to them via physicianId (new)
  // or referralSlug (legacy). Any mismatch returns 403 — no information leak.
  const ownershipCheck = await prisma.user.findFirst({
    where: {
      id:   patientId,
      role: 'PATIENT',
      OR: [
        { physicianId: physician.id },
        ...(physician.referralSlug ? [{ referralSlug: physician.referralSlug }] : []),
      ],
    },
    select: { id: true },
  });

  if (!ownershipCheck) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Upsert PhysicianReview ────────────────────────────────────────────────
  // One review per assessment (unique on assessmentId). Subsequent saves by the
  // same physician update the existing record. reviewedAt is always refreshed.
  try {
    const review = await prisma.physicianReview.upsert({
      where:  { assessmentId },
      update: {
        overallImpression,
        followUpDays:  followUpDays ?? null,
        note:          note         ?? null,
        reviewedAt:    new Date(),
      },
      create: {
        assessmentId,
        userId:        patientId,
        overallImpression,
        followUpDays:  followUpDays ?? null,
        note:          note         ?? null,
        reviewedAt:    new Date(),
      },
    });

    return NextResponse.json({ success: true, reviewId: review.id });
  } catch (err) {
    console.error('[physician/review] upsert failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
