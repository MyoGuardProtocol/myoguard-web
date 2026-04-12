import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

/**
 * Generates a unique human-readable physician referral code.
 * Format: DR-LASTNAME-NNN  e.g. DR-OKPALA-472
 *
 * Retries up to 5 times to avoid the (rare) collision, then falls back to
 * a timestamp-derived suffix that is practically unique.
 */
async function generateUniqueReferralCode(displayName: string): Promise<string> {
  const cleaned  = displayName.replace(/^Dr\.?\s+/i, '').trim();
  const parts    = cleaned.split(/\s+/);
  const lastName = (parts[parts.length - 1] ?? 'DOC')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 8) || 'DOC';

  for (let i = 0; i < 5; i++) {
    const num  = String(100 + Math.floor(Math.random() * 900)); // 100–999
    const code = `DR-${lastName}-${num}`;
    const exists = await prisma.physicianProfile.findFirst({
      where:  { referralCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  // Fallback: base-36 timestamp suffix — practically unique
  return `DR-${lastName}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

const UpgradeSchema = z.object({
  /** Internal DB User.id of the PHYSICIAN_PENDING account to approve */
  userId:       z.string().min(1),
  /** Optional referral slug. If omitted, a slug is derived from the user's name. */
  referralSlug: z.string().min(2).max(60).optional(),
  /** Optional clinic name to include in the PhysicianProfile */
  clinicName:   z.string().max(120).optional(),
});

/**
 * POST /api/admin/upgrade-physician
 *
 * Promotes a PHYSICIAN_PENDING user to PHYSICIAN, creates (or updates) their
 * PhysicianProfile with a referral slug, and auto-generates a unique patient
 * referral code (DR-LASTNAME-NNN) that patients can enter during onboarding
 * to link their account to this physician.
 *
 * Caller must have role = ADMIN.
 *
 * Body: { userId, referralSlug?, clinicName? }
 *
 * On success returns: { ok: true, slug, referralCode }
 */
export async function POST(req: NextRequest) {
  const { userId: callerClerkId } = await auth();
  if (!callerClerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify caller is ADMIN
  const caller = await prisma.user.findUnique({
    where:  { clerkId: callerClerkId },
    select: { role: true },
  });
  if (!caller || caller.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpgradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 422 });
  }

  const { userId, referralSlug, clinicName } = parsed.data;

  // Fetch the target user
  const target = await prisma.user.findUnique({
    where:   { id: userId },
    include: { physicianOnboarding: true },
  });

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (target.role !== 'PHYSICIAN_PENDING') {
    return NextResponse.json({ error: `User role is ${target.role}, not PHYSICIAN_PENDING` }, { status: 400 });
  }

  // Derive slug: provided > existing > kebab-case from name > first 8 chars of id
  const nameSlug = target.fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const derivedSlug =
    referralSlug ??
    target.referralSlug ??
    (nameSlug || target.id.slice(0, 8));

  try {
    // 1. Promote role + set referralSlug + mark as verified
    await prisma.user.update({
      where: { id: userId },
      data:  { role: 'PHYSICIAN', referralSlug: derivedSlug, isVerified: true },
    });

    // 2. Generate a unique patient referral code (DR-LASTNAME-NNN)
    //    Only generate if this profile doesn't already have one.
    const existingProfile = await prisma.physicianProfile.findUnique({
      where:  { slug: derivedSlug },
      select: { referralCode: true },
    });
    const referralCode =
      existingProfile?.referralCode ??
      (await generateUniqueReferralCode(target.fullName));

    // 3. Create / update PhysicianProfile
    await prisma.physicianProfile.upsert({
      where:  { slug: derivedSlug },
      create: {
        slug:         derivedSlug,
        displayName:  target.fullName,
        clinicName:   clinicName ?? null,
        specialty:    target.physicianOnboarding?.specialty ?? null,
        referralCode,
        isActive:     true,
      },
      update: {
        displayName:  target.fullName,
        specialty:    target.physicianOnboarding?.specialty ?? null,
        referralCode,                          // set if not already present
        ...(clinicName ? { clinicName } : {}),
      },
    });

    // 4. Audit log
    await prisma.auditLog.create({
      data: {
        actorId:    callerClerkId,
        action:     'UPGRADE_PHYSICIAN',
        targetType: 'User',
        targetId:   userId,
        metadata:   { slug: derivedSlug, referralCode, previousRole: 'PHYSICIAN_PENDING' },
      },
    });

    return NextResponse.json({ ok: true, slug: derivedSlug, referralCode });
  } catch (err) {
    console.error('[admin/upgrade-physician]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
