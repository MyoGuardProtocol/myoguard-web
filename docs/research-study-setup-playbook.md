# MyoGuard Protocol — Research Study Setup Playbook

**Entity:** Meridian Wellness Systems LLC  
**Platform:** MyoGuard Protocol  
**Document Type:** Operational Internal Workflow Guide  
**Maintained by:** Dr. Okpala  

This playbook is for physicians and the platform operator responsible for creating and running observational studies on MyoGuard Protocol. Read the [Research Governance Policy](./research-governance.md) first — this playbook assumes familiarity with those rules.

---

## Table of Contents

1. [Before You Begin](#1-before-you-begin)
2. [Observational Study Lifecycle](#2-observational-study-lifecycle)
3. [Creating a Study](#3-creating-a-study)
4. [Naming Conventions](#4-naming-conventions)
5. [Cohort Naming Strategy](#5-cohort-naming-strategy)
6. [Consent Versioning](#6-consent-versioning)
7. [Enrolling Patients](#7-enrolling-patients)
8. [Minimum Dataset Recommendations](#8-minimum-dataset-recommendations)
9. [Withdrawal Handling](#9-withdrawal-handling)
10. [Export Handling](#10-export-handling)
11. [Export Verification Process](#11-export-verification-process)
12. [De-identification Review Checklist](#12-de-identification-review-checklist)
13. [Publication Review Workflow](#13-publication-review-workflow)
14. [Physician Responsibilities](#14-physician-responsibilities)

---

## 1. Before You Begin

### Prerequisites

Before setting up a study, confirm all of the following:

- [ ] You have `role = PHYSICIAN` on the MyoGuard platform (`User.role`)
- [ ] You have discussed the study design with Dr. Okpala and received approval in writing
- [ ] You have a study title, slug, and purpose documented
- [ ] You have a consent document text ready at version `1.0` or higher
- [ ] You understand that `ProgressLog` data is permanently excluded from all exports (see Governance §4.3)
- [ ] You understand that `sri_value_internal` is the mandated column name for SRI numeric output — never rename it
- [ ] You understand that your `User.id` (not your `clerkId`, email, or referral code) is the canonical physician identifier

### Platform Access

All study operations use the application service layer:

- **Study creation:** `createStudy()` in `src/lib/research/cohort.ts`
- **Enrollment:** `createStudyEnrollment()` in `src/lib/research/cohort.ts`
- **Export:** `exportStudyCohort()` in `src/lib/research/export.ts`
- **Event logging:** `recordStudyEvent()` in `src/lib/research/cohort.ts`

Do not interact with the `Study`, `StudyEnrollment`, or `AssessmentSnapshot` tables directly via Supabase or the Prisma client — always use the guard functions to ensure consent checks and role verification are enforced.

---

## 2. Observational Study Lifecycle

```
DRAFT → ACTIVE → CLOSED → ARCHIVED
```

| Status | Enrollments | Exports | Modifications |
|--------|-------------|---------|---------------|
| DRAFT | Not permitted | Not permitted | Title, slug, description |
| ACTIVE | Permitted | Permitted | Protocol modifications via event log |
| CLOSED | Not permitted | Permitted | Analysis only — no new data |
| ARCHIVED | Not permitted | Governance review required | None |

**Key rules:**
- Status transitions must be documented in `StudyEventLog` with a `PROTOCOL_MODIFICATION` event
- `ARCHIVED` is a terminal state — no further transitions
- New patient data continues to be captured (via non-blocking snapshot trigger) only while the study is `ACTIVE`

---

## 3. Creating a Study

### Step-by-Step

**Step 1 — Prepare the study record**

Collect the following before calling `createStudy()`:

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `title` | String | "GLP-1 Sarcopenia Trajectory 2026" | Descriptive; used in physician-facing UI |
| `slug` | String | `"glp1-sarcopenia-2026"` | URL-safe; see naming rules in §4 |
| `description` | String? | "Observational cohort study…" | Optional but recommended |
| `createdById` | String | Your `User.id` | Must be your `User.id` — not clerkId |

**Step 2 — Call `createStudy()`**

The guard function verifies that `actorId` equals `createdById`, that you exist in the User table, and that your `role = PHYSICIAN`. Any violation throws an error and aborts the creation.

**Step 3 — Activate the study**

The study is created in `DRAFT` status. Before enrolling patients:

1. Verify the slug and title are correct — slugs cannot be changed after enrollment begins
2. Update status to `ACTIVE` (direct Prisma update with physician confirmation)
3. Log a `PROTOCOL_MODIFICATION` event documenting the activation and the approved protocol version

**Step 4 — Prepare your consent document**

Write and review the consent text at version `1.0`. The full verbatim text is stored immutably in `StudyConsent.consentTextSnapshot` at the moment each patient signs. Changes to consent text require a version bump (e.g., `1.1`) and a new signing cycle for all enrolled patients.

---

## 4. Naming Conventions

### Study Slugs

Slugs must match the pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`

- Lowercase letters, digits, and hyphens only
- No leading or trailing hyphens
- Maximum 64 characters
- Include the study year for uniqueness across multi-year programmes

| Pattern | Example |
|---------|---------|
| `{condition}-{arm}-{year}` | `glp1-sarcopenia-2026` |
| `{condition}-{population}-{year}` | `myopenia-elderly-2026` |
| `{phase}-{condition}-{year}` | `pilot-grip-strength-2026` |

### Study Titles

Use sentence case. Include the study type ("Observational Cohort", "Pilot Study") and year.

**Good:** "GLP-1 Sarcopenia Trajectory — Observational Cohort 2026"  
**Avoid:** "Sarco Study", "Q2 Study", "Test Study"

### Event Log Entries

When recording events, use the structured `eventData` keys defined in the schema:

- `REASSESSMENT` events: always include `sri_band`, `sri_value_internal`, `interval_days`
- `WITHDRAWAL` events: always include `reason` and `initiated_by`
- `PROTOCOL_MODIFICATION` events: always include `field_modified` and `reason`

Do not use arbitrary key names in `eventData` — maintain consistency for downstream event analysis.

---

## 5. Cohort Naming Strategy

### Canonical Labels

Use labels from `COHORT_LABELS` in `src/lib/research/constants.ts` wherever possible:

| Label | Use Case |
|-------|----------|
| `control` | Standard care arm with no intervention |
| `intervention` | Active intervention arm |
| `observational` | Pure observation with no arm assignment |
| `pilot` | Small exploratory cohort |
| `high-risk` | Patients above a defined SRI risk threshold |
| `standard-care` | Usual care comparison arm |
| `glp1-initiation` | GLP-1 treatment initiation phase |
| `glp1-maintenance` | GLP-1 dose maintenance phase |
| `glp1-discontinuation` | GLP-1 discontinuation follow-up |

### Non-Canonical Labels

Non-canonical labels are permitted but must be:
1. Documented in the study protocol before enrollment begins
2. Consistent within the study (case-sensitive)
3. Free of PHI (no patient names, initials, or identifying details)

### Arm Assignment Rules

- Assign cohort label at enrollment
- Do not change it after the first snapshot is collected
- Reassignment after data collection is a protocol deviation — log it with `PROTOCOL_MODIFICATION`

---

## 6. Consent Versioning

### Version Format

Consent versions use semantic versioning: `MAJOR.MINOR` (e.g., `1.0`, `1.1`, `2.0`).

| Change Type | Version Bump | Re-consent Required |
|-------------|-------------|---------------------|
| Corrections to typos or formatting | Minor (`1.0` → `1.1`) | Recommended for enrolled patients |
| Changes to data use scope or participant rights | Major (`1.0` → `2.0`) | Required for all enrolled patients |
| New data collection fields in exports | Minor at minimum | Required; consult Dr. Okpala |
| Initial release | `1.0` | N/A (first signing) |

### Minimum Version Requirement

`MIN_CONSENT_VERSION = "1.0"`. Patients whose `User.consentVersion` is `null` are treated as `"0.0"` — below the minimum — and cannot be enrolled until they re-consent through the clinical flow.

### Consent Text Immutability

The verbatim consent text is stored at `StudyConsent.consentTextSnapshot` at signing time. This is an immutable legal record. If you need to change consent text:

1. Update the text externally (maintain a versioned document)
2. Bump the version number
3. Obtain new signatures from enrolled patients via a new `StudyConsent` record

Never update an existing `StudyConsent` record.

### Operative Consent

For any given enrollment, the operative consent is the `StudyConsent` with the most recent `signedAt`. Use `getOperativeConsent(enrollmentId)` to retrieve it.

---

## 7. Enrolling Patients

### Eligibility Checklist

Before calling `createStudyEnrollment()`, verify:

- [ ] Patient has `User.researchConsent = true` (general consent)
- [ ] Patient's `User.consentVersion` is `>= "1.0"` (or null, which blocks enrollment)
- [ ] Patient has been assessed on MyoGuard — at least one `Assessment` record exists
- [ ] Patient is not already enrolled in this study (`@@unique([studyId, patientId])` prevents duplicates, but check first to avoid confusing errors)
- [ ] The study is in `ACTIVE` status
- [ ] You have the full verbatim consent text ready at the correct version

### Enrollment Call

```typescript
await createStudyEnrollment(
  {
    studyId: 'your-study-cuid',
    patientId: 'patient-user-id',       // User.id — never clerkId
    physicianId: 'your-user-id',        // User.id — never clerkId
    cohortLabel: 'intervention',        // optional; omit for single-arm studies
    consentVersion: '1.0',
    consentTextSnapshot: 'Full verbatim consent text…',
    ipAddress: '…',                     // optional; for consent provenance
  },
  actorId: 'your-user-id',             // must equal physicianId
);
```

### Post-Enrollment

After enrollment, the next clinical assessment the patient completes will automatically trigger `createAssessmentSnapshotNonBlocking()`. The first snapshot for this enrollment is captured at that point.

Log an `ENROLLMENT` event:

```typescript
await recordStudyEvent({
  studyId,
  enrollmentId,
  eventType: StudyEventType.ENROLLMENT,
  eventData: {
    cohort_label: 'intervention',
    consent_version: '1.0',
  },
  recordedBy: physicianUserId,
});
```

---

## 8. Minimum Dataset Recommendations

A study is considered minimally publication-ready when:

| Criterion | Minimum |
|-----------|---------|
| Total enrolled participants | 10 |
| Follow-up snapshots per participant (median) | 2 |
| Study duration | 12 weeks |
| GLP-1 stage coverage | At least 2 distinct stages represented |
| Risk band distribution | Not all participants in a single band |

**For longitudinal trajectory analyses** (primary use case):
- Minimum 20 participants
- At least 3 timepoints per participant (median)
- Maximum 20% dropout rate before the third timepoint

**For subgroup analyses:**
- Minimum 10 participants per subgroup
- Subgroups below 10 must be reported as aggregate or suppressed

These are internal guidance thresholds — consult Dr. Okpala before any publication decisions.

---

## 9. Withdrawal Handling

### Physician-Initiated Withdrawal

1. Update `StudyEnrollment.status` to `WITHDRAWN` and stamp `withdrawalDate`
2. Log a `WITHDRAWAL` event with `reason` and `initiated_by`
3. Inform the patient that their previously collected data is retained (per consent)
4. Do not delete any `AssessmentSnapshot` records

### Patient-Initiated Withdrawal

1. Patient notifies their physician
2. Physician processes the withdrawal (as above)
3. Document whether the withdrawal is due to adverse effects, personal choice, or loss to follow-up

### Data Retention After Withdrawal

Previously collected snapshots are preserved and may be included in analyses as:
- **Per-protocol analysis:** exclude withdrawn participants
- **Intent-to-treat analysis:** include withdrawn participants up to withdrawal date (use `includeWithdrawn: true` in export)
- **Sensitivity analysis:** compare both

Document the chosen analysis strategy in the study protocol before analysis begins.

---

## 10. Export Handling

### Generating a Cohort Export

```typescript
import { exportStudyCohort } from '@/lib/research/export';

const csv = await exportStudyCohort('your-study-id', {
  includeWithdrawn: false,   // true for intent-to-treat analyses
  includeCompleted: true,    // include completed enrollments
  weightBandKg: 5,           // 5 kg default; 10 for small cohorts, 2 for large
});
```

### Export File Naming

Use the format: `myoguard-cohort-export-{studySlug}-{YYYYMMDD}.csv`

Example: `myoguard-cohort-export-glp1-sarcopenia-2026-20260601.csv`

### Where to Run Exports

- Run exports in a secure, access-controlled environment
- Do not export to cloud storage with public access
- Do not email CSV exports — use secure file transfer
- Log each export operation (who ran it, when, for what purpose)

### Import into Statistical Tools

The CSV uses RFC 4180 format with normative column order. Import directly:

```r
# R
df <- read.csv("myoguard-cohort-export-glp1-sarcopenia-2026-20260601.csv",
               stringsAsFactors = FALSE)

# Python
import pandas as pd
df = pd.read_csv("myoguard-cohort-export-glp1-sarcopenia-2026-20260601.csv")
```

The `sri_value_internal` column contains the SRI numeric output. Reference it by this exact name in all analysis scripts — do not rename it in scripts or derived datasets.

---

## 11. Export Verification Process

Run this checklist before using any export in analysis or sharing with collaborators.

### Structural Checks

- [ ] Header row matches normative column order from `CSV_COLUMNS`
- [ ] `participant_id` column contains UUID v4 values only (no names, emails, or internal IDs)
- [ ] No `patientId`, `userId`, `clerkId`, `email`, or `fullName` column present
- [ ] No `ipAddress` column present
- [ ] `weight_band_kg` column contains band strings (e.g., `"70–75 kg"`) — not raw numeric values
- [ ] `sri_value_internal` column present and not renamed
- [ ] `symptoms` column contains JSON arrays — no free-text strings

### Data Quality Checks

- [ ] Row count matches expected enrollment count × expected timepoints (approximately)
- [ ] `timepoint` column starts at 1 per `participant_id` and increments correctly
- [ ] `interval_days` is null for all first timepoints (timepoint = 1)
- [ ] `interval_days` is a positive integer for all subsequent timepoints
- [ ] `sri_band` values are only: `LOW`, `MODERATE`, `HIGH`, `CRITICAL`
- [ ] `activity_status` values match expected ActivityLevel codes
- [ ] Date columns (`enrollment_date`, `snapshot_date`) are in `YYYY-MM-DD` format

### Cohort Size Check

- [ ] Total distinct `participant_id` values ≥ 10 (minimum publication threshold)
- [ ] If subgroup analyses are planned: each subgroup (`cohort_label`) has ≥ 10 participants
- [ ] If weight band is non-default: document the chosen band size and rationale

### Final Gate

- [ ] Export verified by Dr. Okpala (or designated reviewer) before sharing with any collaborator
- [ ] Export file stored in a named, versioned location with access log

---

## 12. De-identification Review Checklist

Before any data leaves the platform environment (export file, publication table, conference slide), verify:

### Direct Identifiers — Must Be Absent

- [ ] No patient names
- [ ] No email addresses
- [ ] No phone numbers
- [ ] No dates of birth (only age bands if age is included)
- [ ] No `patientId`, `userId`, `clerkId`
- [ ] No `ipAddress`
- [ ] No geographic data more granular than country/region

### Quasi-identifiers — Must Be Bucketed

- [ ] Weight is in bands (e.g., `70–75 kg`), not raw values
- [ ] Age (if included) is in 10-year bands (e.g., `40–49`), not exact ages
- [ ] Small cell sizes (< 10) are suppressed or reported as aggregate

### Free-text — Must Be Absent

- [ ] No `ProgressLog` data
- [ ] No free-text symptom descriptions
- [ ] No physician notes
- [ ] `symptoms` column contains structured codes only

### Linkability Check

- [ ] Each `participant_id` (UUID v4) cannot be linked to a real-world patient without the internal mapping
- [ ] The internal mapping table (`patientId` ↔ `researchParticipantId`) is not included in any export or shared with any collaborator

---

## 13. Publication Review Workflow

### Phase 1 — Internal Preparation

1. Complete export verification (§11) and de-identification review (§12)
2. Prepare draft manuscript or abstract
3. Identify the attribution and citation requirements (§10 of Governance Policy)
4. Confirm dataset version and analysis plan are aligned

### Phase 2 — Dr. Okpala Review

1. Submit draft to Dr. Okpala at least **4 weeks before target submission date**
2. Include: draft manuscript, dataset version, analysis plan, journal/conference target
3. Dr. Okpala reviews for:
   - Accuracy of SRI methodology description
   - Correct attribution and IP notice inclusion
   - De-identification verification
   - CDS positioning (no overclaiming diagnostic capability)
   - Co-authorship confirmation

### Phase 3 — Revision and Approval

1. Revise per Dr. Okpala's feedback
2. Obtain written approval before submission
3. Do not post to preprint servers before approval

### Phase 4 — Post-Submission

1. Log the submission in the study record (`PROTOCOL_MODIFICATION` event with `reason: "manuscript_submission"`)
2. Share the DOI or preprint link with Dr. Okpala on acceptance/publication
3. Archive the exact dataset version used for the analysis (named, versioned file)

---

## 14. Physician Responsibilities

### At Study Creation

- Design study with a defined clinical question and endpoint
- Obtain Dr. Okpala's approval for the protocol
- Prepare consent text at version `1.0`
- Define cohort arms if multi-arm design

### At Enrollment

- Confirm patient eligibility (consent, researchConsent, clinical appropriateness)
- Obtain and document informed consent
- Record `ENROLLMENT` event immediately after enrollment
- Set cohort label correctly — it cannot be changed after first snapshot

### During Follow-up

- Record `ADHERENCE_CHECKPOINT` events at agreed intervals
- Record `PHYSICIAN_REVIEW` events when clinically indicated
- Initiate `WITHDRAWAL` promptly if continued participation poses clinical risk or patient requests withdrawal
- Never modify `AssessmentSnapshot` records — create corrections through new Assessments

### At Study Closure

- Ensure all enrolled patients are transitioned to `COMPLETED` or `WITHDRAWN` status
- Perform a final export and run the export verification checklist (§11)
- Log the study closure with a `PROTOCOL_MODIFICATION` event
- Archive the final dataset version

### Before Publication

- Complete the publication review workflow (§13)
- Never share raw (non-bucketed) weight data
- Never include `patientId` or any PHI in publication material
- Ensure the SRI citation and attribution strings are included verbatim (see Governance §10)

---

*Maintained by: Dr. Okpala, Meridian Wellness Systems LLC*  
*Effective: 2026*
