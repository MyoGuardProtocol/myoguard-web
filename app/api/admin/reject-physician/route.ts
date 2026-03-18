import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';

const RejectSchema = z.object({
  /** Internal DB User.id of the PHYSICIAN_PENDING account to reject */
  userId: z.string().min(1),
});

/**
 * POST /api/admin/reject-physician
 *
 * Rejects a PHYSICIAN_PENDING account by setting role back to PATIENT.
 * Optionally logs a reason (future extension).
 *
 * Caller must have role = ADMIN.
 *
 * Body: { userId }
 *
 * On success returns: { ok: true }
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

  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 422 });
  }

  const { userId } = parsed.data;

  const target = await prisma.user.findUnique({
    where:  { id: userId },
    select: { role: true },
  });

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (target.role !== 'PHYSICIAN_PENDING') {
    return NextResponse.json(
      { error: `User role is ${target.role}, expected PHYSICIAN_PENDING` },
      { status: 400 },
    );
  }

  try {
    // Revert to PATIENT — the safest rollback in the current Role enum
    await prisma.user.update({
      where: { id: userId },
      data:  { role: 'PATIENT' },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId:    callerClerkId,
        action:     'REJECT_PHYSICIAN',
        targetType: 'User',
        targetId:   userId,
        metadata:   { previousRole: 'PHYSICIAN_PENDING', newRole: 'PATIENT' },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/reject-physician]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
