import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

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
 * Promotes a PHYSICIAN_PENDING user to PHYSICIAN and creates (or updates)
 * their PhysicianProfile with a referral slug.
 *
 * Caller must have role = ADMIN.
 *
 * Body: { userId, referralSlug?, clinicName? }
 *
 * On success returns: { ok: true, slug }
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
    // 1. Promote role + set referralSlug
    await prisma.user.update({
      where: { id: userId },
      data:  { role: 'PHYSICIAN', referralSlug: derivedSlug },
    });

    // 2. Create / update PhysicianProfile (used by patient referral flow)
    await prisma.physicianProfile.upsert({
      where:  { slug: derivedSlug },
      create: {
        slug:        derivedSlug,
        displayName: target.fullName,
        clinicName:  clinicName ?? null,
        specialty:   target.physicianOnboarding?.specialty ?? null,
        isActive:    true,
      },
      update: {
        displayName: target.fullName,
        specialty:   target.physicianOnboarding?.specialty ?? null,
        ...(clinicName ? { clinicName } : {}),
      },
    });

    // 3. Audit log
    await prisma.auditLog.create({
      data: {
        actorId:    callerClerkId,
        action:     'UPGRADE_PHYSICIAN',
        targetType: 'User',
        targetId:   userId,
        metadata:   { slug: derivedSlug, previousRole: 'PHYSICIAN_PENDING' },
      },
    });

    return NextResponse.json({ ok: true, slug: derivedSlug });
  } catch (err) {
    console.error('[admin/upgrade-physician]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
