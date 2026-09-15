// MyoGuard Clinical Email Layer — Weekly Pulse on-demand dispatch endpoint
// Admin-only. Not accessible to patients or physicians.
// Scheduled delivery infrastructure deferred to BUILD 4C (Vercel Cron).

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { generateWeeklyDigest } from '@/src/lib/weeklyDigest';
import { sendWeeklyPulseEmail } from '@/src/lib/email/categories/WeeklyPulse';
import {
  canSend,
  recordCommunicationEvent,
  markEventSent,
} from '@/src/lib/communications/governance';

/** Same template identity as the cron — this route sends the same message. */
const TEMPLATE_ID = 'clinical.weekly_pulse.v1';

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
    // isVerified added in Phase 1D-C3B for the Layer 0 verified-identity gate.
    select: { email: true, fullName: true, isVerified: true },
  });

  if (!patient?.email) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // ── Layer 0: Communications governance (Phase 1D-C3B) ─────────────────────
  //
  // This route sends the same message as the cron through the same sender, so
  // without this check it would be a complete bypass of recipient choice — an
  // admin "urgent continuity send" could reach someone who had unsubscribed.
  // Admin authority governs WHO may trigger a send, not WHETHER the recipient
  // agreed to receive it.
  const gate = await canSend({
    email:              patient.email,
    communicationClass: 'CLINICAL_CONTINUITY',
    channel:            'EMAIL',
    userId,
    recipientVerified:  patient.isVerified,
    context:            'admin:weekly-pulse',
  });

  if (gate.decision === 'UNAVAILABLE') {
    console.error('[email/weekly-pulse] governance unavailable — not sent');
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
    });
    console.log(
      `[email/weekly-pulse] governance suppressed decision=${gate.decision} ` +
      `reason=${gate.suppressionReason ?? gate.policyReason ?? 'n/a'}`,
    );
    return NextResponse.json(
      { sent: false, decision: gate.decision, reason: gate.suppressionReason ?? gate.policyReason },
      { status: 409 },
    );
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
    console.error('[email/weekly-pulse] could not record communication event — not sent');
    return NextResponse.json(
      { error: 'Could not record communication. Not sent.' },
      { status: 503 },
    );
  }

  const { id: providerMessageId, error } = await sendWeeklyPulseEmail({
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
  const notification = await prisma.notification.create({
    data: {
      userId:  userId,
      type:    'WEEKLY_REMINDER',
      subject: 'MyoGuard Weekly Pulse Check-In',
      body:    JSON.stringify({ riskBand: digest.riskBand, trendStatus: digest.trendStatus }),
      sentAt:  new Date(),
    },
  }).catch((err) => {
    // Still non-blocking in effect: the error is swallowed so a Notification
    // failure cannot turn a delivered email into an error response.
    console.error('[email/weekly-pulse] Notification write failed:', err);
    return null;
  });

  await markEventSent(eventId, providerMessageId, notification?.id);

  return NextResponse.json({ sent: true, to: patient.email });
}
