// MyoGuard generates clinical evidence.
// Physicians generate clinical decisions.
// Exports preserve observations only.
// Never diagnostic. Never predictive.
// Never directive.
// Export outputs must be deterministic.
// No AI generation.

import type { DocumentationNote } from '../types';

// Maps internal event categories to display labels.
// Only physician_review entries are present in DocumentationNote[].
// Additional category labels are defined for future build compatibility.
const CATEGORY_LABELS: Record<string, string> = {
  assessment:       'SRI Assessment',
  checkin:          'Weekly Check-in',
  physician_review: 'Physician Review',
  protocol:         'Protocol Update',
};

/**
 * generateTimelineSummary()
 *
 * Generates a structured chronological summary from physician review
 * documentation entries. Entries are ordered newest first.
 *
 * Data source: DocumentationNote[] from ClinicalEvidenceRecord.documentationNotes.
 * No Prisma access. No AI generation. Deterministic output only.
 */
export function generateTimelineSummary(notes: DocumentationNote[]): string {
  const lines: string[] = [];

  lines.push('MyoGuard Protocol — Documentation Timeline');
  lines.push('Chronological evidence record. Newest entries first.');
  lines.push('');

  if (notes.length === 0) {
    lines.push('No physician review documentation recorded within this observation window.');
  } else {
    // Sort newest first, then format each entry
    const sorted = [...notes].sort(
      (a, b) => new Date(b.noteDate).getTime() - new Date(a.noteDate).getTime(),
    );

    sorted.forEach(note => {
      const date = new Date(note.noteDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      const categoryLabel = CATEGORY_LABELS['physician_review'];
      const observationText = note.overallImpression
        ? `Review documented — impression: ${note.overallImpression}`
        : 'Physician review documented.';

      lines.push(`${date}  ${categoryLabel} — ${observationText}`);

      if (note.followUpDays != null) {
        lines.push(`  Follow-up: ${note.followUpDays} day${note.followUpDays !== 1 ? 's' : ''}.`);
      }
    });
  }

  lines.push('');
  lines.push(
    'Note: Individual SRI assessment and weekly check-in event dates are not included ' +
    'in this evidence record export. Physician review entries are shown with full dates.',
  );
  lines.push('');

  lines.push('---');
  lines.push('MyoGuard Protocol · Physician-led Clinical Decision Support');
  lines.push('© 2026 Meridian Wellness Systems LLC · myoguard.health');

  return lines.join('\n');
}
