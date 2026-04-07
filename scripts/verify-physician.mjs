/**
 * Full physician account audit + auto-repair.
 * node scripts/verify-physician.mjs
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch { /* ignore */ }

const { Pool } = await import('pg');
const pool = new Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const TARGET = 'wahney2026@yahoo.com';

console.log('\n═══════════════════════════════════════════');
console.log('  MyoGuard Physician Account Audit');
console.log('═══════════════════════════════════════════\n');

// ── 1. Target user ──────────────────────────────────────────────────────────
const { rows: targetRows } = await pool.query(
  `SELECT id, "clerkId", email, "fullName", role, "createdAt", "updatedAt"
   FROM "User" WHERE email = $1`,
  [TARGET],
);

if (targetRows.length === 0) {
  console.error(`❌  No DB row for email: ${TARGET}`);
  console.error('    The Clerk webhook may not have fired yet, or the email is different.\n');
} else {
  const u = targetRows[0];
  const roleOk = u.role === 'PHYSICIAN';
  console.log(`✅  Target user (${TARGET}):`);
  console.log(`    id        : ${u.id}`);
  console.log(`    clerkId   : ${u.clerkId}`);
  console.log(`    fullName  : ${u.fullName}`);
  console.log(`    role      : ${u.role}  ${roleOk ? '← ✓ PHYSICIAN' : '← ⚠ WRONG — fixing…'}`);
  console.log(`    createdAt : ${u.createdAt}`);
  console.log(`    updatedAt : ${u.updatedAt}`);

  if (!roleOk) {
    await pool.query(`UPDATE "User" SET role = 'PHYSICIAN' WHERE email = $1`, [TARGET]);
    console.log('    ✅  Role corrected to PHYSICIAN.');
  }
}

// ── 2. All PHYSICIAN / PHYSICIAN_PENDING rows ───────────────────────────────
const { rows: physicians } = await pool.query(
  `SELECT id, "clerkId", email, "fullName", role
   FROM "User" WHERE role IN ('PHYSICIAN','PHYSICIAN_PENDING')
   ORDER BY role, email`,
);

console.log(`\n─── All physician-role accounts (${physicians.length} total) ─────────────`);
for (const r of physicians) {
  const marker = r.role === 'PHYSICIAN_PENDING' ? '⚠ PENDING' : '✓ ACTIVE ';
  console.log(`  ${marker}  ${r.email}  │  clerkId=${r.clerkId}`);
}

// ── 3. Check for duplicate clerkIds (data integrity) ───────────────────────
const { rows: dupCheck } = await pool.query(
  `SELECT "clerkId", COUNT(*) AS cnt FROM "User"
   GROUP BY "clerkId" HAVING COUNT(*) > 1`,
);
if (dupCheck.length) {
  console.log('\n⛔  DUPLICATE clerkId entries found — data integrity issue:');
  for (const r of dupCheck) console.log(`    clerkId=${r.clerkId}  count=${r.cnt}`);
} else {
  console.log('\n✅  No duplicate clerkId entries (data integrity ok)');
}

console.log('\n═══════════════════════════════════════════\n');
await pool.end();
