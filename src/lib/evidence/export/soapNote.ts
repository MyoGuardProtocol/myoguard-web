// MyoGuard generates clinical evidence.
// Physicians generate clinical decisions.
// Exports preserve observations only.
// Never diagnostic. Never predictive.
// Never directive.
// Export outputs must be deterministic.
// No AI generation.

import type { ClinicalEvidenceRecord } from '../types';

function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatConfidence(confidence: string): string {
  if (confidence === 'insufficient_data') return 'Insufficient Data';
  const cap = confidence.charAt(0).toUpperCase() + confidence.slice(1);
  return `${cap} Confidence`;
}

export function generateSOAPNote(packet: ClinicalEvidenceRecord): string {
  const {
    patientSummary,
    trajectory,
    continuity,
    adherence,
    physicianSignals,
    documentationNotes,
    evidenceGovernance,
    windowDays,
  } = packet;

  const generatedDate = new Date(evidenceGovernance.generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const lines: string[] = [];

  lines.push('MyoGuard Protocol — SOAP Documentation Note');
  lines.push(`Generated: ${generatedDate} · ${windowDays}-day observation window`);
  lines.push('For physician documentation support only. Not a clinical assessment.');
  lines.push('');

  // ── S — Subjective ──────────────────────────────────────────────────────────
  // Assessment.symptoms[], sleepHours, sleepQuality, recoveryStatus are not present
  // in ClinicalEvidenceRecord (BUILD 7A constraint). Neutral fallback only.
  // Never fabricate patient-reported findings.
  lines.push('S — SUBJECTIVE');
  lines.push('No patient-reported symptom detail is available in this evidence record.');

  const impressionNotes = documentationNotes.filter(n => n.overallImpression).slice(0, 2);
  if (impressionNotes.length > 0) {
    lines.push('');
    lines.push('Physician impression notes on record within the observation window:');
    impressionNotes.forEach(n => {
      const date = new Date(n.noteDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      lines.push(`  ${date}: ${n.overallImpression}`);
    });
  }
  lines.push('');

  // ── O — Objective ────────────────────────────────────────────────────────────
  // weightKg and gripStrengthKg are not present in ClinicalEvidenceRecord —
  // omitted per BUILD 7A constraint. Use only available measured fields.
  lines.push('O — OBJECTIVE');
  lines.push(
    patientSummary.currentBand
      ? `Sarcopenia Risk Index band: ${patientSummary.currentBand}.`
      : 'Sarcopenia Risk Index band: not yet recorded.',
  );
  if (patientSummary.proteinTargetG != null) {
    lines.push(`Protocol protein target: ${patientSummary.proteinTargetG}g/day.`);
  }
  if (patientSummary.glp1Stage) {
    lines.push(`GLP-1 protocol stage: ${patientSummary.glp1Stage}.`);
  }
  lines.push(`Assessment count (${windowDays}-day window): ${patientSummary.assessmentCount}.`);
  lines.push(`Weekly check-in count (continuity window): ${patientSummary.checkinCount}.`);
  lines.push(`Evidence record generated: ${generatedDate}.`);
  lines.push('');

  // ── A — Clinical Observations ────────────────────────────────────────────────
  // Source: IntelligenceSignals already present in ClinicalEvidenceRecord.
  // Never use "Diagnosis" or "Impression" — observational language only.
  lines.push('A — CLINICAL OBSERVATIONS');
  lines.push('(Observational intelligence signals only. Not a diagnosis or clinical assessment.)');
  lines.push('');
  lines.push(
    `Longitudinal trajectory signal: ${formatStatus(trajectory.status)} ` +
    `(${formatConfidence(trajectory.confidence)}).`,
  );
  lines.push(trajectory.observationText);
  lines.push('');
  lines.push(
    `Continuity signal: ${formatStatus(continuity.status)} ` +
    `(${formatConfidence(continuity.confidence)}).`,
  );
  lines.push(continuity.observationText);
  lines.push('');
  lines.push(
    `Adherence signal: ${formatStatus(adherence.status)} ` +
    `(${formatConfidence(adherence.confidence)}).`,
  );
  lines.push(adherence.observationText);

  const primarySignal = physicianSignals[0];
  if (primarySignal) {
    lines.push('');
    lines.push(
      `Physician review signal: ${formatStatus(primarySignal.status)} ` +
      `(${formatConfidence(primarySignal.confidence)}).`,
    );
    lines.push(primarySignal.explanation);
  }
  lines.push('');

  // ── P — Plan ─────────────────────────────────────────────────────────────────
  // Never prescribe treatment. Final clinical decisions belong to the physician.
  lines.push('P — PLAN');
  lines.push('Final clinical decisions remain under physician discretion.');
  if (
    primarySignal &&
    (primarySignal.status === 'review_recommended' ||
      primarySignal.status === 'review_threshold_crossed')
  ) {
    lines.push('Consider review of identified longitudinal signals.');
  }
  lines.push(
    'All care planning and treatment decisions are the sole responsibility of the treating physician.',
  );
  lines.push(
    'This SOAP note was generated by the MyoGuard evidence engine as documentation support only.',
  );
  lines.push('');

  lines.push('---');
  lines.push('MyoGuard Protocol · Physician-led Clinical Decision Support');
  lines.push('© 2026 Meridian Wellness Systems LLC · myoguard.health');

  return lines.join('\n');
}
