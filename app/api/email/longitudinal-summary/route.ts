// MyoGuard Clinical Email Layer — Longitudinal Summary on-demand dispatch endpoint
// Admin-only. Not accessible to patients or physicians.
// Scheduled delivery infrastructure deferred to BUILD 4C (Vercel Cron).

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { generateWeeklyDigest } from '@/src/lib/weeklyDigest';
import { sendLongitudinalSummaryEmail } from '@/src/lib/email/categories/LongitudinalSummary';
import {
  canSend,
  recordCommunicationEvent,
  markEventSent,
} from '@/src/lib/communications/governance';

/** Same template identity as the cron — this route sends the same message. */
const TEMPLATE_ID = 'clinical.longitudinal_summary.v1';

/**
 * POST /api/email/longitudinal-summary
 *
 * On-demand Patient Longitudinal Reflection Summary email dispatch.
 *
 * Auth: ADMIN role required.
 *
 * Body: { userId: string }  — internal DB User.id (not Clerk ID).
 *
 * Scheduled dispatch infrastructure (Vercel Cron) is deferred to BUILD 4C.
 * This endpoint is the surface that Cron will call; it can also be invoked
 * manually by an admin for testing or one-off sends.
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
    // clerkId added in Phase 1D-C3B.1 — Layer 0 resolves verification from the
    // Clerk identity. Replaces the isVerified column C3B selected here.
    select: { clerkId: true, email: true, fullName: true },
  });

  if (!patient?.email) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // ── Layer 0: Communications governance (Phase 1D-C3B) ─────────────────────
  //
  // Same sender and same message as the cron, so without this check an admin
  // one-off send would bypass recipient choice entirely.
  const gate = await canSend({
    email:              patient.email,
    communicationClass: 'CLINICAL_CONTINUITY',
    channel:            'EMAIL',
    userId,
    // Admin authority governs who may trigger a send, not whether the
    // recipient's address is verified.
    clerkUserId:        patient.clerkId,
    context:            'admin:longitudinal-summary',
  });

  if (gate.decision === 'UNAVAILABLE') {
    console.error('[email/longitudinal-summary] governance unavailable — not sent');
    return NextResponse.json(
      { error: 'Communications governance unavailable. Not sent.' },
      { status: 503 },
    );
  }

  if (gate.decision !== 'ALLOW') {
    await recordCommunicationEvent({
      recipientKey:       gate.recipientKey!,
      keyVersion:         gate.keyVersion,
      userId,
      communicationClass: 'CLINICAL_CONTINUITY',
      channel:            'EMAIL',
      templateId:         TEMPLATE_ID,
      provider:           'RESEND',
      state:              'SUPPRESSED',
      suppressionReason:  gate.suppressionReason,
      policyReason:       gate.policyReason,
    });
    console.log(
      `[email/longitudinal-summary] governance suppressed decision=${gate.decision} ` +
      `reason=${gate.suppressionReason ?? gate.policyReason ?? 'n/a'}`,
    );
    return NextResponse.json(
      { sent: false, decision: gate.decision, reason: gate.suppressionReason ?? gate.policyReason },
      { status: 409 },
    );
  }

  // ── Pull longitudinal data ────────────────────────────────────────────────
  // generateWeeklyDigest provides most required fields.
  // Returns null if no scored assessments — nothing to surface.
  const digest = await generateWeeklyDigest(userId);
  if (!digest) {
    return NextResponse.json(
      { error: 'No scored assessments available for this patient' },
      { status: 422 },
    );
  }

  // Assessment count — separate query; not included in digest payload
  const assessmentCount = await prisma.assessment.count({
    where: { userId },
  });

  // ── Send ──────────────────────────────────────────────────────────────────
  // Governance record before the provider is contacted; no record, no send.
  const eventId = await recordCommunicationEvent({
    recipientKey:       gate.recipientKey!,
    keyVersion:         gate.keyVersion,
    userId,
    communicationClass: 'CLINICAL_CONTINUITY',
    channel:            'EMAIL',
    templateId:         TEMPLATE_ID,
    provider:           'RESEND',
    state:              'REQUESTED',
  });

  if (!eventId) {
    console.error('[email/longitudinal-summary] could not record communication event — not sent');
    return NextResponse.json(
      { error: 'Could not record communication. Not sent.' },
      { status: 503 },
    );
  }

  const { id: providerMessageId, error } = await sendLongitudinalSummaryEmail({
    to:          patient.email,
    patientName: patient.fullName,
    data: {
      assessmentCount,
      riskBand:       digest.riskBand,
      trendStatus:    digest.trendStatus,
      proteinTargetG: digest.proteinTargetG,
      totalCheckins:  digest.totalCheckins,
      streakWeeks:    digest.streakWeeks,
      bestStreak:     digest.bestStreak,
    },
  });

  if (error) {
    console.error('[email/longitudinal-summary] Send failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // This route has never written a Notification record — unlike the cron and
  // unlike its Weekly Pulse counterpart. That gap is pre-existing and is NOT
  // closed here: adding one would create an idempotency anchor and change the
  // cron's dedup behaviour, which is outside this phase's authorised scope.
  // Recorded in the Phase 1D-C3B report.
  await markEventSent(eventId, providerMessageId);

  return NextResponse.json({ sent: true, to: patient.email });
}
