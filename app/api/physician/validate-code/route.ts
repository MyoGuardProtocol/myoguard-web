import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/**
 * GET /api/physician/validate-code?code=DR-OKPALA-472
 *
 * Public endpoint. Validates a physician referral code and returns the
 * physician's display info so the patient can confirm before linking.
 *
 * Resolution: PhysicianProfile.referralCode → PhysicianProfile.slug
 *              → User.referralSlug → User.id (the physician's DB User.id)
 *
 * Returns:
 *   { ok: true,  displayName, specialty, physicianUserId }  — valid code
 *   { ok: false, error }                                     — invalid / inactive
 */
export async function GET(req: NextRequest) {
  const raw  = req.nextUrl.searchParams.get('code') ?? '';
  const code = raw.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ ok: false, error: 'code is required' }, { status: 400 });
  }

  try {
    // 1. Resolve PhysicianProfile by referralCode
    const profile = await prisma.physicianProfile.findFirst({
      where:  { referralCode: code, isActive: true },
      select: { slug: true, displayName: true, specialty: true, clinicName: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: 'Invalid code' }, { status: 404 });
    }

    // 2. Resolve physician User by referralSlug = profile.slug
    const physician = await prisma.user.findFirst({
      where:  { referralSlug: profile.slug, role: 'PHYSICIAN' },
      select: { id: true },
    });

    if (!physician) {
      // Profile exists but no matching User yet (edge case during admin approval)
      return NextResponse.json({ ok: false, error: 'Physician account not fully set up' }, { status: 404 });
    }

    return NextResponse.json({
      ok:             true,
      displayName:    profile.displayName,
      specialty:      profile.specialty,
      clinicName:     profile.clinicName,
      physicianUserId: physician.id,
    });

  } catch (err) {
    console.error('[GET /api/physician/validate-code]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
