// MyoGuard Clinical Email Governance Layer — Longitudinal Summary Cron Route
// Core principle: "The safest email is the email not unnecessarily sent."
//
// Schedule: 1st of month, 09:00 UTC  ("0 9 1 * *" in vercel.json)
// Security: CRON_SECRET Bearer token — verified before any processing.
// Batch:    Maximum 50 patients per execution (CADENCE.BATCH_LIMIT).
// Ordering: Patients with the oldest last check-in date are processed first.
//
// Suppression and idempotency are database-anchored.
// No in-memory state. Vercel serverless has no shared memory between invocations.
// All Notification queries use createdAt — NOT sentAt (sentAt is nullable, unsafe as anchor).
//
// LONGITUDINAL_SUMMARY NotificationType was added in BUILD 4C-i (schema extension).
// Minimum data requirements enforced: 2 assessments/60 days OR 3 check-ins/30 days.

import { NextRequest } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { generateWeeklyDigest } from '@/src/lib/weeklyDigest';
import { sendLongitudinalSummaryEmail } from '@/src/lib/email/categories/LongitudinalSummary';
import { CADENCE } from '@/src/lib/email/governance/cadence';
import { checkLongitudinalSuppression } from '@/src/lib/email/governance/suppression';
import { checkIdempotency } from '@/src/lib/email/governance/idempotency';
import {
  canSend,
  recordCommunicationEvent,
  markEventSent,
} from '@/src/lib/communications/governance';

/** Template identifier recorded on CommunicationEvent — never the rendered output. */
const TEMPLATE_ID = 'clinical.longitudinal_summary.v1';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // ── CRON_SECRET verification ───────────────────────────────────────────────
  //
  // CRON_SECRET must be set in Vercel environment variables.
  // If missing: return 500 and log the configuration issue.
  // The secret value is never logged or exposed in any response body.

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/longitudinal-summary] CRON_SECRET environment variable is not configured');
    return Response.json({ error: 'Service configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Patient candidate query ────────────────────────────────────────────────
  //
  // Fetch all PATIENT users with their most recent WeeklyCheckin for prioritisation.
  // Patients who have gone longest without a check-in are processed first.
  // This ensures patients most in need of a longitudinal summary are prioritised.

  const allPatients = await prisma.user.findMany({
    where:  { role: 'PATIENT' },
    select: {
      id:         true,
      email:      true,
      fullName:   true,
      // Added in Phase 1D-C3B for the Layer 0 verified-identity gate. Weekly
      // Pulse already selected this; this pathway did not, which is why it had
      // no verification gate at all.
      isVerified: true,
      weeklyCheckins: {
        select:  { completedAt: true },
        orderBy: { completedAt: 'desc' },
        take:    1,
      },
    },
  });

  // Sort: patients with no check-ins (null) come first, then oldest ascending.
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
  // The limit caps the number of patients processed for send.

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
    // Runs before the clinical layers below, for the same reasons as Weekly
    // Pulse. This pathway is the one that has actually delivered — four
    // Longitudinal Summary emails were sent to two recipients in June and July
    // 2026, with no consent record and no verification gate of any kind.
    //
    // `recipientVerified` carries User.isVerified. NOTE: that column is set
    // only by the physician-approval routes (always alongside role=PHYSICIAN)
    // and is never set for a PATIENT — so it does not currently mean "email
    // address verified". It is passed because it is the only verification-shaped
    // signal the platform has, and it fails in the safe direction. See the
    // Phase 1D-C3B report.
    const gate = await canSend({
      email:              patient.email,
      communicationClass: 'CLINICAL_CONTINUITY',
      channel:            'EMAIL',
      userId:             patient.id,
      recipientVerified:  patient.isVerified,
      context:            'cron:longitudinal-summary',
    });

    // Fail closed: an outage is not a decision and must not read as one.
    if (gate.decision === 'UNAVAILABLE') {
      errorCount++;
      console.error(
        `[cron/longitudinal-summary] governance unavailable userId=${patient.id} — not sent`,
      );
      continue;
    }

    if (gate.decision !== 'ALLOW') {
      governanceSuppressedCount++;
      console.log(
        `[cron/longitudinal-summary] governance suppressed userId=${patient.id} ` +
        `decision=${gate.decision} reason=${gate.suppressionReason ?? gate.policyReason ?? 'n/a'}`,
      );
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
      });
      continue;
    }

    // ── Layer 1: Suppression ─────────────────────────────────────────────────
    //
    // Suppression is a success state — a suppressed patient was correctly protected
    // from an unnecessary or data-insufficient communication.
    // Reason is logged for auditability. No PHI in the reason string or userId log.

    const suppResult = await checkLongitudinalSuppression(
      patient.id,
      patient.email,
    );

    if (suppResult.suppressed) {
      suppressedCount++;
      console.log(
        `[cron/longitudinal-summary] suppressed userId=${patient.id} reason=${suppResult.reason}`,
      );
      continue;
    }

    processedCount++;

    // ── Layer 2: Idempotency guard ───────────────────────────────────────────
    //
    // Re-checks the Notification table immediately before send.
    // Guards against concurrent cron invocations both passing Layer 1
    // before either has written a Notification record.
    // An idempotency hit is silently skipped.

    const alreadySent = await checkIdempotency(
      patient.id,
      'LONGITUDINAL_SUMMARY',
      CADENCE.LONGITUDINAL_SUMMARY_DAYS,
    );
    if (alreadySent) {
      console.log(`[cron/longitudinal-summary] idempotency: record exists userId=${patient.id}`);
      continue;
    }

    // ── Data generation ──────────────────────────────────────────────────────
    //
    // generateWeeklyDigest returns null if no scored assessments exist.
    // assessmentCount is queried separately — not included in the digest payload.

    const digest = await generateWeeklyDigest(patient.id);
    if (!digest) {
      suppressedCount++;
      console.log(
        `[cron/longitudinal-summary] no digest userId=${patient.id} reason=no_scored_assessments`,
      );
      continue;
    }

    const assessmentCount = await prisma.assessment.count({
      where: { userId: patient.id },
    });

    // ── Send ─────────────────────────────────────────────────────────────────

    // Governance record established BEFORE the provider is contacted; if it
    // cannot be written, we do not send. See Weekly Pulse for the rationale.
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
        `[cron/longitudinal-summary] could not record communication event userId=${patient.id} — not sent`,
      );
      continue;
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
      errorCount++;
      console.error(`[cron/longitudinal-summary] send error userId=${patient.id}:`, error.message);
      continue;
    }

    // ── Notification record ──────────────────────────────────────────────────
    //
    // Written synchronously — this record is the idempotency anchor.
    // type: LONGITUDINAL_SUMMARY — dedicated semantic type (BUILD 4C-ii).
    // createdAt auto-set by @default(now()) — dedup window anchor for future queries.
    // sentAt records actual send time (informational only).

    const notification = await prisma.notification.create({
      data: {
        userId:  patient.id,
        type:    'LONGITUDINAL_SUMMARY',
        subject: 'Your MyoGuard Longitudinal Summary',
        body:    JSON.stringify({
          riskBand:       digest.riskBand,
          trendStatus:    digest.trendStatus,
          assessmentCount,
        }),
        sentAt: new Date(),
      },
    });

    // Promote to SENT and link the clinical record by id — never copy it.
    await markEventSent(eventId, providerMessageId, notification.id);

    sentCount++;
  }

  const executionMs = Date.now() - startTime;

  console.log(
    `[cron/longitudinal-summary] complete ` +
    `candidates=${candidateCount} processed=${processedCount} ` +
    `sent=${sentCount} suppressed=${suppressedCount} ` +
    `governanceSuppressed=${governanceSuppressedCount} errors=${errorCount} ` +
    `ms=${executionMs}`,
  );

  // ── AuditLog ──────────────────────────────────────────────────────────────
  //
  // Fire-and-forget — AuditLog failure must not block the cron response.
  // metadata: Json field — supports structured payload natively.

  prisma.auditLog.create({
    data: {
      actorId:    'system:cron',
      action:     'CRON_EXECUTED',
      targetType: 'CronExecution',
      targetId:   null,
      metadata: {
        cronType:             'longitudinal_summary',
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
    console.error('[cron/longitudinal-summary] AuditLog write failed:', err),
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
