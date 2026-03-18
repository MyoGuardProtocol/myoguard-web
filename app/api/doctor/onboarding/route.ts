import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

const OnboardingSchema = z.object({
  fullName:      z.string().min(2).max(100).trim(),
  country:       z.string().min(2).max(100).trim(),
  specialty:     z.string().max(100).trim().optional(),
  licenseNumber: z.string().max(100).trim().optional(),
});

/**
 * POST /api/doctor/onboarding
 *
 * Called by /doctor/onboarding after a physician completes the setup form.
 *
 * Actions:
 *   1. Validates fields (Zod)
 *   2. Upserts the User record (handles race-condition where Clerk webhook
 *      hasn't fired yet) with role = PHYSICIAN_PENDING
 *   3. Upserts a PhysicianOnboarding record with the submitted profile data
 *
 * Returns: { ok: true } on success.
 * The client then redirects to /doctor/dashboard.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { fullName, country, specialty, licenseNumber } = parsed.data;

  // Fetch email from Clerk (needed if User row doesn't exist yet)
  const clerkUser = await currentUser();
  const email     = clerkUser?.emailAddresses?.[0]?.emailAddress ?? '';

  try {
    // 1. Upsert User — set role to PHYSICIAN_PENDING
    //    If the user is already PHYSICIAN or ADMIN, do NOT downgrade them.
    const existing = await prisma.user.findUnique({
      where:  { clerkId },
      select: { id: true, role: true },
    });

    let dbUser: { id: string };

    if (existing) {
      // Update name; only change role if still PATIENT
      const roleUpdate =
        existing.role === 'PATIENT' ? { role: 'PHYSICIAN_PENDING' as const } : {};

      dbUser = await prisma.user.update({
        where:  { clerkId },
        data:   { fullName, ...roleUpdate },
        select: { id: true },
      });
    } else {
      // New user — create with PHYSICIAN_PENDING
      dbUser = await prisma.user.create({
        data: {
          clerkId,
          email,
          fullName,
          role:               'PHYSICIAN_PENDING',
          subscriptionStatus: 'FREE',
        },
        select: { id: true },
      });
    }

    // 2. Upsert PhysicianOnboarding profile
    await prisma.physicianOnboarding.upsert({
      where:  { userId: dbUser.id },
      create: {
        userId:        dbUser.id,
        country,
        specialty:     specialty     ?? null,
        licenseNumber: licenseNumber ?? null,
      },
      update: {
        country,
        specialty:     specialty     ?? null,
        licenseNumber: licenseNumber ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[doctor/onboarding] DB error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
