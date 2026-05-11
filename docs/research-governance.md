# MyoGuard Protocol — Research Governance Policy

**Entity:** Meridian Wellness Systems LLC  
**Platform:** MyoGuard Protocol  
**Domain:** myoguard.health  
**Instrument:** Sarcopenia Risk Index (SRI)  
**Classification:** Physician-led Clinical Decision Support (CDS)  
**Document Status:** Operational — effective immediately upon STEP D deployment  
**Maintained by:** Dr. Okpala, Meridian Wellness Systems LLC  

---

## Table of Contents

1. [Scope and Authority](#1-scope-and-authority)
2. [PHI Boundaries](#2-phi-boundaries)
3. [De-identification Standards](#3-de-identification-standards)
4. [Export Rules](#4-export-rules)
5. [Withdrawal Policy](#5-withdrawal-policy)
6. [Immutable Snapshot Policy](#6-immutable-snapshot-policy)
7. [Physician Oversight Requirements](#7-physician-oversight-requirements)
8. [CDS Positioning](#8-cds-positioning)
9. [Publication Restrictions](#9-publication-restrictions)
10. [Publication and IP Policy](#10-publication-and-ip-policy)
11. [Operational Responsibilities](#11-operational-responsibilities)
12. [Longitudinal Dataset Governance](#12-longitudinal-dataset-governance)
13. [Cohort Handling Rules](#13-cohort-handling-rules)
14. [Consent Architecture](#14-consent-architecture)
15. [Audit Trail Requirements](#15-audit-trail-requirements)

---

## 1. Scope and Authority

This policy governs all observational research activities conducted on and derived from the MyoGuard Protocol platform. It applies to:

- All named observational studies created within the platform (`Study` model)
- All patient enrollments into those studies (`StudyEnrollment` model)
- All point-in-time assessment snapshots collected for enrolled patients (`AssessmentSnapshot` model)
- All longitudinal exports derived from those snapshots (`exportStudyCohort`)
- All publications, preprints, conference abstracts, or external presentations that reference MyoGuard-derived data

**Authority:** Dr. Okpala, as the responsible researcher and platform operator, is the sole authority for approvals, exceptions, and amendments to this policy. No physician or staff member may override these rules without documented written approval from Dr. Okpala.

**Precedence:** This policy takes precedence over informal instructions, verbal agreements, or individual physician preferences. In case of conflict, this document governs.

---

## 2. PHI Boundaries

### 2.1 Prohibited Fields in Research Outputs

The following fields are classified as Protected Health Information (PHI) or direct patient identifiers. They must never appear in any research export, publication dataset, log output, or inter-system transmission:

| Field | Classification | Notes |
|-------|---------------|-------|
| `patientId` | Internal patient identifier | Replaced by `researchParticipantId` in all exports |
| `userId` | Clerk/platform user ID | Never in research context |
| `clerkId` | Authentication system ID | Never in research context |
| `email` | Direct identifier | Never in research context |
| `fullName` / `name` | Direct identifier | Never in research context |
| `ipAddress` | Network quasi-identifier | `StudyConsent.ipAddress` excluded from all exports |
| `referralCode` / `referralSlug` | Platform identifiers | Never in research context |
| `stripeCustomerId` / `stripeSubId` | Billing identifiers | Never in research context |
| `physicianClerkId` / `physicianId` | Physician identifiers | Internal audit use only |

### 2.2 Sole Patient Identifier in Research Outputs

`researchParticipantId` (UUID v4, generated at enrollment) is the only patient identifier permitted in any research export or publication dataset. It is:

- Generated at enrollment; never updated
- Non-sequential; not reversible to `patientId` without the internal mapping
- Compatible with R, SPSS, Python, and CSV statistical workflows
- Safe for publication, cross-institution collaboration, and data sharing agreements

### 2.3 Internal IDs Safe for Logging

The following internal IDs may appear in structured logs and error contexts (not in exports):

- `assessmentId` — identifies the clinical assessment record
- `enrollmentId` — identifies the study enrollment record
- `studyId` — identifies the named study

---

## 3. De-identification Standards

### 3.1 Quasi-identifier Mitigation

Weight and age are quasi-identifiers. When combined with biological sex and diagnosis, they can narrow re-identification risk in small cohorts. The following bucketing rules apply:

| Cohort Size | Weight Band | Rationale |
|-------------|-------------|-----------|
| < 50 participants | 10 kg | Small cohort — wider band required |
| 50–199 participants | 5 kg (default) | Standard band |
| ≥ 200 participants | 2 kg | Large cohort — granularity acceptable |

Age is bucketed in 10-year bands per standard epidemiological reporting conventions (e.g., "40–49"). Age is not currently a snapshot field; if added in a future schema revision, the bucketing rule applies automatically.

### 3.2 Free-text Field Prohibition

No free-text patient-authored fields may be included in any research export or publication dataset. This is the primary reason `ProgressLog` is permanently excluded (see §4.3).

### 3.3 Symptom Arrays

`AssessmentSnapshot.symptoms` is exported as a JSON array of structured codes. Free-text symptom descriptions, if they exist in the source `Assessment.symptoms` field, must be stripped before export. The export pipeline exports the structured codes only.

### 3.4 Minimum Cohort Size for Publication

Exports containing fewer than 10 participants (`MIN_PUBLICATION_COHORT_SIZE`) require aggregate suppression review before release. Outputs from such cohorts must not be published without explicit approval from Dr. Okpala.

---

## 4. Export Rules

### 4.1 Authorised Export Consumers

Longitudinal CSV exports may only be consumed by:

1. Dr. Okpala and designated co-investigators with written approval
2. Statistical analysis tools (R, Python, SPSS) operating in secure, access-controlled environments
3. External collaborators under a signed Data Use Agreement (DUA)

### 4.2 Export Column Standards

All exports use the normative column order defined in `CSV_COLUMNS` (see `src/lib/research/export.ts`). Column order is frozen for downstream statistical tool compatibility. New columns may only be appended at the end, with a migration note and a corresponding update to all downstream analysis scripts.

| Column | Rule |
|--------|------|
| `participant_id` | `researchParticipantId` — UUID v4, sole identifier |
| `sri_value_internal` | Frozen column name for SRI numeric output — never renamed |
| `weight_band_kg` | Bucketed band — raw `weightKg` never exported |
| `symptoms` | Structured codes only — no free-text PHI |
| All PHI fields | Must never appear — `assertNoPhiInRow()` enforces at runtime |

### 4.3 Permanently Excluded Data Sources

**ProgressLog** is permanently excluded from all research exports and publication datasets.

**Reason:** `ProgressLog.notes` is a free-text field with no structured schema or consent gate — it may contain patient-authored PHI. The model also duplicates `WeeklyCheckin` data at lower clinical fidelity, was not collected under structured study consent, and has no enrollment context (`studyId`, `enrollmentId`, or `researchParticipantId` linkage).

**Inclusion path:** Any future inclusion requires a dedicated consent amendment and schema revision reviewed and approved by Dr. Okpala.

### 4.4 Status Filter for Exports

By default, only `ACTIVE` enrollments are included in exports. `WITHDRAWN` and `COMPLETED` enrollments may be included via explicit flags (`includeWithdrawn`, `includeCompleted`). Previously collected snapshots for withdrawn participants are preserved per the immutability contract (§6) and may be included in sensitivity analyses.

### 4.5 SRI Naming in Exports

The SRI numeric output must always be exported under the column label `sri_value_internal`. This label is frozen.

- **Never rename to:** `sriScore`, `score`, `sri_score`, `risk_score`, or any other variant
- **Reason:** Downstream statistical scripts reference this column by name; renaming breaks reproducibility

---

## 5. Withdrawal Policy

### 5.1 Patient-Initiated Withdrawal

Patients may withdraw from a study at any time without affecting their clinical care. Withdrawal:

1. Sets `StudyEnrollment.status` to `WITHDRAWN`
2. Stamps `StudyEnrollment.withdrawalDate`
3. Logs a `WITHDRAWAL` event in `StudyEventLog`
4. Does NOT delete previously collected `AssessmentSnapshot` records

### 5.2 Snapshot Preservation After Withdrawal

Previously collected snapshots are preserved in accordance with observational study data retention requirements. The immutability contract (§6) applies to all snapshots regardless of enrollment status.

### 5.3 Withdrawal in Exports

Withdrawn participant data is excluded from default exports. Inclusion for intent-to-treat or sensitivity analyses requires the `includeWithdrawn` flag and explicit documentation in the analysis plan.

### 5.4 Physician-Initiated Withdrawal

Physicians may initiate withdrawal on a patient's behalf for clinical or safety reasons. All physician-initiated withdrawals must include a documented reason in the `WITHDRAWAL` `StudyEventLog` entry (`eventData.reason` and `eventData.initiated_by`).

---

## 6. Immutable Snapshot Policy

### 6.1 Core Rule

`AssessmentSnapshot` records are **never updated after creation**. This is an architectural invariant — no update pathway exists in the application layer.

### 6.2 Rationale

Immutability ensures:
- **Longitudinal integrity:** Trajectory analyses reflect what was clinically observed at each timepoint, not retrospective corrections
- **Publication reproducibility:** A exported dataset at time T1 is identical to the same export at time T2 (same enrollment IDs, same snapshot IDs)
- **Audit traceability:** The snapshot record reflects exactly what the assessment produced at point of capture

### 6.3 Correction Protocol

If a snapshot contains erroneous data (e.g., incorrect weight entry, erroneous GLP-1 stage):

1. A new `Assessment` is created with the corrected values
2. The snapshot trigger captures a new `AssessmentSnapshot` from the corrected assessment
3. A `PROTOCOL_MODIFICATION` event is logged in `StudyEventLog` with `eventData.field_modified` and `eventData.reason`
4. The original snapshot remains in the database — it is flagged through the event log, not deleted

### 6.4 Idempotency Constraint

The `@@unique([assessmentId, enrollmentId])` constraint on `AssessmentSnapshot` ensures that duplicate snapshot attempts for the same (assessment, enrollment) pair are safely skipped — the application layer checks for an existing record before writing.

---

## 7. Physician Oversight Requirements

### 7.1 Study Creation Authority

Only users with `role = PHYSICIAN` may create named observational studies. The `createStudy` guard verifies:

1. The actor's `User.id` matches the `createdById` field
2. The actor exists in the `User` table
3. The actor's `role` is `PHYSICIAN`

Staff, patients, and administrators may not create studies.

### 7.2 Enrollment Authority

Only users with `role = PHYSICIAN` may enroll patients in studies. The `createStudyEnrollment` guard verifies:

1. Actor identity (`actorId === physicianId`)
2. Study exists and is `ACTIVE`
3. Patient exists with `researchConsent = true`
4. Patient's effective consent version ≥ `MIN_CONSENT_VERSION` (`1.0`)
5. Enrolling physician exists with `role = PHYSICIAN`

### 7.3 Ongoing Oversight

Enrolled physicians are responsible for:
- Reviewing `ADHERENCE_CHECKPOINT` events at agreed intervals
- Recording `PHYSICIAN_REVIEW` events when clinically indicated
- Initiating `WITHDRAWAL` for any patient whose continued participation poses clinical risk
- Reviewing export datasets before submission to publications or collaborators

---

## 8. CDS Positioning

### 8.1 Platform Classification

MyoGuard Protocol is classified as **Physician-led Clinical Decision Support (CDS)**. It is not a diagnostic device, a clinical trial platform, or a medical records system.

### 8.2 SRI Instrument Status

The Sarcopenia Risk Index (SRI) is an **expert-consensus framework**. It is not a validated diagnostic instrument. All publications and study protocols must include the following disclaimer:

> *All outputs from MyoGuard Protocol are clinical decision support and do not constitute medical advice. Physician oversight is mandatory for all clinical applications. The Sarcopenia Risk Index (SRI) is an expert-consensus framework; it is not a validated diagnostic instrument.*

### 8.3 Patient Consent Positioning

Any research consent form or UI referencing MyoGuard must include the following statement verbatim:

> *MyoGuard Protocol is a physician-led Clinical Decision Support (CDS) platform. Participation in observational data collection is voluntary and does not affect your clinical care.*

---

## 9. Publication Restrictions

### 9.1 Pre-Publication Review

All publications, preprints, conference abstracts, and external presentations that report findings derived from MyoGuard-derived observational data must be reviewed and approved by Dr. Okpala before submission.

### 9.2 Co-authorship

Dr. Okpala is a co-author or acknowledged collaborator on all publications using MyoGuard-derived data. Exceptions require written consent from Dr. Okpala.

### 9.3 Data Sharing

MyoGuard-derived datasets may not be shared with external parties without:

1. A signed Data Use Agreement (DUA) reviewed by legal counsel
2. Written approval from Dr. Okpala
3. Confirmation that the dataset meets all de-identification standards in §3

### 9.4 Preprint Embargo

Draft manuscripts must not be posted to preprint servers before the internal review described in §9.1 is completed.

---

## 10. Publication and IP Policy

### 10.1 Proprietary Methodology

The Sarcopenia Risk Index (SRI) methodology is proprietary to Meridian Wellness Systems LLC. Provisional intellectual property protection is associated with the SRI framework.

### 10.2 Platform Attribution

All publications using MyoGuard-derived observational datasets must acknowledge MyoGuard Protocol as the observational data collection and Clinical Decision Support infrastructure platform. The following acknowledgement statement should appear in the acknowledgements section:

> *Observational data were collected via MyoGuard Protocol, Meridian Wellness Systems LLC (myoguard.health), 2026.*

### 10.3 Methodology Citation

Publications that describe the SRI computation methodology — including scoring logic, risk band thresholds, or protocol generation rules — must cite the SRI in their methodology section as:

> *MyoGuard Sarcopenia Risk Index (SRI), Meridian Wellness Systems LLC, 2026.*

This citation applies whether the SRI computation is described directly or referenced through a prior publication. The internal numeric export values labelled `sri_value_internal` should be referenced in methodology sections using this citation.

### 10.4 IP Notice in Methodology Sections

Where the SRI framework is described in sufficient detail to enable reproduction, the following notice should appear in the methodology section or supplementary material:

> *The Sarcopenia Risk Index (SRI) methodology is proprietary to Meridian Wellness Systems LLC. Provisional intellectual property protection is associated with the SRI framework.*

### 10.5 Prohibited Descriptions

Publications must not:
- Describe the SRI as a "calculator" or "scoring tool"
- Reproduce the complete SRI weight matrix or algorithm without written approval from Dr. Okpala
- Represent the SRI as a validated clinical instrument without citing the expert-consensus qualification
- Use the name "Meridian Health" or "Meridian Health Holding" — the correct entity name is "Meridian Wellness Systems LLC"

### 10.6 External Collaborator Obligations

Collaborators who receive access to MyoGuard-derived datasets under a Data Use Agreement are bound by §§10.1–10.5 as a condition of access. This must be stated explicitly in the DUA.

---

## 11. Operational Responsibilities

| Role | Responsibility |
|------|---------------|
| Dr. Okpala | Policy authority, publication approval, exception approval, consent version governance |
| Enrolling Physician | Patient eligibility assessment, consent witnessing, ongoing clinical oversight, event logging |
| Platform (automated) | Non-blocking snapshot creation, PHI enforcement (`assertNoPhiInRow`), audit logging |
| Export Consumer | Verifying de-identification before analysis, not re-identifying participants |

---

## 12. Longitudinal Dataset Governance

### 12.1 Timepoint Integrity

Each `AssessmentSnapshot` represents a single point-in-time observation. The `timepoint` column in exports is an ordinal within the enrollment trajectory (1 = first, 2 = second, etc.). Ordinal assignment is determined by `snapshotDate` ascending order.

### 12.2 Interval Calculation

`interval_days` reflects the number of days between consecutive snapshots within an enrollment. The first timepoint always has `interval_days = null`. Gaps in follow-up are preserved and must be accounted for in longitudinal models.

### 12.3 Multi-Study Enrollment

A patient may be concurrently enrolled in multiple studies. Snapshots are created independently per enrollment — the same clinical assessment produces one `AssessmentSnapshot` per active, consented enrollment. Each snapshot has an independent `researchParticipantId` per enrollment; the same patient has different participant IDs across different studies.

### 12.4 Dataset Versioning

Published datasets should be versioned with a date stamp (e.g., `myoguard-cohort-export-study-abc-20260601.csv`). Version changes arising from additional data collection (new snapshots) must be documented in the analysis plan. Dataset versions are not interchangeable without rechecking cohort composition.

---

## 13. Cohort Handling Rules

### 13.1 Cohort Label Governance

`StudyEnrollment.cohortLabel` is optional free text for within-study segmentation. Canonical labels are defined in `src/lib/research/constants.ts`. Non-canonical labels are permitted but must be documented in the study protocol.

### 13.2 Cohort Size Minimums

Subgroup analyses by cohort label require a minimum of 10 participants per subgroup before publication. Subgroups below this threshold must be reported as aggregate or suppressed.

### 13.3 Cohort Arm Integrity

Cohort arm assignment (`cohortLabel`) is set at enrollment and must not be changed after the first snapshot is collected. Reassignment after data collection begins is a protocol deviation requiring a `PROTOCOL_MODIFICATION` event.

---

## 14. Consent Architecture

### 14.1 Two-Layer Consent Model

Research participation requires two independent consent layers:

1. **General data-use consent** (`User.researchConsent = true`) — the prerequisite for any research enrollment
2. **Per-study, per-version consent** (`StudyConsent`) — specific to each named study

Both must be satisfied. Clinical access is unaffected by research consent status.

### 14.2 Consent Version Gating

`MIN_CONSENT_VERSION = "1.0"`. Users whose `consentVersion` is `null` are treated as version `"0.0"` — below the minimum. These users are not enrolled in studies until they re-consent.

### 14.3 Consent as Immutable Legal Record

`StudyConsent.consentTextSnapshot` stores the full verbatim text of the consent document at signing time. This record is immutable. If consent text changes (new version), a new `StudyConsent` record is required — the existing record is not updated.

### 14.4 Operative Consent

The operative consent for a given enrollment is the `StudyConsent` record with the most recent `signedAt` timestamp. Consent version comparison uses semantic versioning logic.

---

## 15. Audit Trail Requirements

### 15.1 StudyEventLog

All significant research lifecycle events are recorded in `StudyEventLog`. The log is append-only — no updates or deletes. Required events:

| Milestone | EventType | Required eventData keys |
|-----------|-----------|------------------------|
| Patient enrolled | `ENROLLMENT` | `cohort_label`, `consent_version` |
| Reassessment captured | `REASSESSMENT` | `sri_band`, `sri_value_internal`, `interval_days` |
| Patient withdrawn | `WITHDRAWAL` | `reason`, `initiated_by` |
| Protocol modified | `PROTOCOL_MODIFICATION` | `field_modified`, `reason` |
| Physician review | `PHYSICIAN_REVIEW` | `overall_impression`, `follow_up_days` |
| Adherence check | `ADHERENCE_CHECKPOINT` | `protein_adherence`, `exercise_adherence`, `recovery_status` |

### 15.2 PHI in Event Data

`eventData` JSON payloads must never contain PHI. Permitted keys include `sri_band`, `sri_value_internal`, `interval_days`, `cohort_label`, `consent_version`, `reason`, `field_modified`. PHI field names and values are prohibited per §2.

### 15.3 Audit Log vs. StudyEventLog

The platform's existing `AuditLog` model handles system/compliance events (authentication, role changes, billing). `StudyEventLog` handles research-specific workflow milestones. These are distinct systems — do not conflate them.

---

*Document maintained by: Dr. Okpala, Meridian Wellness Systems LLC*  
*Effective date: 2026*  
*Next scheduled review: Before first external data sharing under a DUA*
