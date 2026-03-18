-- Migration: add_physician_referral_code
-- Adds a human-readable patient referral code to PhysicianProfile.
-- Run in Supabase SQL Editor or via `prisma migrate deploy`.
--
-- Format: DR-LASTNAME-NNN  (e.g. DR-OKPALA-472)
-- Auto-generated when a PHYSICIAN_PENDING account is approved by an admin.

ALTER TABLE "PhysicianProfile"
    ADD COLUMN IF NOT EXISTS "referralCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PhysicianProfile_referralCode_key"
    ON "PhysicianProfile"("referralCode");
