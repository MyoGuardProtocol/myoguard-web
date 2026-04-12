export const dynamic = 'force-dynamic';

/**
 * POST /api/physician/review-session
 *
 * Increments the cumulative review time for a physician–patient pair within the
 * current billing month.  Called by PatientDrawer every 60 s and on drawer close
 * via keepalive fetch, so the client sends incremental seconds, not an absolute total.
 *
 * Used to track CPT 99470 eligibility (≥ 10 minutes of documented review per month).
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/lib/prisma';

// ─── Validation ───────────────────────────────────────────────────────────────

const BodySchema = z.object({
  patientId:         z.string().min(1),
  additionalSeconds: z.number().int().min(1).max(3600),
  billingMonth:      z.string().regex(/^\d{4}-\d{2}$/), // "YYYY-MM"
});

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, referralSlug: true },
  });
  if (!physician || physician.role !== 'PHYSICIAN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { patientId, additionalSeconds, billingMonth } = parsed.data;

  // ── IDOR guard ────────────────────────────────────────────────────────────
  const orClauses: Record<string, unknown>[] = [{ physicianId: physician.id }];
  if (physician.referralSlug) orClauses.push({ referralSlug: physician.referralSlug });

  const ownership = await prisma.user.findFirst({
    where:  { id: patientId, role: 'PATIENT', OR: orClauses },
    select: { id: true },
  });
  if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ── Upsert session record ─────────────────────────────────────────────────
  await prisma.physicianReviewSession.upsert({
    where: {
      physicianId_patientId_billingMonth: {
        physicianId: physician.id,
        patientId,
        billingMonth,
      },
    },
    update: { cumulativeSeconds: { increment: additionalSeconds } },
    create: {
      physicianId:       physician.id,
      patientId,
      billingMonth,
      cumulativeSeconds: additionalSeconds,
    },
  });

  return NextResponse.json({ success: true });
}
