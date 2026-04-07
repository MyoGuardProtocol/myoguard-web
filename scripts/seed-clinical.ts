/**
 * scripts/seed-clinical.ts
 *
 * MyoGuard Clinical Luxury Seed
 * ─────────────────────────────
 * Populates PhysicianProfile, PhysicianReview, AuditLog, and supporting
 * User / Assessment rows with high-fidelity mock data for UI development
 * and stakeholder demos.
 *
 * NOTE — Schema constraints you should know:
 *   • PhysicianProfile has no `bio` or `imageUrl` column. Rich physician
 *     narrative is embedded in the seed comments below; add those columns
 *     via a migration if the UI needs to display them.
 *   • PhysicianReview.userId is the PHYSICIAN's User.id (not the patient).
 *     This script creates seed physician User rows (role: PHYSICIAN) as
 *     FK targets. They carry fake clerkIds and won't appear in Clerk.
 *   • Assessment.userId is the PATIENT's User.id.
 *
 * Usage:
 *   npx tsx scripts/seed-clinical.ts           # dry run guard on (default)
 *   npx tsx scripts/seed-clinical.ts --force   # re-seed even if data exists
 *
 * Prerequisites:
 *   DIRECT_URL (or DATABASE_URL) must be set in .env
 */

import 'dotenv/config';
import { PrismaClient, RiskBand, Role, Sex, ActivityLevel, Glp1Stage } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ─── DB connection (direct, bypasses PgBouncer — required for writes) ────────

const pool = new Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool as unknown as any),
  log: ['error', 'warn'],
} as ConstructorParameters<typeof PrismaClient>[0]);

// ─── Idempotency sentinel ─────────────────────────────────────────────────────

const SEED_CLERK_ID = 'seed_mgclinical_v1_nwosu';

// ═══════════════════════════════════════════════════════════════════════════════
// PHYSICIAN DATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Each entry creates:
 *   - A PhysicianProfile row (the clinical record shown in the portal)
 *   - A User row  (role: PHYSICIAN — needed as FK target for PhysicianReview)
 *
 * Bios (stored here for reference; add a `bio` column to PhysicianProfile
 * and a `imageUrl` column if your UI needs to display them):
 *
 * Dr. Amara Nwosu, MD, ABOM
 *   Board-certified Obesity Medicine specialist with 12 years' experience
 *   managing GLP-1 therapy at scale. Founding physician at Meridian Metabolic
 *   Institute. Particular focus on preserving lean mass during aggressive
 *   caloric restriction. Fluent in Igbo and English.
 *   Image: https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400
 *
 * Dr. James Whitfield, MD, FACP
 *   Fellow of the American College of Physicians. 20 years in Internal
 *   Medicine with a sub-specialty in Metabolic Health. Pioneer of the
 *   "protein-first, drug-second" protocol adopted at Whitfield Longevity
 *   Clinic. Mentor to 30+ medical residents.
 *   Image: https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400
 *
 * Dr. Sofia Marchetti, MD, FACE
 *   Fellow of the American College of Endocrinology. Dual-trained in
 *   Endocrinology and Sports Medicine. Leads the GLP-1 Muscle Preservation
 *   Research Program at Marchetti Endocrine Associates. Published in JCEM
 *   and Obesity Reviews.
 *   Image: https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400
 */
const PHYSICIANS = [
  {
    profile: {
      slug:         'dr-amara-nwosu',
      displayName:  'Dr. Amara Nwosu, MD, ABOM',
      clinicName:   'Meridian Metabolic Institute',
      specialty:    'Obesity Medicine & GLP-1 Therapeutics',
      referralCode: 'DR-NWOSU-4821',
      isActive:     true,
    },
    user: {
      clerkId:            'seed_mgclinical_v1_nwosu',
      email:              'amara.nwosu@meridianmetabolic.example.com',
      fullName:           'Dr. Amara Nwosu',
      role:               'PHYSICIAN' as Role,
      subscriptionStatus: 'ACTIVE' as const,
      referralCode:       'DR-NWOSU-4821',
    },
  },
  {
    profile: {
      slug:         'dr-james-whitfield',
      displayName:  'Dr. James Whitfield, MD, FACP',
      clinicName:   'Whitfield Longevity & Metabolic Clinic',
      specialty:    'Internal Medicine – Metabolic Health',
      referralCode: 'DR-WHITFIELD-7063',
      isActive:     true,
    },
    user: {
      clerkId:            'seed_mgclinical_v1_whitfield',
      email:              'james.whitfield@whitfieldlongevity.example.com',
      fullName:           'Dr. James Whitfield',
      role:               'PHYSICIAN' as Role,
      subscriptionStatus: 'ACTIVE' as const,
      referralCode:       'DR-WHITFIELD-7063',
    },
  },
  {
    profile: {
      slug:         'dr-sofia-marchetti',
      displayName:  'Dr. Sofia Marchetti, MD, FACE',
      clinicName:   'Marchetti Endocrine Associates',
      specialty:    'Endocrinology, Diabetes & Metabolism',
      referralCode: 'DR-MARCHETTI-3195',
      isActive:     true,
    },
    user: {
      clerkId:            'seed_mgclinical_v1_marchetti',
      email:              'sofia.marchetti@marchettiendocrine.example.com',
      fullName:           'Dr. Sofia Marchetti',
      role:               'PHYSICIAN' as Role,
      subscriptionStatus: 'ACTIVE' as const,
      referralCode:       'DR-MARCHETTI-3195',
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT DATA (10 patients — varied risk bands)
// ═══════════════════════════════════════════════════════════════════════════════

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/**
 * Risk band distribution:
 *   HIGH     (score ≥ 70) — Marcus, Yolanda, David         3 patients
 *   MODERATE (score 45–69) — Rachel, James, Elena, Thomas   4 patients
 *   LOW      (score < 45) — Priya, William, Keiko           3 patients
 *
 * Clinical narrative: each HIGH patient shows the hallmarks of accelerated
 * lean-mass loss — very low protein, minimal resistance exercise, elevated
 * weakness scores, and visible GLP-1 side-effect burden. LOW patients have
 * adopted the MyoGuard protocol correctly.
 */
const PATIENTS: Array<{
  user: {
    clerkId: string;
    email:   string;
    fullName: string;
  };
  assessment: {
    assessmentDate:  Date;
    weightKg:        number;
    proteinGrams:    number;
    exerciseDaysWk:  number;
    hydrationLitres: number;
    symptoms:        string[];
    fatigue:         number;
    nausea:          number;
    muscleWeakness:  number;
    score:           number;
    riskBand:        RiskBand;
  };
  reviewedByIndex: number | null; // index into PHYSICIANS array
  reviewNote:      string | null;
  overallImpression: 'stable' | 'monitoring' | 'intervention' | null;
  followUpDays:    number | null;
}> = [
  // ── HIGH RISK ──────────────────────────────────────────────────────────────
  {
    user: {
      clerkId:  'seed_mgpatient_v1_marcus',
      email:    'marcus.thompson@patients.example.com',
      fullName: 'Marcus Thompson',
    },
    assessment: {
      assessmentDate:  daysAgo(3),
      weightKg:        118.4,
      proteinGrams:    48,
      exerciseDaysWk:  0,
      hydrationLitres: 1.2,
      symptoms:        ['severe_fatigue', 'muscle_weakness', 'joint_pain', 'brain_fog'],
      fatigue:         9,
      nausea:          7,
      muscleWeakness:  8,
      score:           82.4,
      riskBand:        'HIGH',
    },
    reviewedByIndex:   0, // Dr. Nwosu
    overallImpression: 'intervention',
    followUpDays:      7,
    reviewNote:
      'Critically low protein intake at 0.41 g/kg. Sarcopenic trajectory confirmed. ' +
      'Initiating supervised resistance protocol — 3× weekly minimum. Protein target ' +
      'elevated to 140 g/day. Considering referral to dietitian specialising in GLP-1 ' +
      'patients. Reassess in 7 days.',
  },
  {
    user: {
      clerkId:  'seed_mgpatient_v1_yolanda',
      email:    'yolanda.pierce@patients.example.com',
      fullName: 'Yolanda Pierce',
    },
    assessment: {
      assessmentDate:  daysAgo(5),
      weightKg:        104.2,
      proteinGrams:    55,
      exerciseDaysWk:  1,
      hydrationLitres: 1.0,
      symptoms:        ['severe_fatigue', 'appetite_loss', 'muscle_weakness', 'poor_sleep'],
      fatigue:         8,
      nausea:          8,
      muscleWeakness:  7,
      score:           79.1,
      riskBand:        'HIGH',
    },
    reviewedByIndex:   1, // Dr. Whitfield
    overallImpression: 'intervention',
    followUpDays:      7,
    reviewNote:
      'Semaglutide dose escalation correlating with marked protein avoidance. ' +
      'Hydration critically low — 1.0 L/day against 2.5 L target. Reviewing dose ' +
      'schedule; may delay next escalation by 2 weeks to stabilise GI tolerance. ' +
      'Electrolyte panel ordered.',
  },
  {
    user: {
      clerkId:  'seed_mgpatient_v1_david',
      email:    'david.chen@patients.example.com',
      fullName: 'David Chen',
    },
    assessment: {
      assessmentDate:  daysAgo(1),
      weightKg:        131.7,
      proteinGrams:    42,
      exerciseDaysWk:  0,
      hydrationLitres: 0.9,
      symptoms:        ['severe_fatigue', 'muscle_weakness', 'nausea', 'dizziness', 'brain_fog'],
      fatigue:         10,
      nausea:          9,
      muscleWeakness:  9,
      score:           88.7,
      riskBand:        'HIGH',
    },
    reviewedByIndex:   null,
    overallImpression: null,
    followUpDays:      null,
    reviewNote:        null,
  },

  // ── MODERATE RISK ──────────────────────────────────────────────────────────
  {
    user: {
      clerkId:  'seed_mgpatient_v1_rachel',
      email:    'rachel.monroe@patients.example.com',
      fullName: 'Rachel Monroe',
    },
    assessment: {
      assessmentDate:  daysAgo(7),
      weightKg:        89.3,
      proteinGrams:    78,
      exerciseDaysWk:  2,
      hydrationLitres: 1.8,
      symptoms:        ['moderate_fatigue', 'mild_nausea', 'occasional_weakness'],
      fatigue:         6,
      nausea:          5,
      muscleWeakness:  5,
      score:           61.3,
      riskBand:        'MODERATE',
    },
    reviewedByIndex:   0, // Dr. Nwosu
    overallImpression: 'monitoring',
    followUpDays:      14,
    reviewNote:
      'Improving trend — protein up from 58 g baseline. Resistance training adherence ' +
      'needs reinforcement; 2× per week is below therapeutic threshold for lean mass ' +
      'preservation at this caloric deficit. Target: 3–4× weekly with emphasis on ' +
      'compound movements. Recheck MyoGuard score in 2 weeks.',
  },
  {
    user: {
      clerkId:  'seed_mgpatient_v1_james_o',
      email:    'james.okafor@patients.example.com',
      fullName: 'James Okafor',
    },
    assessment: {
      assessmentDate:  daysAgo(10),
      weightKg:        96.1,
      proteinGrams:    85,
      exerciseDaysWk:  2,
      hydrationLitres: 2.0,
      symptoms:        ['mild_fatigue', 'mild_nausea'],
      fatigue:         5,
      nausea:          4,
      muscleWeakness:  4,
      score:           58.8,
      riskBand:        'MODERATE',
    },
    reviewedByIndex:   2, // Dr. Marchetti
    overallImpression: 'monitoring',
    followUpDays:      14,
    reviewNote:
      'Baseline established. Protein intake tracking at 0.88 g/kg — just below the ' +
      '1.0 g/kg minimum for GLP-1 patients. Recommending leucine-rich protein ' +
      'supplementation post-workout. Endocrine panel stable; continue current ' +
      'tirzepatide dose.',
  },
  {
    user: {
      clerkId:  'seed_mgpatient_v1_elena',
      email:    'elena.reyes@patients.example.com',
      fullName: 'Elena Reyes',
    },
    assessment: {
      assessmentDate:  daysAgo(4),
      weightKg:        82.8,
      proteinGrams:    72,
      exerciseDaysWk:  3,
      hydrationLitres: 1.9,
      symptoms:        ['moderate_fatigue', 'appetite_changes', 'mild_weakness'],
      fatigue:         6,
      nausea:          4,
      muscleWeakness:  5,
      score:           67.2,
      riskBand:        'MODERATE',
    },
    reviewedByIndex:   null,
    overallImpression: null,
    followUpDays:      null,
    reviewNote:        null,
  },
  {
    user: {
      clerkId:  'seed_mgpatient_v1_thomas',
      email:    'thomas.nakamura@patients.example.com',
      fullName: 'Thomas Nakamura',
    },
    assessment: {
      assessmentDate:  daysAgo(14),
      weightKg:        77.5,
      proteinGrams:    91,
      exerciseDaysWk:  3,
      hydrationLitres: 2.2,
      symptoms:        ['mild_fatigue', 'occasional_nausea'],
      fatigue:         4,
      nausea:          3,
      muscleWeakness:  4,
      score:           52.0,
      riskBand:        'MODERATE',
    },
    reviewedByIndex:   1, // Dr. Whitfield
    overallImpression: 'stable',
    followUpDays:      21,
    reviewNote:
      'Notable improvement from initial 71.4 score three weeks ago. Protein ' +
      'adherence commendable — patient adopted Greek yogurt and egg-white protocol ' +
      'from start sheet. Recommend progressing to 4× weekly resistance to consolidate ' +
      'gains. Score trajectory is downward (positive). Next review in 3 weeks.',
  },

  // ── LOW RISK ───────────────────────────────────────────────────────────────
  {
    user: {
      clerkId:  'seed_mgpatient_v1_priya',
      email:    'priya.sharma@patients.example.com',
      fullName: 'Priya Sharma',
    },
    assessment: {
      assessmentDate:  daysAgo(2),
      weightKg:        68.9,
      proteinGrams:    118,
      exerciseDaysWk:  4,
      hydrationLitres: 2.5,
      symptoms:        ['minimal_fatigue'],
      fatigue:         2,
      nausea:          2,
      muscleWeakness:  1,
      score:           28.4,
      riskBand:        'LOW',
    },
    reviewedByIndex:   2, // Dr. Marchetti
    overallImpression: 'stable',
    followUpDays:      30,
    reviewNote:
      'Exemplary protocol adherence. Protein at 1.71 g/kg — well above target. ' +
      'DEXA scan at 6-month mark showed 0.4 kg lean mass gain despite 8.2 kg total ' +
      'weight loss. This patient is a model for the MyoGuard muscle-preservation ' +
      'protocol. No medication changes required. Monthly check-in sufficient.',
  },
  {
    user: {
      clerkId:  'seed_mgpatient_v1_william',
      email:    'william.foster@patients.example.com',
      fullName: 'William Foster',
    },
    assessment: {
      assessmentDate:  daysAgo(8),
      weightKg:        92.4,
      proteinGrams:    132,
      exerciseDaysWk:  5,
      hydrationLitres: 2.8,
      symptoms:        [],
      fatigue:         2,
      nausea:          1,
      muscleWeakness:  2,
      score:           34.9,
      riskBand:        'LOW',
    },
    reviewedByIndex:   null,
    overallImpression: null,
    followUpDays:      null,
    reviewNote:        null,
  },
  {
    user: {
      clerkId:  'seed_mgpatient_v1_keiko',
      email:    'keiko.santos@patients.example.com',
      fullName: 'Keiko Santos',
    },
    assessment: {
      assessmentDate:  daysAgo(6),
      weightKg:        71.2,
      proteinGrams:    105,
      exerciseDaysWk:  4,
      hydrationLitres: 2.3,
      symptoms:        ['minimal_nausea'],
      fatigue:         3,
      nausea:          3,
      muscleWeakness:  2,
      score:           41.2,
      riskBand:        'LOW',
    },
    reviewedByIndex:   0, // Dr. Nwosu
    overallImpression: 'stable',
    followUpDays:      30,
    reviewNote:
      'Score holding steady in the LOW band for three consecutive assessments. ' +
      'Patient reports improved energy and reduced GI side effects since switching ' +
      'from oral semaglutide to injectable. Maintain current protein and exercise ' +
      'targets. Next formal review in 30 days.',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const force = process.argv.includes('--force');

  // Idempotency check
  const sentinel = await prisma.user.findUnique({
    where:  { clerkId: SEED_CLERK_ID },
    select: { id: true },
  });

  if (sentinel && !force) {
    console.log(
      '⚠  Seed data already present (sentinel clerkId found).\n' +
      '   Run with --force to drop and re-seed: npx tsx scripts/seed-clinical.ts --force',
    );
    return;
  }

  if (force && sentinel) {
    console.log('🗑  --force: removing existing seed data…');
    // Delete in dependency order (deepest first)
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: ['seed_mgclinical_v1_nwosu', 'seed_mgclinical_v1_whitfield', 'seed_mgclinical_v1_marchetti'] } },
    });
    // PhysicianReview and Assessment are cascade-deleted with the patient User
    const seedClerkIds = [
      ...PHYSICIANS.map(p => p.user.clerkId),
      ...PATIENTS.map(p => p.user.clerkId),
    ];
    await prisma.user.deleteMany({ where: { clerkId: { in: seedClerkIds } } });
    await prisma.physicianProfile.deleteMany({
      where: { slug: { in: PHYSICIANS.map(p => p.profile.slug) } },
    });
    console.log('✓  Existing seed data removed.\n');
  }

  // ── 1. Physician Users ────────────────────────────────────────────────────
  console.log('👤  Creating physician users…');
  const physicianUsers: { id: string }[] = [];

  for (const p of PHYSICIANS) {
    const u = await prisma.user.create({
      data:   p.user,
      select: { id: true },
    });
    physicianUsers.push(u);
    console.log(`   ✓ ${p.user.fullName} (${u.id})`);
  }

  // ── 2. PhysicianProfiles ──────────────────────────────────────────────────
  console.log('\n🏥  Creating physician profiles…');
  for (const p of PHYSICIANS) {
    await prisma.physicianProfile.upsert({
      where:  { slug: p.profile.slug },
      create: p.profile,
      update: p.profile,
    });
    console.log(`   ✓ ${p.profile.displayName} — ${p.profile.clinicName}`);
  }

  // ── 3. Patient Users + Assessments + PhysicianReviews ────────────────────
  console.log('\n🧪  Creating patients, assessments, and reviews…');

  const createdAssessments: { id: string; patientName: string; reviewedByIndex: number | null }[] = [];

  for (const p of PATIENTS) {
    // Patient user (no role specified → defaults to PATIENT)
    const patient = await prisma.user.create({
      data: {
        clerkId:            p.user.clerkId,
        email:              p.user.email,
        fullName:           p.user.fullName,
        role:               'PATIENT',
        subscriptionStatus: 'FREE',
      },
      select: { id: true },
    });

    // Assessment
    const assessment = await prisma.assessment.create({
      data: {
        userId:          patient.id,
        ...p.assessment,
      },
      select: { id: true },
    });

    console.log(
      `   ✓ ${p.user.fullName.padEnd(20)} score=${p.assessment.score.toFixed(1).padStart(5)}  ` +
      `band=${p.assessment.riskBand.padEnd(10)}` +
      (p.reviewedByIndex !== null ? `  reviewed by ${PHYSICIANS[p.reviewedByIndex].user.fullName}` : ''),
    );

    createdAssessments.push({
      id:              assessment.id,
      patientName:     p.user.fullName,
      reviewedByIndex: p.reviewedByIndex,
    });

    // PhysicianReview (if this patient has a reviewing physician)
    if (
      p.reviewedByIndex !== null &&
      p.reviewNote        !== null &&
      p.overallImpression !== null
    ) {
      await prisma.physicianReview.create({
        data: {
          assessmentId:      assessment.id,
          userId:            physicianUsers[p.reviewedByIndex].id,
          overallImpression: p.overallImpression,
          followUpDays:      p.followUpDays,
          note:              p.reviewNote,
          reviewedAt:        daysAgo(Math.floor(Math.random() * 2)),
        },
      });
    }
  }

  // ── 4. AuditLog ───────────────────────────────────────────────────────────
  console.log('\n📋  Creating audit log entries…');

  const [nwosuId, whitfieldId, marchettiId] = physicianUsers.map(u => u.id);

  const reviewedAssessments = createdAssessments.filter(a => a.reviewedByIndex !== null);

  // Map of physician index → assessments they reviewed
  const byPhysician = (idx: number) =>
    reviewedAssessments.filter(a => a.reviewedByIndex === idx);

  const auditEntries: Array<{
    actorId:    string;
    action:     string;
    targetType: string;
    targetId:   string | null;
    metadata:   object;
    createdAt:  Date;
  }> = [
    {
      actorId:    nwosuId,
      action:     'physician.review.submitted',
      targetType: 'Assessment',
      targetId:   byPhysician(0)[0]?.id ?? null,
      metadata:   {
        patientName:       byPhysician(0)[0]?.patientName ?? '',
        overallImpression: 'intervention',
        followUpDays:      7,
        note:              'Critically low protein intake at 0.41 g/kg. Sarcopenic trajectory confirmed.',
      },
      createdAt:  daysAgo(3),
    },
    {
      actorId:    nwosuId,
      action:     'physician.review.submitted',
      targetType: 'Assessment',
      targetId:   byPhysician(0)[1]?.id ?? null,
      metadata:   {
        patientName:       byPhysician(0)[1]?.patientName ?? '',
        overallImpression: 'monitoring',
        followUpDays:      14,
        note:              'Improving trend — protein up from 58 g baseline.',
      },
      createdAt:  daysAgo(7),
    },
    {
      actorId:    nwosuId,
      action:     'physician.patient.viewed',
      targetType: 'User',
      targetId:   null,
      metadata:   {
        patientName: 'David Chen',
        context:     'Dashboard review — HIGH risk flag triggered physician alert',
      },
      createdAt:  daysAgo(1),
    },
    {
      actorId:    whitfieldId,
      action:     'physician.review.submitted',
      targetType: 'Assessment',
      targetId:   byPhysician(1)[0]?.id ?? null,
      metadata:   {
        patientName:       byPhysician(1)[0]?.patientName ?? '',
        overallImpression: 'intervention',
        followUpDays:      7,
        note:              'Semaglutide dose escalation correlating with marked protein avoidance.',
      },
      createdAt:  daysAgo(5),
    },
    {
      actorId:    whitfieldId,
      action:     'physician.review.submitted',
      targetType: 'Assessment',
      targetId:   byPhysician(1)[1]?.id ?? null,
      metadata:   {
        patientName:       byPhysician(1)[1]?.patientName ?? '',
        overallImpression: 'stable',
        followUpDays:      21,
        note:              'Notable improvement from initial 71.4 score three weeks ago.',
      },
      createdAt:  daysAgo(14),
    },
    {
      actorId:    whitfieldId,
      action:     'physician.protocol.reviewed',
      targetType: 'ProtocolPlan',
      targetId:   null,
      metadata:   {
        patientName: 'Thomas Nakamura',
        protocol:    'Muscle Preservation Protocol — Compound Resistance Progression',
        note:        'Dr. Whitfield reviewed and endorsed resistance training progression',
      },
      createdAt:  daysAgo(14),
    },
    {
      actorId:    marchettiId,
      action:     'physician.review.submitted',
      targetType: 'Assessment',
      targetId:   byPhysician(2)[0]?.id ?? null,
      metadata:   {
        patientName:       byPhysician(2)[0]?.patientName ?? '',
        overallImpression: 'monitoring',
        followUpDays:      14,
        note:              'Baseline established. Protein tracking at 0.88 g/kg.',
      },
      createdAt:  daysAgo(10),
    },
    {
      actorId:    marchettiId,
      action:     'physician.review.submitted',
      targetType: 'Assessment',
      targetId:   byPhysician(2)[1]?.id ?? null,
      metadata:   {
        patientName:       byPhysician(2)[1]?.patientName ?? '',
        overallImpression: 'stable',
        followUpDays:      30,
        note:              'Exemplary protocol adherence. DEXA scan shows lean mass gain.',
      },
      createdAt:  daysAgo(2),
    },
    {
      actorId:    marchettiId,
      action:     'physician.patient.viewed',
      targetType: 'User',
      targetId:   null,
      metadata:   {
        patientName: 'Priya Sharma',
        context:     'Monthly review — confirming continued LOW risk status',
      },
      createdAt:  daysAgo(2),
    },
    {
      actorId:    nwosuId,
      action:     'physician.review.submitted',
      targetType: 'Assessment',
      targetId:   byPhysician(0)[2]?.id ?? null,
      metadata:   {
        patientName:       byPhysician(0)[2]?.patientName ?? 'Keiko Santos',
        overallImpression: 'stable',
        followUpDays:      30,
        note:              'Score holding steady in LOW band for three consecutive assessments.',
      },
      createdAt:  daysAgo(6),
    },
  ];

  for (const entry of auditEntries) {
    await prisma.auditLog.create({ data: entry });
  }

  console.log(`   ✓ ${auditEntries.length} audit log entries created`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  MyoGuard Clinical Seed complete');
  console.log(`    Physicians:         ${PHYSICIANS.length}`);
  console.log(`    Physician profiles: ${PHYSICIANS.length}`);
  console.log(`    Patients:           ${PATIENTS.length}`);
  console.log(`    Assessments:        ${PATIENTS.length}`);
  console.log(`    Physician reviews:  ${PATIENTS.filter(p => p.reviewedByIndex !== null).length}`);
  console.log(`    Audit log entries:  ${auditEntries.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch(err => {
    console.error('\n❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
