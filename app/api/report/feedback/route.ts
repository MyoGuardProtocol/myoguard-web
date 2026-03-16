import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import { z }                         from 'zod';
import { prisma }                    from '@/src/lib/prisma';

// ─── Validation schema ────────────────────────────────────────────────────────

const FeedbackSchema = z
  .object({
    assessmentId:      z.string().cuid('assessmentId must be a valid cuid'),
    overallImpression: z.enum(['stable', 'monitoring', 'intervention']).nullable(),
    followUpDays:      z
      .union([z.literal(7), z.literal(14), z.literal(21), z.literal(30)])
      .nullable(),
    note: z.string().max(2000, 'Note must be 2 000 characters or fewer').nullable(),
  })
  .refine(
    d =>
      d.overallImpression !== null ||
      d.followUpDays      !== null ||
      (d.note !== null && d.note.trim().length > 0),
    { message: 'At least one review field must be provided' },
  );

// ─── POST /api/report/feedback ────────────────────────────────────────────────
//
// Upsert (create or update) a PhysicianReview record linked to an assessment.
// One record per assessment — subsequent saves overwrite the previous entry and
// refresh `reviewedAt` so the timestamp always reflects the latest save.
//
// Auth: Clerk session required. Assessment ownership verified before write.
// Audit: Every successful save is written to AuditLog for clinical record-keeping.

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { assessmentId, overallImpression, followUpDays, note } = parsed.data;

  // ── Resolve internal user ─────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // ── Verify assessment ownership ───────────────────────────────────────────
  const assessment = await prisma.assessment.findUnique({
    where:  { id: assessmentId },
    select: { userId: true },
  });
  if (!assessment || assessment.userId !== user.id) {
    // Return 404 rather than 403 to avoid leaking assessment existence
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  // ── Upsert PhysicianReview ────────────────────────────────────────────────
  const reviewedAt = new Date();

  try {
    const review = await prisma.physicianReview.upsert({
      where:  { assessmentId },
      create: {
        assessmentId,
        userId:            user.id,
        overallImpression: overallImpression ?? null,
        followUpDays:      followUpDays      ?? null,
        note:              note?.trim()      ?? null,
        reviewedAt,
      },
      update: {
        overallImpression: overallImpression ?? null,
        followUpDays:      followUpDays      ?? null,
        note:              note?.trim()      ?? null,
        reviewedAt,
      },
      select: {
        id:                true,
        overallImpression: true,
        followUpDays:      true,
        note:              true,
        reviewedAt:        true,
      },
    });

    // ── Audit trail ───────────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        actorId:    user.id,
        action:     'PHYSICIAN_REVIEW_SAVED',
        targetType: 'PhysicianReview',
        targetId:   review.id,
        metadata:   {
          assessmentId,
          overallImpression,
          followUpDays,
          hasNote: (note?.trim().length ?? 0) > 0,
        },
      },
    });

    return NextResponse.json({
      id:                review.id,
      overallImpression: review.overallImpression,
      followUpDays:      review.followUpDays,
      note:              review.note,
      reviewedAt:        review.reviewedAt.toISOString(),
    });
  } catch (err) {
    console.error('[POST /api/report/feedback]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
