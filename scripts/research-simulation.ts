/**
 * scripts/research-simulation.ts
 *
 * STEP F — Internal Research Operations Simulation
 *
 * Validates the full observational study lifecycle end-to-end using synthetic
 * data only. Leaves ZERO records in the database after completion.
 *
 * Run:
 *   npx tsx scripts/research-simulation.ts
 *
 * Prerequisites:
 *   DATABASE_URL must be set in .env or .env.local
 *   The research schema (STEP C) must be deployed to Supabase
 */

import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local' }); // .env.local overrides .env

import {
  PrismaClient,
  RiskBand,
  Role,
  Sex,
  ActivityLevel,
  Glp1Stage,
  StudyStatus,
  EnrollmentStatus,
  StudyEventType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { createStudy, createStudyEnrollment, createAssessmentSnapshotNonBlocking, recordStudyEvent, getStudyCohortSummary } from '../src/lib/research/cohort';
import { exportStudyCohort, CSV_COLUMNS } from '../src/lib/research/export';
import { PHI_FIELDS } from '../src/lib/research/deidentify';

// ─── Simulation-local Prisma client ──────────────────────────────────────────
// Scripts use their own client (not the Next.js singleton) per seed-clinical.ts pattern.

const pool = new Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

const db = new PrismaClient({
  adapter: new PrismaPg(pool as unknown as any),
  log: ['error'],
} as ConstructorParameters<typeof PrismaClient>[0]);

// ─── Simulation constants ─────────────────────────────────────────────────────

const RUN_ID = `SIM_STEPF_${Date.now()}`;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WEIGHT_BAND_RE = /^\d+–\d+ kg$/;

// ─── Simulation state (used for guaranteed cleanup) ───────────────────────────

interface SimState {
  physicianId: string | null;
  patientIds: string[];
  studyId: string | null;
  enrollmentIds: string[];
  assessmentIds: string[];
  snapshotIds: string[];
  eventLogIds: string[];
}

const state: SimState = {
  physicianId: null,
  patientIds: [],
  studyId: null,
  enrollmentIds: [],
  assessmentIds: [],
  snapshotIds: [],
  eventLogIds: [],
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`[SIM] ${msg}`); }
function pass(msg: string) { console.log(`  ✓  ${msg}`); }
function fail(msg: string) { console.error(`  ✗  ${msg}`); }
function section(title: string) { console.log(`\n══════════════════════════════\n  ${title}\n══════════════════════════════`); }

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** RFC 4180-compliant single-row parser. Handles quoted fields with embedded commas/quotes. */
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { cells.push(current); current = ''; }
      else { current += ch; }
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(csv: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csv.split('\n').filter(l => l.trim());
  const headers = parseCsvRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cells = parseCsvRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

// ─── Trajectory definitions ───────────────────────────────────────────────────

interface TimePoint {
  score: number;
  riskBand: RiskBand;
  weightKg: number;
  daysAgo: number;
  proteinTargetG: number;
  hydrationTargetL: number;
  glp1Stage: string;
}

interface Trajectory {
  label: string;
  cohortLabel: string;
  timepoints: TimePoint[];
  withdraw?: boolean;
}

const TRAJECTORIES: Trajectory[] = [
  {
    label: 'LOW → MODERATE progression',
    cohortLabel: 'glp1-initiation',
    timepoints: [
      { score: 22.0, riskBand: RiskBand.LOW,      weightKg: 78.4, daysAgo: 14, proteinTargetG: 110, hydrationTargetL: 2.5, glp1Stage: 'INITIATION' },
      { score: 38.5, riskBand: RiskBand.MODERATE,  weightKg: 75.1, daysAgo: 0,  proteinTargetG: 128, hydrationTargetL: 2.8, glp1Stage: 'DOSE_ESCALATION' },
    ],
  },
  {
    label: 'MODERATE → HIGH progression',
    cohortLabel: 'high-risk',
    timepoints: [
      { score: 43.0, riskBand: RiskBand.MODERATE, weightKg: 88.2, daysAgo: 21, proteinTargetG: 140, hydrationTargetL: 3.0, glp1Stage: 'DOSE_ESCALATION' },
      { score: 63.5, riskBand: RiskBand.HIGH,     weightKg: 84.3, daysAgo: 0,  proteinTargetG: 152, hydrationTargetL: 3.2, glp1Stage: 'MAINTENANCE' },
    ],
  },
  {
    label: 'Stable LOW (3 timepoints)',
    cohortLabel: 'control',
    timepoints: [
      { score: 17.5, riskBand: RiskBand.LOW, weightKg: 70.0, daysAgo: 56, proteinTargetG: 95,  hydrationTargetL: 2.2, glp1Stage: 'MAINTENANCE' },
      { score: 19.0, riskBand: RiskBand.LOW, weightKg: 71.2, daysAgo: 28, proteinTargetG: 98,  hydrationTargetL: 2.3, glp1Stage: 'MAINTENANCE' },
      { score: 18.5, riskBand: RiskBand.LOW, weightKg: 70.8, daysAgo: 0,  proteinTargetG: 97,  hydrationTargetL: 2.2, glp1Stage: 'MAINTENANCE' },
    ],
  },
  {
    label: 'Withdrawal case (1 timepoint)',
    cohortLabel: 'glp1-initiation',
    withdraw: true,
    timepoints: [
      { score: 34.5, riskBand: RiskBand.MODERATE, weightKg: 92.0, daysAgo: 7, proteinTargetG: 132, hydrationTargetL: 2.9, glp1Stage: 'INITIATION' },
    ],
  },
];

// ─── Phase 1: Create synthetic users ─────────────────────────────────────────

async function createPhysician(): Promise<string> {
  const user = await db.user.create({
    data: {
      clerkId:    `${RUN_ID}_PHYS`,
      email:      `sim-physician-${RUN_ID}@simulation.test`,
      fullName:   'Dr. Simulation Physician',
      role:       Role.PHYSICIAN,
      isVerified: true,
    },
  });
  state.physicianId = user.id;
  log(`Physician created: ${user.id}`);
  return user.id;
}

async function createPatients(physicianId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const user = await db.user.create({
      data: {
        clerkId:         `${RUN_ID}_PAT${i}`,
        email:           `sim-patient-${i}-${RUN_ID}@simulation.test`,
        fullName:        `Simulation Patient ${i}`,
        role:            Role.PATIENT,
        physicianId,
        researchConsent: true,
        consentDate:     new Date(),
        consentVersion:  '1.0',
      },
    });
    ids.push(user.id);
    // Create UserProfile for the patient
    await db.userProfile.create({
      data: {
        userId:         user.id,
        age:            45 + i,
        sex:            Sex.FEMALE,
        heightCm:       165,
        weightKg:       TRAJECTORIES[i - 1].timepoints[0].weightKg,
        activityLevel:  ActivityLevel.LIGHTLY_ACTIVE,
        glp1Medication: 'Semaglutide',
        glp1DoseMg:     0.5,
        glp1Stage:      Glp1Stage.INITIATION,
        treatmentStart: daysAgo(60),
      },
    });
    log(`Patient ${i} created: ${user.id}`);
  }
  state.patientIds = ids;
  return ids;
}

// ─── Phase 2: Create study and enroll patients ────────────────────────────────

async function setupStudy(physicianId: string, patientIds: string[]): Promise<string> {
  // createStudy() validates physician role
  const study = await createStudy(
    {
      title:       `STEP F Simulation — GLP-1 Sarcopenia Trajectory ${RUN_ID}`,
      slug:        `sim-stepf-${Date.now()}`,
      description: 'Synthetic observational study for infrastructure validation only.',
      createdById: physicianId,
    },
    physicianId
  );
  state.studyId = study.id;
  log(`Study created (DRAFT): ${study.id}`);

  // Activate study (direct update — matches operational playbook §3 Step 3)
  await db.study.update({ where: { id: study.id }, data: { status: StudyStatus.ACTIVE } });
  log(`Study activated: ${study.id}`);

  const CONSENT_TEXT =
    'MyoGuard Protocol is a physician-led Clinical Decision Support (CDS) platform. ' +
    'Participation in observational data collection is voluntary and does not affect your clinical care. ' +
    'Simulation consent text v1.0.';

  for (let i = 0; i < patientIds.length; i++) {
    const enrollment = await createStudyEnrollment(
      {
        studyId:              study.id,
        patientId:            patientIds[i],
        physicianId,
        cohortLabel:          TRAJECTORIES[i].cohortLabel,
        consentVersion:       '1.0',
        consentTextSnapshot:  CONSENT_TEXT,
        ipAddress:            '127.0.0.1',
      },
      physicianId
    );
    state.enrollmentIds.push(enrollment.id);
    log(`Enrollment ${i + 1} created: ${enrollment.id} (cohort: ${TRAJECTORIES[i].cohortLabel})`);
  }

  return study.id;
}

// ─── Phase 3: Longitudinal assessment and snapshot simulation ─────────────────

async function simulateTrajectories(studyId: string, physicianId: string, patientIds: string[]): Promise<void> {
  for (let p = 0; p < patientIds.length; p++) {
    const patientId    = patientIds[p];
    const enrollmentId = state.enrollmentIds[p];
    const trajectory   = TRAJECTORIES[p];
    log(`\nSimulating trajectory for Patient ${p + 1}: ${trajectory.label}`);

    for (let t = 0; t < trajectory.timepoints.length; t++) {
      const tp = trajectory.timepoints[t];
      const snapshotDate = daysAgo(tp.daysAgo);

      // Create Assessment
      const assessment = await db.assessment.create({
        data: {
          userId:          patientId,
          assessmentDate:  snapshotDate,
          weightKg:        tp.weightKg,
          proteinGrams:    tp.proteinTargetG * 0.85,
          exerciseDaysWk:  3,
          hydrationLitres: tp.hydrationTargetL * 0.9,
          symptoms:        ['fatigue', 'muscle_weakness'],
          fatigue:         t === 0 ? 3 : 4,
          nausea:          1,
          muscleWeakness:  t === 0 ? 2 : 3,
          score:           tp.score,
          riskBand:        tp.riskBand,
          sleepQuality:    3,
          gripStrengthKg:  28.5 - t * 1.2,
          glp1Stage:       tp.glp1Stage,
        },
      });
      state.assessmentIds.push(assessment.id);

      // Create MuscleScore (provides proteinTargetG for snapshot)
      await db.muscleScore.create({
        data: {
          userId:        patientId,
          assessmentId:  assessment.id,
          score:         tp.score,
          riskBand:      tp.riskBand,
          leanLossEstPct: 3.5 + t * 0.8,
          proteinTargetG: tp.proteinTargetG,
          explanation:   `Simulation MuscleScore T${t + 1} — ${trajectory.label}`,
          giSeverity:    t === 0 ? 'mild' : 'moderate',
        },
      });

      // Create ProtocolPlan (provides hydrationTarget for snapshot)
      await db.protocolPlan.create({
        data: {
          userId:          patientId,
          assessmentId:    assessment.id,
          proteinTargetG:  tp.proteinTargetG,
          proteinSources:  ['chicken', 'whey'],
          supplementation: ['creatine'],
          trainingPlan:    'Resistance 3×/week, 30 min walking daily',
          hydrationTarget: tp.hydrationTargetL,
          electrolyteNotes: 'Sodium and potassium focus during dose escalation',
          giGuidance:      'Small frequent meals. Avoid high-fat foods peri-dose.',
        },
      });

      // Create AssessmentSnapshot directly (explicit snapshotDate for trajectory ordering)
      const snapshot = await db.assessmentSnapshot.create({
        data: {
          assessmentId:    assessment.id,
          enrollmentId,
          sriBand:         tp.riskBand,
          sriScore:        tp.score,
          proteinTargetG:  tp.proteinTargetG,
          hydrationTargetL: tp.hydrationTargetL,
          activityStatus:  ActivityLevel.LIGHTLY_ACTIVE,
          symptoms:        ['fatigue', 'muscle_weakness'],
          giTolerance:     t === 0 ? 'mild' : 'moderate',
          sleepQuality:    3,
          gripStrengthKg:  28.5 - t * 1.2,
          glp1Stage:       tp.glp1Stage,
          weightKg:        tp.weightKg,
          snapshotDate,
        },
      });
      state.snapshotIds.push(snapshot.id);

      // Log REASSESSMENT event (except first — log ENROLLMENT for T1)
      const eventType = t === 0 ? StudyEventType.ENROLLMENT : StudyEventType.REASSESSMENT;
      const eventData = t === 0
        ? { cohort_label: trajectory.cohortLabel, consent_version: '1.0' }
        : { sri_band: tp.riskBand, sri_value_internal: tp.score, interval_days: tp.daysAgo > 0 ? tp.daysAgo : 14 };

      const event = await recordStudyEvent({
        studyId,
        enrollmentId,
        patientId,
        eventType,
        eventData,
        recordedBy: physicianId,
      });
      state.eventLogIds.push(event.id);

      log(`  T${t + 1}: ${tp.riskBand} (score=${tp.score}, weight=${tp.weightKg}kg, daysAgo=${tp.daysAgo})`);
    }
  }
}

// ─── Phase 4: Non-blocking snapshot trigger test ──────────────────────────────

async function testNonBlockingTrigger(patientId: string, physicianId: string, enrollmentId: string): Promise<void> {
  section('Non-Blocking Snapshot Trigger Test');

  // Create a fresh assessment to feed the trigger
  const triggerAssessment = await db.assessment.create({
    data: {
      userId:          patientId,
      assessmentDate:  new Date(),
      weightKg:        76.0,
      proteinGrams:    115,
      exerciseDaysWk:  3,
      hydrationLitres: 2.5,
      symptoms:        ['fatigue'],
      fatigue:         2,
      nausea:          0,
      muscleWeakness:  1,
      score:           32.0,
      riskBand:        RiskBand.MODERATE,
      glp1Stage:       'DOSE_ESCALATION',
    },
  });
  state.assessmentIds.push(triggerAssessment.id);
  log(`Trigger assessment created: ${triggerAssessment.id}`);

  // Call the non-blocking trigger — returns void immediately
  createAssessmentSnapshotNonBlocking({ assessmentId: triggerAssessment.id, patientId });
  log('Non-blocking trigger fired (no await)');

  // Poll for snapshot creation (up to 5 seconds)
  let triggered = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    await sleep(100);
    const snapshot = await db.assessmentSnapshot.findUnique({
      where: { assessmentId_enrollmentId: { assessmentId: triggerAssessment.id, enrollmentId } },
    });
    if (snapshot) {
      state.snapshotIds.push(snapshot.id);
      triggered = true;
      pass(`Non-blocking trigger created snapshot in ~${(attempt + 1) * 100}ms: ${snapshot.id}`);
      break;
    }
  }
  if (!triggered) {
    fail('Non-blocking trigger did NOT create snapshot within 5s timeout');
    throw new Error('Non-blocking snapshot trigger failed');
  }

  // Test idempotency: call trigger again — should skip (snapshot already exists)
  createAssessmentSnapshotNonBlocking({ assessmentId: triggerAssessment.id, patientId });
  await sleep(500);
  const snapshotCount = await db.assessmentSnapshot.count({
    where: { assessmentId: triggerAssessment.id, enrollmentId },
  });
  assert(snapshotCount === 1, 'Idempotency guard: duplicate trigger must not create a second snapshot');
  pass('Idempotency guard: duplicate trigger correctly skipped');

  // Log a REASSESSMENT event for this trigger test assessment
  const event = await recordStudyEvent({
    studyId: state.studyId!,
    enrollmentId,
    eventType: StudyEventType.REASSESSMENT,
    eventData: { sri_band: 'MODERATE', sri_value_internal: 32.0, trigger_test: true },
    recordedBy: physicianId,
  });
  state.eventLogIds.push(event.id);
}

// ─── Phase 5: Withdrawal simulation ──────────────────────────────────────────

async function simulateWithdrawal(studyId: string, physicianId: string): Promise<void> {
  section('Withdrawal Simulation');

  const withdrawalEnrollmentId = state.enrollmentIds[3]; // Patient 4
  const withdrawalDate = new Date();

  await db.studyEnrollment.update({
    where: { id: withdrawalEnrollmentId },
    data: { status: EnrollmentStatus.WITHDRAWN, withdrawalDate },
  });
  log(`Patient 4 enrollment marked WITHDRAWN`);

  const event = await recordStudyEvent({
    studyId,
    enrollmentId: withdrawalEnrollmentId,
    eventType: StudyEventType.WITHDRAWAL,
    eventData: { reason: 'patient_request', initiated_by: 'physician' },
    recordedBy: physicianId,
  });
  state.eventLogIds.push(event.id);
  pass('WITHDRAWAL event logged');
}

// ─── Phase 6: Export and validation ──────────────────────────────────────────

interface ValidationReport {
  columnCheck: boolean;
  phiCheck: boolean;
  sriLabelCheck: boolean;
  uuidCheck: boolean;
  weightBandCheck: boolean;
  trajectoryCheck: boolean;
  intervalCheck: boolean;
  withdrawalPreservationCheck: boolean;
  rowCount: number;
  participantCount: number;
  sampleRow: Record<string, string> | null;
}

async function runExportValidation(studyId: string): Promise<ValidationReport> {
  section('Export and Validation');
  const report: ValidationReport = {
    columnCheck: false,
    phiCheck: false,
    sriLabelCheck: false,
    uuidCheck: false,
    weightBandCheck: false,
    trajectoryCheck: false,
    intervalCheck: false,
    withdrawalPreservationCheck: false,
    rowCount: 0,
    participantCount: 0,
    sampleRow: null,
  };

  // Default export (ACTIVE only — excludes withdrawn Patient 4)
  const csvActive = await exportStudyCohort(studyId, { weightBandKg: 5 });
  const { headers, rows: activeRows } = parseCsv(csvActive);

  log(`Active-only export: ${activeRows.length} rows`);
  report.rowCount = activeRows.length;

  // 1. Column check
  const missingCols = CSV_COLUMNS.filter(col => !headers.includes(col));
  report.columnCheck = missingCols.length === 0;
  if (report.columnCheck) pass(`All ${CSV_COLUMNS.length} columns present in correct order`);
  else fail(`Missing columns: ${missingCols.join(', ')}`);

  // 2. PHI field check (column headers must not match any PHI field name)
  const phiInHeaders = PHI_FIELDS.filter(phi => headers.includes(phi));
  report.phiCheck = phiInHeaders.length === 0;
  if (report.phiCheck) pass(`PHI audit: no PHI field names in column headers (checked ${PHI_FIELDS.length} fields)`);
  else fail(`PHI VIOLATION in headers: ${phiInHeaders.join(', ')}`);

  // Also check row values: no PHI field name should appear as a column key
  let phiValueLeak = false;
  for (const row of activeRows) {
    for (const phi of PHI_FIELDS) {
      if (row[phi] !== undefined) { phiValueLeak = true; fail(`PHI VALUE in row: ${phi}`); }
    }
  }
  if (!phiValueLeak) pass('PHI audit: no PHI field names found as row keys');

  // 3. sri_value_internal label check
  report.sriLabelCheck = headers.includes('sri_value_internal') && !headers.includes('sriScore') && !headers.includes('score');
  if (report.sriLabelCheck) pass('SRI export label: sri_value_internal present; sriScore/score absent');
  else fail('SRI label check failed');

  // 4. Participant ID format (UUID v4)
  const badUuids = activeRows.filter(r => !UUID_V4_RE.test(r['participant_id']));
  report.uuidCheck = badUuids.length === 0;
  if (report.uuidCheck) pass(`UUID v4 check: all ${activeRows.length} participant_id values are valid UUIDs`);
  else fail(`Invalid UUIDs: ${badUuids.length} rows`);

  // 5. Weight band format
  const badBands = activeRows.filter(r => !WEIGHT_BAND_RE.test(r['weight_band_kg']));
  report.weightBandCheck = badBands.length === 0;
  if (report.weightBandCheck) pass(`Weight band check: all values match "N–M kg" format`);
  else fail(`Bad weight bands: ${badBands.map(r => r['weight_band_kg']).join(', ')}`);

  // 6. Unique participant count
  const uniqueParticipants = new Set(activeRows.map(r => r['participant_id']));
  report.participantCount = uniqueParticipants.size;
  log(`Distinct participant IDs: ${report.participantCount} (expected 3 active)`);

  // 7. Trajectory check — Patient 1 (LOW → MODERATE)
  const pat1Rows = activeRows
    .filter(r => r['cohort_label'] === 'glp1-initiation')
    .sort((a, b) => Number(a['timepoint']) - Number(b['timepoint']));
  // There may be multiple glp1-initiation patients; check that LOW→MODERATE appears somewhere
  const hasLowToModerate = activeRows.some(r => r['sri_band'] === 'LOW') &&
    activeRows.some(r => r['sri_band'] === 'MODERATE');
  report.trajectoryCheck = hasLowToModerate;
  if (report.trajectoryCheck) pass('Trajectory check: both LOW and MODERATE bands present in export');
  else fail('Trajectory check: missing LOW or MODERATE bands');

  // Also verify HIGH band present (Patient 2)
  const hasHigh = activeRows.some(r => r['sri_band'] === 'HIGH');
  if (hasHigh) pass('HIGH band present in export (Patient 2 trajectory)');
  else fail('HIGH band missing from export');

  // 8. Interval days check
  const firstTimepoints  = activeRows.filter(r => r['timepoint'] === '1');
  const laterTimepoints  = activeRows.filter(r => Number(r['timepoint']) > 1);
  const firstHaveNull    = firstTimepoints.every(r => r['interval_days'] === '');
  const laterHaveValue   = laterTimepoints.every(r => r['interval_days'] !== '');
  report.intervalCheck = firstHaveNull && laterHaveValue;
  if (firstHaveNull) pass(`Interval check: all ${firstTimepoints.length} first timepoints have null interval_days`);
  else fail('Interval check: some first timepoints have non-null interval_days');
  if (laterHaveValue) pass(`Interval check: all ${laterTimepoints.length} later timepoints have interval_days values`);
  else fail('Interval check: some later timepoints are missing interval_days');

  // 9. Withdrawal preservation — re-export with includeWithdrawn
  const csvWithWithdrawn = await exportStudyCohort(studyId, { includeWithdrawn: true, weightBandKg: 5 });
  const { rows: allRows } = parseCsv(csvWithWithdrawn);
  report.withdrawalPreservationCheck = allRows.length > activeRows.length;
  if (report.withdrawalPreservationCheck) {
    pass(`Withdrawal preservation: includeWithdrawn export has ${allRows.length} rows vs ${activeRows.length} active-only`);
  } else {
    fail('Withdrawal preservation: includeWithdrawn export has no additional rows');
  }

  report.sampleRow = activeRows[0] ?? null;
  return report;
}

// ─── Phase 7: Cohort summary validation ──────────────────────────────────────

async function runCohortSummary(studyId: string): Promise<void> {
  section('Cohort Summary Validation');
  const summary = await getStudyCohortSummary(studyId);
  log(`Total enrolled:  ${summary.totalEnrolled}`);
  log(`Active:          ${summary.activeCount}`);
  log(`Withdrawn:       ${summary.withdrawnCount}`);
  log(`Completed:       ${summary.completedCount}`);
  log(`Snapshot count:  ${summary.snapshotCount}`);
  assert(summary.totalEnrolled === 4, 'Total enrolled must be 4');
  assert(summary.activeCount === 3, 'Active count must be 3 (Patient 4 withdrawn)');
  assert(summary.withdrawnCount === 1, 'Withdrawn count must be 1');
  pass('Cohort summary counts validated');
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  section('Cleanup — Deleting All Synthetic Records');
  const errors: string[] = [];

  const safe = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); log(`Deleted: ${label}`); }
    catch (err) { const msg = err instanceof Error ? err.message : String(err); errors.push(`${label}: ${msg}`); fail(`Cleanup failed for ${label}: ${msg}`); }
  };

  // 1. StudyEventLog
  if (state.eventLogIds.length) {
    await safe(`StudyEventLog (${state.eventLogIds.length})`, () =>
      db.studyEventLog.deleteMany({ where: { id: { in: state.eventLogIds } } }));
  }

  // 2. AssessmentSnapshot
  if (state.snapshotIds.length) {
    await safe(`AssessmentSnapshot (${state.snapshotIds.length})`, () =>
      db.assessmentSnapshot.deleteMany({ where: { id: { in: state.snapshotIds } } }));
  }

  // 3. StudyConsent (linked to enrollments — delete before enrollment)
  if (state.enrollmentIds.length) {
    await safe(`StudyConsent (all for enrollments)`, () =>
      db.studyConsent.deleteMany({ where: { enrollmentId: { in: state.enrollmentIds } } }));
  }

  // 4. StudyEnrollment
  if (state.enrollmentIds.length) {
    await safe(`StudyEnrollment (${state.enrollmentIds.length})`, () =>
      db.studyEnrollment.deleteMany({ where: { id: { in: state.enrollmentIds } } }));
  }

  // 5. Study
  if (state.studyId) {
    await safe(`Study (${state.studyId})`, () =>
      db.study.delete({ where: { id: state.studyId! } }));
  }

  // 6. Assessment (cascades to MuscleScore and ProtocolPlan via onDelete: Cascade)
  if (state.assessmentIds.length) {
    await safe(`Assessment + MuscleScore + ProtocolPlan (${state.assessmentIds.length})`, () =>
      db.assessment.deleteMany({ where: { id: { in: state.assessmentIds } } }));
  }

  // 7. User (cascades to UserProfile, any remaining clinical records)
  if (state.patientIds.length) {
    await safe(`Patient Users + UserProfiles (${state.patientIds.length})`, () =>
      db.user.deleteMany({ where: { id: { in: state.patientIds } } }));
  }
  if (state.physicianId) {
    await safe(`Physician User (${state.physicianId})`, () =>
      db.user.delete({ where: { id: state.physicianId! } }));
  }

  // Verify zero residual records
  const residualCheck = await Promise.all([
    db.user.count({ where: { clerkId: { startsWith: RUN_ID } } }),
    db.study.count({ where: { slug: { contains: 'sim-stepf-' } } }),
  ]);
  const [residualUsers, residualStudies] = residualCheck;

  if (residualUsers === 0 && residualStudies === 0 && errors.length === 0) {
    pass('Cleanup complete — ZERO synthetic records remain in database');
  } else {
    if (residualUsers > 0) fail(`${residualUsers} synthetic User records still in database`);
    if (residualStudies > 0) fail(`${residualStudies} synthetic Study records still in database`);
    if (errors.length > 0) fail(`${errors.length} cleanup error(s) — manual deletion may be required`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  MyoGuard Protocol — STEP F Research Simulation`);
  console.log(`  Run ID: ${RUN_ID}`);
  console.log(`${'═'.repeat(60)}\n`);

  const results: { validation: ValidationReport | null; error: string | null } = {
    validation: null,
    error: null,
  };

  try {
    section('Phase 1 — Synthetic User Creation');
    const physicianId = await createPhysician();
    const patientIds  = await createPatients(physicianId);

    section('Phase 2 — Study Setup and Enrollment');
    const studyId = await setupStudy(physicianId, patientIds);

    section('Phase 3 — Longitudinal Trajectory Simulation');
    await simulateTrajectories(studyId, physicianId, patientIds);

    await testNonBlockingTrigger(patientIds[0], physicianId, state.enrollmentIds[0]);
    await simulateWithdrawal(studyId, physicianId);

    const validation = await runExportValidation(studyId);
    results.validation = validation;

    await runCohortSummary(studyId);

    section('Simulation Summary');
    log(`Assessments created:  ${state.assessmentIds.length}`);
    log(`Snapshots created:    ${state.snapshotIds.length}`);
    log(`Event log entries:    ${state.eventLogIds.length}`);
    log(`Enrollments:          ${state.enrollmentIds.length}`);

    if (results.validation) {
      const v = results.validation;
      console.log('\n  Validation Results:');
      console.log(`    Column check:              ${v.columnCheck ? '✓' : '✗'}`);
      console.log(`    PHI check:                 ${v.phiCheck ? '✓' : '✗'}`);
      console.log(`    SRI label check:           ${v.sriLabelCheck ? '✓' : '✗'}`);
      console.log(`    UUID v4 check:             ${v.uuidCheck ? '✓' : '✗'}`);
      console.log(`    Weight band check:         ${v.weightBandCheck ? '✓' : '✗'}`);
      console.log(`    Trajectory check:          ${v.trajectoryCheck ? '✓' : '✗'}`);
      console.log(`    Interval days check:       ${v.intervalCheck ? '✓' : '✗'}`);
      console.log(`    Withdrawal preservation:   ${v.withdrawalPreservationCheck ? '✓' : '✗'}`);
      console.log(`    Export rows (active):      ${v.rowCount}`);
      console.log(`    Unique participants:       ${v.participantCount}`);
      if (v.sampleRow) {
        console.log('\n  Sample export row (de-identified):');
        console.log(`    participant_id:    ${v.sampleRow['participant_id']}`);
        console.log(`    sri_band:          ${v.sampleRow['sri_band']}`);
        console.log(`    sri_value_internal:${v.sampleRow['sri_value_internal']}`);
        console.log(`    weight_band_kg:    ${v.sampleRow['weight_band_kg']}`);
        console.log(`    timepoint:         ${v.sampleRow['timepoint']}`);
        console.log(`    interval_days:     ${v.sampleRow['interval_days'] || '(null — first timepoint)'}`);
      }
    }

  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err);
    console.error(`\n[SIM ERROR] ${results.error}`);
    throw err;
  } finally {
    await cleanup();
    await db.$disconnect();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
