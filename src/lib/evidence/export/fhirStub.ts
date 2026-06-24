// MyoGuard generates clinical evidence.
// Physicians generate clinical decisions.
// Exports preserve observations only.
// Never diagnostic. Never predictive.
// Never directive.
// Export outputs must be deterministic.
// No AI generation.

// BUILD 7C — HL7 FHIR R4 export foundation.

import type { ClinicalEvidenceRecord } from '../types';

export function toFHIRBundle(
  _record: ClinicalEvidenceRecord,
): Record<string, unknown> {
  throw new Error('Not implemented — BUILD 7C');
}
