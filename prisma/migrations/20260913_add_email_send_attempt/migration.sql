-- Migration: 20260913_add_email_send_attempt
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ THIS FILE WAS NOT EXECUTED. It is DDL documentation only.                │
-- │                                                                          │
-- │ This repository does not use Prisma-managed migration history (see       │
-- │ CLAUDE.md). Schema changes are applied with `npx prisma db push`, which  │
-- │ ignores this directory entirely. The EmailSendAttempt table was created  │
-- │ that way on 2026-09-13; these statements are recorded to document the    │
-- │ resulting shape and to support manual recovery.                          │
-- │                                                                          │
-- │ Do NOT run `prisma migrate deploy` or `prisma migrate dev` against this  │
-- │ repository. `_prisma_migrations` records only 2 of the 6 directories     │
-- │ here, so migrate would try to replay already-applied DDL (deploy) or     │
-- │ offer to reset the database (dev). That hazard predates this file.       │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Adds abuse-control state for the two public, unauthenticated email routes
-- (/api/protocol-email, /api/email-capture).
--
-- One row per send ATTEMPT, written before the email provider is invoked.
-- Append-only rows make the 24-hour ceiling a true rolling window.
--
-- Privacy: no plaintext email, no name, no IP, no user id, no clinical value.
-- "recipientKey" is HMAC-SHA256 of the normalised address and is not
-- reversible without the server-side secret.
--
-- Retention: every request that reaches this table also runs a bounded delete
-- of rows older than the enforcement window (24 hours), so the table cannot
-- accumulate while traffic continues. Not durable visitor history.
--
-- Additive only. No existing table, column, index or constraint is touched.

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailSendAttempt" (
    "id" TEXT NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSendAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Serves both enforcement reads: the 10-minute cooldown probe and the
-- rolling 24-hour count, each scoped to a single recipientKey.
-- Also supports the opportunistic cleanup delete, which filters on createdAt.
CREATE INDEX IF NOT EXISTS "EmailSendAttempt_recipientKey_createdAt_idx"
    ON "EmailSendAttempt" ("recipientKey", "createdAt");
