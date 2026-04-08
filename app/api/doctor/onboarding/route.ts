export const dynamic = 'force-dynamic';

import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/lib/prisma';
import { Prisma } from '@prisma/client';

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
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? '';

  if (!email) {
    console.error('[doctor/onboarding] No email on Clerk user', clerkId);
    return NextResponse.json(
      { error: 'Could not retrieve account email. Please sign out and try again.' },
      { status: 422 },
    );
  }

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
    console.error('Onboarding error:', err);

    // If DB tables don't exist yet (migration pending), send notification email
    // and return 200 so the form shows the success screen.
    const isTableMissing =
      (err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2021' || err.code === 'P2010')) ||
      (err instanceof Error &&
        (err.message.includes('relation') || err.message.includes('does not exist')));

    if (isTableMissing) {
      console.warn('[doctor/onboarding] DB table missing — falling back to email notification');
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const submittedAt = new Date().toLocaleString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
        });
        await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'MyoGuard Protocol <onboarding@resend.dev>',
            to:      'onyeka.okpala@myoguard.health',
            subject: 'New Physician Registration — MyoGuard',
            html: `
              <p><strong>New physician registration received.</strong></p>
              <table style="border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Name</td><td><strong>${fullName}</strong></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Email</td><td>${email}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Country</td><td>${country}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Specialty</td><td>${specialty ?? '—'}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Licence No.</td><td>${licenseNumber ?? '—'}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Submitted</td><td>${submittedAt}</td></tr>
              </table>
              <p style="margin-top:16px;color:#94a3b8;font-size:12px;">
                Note: DB migration is pending. Record was not written to the database.
              </p>
            `,
          }),
        }).catch(e => console.error('[doctor/onboarding] Resend fallback failed', e));
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
