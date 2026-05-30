// MyoGuard Clinical Email Governance Layer
// Core principle: "The safest email is the email not unnecessarily sent."
// These are clinical continuity communications, not marketing campaigns.
// Suppression is a feature, not a failure.
// Every suppression is logged for auditability.

import { prisma } from '@/src/lib/prisma';
import type { NotificationType } from '@prisma/client';

/**
 * checkIdempotency()
 *
 * Layer 2 idempotency guard — called immediately before each email send attempt,
 * after all suppression checks have passed.
 *
 * Purpose:
 *   Prevents duplicate sends when two concurrent cron invocations both pass the
 *   Layer 1 suppression check before either writes a Notification record.
 *   Vercel does not guarantee exactly-once cron delivery; this guard addresses
 *   the resulting race condition.
 *
 * Returns:
 *   true  — a Notification record already exists within the cadence window.
 *            Caller must skip this patient silently (not counted as error or suppression).
 *   false — no recent record found; safe to proceed with send.
 *
 * Window anchor: Notification.createdAt (non-nullable, @default(now())).
 *
 * IMPORTANT: sentAt must NOT be used as the window anchor — it is nullable (DateTime?)
 * and a record with sentAt = null would fall outside any sentAt-based window query,
 * producing false negatives and allowing duplicate sends.
 */
export async function checkIdempotency(
  userId:     string,
  type:       NotificationType,
  windowDays: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: since },  // createdAt — non-nullable anchor, always set
    },
    select: { id: true },
  });

  return existing !== null;
}
