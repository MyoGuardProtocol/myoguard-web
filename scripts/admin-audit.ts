/**
 * scripts/admin-audit.ts
 * One-shot admin account recovery audit.
 * Run: npx tsx scripts/admin-audit.ts
 * DELETE this file after the audit is complete.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const EMAILS = [
  'passtissue@gmail.com',
  'onyeka.okpala@gmail.com',
  'onyeka.okpala@proton.me',
  'myoguardprotocol@gmail.com',
  'myoguardprotocol.vp@gmail.com',
  'onyeka.okpala@myoguard.health',
  // Reference — known test physician
  'nneanyiasa@proton.me',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set');

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    max: 2,
  });

  const adapter  = new PrismaPg(pool as any);
  const prisma   = new PrismaClient({ adapter } as any);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MyoGuard Protocol — Admin Account Recovery Audit');
  console.log('═══════════════════════════════════════════════════════\n');

  const users = await prisma.user.findMany({
    where: { email: { in: EMAILS } },
    select: {
      id:        true,
      clerkId:   true,
      email:     true,
      fullName:  true,
      role:      true,
      createdAt: true,
      profile:               { select: { id: true, age: true, sex: true } },
      physicianOnboarding:   { select: { id: true, specialty: true, submittedAt: true } },
      assessments:           { select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Also check for any ALL_ADMIN roles in the system
  const allAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id:       true,
      clerkId:  true,
      email:    true,
      fullName: true,
      role:     true,
      createdAt: true,
    },
  });

  console.log('FOUND IN DATABASE (from target email list):');
  console.log(`  ${users.length} of ${EMAILS.length} target emails exist in DB\n`);

  if (users.length === 0) {
    console.log('  ⚠  None of the target emails found in database.\n');
  } else {
    for (const u of users) {
      const hasPatientProfile   = !!u.profile;
      const hasPhysicianProfile = !!u.physicianOnboarding;
      const hasAssessments      = u.assessments.length > 0;

      console.log(`  ┌─ ${u.email}`);
      console.log(`  │  DB id:        ${u.id}`);
      console.log(`  │  Clerk id:     ${u.clerkId}`);
      console.log(`  │  Full name:    ${u.fullName || '(none)'}`);
      console.log(`  │  Role:         ${u.role}`);
      console.log(`  │  Patient prof: ${hasPatientProfile  ? '✓ YES' : '✗ NO'}`);
      console.log(`  │  Physician oc: ${hasPhysicianProfile ? '✓ YES (onboarding record)' : '✗ NO'}`);
      console.log(`  │  Assessments:  ${hasAssessments     ? '✓ YES' : '✗ none'}`);
      if (u.profile) {
        console.log(`  │  Profile age:  ${u.profile.age}  sex: ${u.profile.sex}`);
      }
      if (u.physicianOnboarding) {
        console.log(`  │  Specialty:    ${u.physicianOnboarding.specialty || '(not set)'}`);
        console.log(`  │  Submitted:    ${u.physicianOnboarding.submittedAt.toISOString()}`);
      }
      console.log(`  │  Created:      ${u.createdAt.toISOString()}`);

      const canApprovePhysicians = u.role === 'ADMIN';
      const canAccessAdminPanel  = u.role === 'ADMIN';
      const canAccessDoctor      = u.role === 'PHYSICIAN' || u.role === 'ADMIN';
      const canAccessPatient     = u.role === 'PATIENT'   || u.role === 'ADMIN';

      console.log(`  │  Admin panel:  ${canAccessAdminPanel  ? '✓' : '✗'}`);
      console.log(`  │  Approve phys: ${canApprovePhysicians ? '✓' : '✗'}`);
      console.log(`  │  Doctor routes:${canAccessDoctor      ? '✓' : '✗'}`);
      console.log(`  │  Patient dash: ${canAccessPatient     ? '✓' : '✗'}`);
      console.log(`  └─────────────────────────────────────────────────────\n`);
    }
  }

  // Report missing emails
  const foundEmails = new Set(users.map(u => u.email));
  const missing = EMAILS.filter(e => !foundEmails.has(e));
  if (missing.length > 0) {
    console.log('NOT IN DATABASE (no row found):');
    for (const e of missing) console.log(`  ✗  ${e}`);
    console.log('');
  }

  // All admins in the entire system
  console.log(`ALL ADMIN ACCOUNTS IN DATABASE (role = ADMIN):`);
  if (allAdmins.length === 0) {
    console.log('  ⚠  NO ADMIN ACCOUNTS EXIST. Platform has no admin.\n');
  } else {
    for (const a of allAdmins) {
      console.log(`  ✓  ${a.email}  (id: ${a.id})  clerkId: ${a.clerkId}  name: ${a.fullName}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
