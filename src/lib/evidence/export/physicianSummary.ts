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

export function generatePhysicianSummary(packet: ClinicalEvidenceRecord): string {
  const {
    patientSummary,
    trajectory,
    continuity,
    adherence,
    physicianSignals,
    overallContinuityStatus,
    documentationNotes,
    evidenceReadiness,
    evidenceGovernance,
    windowDays,
  } = packet;

  const generatedDate = new Date(evidenceGovernance.generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const sections: string[] = [];

  sections.push('MyoGuard Protocol — Physician Summary');
  sections.push(`Generated: ${generatedDate} · ${windowDays}-day observation window`);
  sections.push('');

  // 1. Patient Overview
  sections.push('1. PATIENT OVERVIEW');
  const overview: string[] = [];
  overview.push(
    patientSummary.currentBand
      ? `The most recent Sarcopenia Risk Index band recorded is ${patientSummary.currentBand}.`
      : 'No Sarcopenia Risk Index band has been recorded within this observation window.',
  );
  if (patientSummary.proteinTargetG != null) {
    overview.push(`Protocol protein target is ${patientSummary.proteinTargetG}g per day.`);
  } else {
    overview.push('No protocol protein target has been assigned.');
  }
  if (patientSummary.glp1Stage) {
    overview.push(`GLP-1 protocol stage recorded as: ${patientSummary.glp1Stage}.`);
  }
  overview.push(
    `${patientSummary.assessmentCount} SRI assessment${patientSummary.assessmentCount !== 1 ? 's' : ''} ` +
    `and ${patientSummary.checkinCount} weekly check-in${patientSummary.checkinCount !== 1 ? 's' : ''} ` +
    `are documented within this evidence window.`,
  );
  sections.push(overview.join(' '));
  sections.push('');

  // 2. Longitudinal Observations
  sections.push('2. LONGITUDINAL OBSERVATIONS');
  const longitudinal: string[] = [];
  longitudinal.push(
    `Band trajectory signal: ${formatStatus(trajectory.status)} (${formatConfidence(trajectory.confidence)}).`,
  );
  longitudinal.push(trajectory.observationText);
  longitudinal.push(
    `This signal is based on ${trajectory.dataPoints} assessment${trajectory.dataPoints !== 1 ? 's' : ''} ` +
    `within a ${trajectory.windowDays}-day trajectory window.`,
  );
  sections.push(longitudinal.join(' '));
  sections.push('');

  // 3. Continuity Signals
  sections.push('3. CONTINUITY SIGNALS');
  const continuityParts: string[] = [];
  continuityParts.push(
    `Continuity: ${formatStatus(continuity.status)} (${formatConfidence(continuity.confidence)}).`,
  );
  continuityParts.push(continuity.observationText);
  continuityParts.push(
    `Adherence: ${formatStatus(adherence.status)} (${formatConfidence(adherence.confidence)}).`,
  );
  continuityParts.push(adherence.observationText);
  continuityParts.push(`Overall continuity status: ${formatStatus(String(overallContinuityStatus))}.`);
  sections.push(continuityParts.join(' '));
  sections.push('');

  // 4. Review Signals
  sections.push('4. REVIEW SIGNALS');
  const primarySignal = physicianSignals[0];
  if (primarySignal) {
    sections.push(
      `Physician signal: ${formatStatus(primarySignal.status)} (${formatConfidence(primarySignal.confidence)}). ` +
      primarySignal.explanation,
    );
  } else {
    sections.push('No physician review signals were identified within this observation window.');
  }
  sections.push('');

  // 5. Documentation Timeline (prose narrative)
  sections.push('5. DOCUMENTATION TIMELINE');
  const timelineProse: string[] = [];
  timelineProse.push(
    `Evidence record documentation maturity is ${evidenceReadiness.status}, ` +
    `based on ${evidenceReadiness.assessmentCount} assessment${evidenceReadiness.assessmentCount !== 1 ? 's' : ''} ` +
    `and ${evidenceReadiness.checkinCount} check-in${evidenceReadiness.checkinCount !== 1 ? 's' : ''}.`,
  );
  if (documentationNotes.length > 0) {
    const mostRecent = new Date(documentationNotes[0].noteDate).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    timelineProse.push(
      `${documentationNotes.length} physician review${documentationNotes.length !== 1 ? 's are' : ' is'} ` +
      `documented within this window, most recently on ${mostRecent}.`,
    );
    if (documentationNotes.some(n => n.overallImpression)) {
      timelineProse.push('Physician review impression notes are available in the full evidence record.');
    }
  } else {
    timelineProse.push(
      'No physician review documentation has been recorded within this observation window.',
    );
  }
  sections.push(timelineProse.join(' '));
  sections.push('');

  sections.push('---');
  sections.push('MyoGuard Protocol · Physician-led Clinical Decision Support');
  sections.push('All clinical observations are generated by the MyoGuard evidence engine and are observational only.');
  sections.push('Clinical interpretation and all clinical decisions remain with the treating physician.');
  sections.push('© 2026 Meridian Wellness Systems LLC · myoguard.health');

  return sections.join('\n');
}
