import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/account-audit?secret=<AUDIT_SECRET>
 *
 * TEMPORARY DIAGNOSTIC ENDPOINT — delete after admin account recovery.
 *
 * Requires the `AUDIT_SECRET` environment variable to be set in Vercel.
 * Accepts the secret as a query param so it can be hit from a browser.
 *
 * Returns the role, profile state, and Clerk ID for a fixed set of
 * operator emails, plus a full list of all ADMIN accounts in the DB.
 * No patient PHI is returned.
 */

const TARGET_EMAILS = [
  'passtissue@gmail.com',
  'onyeka.okpala@gmail.com',
  'onyeka.okpala@proton.me',
  'myoguardprotocol@gmail.com',
  'myoguardprotocol.vp@gmail.com',
  'onyeka.okpala@myoguard.health',
  // reference — known test physician
  'nneanyiasa@proton.me',
];

export async function GET(req: NextRequest) {
  // ── Secret guard ───────────────────────────────────────────────────────────
  const auditSecret = process.env.AUDIT_SECRET;
  if (!auditSecret) {
    return NextResponse.json(
      { error: 'AUDIT_SECRET env var not set — endpoint disabled.' },
      { status: 503 },
    );
  }

  const providedSecret = req.nextUrl.searchParams.get('secret');
  if (!providedSecret || providedSecret !== auditSecret) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // ── Target email lookup ────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    where: { email: { in: TARGET_EMAILS } },
    select: {
      id:        true,
      clerkId:   true,
      email:     true,
      fullName:  true,
      role:      true,
      createdAt: true,
      profile:             { select: { id: true, age: true, sex: true } },
      physicianOnboarding: { select: { id: true, specialty: true, submittedAt: true } },
      assessments:         { select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  });

  // ── All ADMIN accounts in the system ──────────────────────────────────────
  const allAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id:       true,
      clerkId:  true,
      email:    true,
      fullName: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // ── Shape output ──────────────────────────────────────────────────────────
  const accountRows = users.map(u => ({
    email:               u.email,
    fullName:            u.fullName,
    dbId:                u.id,
    clerkId:             u.clerkId,
    role:                u.role,
    createdAt:           u.createdAt,
    hasPatientProfile:   !!u.profile,
    profileAge:          u.profile?.age ?? null,
    profileSex:          u.profile?.sex ?? null,
    hasAssessments:      u.assessments.length > 0,
    hasPhysicianRecord:  !!u.physicianOnboarding,
    physicianSpecialty:  u.physicianOnboarding?.specialty ?? null,
    physicianSubmitted:  u.physicianOnboarding?.submittedAt ?? null,
    // Derived flags
    canAccessAdminPanel: u.role === 'ADMIN',
    canApprovePhysicians: u.role === 'ADMIN',
    canAccessDoctorRoutes: ['PHYSICIAN', 'PHYSICIAN_PENDING', 'ADMIN'].includes(u.role),
    canAccessPatientDash:  ['PATIENT', 'ADMIN'].includes(u.role),
    mixedState: (!!u.profile || u.assessments.length > 0) && !!u.physicianOnboarding,
  }));

  const missingEmails = TARGET_EMAILS.filter(
    e => !users.find(u => u.email === e),
  );

  return NextResponse.json({
    _note: 'TEMPORARY DIAGNOSTIC — delete app/api/admin/account-audit after use.',
    targetEmailsQueried: TARGET_EMAILS.length,
    foundInDatabase:     accountRows.length,
    missingFromDatabase: missingEmails,
    accounts:            accountRows,
    allAdminAccounts:    allAdmins,
    adminCount:          allAdmins.length,
  });
}
