# MyoGuard Protocol — Observational Study Architecture

**Entity:** Meridian Wellness Systems LLC  
**Platform:** MyoGuard Protocol (myoguard.health)  
**Classification:** Physician-led Clinical Decision Support (CDS) + Research-Ready Infrastructure  
**Status:** Infrastructure implemented; no active studies as of 2026-05-10  
**Approved by:** Dr. Okpala

---

## System Boundary Overview

The platform has three operationally distinct layers. Each has separate data models,
service functions, and governance rules. Cross-layer contamination (e.g., exposing
research data in the CDS UI, or writing PHI to export rows) is prevented by
runtime enforcement in the service layer.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Clinical CDS Operations                               │
│  Models: User, Assessment, MuscleScore, ProtocolPlan,           │
│          PhysicianReview, UserProfile, WeeklyCheckin            │
│  Output: Physician-reviewed protocol plans (CDS only)           │
│  PHI: Present — never leaves this layer in research exports     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ trigger: Assessment created
                           ▼ (non-blocking, fire-and-forget)
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Observational Research Infrastructure                 │
│  Models: Study, StudyEnrollment, StudyConsent,                  │
│          AssessmentSnapshot, StudyEventLog                      │
│  Service: src/lib/research/cohort.ts                            │
│  PHI boundary: patientId present internally; never exported     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ exportStudyCohort()
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Publication/Export Infrastructure                     │
│  Service: src/lib/research/export.ts + deidentify.ts            │
│  Output: De-identified CSV with researchParticipantId only      │
│  PHI: Absent — assertNoPhiInRow() enforced on every row         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Clinical CDS Operations

### Scope

Everything in Layer 1 exists to deliver physician-led Clinical Decision Support.
The Sarcopenia Risk Index (SRI) generates risk stratification for a specific patient
at a specific point in time. Outputs are CDS only — not medical advice.

### Models

| Model | Purpose |
|---|---|
| `User` | Patient and physician accounts |
| `Assessment` | SRI input capture and risk band output |
| `MuscleScore` | Protocol targets generated from SRI inputs |
| `ProtocolPlan` | Physician-reviewed full protocol for the patient |
| `UserProfile` | Demographic and GLP-1 treatment context |
| `WeeklyCheckin` | Longitudinal self-reported adherence data |
| `PhysicianReview` | Physician annotation on an Assessment |
| `ProgressLog` | Patient-authored daily tracking notes |

### Non-Touch Rules (Layer 1)

The following files and models must not be modified by research infrastructure:

- `src/lib/protocolEngine.ts` — SRI generation logic
- `middleware.ts` — Clerk authentication
- `prisma/schema.prisma` lines 1–381 — all existing models
- Any Clerk configuration
- Any Stripe/Lemon Squeezy billing logic

Research infrastructure is additive only. Existing clinical routes are unchanged.

### ProgressLog — Permanent Layer 1 Exclusion

`ProgressLog` is excluded from all research exports permanently in this phase.

**Reason:** The `notes` field is free-text with no schema-level constraint — it may
contain patient-authored PHI (names, dates, drug references). The model was not
designed for or collected under structured study consent. It duplicates `WeeklyCheckin`
data at lower clinical fidelity and has no `researchParticipantId` linkage.

Inclusion in a future phase requires: a consent amendment, a schema revision adding
enrollment context, a PHI scrubbing pre-process, and explicit approval from Dr. Okpala.

---

## Layer 2 — Observational Research Infrastructure

### Scope

Layer 2 stores research-grade longitudinal data for physician-led observational studies.
It is built on top of Layer 1 via a non-destructive, additive schema extension.
No existing models were modified. No existing routes were changed.

### Data Models

#### `Study`
A named physician-led observational study. Anchors cohort grouping.

| Field | Type | Notes |
|---|---|---|
| `id` | `cuid()` | Internal identifier |
| `slug` | `String @unique` | URL-safe, e.g. "glp1-sarcopenia-2026" |
| `status` | `StudyStatus` | DRAFT → ACTIVE → CLOSED → ARCHIVED |
| `createdById` | `String` | Always `User.id` — never clerkId |

#### `StudyEnrollment`
Links a patient to a study under a specific physician. The central research record.

| Field | Type | Notes |
|---|---|---|
| `patientId` | `String` | `User.id` — plain scalar, never exported |
| `physicianId` | `String` | `User.id` — plain scalar, always physician |
| `researchParticipantId` | `String @unique @default(uuid())` | UUID v4, sole export identifier |
| `status` | `EnrollmentStatus` | ACTIVE / WITHDRAWN / COMPLETED |
| `cohortLabel` | `String?` | Free-form segmentation label |

**Double-enrollment prevention:** `@@unique([studyId, patientId])` prevents the same
patient from being enrolled twice in the same study.

#### `StudyConsent`
Per-enrollment, per-version consent record. Operative consent = most recent `signedAt`.

| Field | Type | Notes |
|---|---|---|
| `consentVersion` | `String` | Semantic version: "1.0", "1.1", etc. |
| `consentTextSnapshot` | `String` | Full verbatim text — immutable legal record |
| `ipAddress` | `String?` | Provenance only — never in research exports |

**Relationship to `User.researchConsent`:** `StudyConsent` is per-study, per-version
and requires `User.researchConsent = true` as a prerequisite. They are separate gates:
general data-use consent (Layer 1) + study-specific consent (Layer 2).

#### `AssessmentSnapshot`
Immutable point-in-time research snapshot of a clinical assessment.

| Field | Type | Notes |
|---|---|---|
| `assessmentId` | `String` | Plain scalar — no `@relation` to Assessment |
| `enrollmentId` | `String` | Required — no orphan snapshots |
| `sriScore` | `Float` | Internal research value — never in UI or PostHog |
| `sriBand` | `RiskBand` | LOW / MODERATE / HIGH / CRITICAL |
| `weightKg` | `Float` | Quasi-identifier — bucketed in publication exports |

**Immutability contract:** Records are NEVER updated after creation. Corrections
require a new Assessment (and new snapshot) plus a `PROTOCOL_MODIFICATION` entry
in `StudyEventLog` documenting the correction reason. This mirrors standard
clinical trial data management practice.

#### `StudyEventLog`
Append-only structured audit trail for research workflow milestones.
Distinct from `AuditLog` (system/compliance events).

| `eventType` | When to use | Key `eventData` fields |
|---|---|---|
| `ENROLLMENT` | Patient enrolled | `cohort_label`, `consent_version` |
| `REASSESSMENT` | New Assessment + Snapshot created | `sri_band`, `sri_value_internal`, `interval_days` |
| `PROTOCOL_MODIFICATION` | Correction to existing data | `field_modified`, `reason` |
| `PHYSICIAN_REVIEW` | Physician annotated a snapshot | `overall_impression`, `follow_up_days` |
| `ADHERENCE_CHECKPOINT` | Weekly adherence review | `protein_adherence`, `exercise_adherence`, `recovery_status` |
| `WITHDRAWAL` | Enrollment withdrawn | `reason`, `initiated_by` |

**eventData key naming rules (non-negotiable):**
- Use `sri_value_internal` — not `sriScore`, not `score`
- Use `sri_band` — not `riskBand`
- Use `generated` — not `calculated`
- No PHI values — no names, emails, direct IDs

### Relation Strategy — Plain Scalar

References to existing models (`User`, `Assessment`) use plain `String` fields
with no `@relation` directive. This preserves zero-touch on all existing clinical
models and passes `prisma validate` without requiring back-relation fields.

Tradeoff: no DB-level FK constraint, no ORM cascade. Application code enforces
existence checks before writes (see Application-Layer Guards below).

### Application-Layer Guards (`src/lib/research/cohort.ts`)

Three guard functions enforce pre-write verification rules.

#### `createStudy(input, actorId)`
1. `actorId` must equal `input.createdById` (impersonation prevention)
2. User must exist
3. `User.role` must be `PHYSICIAN` — `PHYSICIAN_PENDING`, `PATIENT`, and `ADMIN` are rejected

#### `createStudyEnrollment(input, actorId)`
1. `actorId` must equal `input.physicianId`
2. Study must exist and be `ACTIVE`
3. Patient must exist with `researchConsent = true`
4. `User.consentVersion` must meet minimum threshold (`"1.0"`).
   `null` is treated as `"0.0"` — below threshold, patient must re-consent.
   Clinical access is unaffected; only research enrollment is blocked.
5. Physician must exist with `role = PHYSICIAN`

#### `createAssessmentSnapshotNonBlocking(input)`
Non-blocking fire-and-forget trigger. Not async — returns void immediately.

```typescript
// Correct usage after Assessment creation:
await prisma.assessment.create({ ... });   // await the clinical write
createAssessmentSnapshotNonBlocking({ assessmentId, patientId }); // NO await
```

Internal trigger conditions:
1. Patient has ≥1 ACTIVE StudyEnrollment
2. Enrollment has ≥1 operative StudyConsent
3. No existing snapshot for the `(assessmentId, enrollmentId)` pair

If ANY of the above fail, or if an exception is thrown, the error is logged
with structured context and swallowed. The Assessment is already persisted.
The clinical workflow is never interrupted.

### Consent Architecture

```
User.researchConsent = true         ← General data-use prerequisite (Layer 1)
         │
         ▼
User.consentVersion >= "1.0"        ← Version gate (null treated as "0.0")
         │
         ▼
StudyConsent (per-enrollment)       ← Study-specific, full text snapshot
         │
         ▼
StudyEnrollment.status = ACTIVE     ← Patient is enrolled and consented
```

Legacy users with `consentVersion = null` are treated as `"0.0"` in application
gate logic only. No schema change was made. Existing users are not blocked from
clinical CDS use — only from study enrollment until they re-consent.

### Cohort Query Helpers (`src/lib/research/cohort.ts`)

| Function | Purpose |
|---|---|
| `getActiveEnrollmentForPatient(patientId, studyId)` | Lookup for snapshot trigger |
| `getOperativeConsent(enrollmentId)` | Most recent signed consent |
| `getStudyCohortSummary(studyId)` | Aggregate counts for physician dashboard |
| `getEnrollmentsByGlp1Stage(studyId, stage)` | Stage-based cohort segmentation |
| `getEnrollmentsByAgeBand(studyId, min, max)` | Demographic segmentation |
| `getSriTrajectory(enrollmentId)` | Full longitudinal SRI trajectory |
| `recordStudyEvent(input)` | Append research workflow event to StudyEventLog |

All query results use `researchParticipantId` as the patient identifier.
`patientId` is never returned in any result object.

---

## Layer 3 — Publication/Export Infrastructure

### Scope

Layer 3 converts Layer 2 research data into de-identified, publication-ready
datasets. It enforces all PHI exclusion rules before any data leaves the system.

### Service Files

| File | Responsibility |
|---|---|
| `src/lib/research/deidentify.ts` | PHI field constants, bucketing functions, row-level enforcement |
| `src/lib/research/export.ts` | CSV pipeline, column registry, full cohort export |

### PHI Exclusion Rules

The following fields are never present in any export row. `assertNoPhiInRow()`
enforces this at runtime before every row write and will throw on violation.

```typescript
PHI_FIELDS = [
  'patientId', 'userId', 'clerkId', 'email', 'fullName', 'name',
  'ipAddress', 'referralCode', 'referralSlug', 'stripeCustomerId',
  'stripeSubId', 'physicianClerkId', 'physicianId'
]
```

### Quasi-Identifier Mitigation

`weightKg` is a quasi-identifier. When combined with `age` and `sex` in a small
cohort it can narrow re-identification risk. The export layer replaces raw weight
with a bucketed band:

```
bucketWeight(72.3, 5) → "70–75 kg"    // default 5 kg bands
bucketWeight(72.3, 2) → "72–74 kg"    // narrower band for large cohorts
bucketWeight(72.3, 10) → "70–80 kg"   // wider band for small cohorts
```

`age` is not in `AssessmentSnapshot` but is available via `UserProfile`. If age is
added to future export formats, `bucketAge()` in `deidentify.ts` must be used:

```
bucketAge(43, 10) → "40–49"
```

### Export Column Reference

Column order is normative. Do not reorder without updating all statistical analysis scripts.

| Column | Source | Notes |
|---|---|---|
| `participant_id` | `enrollment.researchParticipantId` | UUID v4 — sole patient identifier |
| `study_id` | `enrollment.studyId` | Safe — not patient-identifiable |
| `cohort_label` | `enrollment.cohortLabel` | Optional segmentation |
| `enrollment_date` | `enrollment.enrolledAt` | YYYY-MM-DD only |
| `timepoint` | Row ordinal | 1 = earliest snapshot |
| `snapshot_date` | `snapshot.snapshotDate` | YYYY-MM-DD only |
| `sri_band` | `snapshot.sriBand` | LOW / MODERATE / HIGH / CRITICAL |
| `sri_value_internal` | `snapshot.sriScore` | **Label is normative — never rename** |
| `protein_target_g` | `snapshot.proteinTargetG` | g/day |
| `hydration_target_l` | `snapshot.hydrationTargetL` | litres/day |
| `activity_status` | `snapshot.activityStatus` | String-serialised ActivityLevel enum |
| `gi_tolerance` | `snapshot.giTolerance` | none / mild / moderate / severe |
| `sleep_quality` | `snapshot.sleepQuality` | 1–5 (nullable) |
| `grip_strength_kg` | `snapshot.gripStrengthKg` | Nullable — sparse field |
| `glp1_stage` | `snapshot.glp1Stage` | String-serialised Glp1Stage (nullable) |
| `weight_band_kg` | `bucketWeight(snapshot.weightKg)` | Bucketed — NOT raw weight |
| `symptoms` | `snapshot.symptoms` | JSON array of structured codes — no free-text |
| `interval_days` | Computed | Days since previous snapshot; null for timepoint 1 |

### sriScore Exposure Rules (Non-Negotiable)

The `sriScore` field on `AssessmentSnapshot` is an internal research value.

1. **Never surfaced in patient-facing or physician-facing UI.**
2. **Never transmitted to PostHog or any external analytics provider.**
3. **Export column header must be `sri_value_internal` in all CSV, JSON, and statistical output files.**

Violation of rule 3 invalidates export compatibility with any downstream analysis
script that expects the normative column name.

### Export Pipeline

```
exportStudyCohort(studyId, options)
  │
  ├─ prisma.studyEnrollment.findMany({ where: { studyId, status: filter } })
  │
  └─ for each enrollment:
       getSriTrajectory(enrollment.id)
         │
         └─ prisma.assessmentSnapshot.findMany({ orderBy: snapshotDate asc })
              │
              └─ for each snapshot:
                   buildExportRow(...)
                     │
                     ├─ bucketWeight(snapshot.weightKg)
                     ├─ assertNoPhiInRow(row)  ← throws on PHI violation
                     └─ push to rows buffer
  │
  └─ toCsv(rows)  ← RFC 4180 CSV with normative column order
```

---

## Governance Rules Summary

| Rule | Where enforced |
|---|---|
| researchParticipantId is sole export patient identifier | `export.ts` ExportRow type |
| PHI fields never in export rows | `assertNoPhiInRow()` in `deidentify.ts` |
| ProgressLog excluded from all exports | `EXCLUDED_MODELS` in `export.ts` |
| null consentVersion treated as "0.0" | `createStudyEnrollment()` in `cohort.ts` |
| physician canonical ID = `User.id` | `createStudy()`, `createStudyEnrollment()` guards |
| snapshot creation non-blocking | `createAssessmentSnapshotNonBlocking()` — not async |
| sriScore never in UI or PostHog | Schema comment + no exposure in any route |
| sriScore export label = `sri_value_internal` | `CSV_COLUMNS` in `export.ts`, `SriTimepoint.sri_value_internal` |
| AssessmentSnapshot immutable after creation | No update paths exist in service layer |
| Corrections via new Assessment + PROTOCOL_MODIFICATION event | `StudyEventLog` append pattern |
| `PHYSICIAN_PENDING` blocked from study creation | `createStudy()` role check |
| Double-enrollment prevented | `@@unique([studyId, patientId])` schema constraint |
| eventData must not contain PHI | `recordStudyEvent()` caller contract |

---

## Analytics Events (Reserved, Not Yet Wired)

The following events are reserved for future instrumentation. None contain PHI.
See `docs/analytics-events.md` and `src/lib/posthog.ts` for wiring pattern.

| Event | Properties | When to fire |
|---|---|---|
| `study_enrollment_started` | `study_id`, `cohort_label` | Physician initiates enrollment flow |
| `study_enrollment_completed` | `study_id`, `cohort_label` | `createStudyEnrollment()` succeeds |
| `reassessment_completed` | `study_id`, `sri_band` | Snapshot created (non-blocking context) |
| `longitudinal_checkpoint_completed` | `study_id`, `interval_days` | ADHERENCE_CHECKPOINT event logged |

**Prohibition:** `sri_value_internal` (numeric SRI score) must never appear in
any PostHog event property. Only `sri_band` (LOW/MODERATE/HIGH/CRITICAL) is safe
for analytics transmission.

---

## File Index

| File | Layer | Purpose |
|---|---|---|
| `prisma/schema.prisma` lines 382–648 | 2 | Research models and enums (additive) |
| `src/lib/research/deidentify.ts` | 3 | PHI enforcement, bucketing, exclusion constants |
| `src/lib/research/cohort.ts` | 2 | Guards, query helpers, snapshot trigger |
| `src/lib/research/export.ts` | 3 | CSV pipeline, column registry, cohort export |

**Protected files (not modified by research infrastructure):**
- `src/lib/protocolEngine.ts`
- `middleware.ts`
- `prisma/schema.prisma` lines 1–381
- Any Clerk, Stripe, or Lemon Squeezy configuration
