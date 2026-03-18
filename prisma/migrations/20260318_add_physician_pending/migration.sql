-- Migration: add_physician_pending
-- Run this in Supabase SQL Editor or via `prisma migrate deploy` when
-- the database server is reachable on port 5432.
--
-- Changes:
--   1. Add PHYSICIAN_PENDING value to the Role enum
--   2. Create PhysicianOnboarding table

-- 1. Add new enum value (PostgreSQL requires ALTER TYPE)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PHYSICIAN_PENDING';

-- 2. Create PhysicianOnboarding table
CREATE TABLE IF NOT EXISTS "PhysicianOnboarding" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "country"       TEXT NOT NULL,
    "specialty"     TEXT,
    "licenseNumber" TEXT,
    "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysicianOnboarding_pkey" PRIMARY KEY ("id")
);

-- 3. Unique constraint on userId (one record per physician)
CREATE UNIQUE INDEX IF NOT EXISTS "PhysicianOnboarding_userId_key"
    ON "PhysicianOnboarding"("userId");

-- 4. Foreign key to User
ALTER TABLE "PhysicianOnboarding"
    ADD CONSTRAINT "PhysicianOnboarding_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
