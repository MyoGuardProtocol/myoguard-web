// MyoGuard Clinical Email Governance Layer — Weekly Pulse Cron Route
// Core principle: "The safest email is the email not unnecessarily sent."
//
// Schedule: Monday 09:00 UTC  ("0 9 * * 1" in vercel.json)
// Security: CRON_SECRET Bearer token — verified before any processing.
// Batch:    Maximum 50 patients per execution (CADENCE.BATCH_LIMIT).
// Ordering: Patients with the oldest last check-in date are processed first.
//
// Suppression and idempotency are database-anchored.
// No in-memory state. Vercel serverless has no shared memory between invocations.
// All Notification queries use createdAt — NOT sentAt (sentAt is nullable, unsafe as anchor).

import { NextRequest } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { generateWeeklyDigest } from '@/src/lib/weeklyDigest';
import { sendWeeklyPulseEmail } from '@/src/lib/email/categories/WeeklyPulse';
import { CADENCE } from '@/src/lib/email/governance/cadence';
import { checkWeeklyPulseSuppression } from '@/src/lib/email/governance/suppression';
import { checkIdempotency } from '@/src/lib/email/governance/idempotency';
import {
  canSend,
  recordCommunicationEvent,
  markEventSent,
} from '@/src/lib/communications/governance';

/** Template identifier recorded on CommunicationEvent — never the rendered output. */
const TEMPLATE_ID = 'clinical.weekly_pulse.v1';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // ── CRON_SECRET verification ───────────────────────────────────────────────
  //
  // CRON_SECRET must be set in Vercel environment variables.
  // If missing: return 500 and log the configuration issue.
  // The secret value is never logged or exposed in any response body.

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/weekly-pulse] CRON_SECRET environment variable is not configured');
    return Response.json({ error: 'Service configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Patient candidate query ────────────────────────────────────────────────
  //
  // Fetch all PATIENT users, including their most recent WeeklyCheckin date.
  // Used to sort candidates: patients who have gone longest without checking in
  // are processed first (oldest check-in date ascending; nulls = never checked in).
  // This ensures patients most in need of a continuity prompt are prioritised.

  const allPatients = await prisma.user.findMany({
    where:  { role: 'PATIENT' },
    select: {
      id:         true,
      clerkId:    true,
      email:      true,
      fullName:   true,
      // Retained for Layer 1 ONLY, which has consumed it since BUILD 4C. It is
      // no longer used as an email-verification signal — see Layer 0 below.
      isVerified: true,
      weeklyCheckins: {
        select:  { completedAt: true },
        orderBy: { completedAt: 'desc' },
        take:    1,
      },
    },
  });

  // Sort: patients with no check-ins (null) come first, then oldest check-in ascending.
  allPatients.sort((a, b) => {
    const aTime = a.weeklyCheckins[0]?.completedAt?.getTime() ?? 0;
    const bTime = b.weeklyCheckins[0]?.completedAt?.getTime() ?? 0;
    return aTime - bTime;
  });

  const candidateCount = allPatients.length;

  // ── Batch processing ───────────────────────────────────────────────────────
  //
  // Iterate in priority order (oldest check-in first).
  // Suppressed patients do not count toward the batch limit.
  // The limit caps the number of patients actually processed for send (processedCount).
  // Remaining patients wait for the next cron execution.

  let suppressedCount           = 0;
  let governanceSuppressedCount = 0;
  let processedCount            = 0;
  let sentCount                 = 0;
  let errorCount                = 0;

  for (const patient of allPatients) {

    // Batch limit — stop when we have processed enough patients for this execution
    if (processedCount >= CADENCE.BATCH_LIMIT) break;

    // ── Layer 0: Communications governance (Phase 1D-C3B) ────────────────────
    //
    // Recipient choice and absolute suppression are evaluated BEFORE the
    // clinical layers below. A recipient who has withdrawn consent, hard
    // bounced or complained should not have clinical queries run against their
    // record at all, and preference is both cheaper and more absolute than
    // data-sufficiency.
    //
    // Phase 1D-C3B.1: this route no longer asserts whether the recipient is
    // verified. It supplies the Clerk identity and the governance boundary
    // resolves verification itself against Clerk's verified PRIMARY email,
    // requiring that address to BE the destination. User.isVerified is a
    // physician credential-approval flag and was never an email-verification
    // signal; it is not consulted here.
    const gate = await canSend({
      email:              patient.email,
      communicationClass: 'CLINICAL_CONTINUITY',
      channel:            'EMAIL',
      userId:             patient.id,
      clerkUserId:        patient.clerkId,
      context:            'cron:weekly-pulse',
    });

    // Fail closed: governance could not be established, so nothing is sent.
    // Counted as an error rather than a suppression — this is an outage, not a
    // decision, and must not read as a recipient having been protected.
    if (gate.decision === 'UNAVAILABLE') {
      errorCount++;
      console.error(`[cron/weekly-pulse] governance unavailable userId=${patient.id} — not sent`);
      continue;
    }

    if (gate.decision !== 'ALLOW') {
      governanceSuppressedCount++;
      console.log(
        `[cron/weekly-pulse] governance suppressed userId=${patient.id} ` +
        `decision=${gate.decision} reason=${gate.suppressionReason ?? gate.policyReason ?? 'n/a'}`,
      );
      // Auditable refusal. Suppression was previously console-only and
      // invisible once logs aged out.
      await recordCommunicationEvent({
        recipientKey:       gate.recipientKey!,
        keyVersion:         gate.keyVersion,
        userId:             patient.id,
        communicationClass: 'CLINICAL_CONTINUITY',
        channel:            'EMAIL',
        templateId:         TEMPLATE_ID,
        provider:           'RESEND',
        state:              'SUPPRESSED',
        suppressionReason:  gate.suppressionReason,
        policyReason:       gate.policyReason,
      });
      continue;
    }

    // ── Layer 1: Suppression ─────────────────────────────────────────────────
    //
    // Suppression is a success state — a suppressed patient was correctly protected
    // from an unnecessary communication. Reason is logged for auditability.
    // No PHI appears in the logged reason or userId.

    const suppResult = await checkWeeklyPulseSuppression(
      patient.id,
      patient.email,
      patient.isVerified,
    );

    if (suppResult.suppressed) {
      suppressedCount++;
      console.log(
        `[cron/weekly-pulse] suppressed userId=${patient.id} reason=${suppResult.reason}`,
      );
      continue;
    }

    processedCount++;

    // ── Layer 2: Idempotency guard ───────────────────────────────────────────
    //
    // Re-checks the Notification table immediately before send.
    // Guards against concurrent cron invocations both passing Layer 1
    // before either has written a Notification record.
    // An idempotency hit is silently skipped — not counted as suppression or error.

    const alreadySent = await checkIdempotency(
      patient.id,
      'WEEKLY_REMINDER',
      CADENCE.WEEKLY_PULSE_DAYS,
    );
    if (alreadySent) {
      console.log(`[cron/weekly-pulse] idempotency: record exists userId=${patient.id}`);
      continue;
    }

    // ── Digest generation ────────────────────────────────────────────────────
    //
    // generateWeeklyDigest returns null if no scored assessments exist.
    // This is a suppression condition — not an error.

    const digest = await generateWeeklyDigest(patient.id);
    if (!digest) {
      suppressedCount++;
      console.log(`[cron/weekly-pulse] no digest userId=${patient.id} reason=no_scored_assessments`);
      continue;
    }

    // ── Send ─────────────────────────────────────────────────────────────────
    //
    // Only governed fields are passed — never nextAction, projectedScore, or nextActionType.

    // Governance record is established BEFORE the provider is contacted.
    // If it cannot be written we do not send: protecting recipient choice and
    // the integrity of the clinical sending record outranks delivery, and an
    // unrecorded send is one that later cannot be audited or reconciled.
    const eventId = await recordCommunicationEvent({
      recipientKey:       gate.recipientKey!,
      keyVersion:         gate.keyVersion,
      userId:             patient.id,
      communicationClass: 'CLINICAL_CONTINUITY',
      channel:            'EMAIL',
      templateId:         TEMPLATE_ID,
      provider:           'RESEND',
      state:              'REQUESTED',
    });

    if (!eventId) {
      errorCount++;
      console.error(
        `[cron/weekly-pulse] could not record communication event userId=${patient.id} — not sent`,
      );
      continue;
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
      errorCount++;
      console.error(`[cron/weekly-pulse] send error userId=${patient.id}:`, error.message);
      continue;
    }

    // ── Notification record ──────────────────────────────────────────────────
    //
    // Written synchronously — not fire-and-forget.
    // This record is the idempotency anchor for subsequent invocations.
    // createdAt is auto-set by @default(now()) and is the dedup window anchor.
    // sentAt records the actual send timestamp (informational only).

    const notification = await prisma.notification.create({
      data: {
        userId:  patient.id,
        type:    'WEEKLY_REMINDER',
        subject: 'MyoGuard Weekly Pulse Check-In',
        body:    JSON.stringify({
          riskBand:    digest.riskBand,
          trendStatus: digest.trendStatus,
        }),
        sentAt: new Date(),
      },
    });

    // Promote the governance record to SENT and link the clinical record by id.
    // The clinical payload stays in Notification.body; CommunicationEvent
    // references it and never copies it.
    await markEventSent(eventId, providerMessageId, notification.id);

    sentCount++;
  }

  const executionMs = Date.now() - startTime;

  console.log(
    `[cron/weekly-pulse] complete ` +
    `candidates=${candidateCount} processed=${processedCount} ` +
    `sent=${sentCount} suppressed=${suppressedCount} ` +
    `governanceSuppressed=${governanceSuppressedCount} errors=${errorCount} ` +
    `ms=${executionMs}`,
  );

  // ── AuditLog ─────────────────────────────────────────────────────────────
  //
  // Fire-and-forget — AuditLog failure must not block the cron response.
  // actorId: "system:cron" sentinel — system-generated, no user actor.
  // metadata: Json field — supports structured payload natively (no schema workaround).

  prisma.auditLog.create({
    data: {
      actorId:    'system:cron',
      action:     'CRON_EXECUTED',
      targetType: 'CronExecution',
      targetId:   null,
      metadata: {
        cronType:             'weekly_pulse',
        candidateCount,
        patientsProcessed:    processedCount,
        emailsSent:           sentCount,
        suppressed:           suppressedCount,
        governanceSuppressed: governanceSuppressedCount,
        errors:               errorCount,
        executionMs,
      },
    },
  }).catch((err) =>
    console.error('[cron/weekly-pulse] AuditLog write failed:', err),
  );

  return Response.json({
    ok:                   true,
    candidateCount,
    patientsProcessed:    processedCount,
    emailsSent:           sentCount,
    suppressed:           suppressedCount,
    governanceSuppressed: governanceSuppressedCount,
    errors:               errorCount,
    executionMs,
  });
}
