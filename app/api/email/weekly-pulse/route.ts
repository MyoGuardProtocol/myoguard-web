// MyoGuard Clinical Email Layer — Weekly Pulse on-demand dispatch endpoint
// Admin-only. Not accessible to patients or physicians.
// Scheduled delivery infrastructure deferred to BUILD 4C (Vercel Cron).

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { generateWeeklyDigest } from '@/src/lib/weeklyDigest';
import { sendWeeklyPulseEmail } from '@/src/lib/email/categories/WeeklyPulse';

/**
 * POST /api/email/weekly-pulse
 *
 * On-demand Weekly Pulse Check-In email dispatch.
 *
 * Auth: ADMIN role required.
 *
 * Body: { userId: string }  — internal DB User.id (not Clerk ID).
 *
 * Scheduled dispatch infrastructure (Vercel Cron) is deferred to BUILD 4C.
 * This endpoint is the surface that Cron will call; it can also be invoked
 * manually by an admin for testing or urgent continuity sends.
 *
 * Returns: { sent: true, to: string } on success.
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId: callerClerkId } = await auth();
  if (!callerClerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const caller = await prisma.user.findUnique({
    where:  { clerkId: callerClerkId },
    select: { role: true },
  });
  if (!caller || caller.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Payload validation ────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId } = body as { userId?: unknown };
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId (string) is required' }, { status: 422 });
  }

  // ── Resolve patient ───────────────────────────────────────────────────────
  const patient = await prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, fullName: true },
  });

  if (!patient?.email) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // ── Generate digest payload ───────────────────────────────────────────────
  // Returns null if the patient has no scored assessments — nothing to surface.
  const digest = await generateWeeklyDigest(userId);
  if (!digest) {
    return NextResponse.json(
      { error: 'No scored assessments available for this patient' },
      { status: 422 },
    );
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  // Only pass governed fields — never pass nextAction, projectedScore, or nextActionType.
  const { error } = await sendWeeklyPulseEmail({
    to:          patient.email,
    patientName: patient.fullName,
    digest: {
      riskBand:       digest.riskBand,
      trendStatus:    digest.trendStatus,
      proteinTargetG: digest.proteinTargetG,
      totalCheckins:  digest.totalCheckins,
      streakWeeks:    digest.streakWeeks,
    },
  });

  if (error) {
    console.error('[email/weekly-pulse] Send failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Notification record ───────────────────────────────────────────────────
  // Write WEEKLY_REMINDER to the patient's notification log for de-duplication
  // and audit trail. Fire-and-forget — failure must not block the success response.
  prisma.notification.create({
    data: {
      userId:  userId,
      type:    'WEEKLY_REMINDER',
      subject: 'MyoGuard Weekly Pulse Check-In',
      body:    JSON.stringify({ riskBand: digest.riskBand, trendStatus: digest.trendStatus }),
      sentAt:  new Date(),
    },
  }).catch((err) => console.error('[email/weekly-pulse] Notification write failed:', err));

  return NextResponse.json({ sent: true, to: patient.email });
}
