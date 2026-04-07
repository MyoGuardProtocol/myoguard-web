-- Migration: 20260406_add_sleep_recovery
-- Adds sleep tracking and computed recovery status to Assessment and WeeklyCheckin.
-- All new columns are nullable so existing rows are unaffected.

-- Assessment table
ALTER TABLE "Assessment"
  ADD COLUMN IF NOT EXISTS "sleepHours"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sleepQuality"   INTEGER,
  ADD COLUMN IF NOT EXISTS "recoveryStatus" TEXT;

-- WeeklyCheckin table
ALTER TABLE "WeeklyCheckin"
  ADD COLUMN IF NOT EXISTS "sleepHours"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sleepQuality"   INTEGER,
  ADD COLUMN IF NOT EXISTS "recoveryStatus" TEXT;
