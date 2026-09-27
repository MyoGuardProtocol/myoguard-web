/**
 * src/lib/practiceUpdates/clinicalPracticeUpdates.ts
 *
 * CCC Clinical Practice Updates — the physician view of the Evidence Register.
 *
 * WHAT THIS DOES
 * Selects the Evidence Register entries a physician may see (`isCCCVisible`),
 * orders them, and projects each into a display model holding only the fields
 * the CCC renders. The projection is a whitelist: the Founder decision
 * rationale, the public-interest rationale and anything else not named below
 * are never copied, so no component downstream can render them by accident.
 *
 * FAIL-CLOSED
 * An entry that is not CCC-visible, or whose `sourceCitationId` does not resolve
 * to the Clinical Evidence Library, is dropped — never shown half-formed.
 *
 * WHAT THIS IS NOT
 * It reads published literature and editorial decisions only. It never touches
 * patient data, the Clinical Evidence Engine (`src/lib/evidence/`), the
 * Sarcopenia Risk Index (SRI) or any Clinical Decision Support (CDS) logic.
 *
 * Read-only. No Prisma, no network, no mutation.
 */

import {
  EVIDENCE_REGISTER,
  EVIDENCE_QUALITY_LABELS,
  PERSISTENCE_THEME_LABELS,
  PRACTICE_CLASSIFICATION_LABELS,
  PRACTICE_CLASSIFICATION_ORDER,
  hasPatientExplainer,
  isCCCVisible,
  sourceHref,
  type EvidenceRegisterEntry,
  type PracticeClassification,
} from '@/src/data/evidenceRegister';
import { CITATIONS, type Citation } from '@/src/data/citations';
import { publicArticlePathForEvidence } from '@/src/lib/learn/evidenceExplained/publicArticles';

export type ExplainerStatus = 'Patient explainer available' | 'Clinical note only';

/**
 * The public Evidence Explained path for an entry, or null. Production asks the
 * central public-exposure selector; tests pass their own.
 */
export type ExplainerPathResolver = (evidenceId: string) => string | null;

export interface PracticeUpdateSource {
  /** Human-readable citation. */
  readonly label: string;
  /** DOI, PubMed or canonical-URL link, in that priority, when one exists. */
  readonly href: string | null;
}

export interface ClinicalPracticeUpdate {
  readonly id: string;
  readonly title: string;
  readonly evidenceTypeLabel: string;
  readonly evidenceQualityLabel: string;
  readonly practiceClassification: PracticeClassification;
  readonly practiceClassificationLabel: string;
  readonly clinicalRelevance: string;
  readonly limitations: readonly string[];
  /** Rendered under the label "Product consideration only". */
  readonly productConsideration: string;
  readonly persistenceThemeLabels: readonly string[];
  readonly source: PracticeUpdateSource;
  /** ISO dates, with display forms. */
  readonly lastReviewedAt: string;
  readonly lastReviewedLabel: string;
  readonly reviewDueAt: string;
  readonly reviewDueLabel: string;
  readonly explainerStatus: ExplainerStatus;
  /**
   * The public article, only when the central selector says it is publicly
   * exposable right now. Null means "Clinical note only" and no link.
   */
  readonly explainerHref: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-20" → "20 Sep 2026". Deterministic: no locale, no timezone. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Link priority: DOI, then PMID, then the source's canonical URL — defined once
 * in the Evidence Register and shared with Evidence Explained. The canonical URL
 * has already passed `canonicalUrlProblems` as a condition of register validity.
 */
export { sourceHref };

function citationLabel(c: Citation): string {
  const authors = c.authors.length > 3 ? `${c.authors[0]} et al.` : c.authors.join(', ') + '.';
  return `${authors} ${c.title}. ${c.journal}. ${c.year}.`;
}

function resolveSource(e: EvidenceRegisterEntry, citations: readonly Citation[]): PracticeUpdateSource | null {
  if (e.sourceCitationId !== null) {
    const c = citations.find(x => x.id === e.sourceCitationId);
    return c ? { label: citationLabel(c), href: sourceHref(c.doi, c.pmid, null) } : null;
  }
  const s = e.externalSource;
  return { label: s.description, href: sourceHref(s.doi, s.pmid, s.canonicalUrl) };
}

/** Display order: practice-classification priority, then most recently reviewed, then id. */
export function comparePracticeUpdates(a: ClinicalPracticeUpdate, b: ClinicalPracticeUpdate): number {
  const p = PRACTICE_CLASSIFICATION_ORDER.indexOf(a.practiceClassification)
          - PRACTICE_CLASSIFICATION_ORDER.indexOf(b.practiceClassification);
  if (p !== 0) return p;
  if (a.lastReviewedAt !== b.lastReviewedAt) return a.lastReviewedAt > b.lastReviewedAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The CCC-visible entries of `entries`, projected and ordered. Accepts
 * `unknown` entries so malformed records are dropped rather than trusted.
 */
export function buildClinicalPracticeUpdates(
  entries: readonly unknown[],
  citations: readonly Citation[] = CITATIONS,
  explainerPathFor: ExplainerPathResolver = id => publicArticlePathForEvidence(id),
): ClinicalPracticeUpdate[] {
  const out: ClinicalPracticeUpdate[] = [];
  for (const raw of entries) {
    if (!isCCCVisible(raw)) continue;
    const e = raw as EvidenceRegisterEntry;
    const source = resolveSource(e, citations);
    // isCCCVisible guarantees both review dates; re-checked so the types need no assertion.
    if (!source || e.lastReviewedAt === null || e.reviewDueAt === null) continue;
    // A link needs both: the register's own public conditions and a publicly
    // exposable article from the central selector. Either alone is not enough.
    const explainerHref = hasPatientExplainer(e) ? explainerPathFor(e.id) : null;
    out.push({
      id: e.id,
      title: e.title,
      evidenceTypeLabel: e.evidenceType,
      evidenceQualityLabel: EVIDENCE_QUALITY_LABELS[e.evidenceQuality],
      practiceClassification: e.practiceClassification,
      practiceClassificationLabel: PRACTICE_CLASSIFICATION_LABELS[e.practiceClassification],
      clinicalRelevance: e.clinicalRelevance,
      limitations: [...e.limitations],
      productConsideration: e.myoguardImplication.text,
      persistenceThemeLabels: e.persistenceThemes.map(t => PERSISTENCE_THEME_LABELS[t]),
      source,
      lastReviewedAt: e.lastReviewedAt,
      lastReviewedLabel: formatIsoDate(e.lastReviewedAt),
      reviewDueAt: e.reviewDueAt,
      reviewDueLabel: formatIsoDate(e.reviewDueAt),
      explainerStatus: explainerHref ? 'Patient explainer available' : 'Clinical note only',
      explainerHref,
    });
  }
  return out.sort(comparePracticeUpdates);
}

/** The production Clinical Practice Updates, from the shipped Evidence Register. */
export function getClinicalPracticeUpdates(): ClinicalPracticeUpdate[] {
  return buildClinicalPracticeUpdates(EVIDENCE_REGISTER);
}
