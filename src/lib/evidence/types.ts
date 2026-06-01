// MyoGuard — Clinical Evidence Engine: Type Definitions
//
// Core principle:
// MyoGuard generates clinical evidence. The physician generates clinical decisions.
// Never cross that boundary. All outputs are observational. Never diagnostic.
// Never predictive. Never directive.
//
// This module defines the type contracts for the entire evidence layer.
// The evidence layer documents intelligence signals as structured records
// suitable for physician review, registry export, and future EHR integration.
//
// No Prisma access. No UI. No client code. Pure TypeScript contracts.
//
// Vocabulary governance (extends BUILD 5A rules):
//   PREFER: observed, recorded, continuity concern, review signal, requiring attention,
//           documentation maturity, longitudinal record, evidence window
//   NEVER:  worsening, deteriorating, urgent, severe, predicted, forecast,
//           recommendation, diagnosis, risk (in prognostic context), improving (unqualified)

import type {
  IntelligenceSignal,
  OverallContinuityStatus,
  ConfidenceLevel,
} from '@/src/lib/intelligence/types';

// Re-export intelligence layer types consumed by evidence layer consumers.
// Centralises imports for files that only depend on evidence layer.
export type { IntelligenceSignal, OverallContinuityStatus, ConfidenceLevel };

// ─── Evidence Governance ──────────────────────────────────────────────────────
//
// Captures the lineage of every ClinicalEvidenceRecord for:
//   - auditability
//   - research reproducibility
//   - future EHR lineage tracking
//   - future protocol version tracking across publications
//
// protocolVersion:     Tracks the SRI/protocol version in effect at generation time.
//                      Placeholder "1.0.0" until sourced from package.json or a
//                      dedicated version constant in protocolEngine.ts.
// intelligenceVersion: Tracks the intelligence layer algorithm version.
//                      Placeholder "1.0.0" until src/lib/intelligence/ exports a
//                      version constant.

export interface EvidenceGovernance {
  generatedBy:         'myoguard_evidence_engine';
  generatedAt:         string;        // ISO 8601 timestamp
  protocolVersion:     string;        // e.g. "1.0.0" — placeholder
  intelligenceVersion: string;        // e.g. "1.0.0" — placeholder
}

// ─── Evidence Readiness ───────────────────────────────────────────────────────
//
// Evidence Readiness reflects documentation maturity only.
// It is not a clinical judgment, recommendation, risk classification, or prediction.
//
// Determined by assessmentCount (primary determinant):
//   limited:     0–1 assessments — insufficient longitudinal documentation
//   developing:  2 assessments  — evidence record forming
//   sufficient:  3+ assessments — sufficient longitudinal documentation
//
// checkinCount is informational — provides engagement volume context;
// it does not modify the status derived from assessmentCount.

export interface EvidenceReadiness {
  status:          'limited' | 'developing' | 'sufficient';
  assessmentCount: number;
  checkinCount:    number;   // informational; does not affect status
}

// ─── Evidence Summary ─────────────────────────────────────────────────────────
//
// A documented snapshot of one intelligence signal dimension within a
// ClinicalEvidenceRecord. Derived from PatientIntelligenceSummary signals;
// reformatted for evidence record composition and export surfaces.

export interface EvidenceSummary {
  status:          string;         // Signal status verbatim — no transformation applied
  confidence:      ConfidenceLevel;
  observationText: string;         // Observational narrative from the intelligence signal
  dataPoints:      number;         // Count of data points contributing to this signal
  windowDays:      number;         // Observation window length in days
}

// ─── Documentation Note ───────────────────────────────────────────────────────
//
// A structured clinical documentation entry representing a single physician
// review event within the evidence window.
// Source: PhysicianReview records within the ClinicalEvidenceRecord window.

export interface DocumentationNote {
  noteDate:          string;         // ISO 8601 timestamp of the review event
  assessmentId:      string;         // Links this note to the reviewed assessment
  overallImpression: string | null;
  followUpDays:      number | null;
  note:              string | null;
}

// ─── Patient Summary ──────────────────────────────────────────────────────────
//
// Protocol context for evidence record composition.
// Contains clinical protocol data only — no PHI beyond what the treating
// physician already holds for this patient in the course of care.

export interface PatientSummary {
  currentBand:     string | null;    // Most recent riskBand from MuscleScore
  glp1Stage:       string | null;    // GLP-1 stage from UserProfile
  proteinTargetG:  number | null;    // Protocol protein target in grams (MuscleScore)
  assessmentCount: number;           // Assessments within the evidence window
  checkinCount:    number;           // Weekly check-ins within the continuity window
}

// ─── Export Metadata ──────────────────────────────────────────────────────────
//
// Identifies which export surfaces are available for this record instance.
//
// supportsPhysicianReport: always true — physician report is always available.
// supportsResearchExport:  true only when an active StudyEnrollment exists for
//                          this patient and includeResearchData was requested.
// supportsEHRExport:       false — BUILD 6A (HL7 FHIR R4 stub in exportMapper.ts).
// researchParticipantId:   UUID from StudyEnrollment.researchParticipantId.
//                          null when patient is not enrolled or enrollment is inactive.
//                          This is the ONLY export-safe patient identifier.
//                          patientId is NEVER included in research exports.

export interface ExportMetadata {
  supportsPhysicianReport: true;
  supportsResearchExport:  boolean;
  supportsEHRExport:       false;    // BUILD 6A — not yet implemented
  researchParticipantId:   string | null;
}

// ─── Clinical Evidence Record ─────────────────────────────────────────────────
//
// The primary output of the MyoGuard evidence engine.
// Produced by generateClinicalEvidenceRecord() in evidencePacket.ts.
//
// This is a structured documentation record, not a clinical assessment.
// All dimensions are observational. None are diagnostic, predictive, or directive.
//
// "Record" is used intentionally over "Packet" — this structure is designed
// to support physician review, registry exports, EHR integration, and
// observational research outputs as the evidence layer matures.

export interface ClinicalEvidenceRecord {
  patientId:               string;
  physicianId:             string;
  windowDays:              number;                    // Default: 90 days
  generatedAt:             string;                    // ISO 8601 timestamp
  evidenceGovernance:      EvidenceGovernance;
  evidenceReadiness:       EvidenceReadiness;
  patientSummary:          PatientSummary;
  trajectory:              EvidenceSummary;
  continuity:              EvidenceSummary;
  adherence:               EvidenceSummary;
  physicianSignals:        IntelligenceSignal[];      // Wrapped from PatientIntelligenceSummary.physicianSignals
  overallContinuityStatus: OverallContinuityStatus;
  longitudinalNarrative:   string;                   // Generated by longitudinalSummary.ts
  documentationNotes:      DocumentationNote[];      // From PhysicianReview records in window
  exportMetadata:          ExportMetadata;
}
