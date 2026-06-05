/**
 * scripts/admin-audit.mjs
 * Admin account recovery audit — plain Node ESM, uses pg directly.
 * Run: node --use-system-ca scripts/admin-audit.mjs
 * DELETE after the audit is complete.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');

function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ── pg ────────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

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
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    max: 2,
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MyoGuard Protocol — Admin Account Recovery Audit');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Target email lookup ────────────────────────────────────────────────────
  const placeholders = EMAILS.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: users } = await pool.query(
    `SELECT
       u.id,
       u."clerkId",
       u.email,
       u."fullName",
       u.role,
       u."createdAt",
       (SELECT COUNT(*) FROM "UserProfile"      WHERE "userId" = u.id) AS profile_count,
       (SELECT COUNT(*) FROM "PhysicianOnboarding" WHERE "userId" = u.id) AS onboarding_count,
       (SELECT specialty FROM "PhysicianOnboarding" WHERE "userId" = u.id LIMIT 1) AS specialty,
       (SELECT "submittedAt" FROM "PhysicianOnboarding" WHERE "userId" = u.id LIMIT 1) AS onboarding_submitted,
       (SELECT age  FROM "UserProfile" WHERE "userId" = u.id LIMIT 1) AS profile_age,
       (SELECT sex  FROM "UserProfile" WHERE "userId" = u.id LIMIT 1) AS profile_sex,
       (SELECT COUNT(*) FROM "Assessment" WHERE "userId" = u.id) AS assessment_count
     FROM "User" u
     WHERE u.email IN (${placeholders})
     ORDER BY u."createdAt" ASC`,
    EMAILS
  );

  console.log(`FOUND IN DATABASE (from ${EMAILS.length} target emails): ${users.length} match(es)\n`);

  const foundEmails = new Set();

  for (const u of users) {
    foundEmails.add(u.email);
    const hasPatient    = parseInt(u.profile_count)    > 0;
    const hasPhysician  = parseInt(u.onboarding_count) > 0;
    const hasAssess     = parseInt(u.assessment_count) > 0;
    const isAdmin       = u.role === 'ADMIN';
    const isPhysician   = u.role === 'PHYSICIAN' || u.role === 'PHYSICIAN_PENDING';

    console.log(`  ┌─ ${u.email}`);
    console.log(`  │  DB id       : ${u.id}`);
    console.log(`  │  Clerk id    : ${u.clerkId}`);
    console.log(`  │  Full name   : ${u.fullName || '(none)'}`);
    console.log(`  │  Role        : ${u.role}`);
    console.log(`  │  Created     : ${u.createdAt ? new Date(u.createdAt).toISOString() : 'unknown'}`);
    console.log(`  │  Patient prof: ${hasPatient   ? '✓ YES (UserProfile exists)' : '✗ NO'}`);
    console.log(`  │  Assessments : ${hasAssess    ? `✓ YES (${u.assessment_count})` : '✗ none'}`);
    console.log(`  │  Physician oc: ${hasPhysician ? `✓ YES — specialty: ${u.specialty || 'not set'}, submitted: ${u.onboarding_submitted ? new Date(u.onboarding_submitted).toISOString().slice(0,10) : '?'}` : '✗ NO'}`);
    if (hasPatient) {
      console.log(`  │  Profile data: age=${u.profile_age}, sex=${u.profile_sex}`);
    }
    console.log(`  │  ── Permissions ──────────────────────────────`);
    console.log(`  │  Admin panel   : ${isAdmin     ? '✓ YES' : '✗ NO'}`);
    console.log(`  │  Approve phys  : ${isAdmin     ? '✓ YES' : '✗ NO'}`);
    console.log(`  │  Doctor routes : ${isAdmin || isPhysician ? '✓ YES' : '✗ NO'}`);
    console.log(`  │  Patient dash  : ${isAdmin || u.role === 'PATIENT' ? '✓ YES' : '✗ NO'}`);
    console.log(`  └───────────────────────────────────────────────────────────\n`);
  }

  // ── Missing emails ─────────────────────────────────────────────────────────
  const missing = EMAILS.filter(e => !foundEmails.has(e));
  if (missing.length > 0) {
    console.log('NOT IN DATABASE (no matching row):');
    for (const e of missing) console.log(`  ✗  ${e}`);
    console.log('');
  }

  // ── All ADMIN accounts system-wide ────────────────────────────────────────
  const { rows: allAdmins } = await pool.query(
    `SELECT id, "clerkId", email, "fullName", "createdAt"
     FROM "User"
     WHERE role = 'ADMIN'
     ORDER BY "createdAt" ASC`
  );

  console.log('ALL ADMIN ACCOUNTS IN DATABASE (role = ADMIN):');
  if (allAdmins.length === 0) {
    console.log('  ⚠  NONE — platform currently has no ADMIN account.\n');
  } else {
    for (const a of allAdmins) {
      console.log(`  ✓  ${a.email}`);
      console.log(`     DB id   : ${a.id}`);
      console.log(`     Clerk id: ${a.clerkId}`);
      console.log(`     Name    : ${a.fullName}`);
      console.log(`     Created : ${new Date(a.createdAt).toISOString()}\n`);
    }
  }

  // ── Mixed-state detection for onyeka.okpala@myoguard.health ──────────────
  const mixed = users.find(u => u.email === 'onyeka.okpala@myoguard.health');
  if (mixed) {
    const hasPatientData = parseInt(mixed.profile_count) > 0 || parseInt(mixed.assessment_count) > 0;
    const hasPhysicianData = parseInt(mixed.onboarding_count) > 0;
    if (hasPatientData && hasPhysicianData) {
      console.log('⚠  MIXED STATE DETECTED: onyeka.okpala@myoguard.health has BOTH patient and physician records.');
      console.log('   This account needs role correction. See recommendation below.\n');
    } else if (hasPatientData && mixed.role !== 'PATIENT') {
      console.log(`⚠  MISMATCH: onyeka.okpala@myoguard.health has patient data (UserProfile/Assessment) but role=${mixed.role}.\n`);
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error('Audit script error:', err.message);
  process.exit(1);
});
