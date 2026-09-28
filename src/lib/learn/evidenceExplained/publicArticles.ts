/**
 * src/lib/learn/evidenceExplained/publicArticles.ts
 *
 * Evidence Explained — the ONE public-exposure selector.
 *
 * Every public surface asks this module and nothing else: the article route
 * and its metadata, the sitemap, the /learn discovery section, the CCC
 * "Patient explainer available" link and article analytics. None of them
 * imports the manuscript registry, a manuscript module or the governance
 * functions directly, so there is no second path to a manuscript to keep in
 * step. scripts/evidenceExplainedPublicRoute.test.mjs enforces that.
 *
 * WHAT MAKES AN ARTICLE PUBLIC
 * `publicArticleBlockers` is empty only when:
 *   - the requested slug is well-formed kebab-case and matches, exactly and
 *     uniquely, one manuscript's internalWorkingSlug and one register entry's
 *     explainerSlug, and the manuscript links to that same entry;
 *   - `manuscriptPublicationBlockers` is empty: a valid APPROVED manuscript, a
 *     valid PUBLISHED public-visibility register entry with a complete Founder
 *     decision, a matching explainerSlug, a valid past-or-present publishedAt,
 *     a verified and classified source, both reviews current, a safe source
 *     link, and the route capability enabled.
 * Anything else is refused, and a refusal carries no reason to the caller:
 * `resolvePublicArticle` returns null and the route answers with the ordinary
 * 404. Blocker text exists for tests only.
 *
 * WHAT A PUBLIC ARTICLE CARRIES
 * `PublicArticle` is a whitelist. Manuscript and evidence ids, the Founder
 * decision and its rationale, the public-interest rationale, the MyoGuard
 * implication, source facts and every other governance field are never
 * copied, so no page can render them by accident.
 *
 * SERVER ONLY
 * This module reads every manuscript, including unpublished drafts. The
 * `server-only` import makes the build fail if a client component ever
 * imports it, so draft text cannot reach a browser bundle through it.
 */

import 'server-only';
import type { Metadata } from 'next';
import {
  EVIDENCE_REGISTER,
  EVIDENCE_QUALITY_LABELS,
  type EvidenceRegisterEntry,
  type IsoDate,
  type RegisterEvidenceType,
} from '@/src/data/evidenceRegister';
import {
  PUBLIC_ROUTE_IMPLEMENTED,
  manuscriptPublicationBlockers,
  primarySourceHref,
  type EvidenceExplainedManuscript,
  type ManuscriptBlock,
  type SectionId,
} from './manuscriptGovernance';
import { EVIDENCE_EXPLAINED_MANUSCRIPTS } from './registry';
import {
  PUBLIC_REVIEWERS,
  PUBLIC_REVIEW_ASSIGNMENTS,
  publicReviewerBlockers,
  resolvePublicReviewer,
  type PublicReviewer,
} from './publicReviewers';

// ── Context ────────────────────────────────────────────────────────────────────

/** What the selector judges against. Production uses `productionContext()`; tests pass synthetic data. */
export interface PublicArticleContext {
  readonly manuscripts: readonly unknown[];
  readonly register: readonly EvidenceRegisterEntry[];
  readonly today: IsoDate;
  readonly routeEnabled: boolean;
  /** The controlled public-reviewer records. Empty means no article can be exposed. */
  readonly reviewers: readonly unknown[];
  readonly reviewAssignments: readonly unknown[];
}

/** Today's date in UTC — the review clock. */
export function utcToday(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

export function productionContext(): PublicArticleContext {
  return {
    manuscripts: EVIDENCE_EXPLAINED_MANUSCRIPTS,
    register: EVIDENCE_REGISTER,
    today: utcToday(),
    routeEnabled: PUBLIC_ROUTE_IMPLEMENTED,
    reviewers: PUBLIC_REVIEWERS,
    reviewAssignments: PUBLIC_REVIEW_ASSIGNMENTS,
  };
}

// ── Paths ──────────────────────────────────────────────────────────────────────

export const ARTICLE_BASE_PATH = '/learn/evidence';
export const SITE_ORIGIN = 'https://myoguard.health';

/** A well-formed article slug: lower-case kebab-case, 3–100 characters. */
export const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 100;

export const articlePath = (slug: string) => `${ARTICLE_BASE_PATH}/${slug}`;

// ── The selector ───────────────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every reason `slug` may not be served. Empty means the article is publicly exposable. */
export function publicArticleBlockers(slug: unknown, ctx: PublicArticleContext = productionContext()): string[] {
  if (typeof slug !== 'string' || slug.length < 3 || slug.length > MAX_SLUG_LENGTH || !ARTICLE_SLUG_PATTERN.test(slug)) {
    return ['malformed slug'];
  }
  const manuscripts = ctx.manuscripts.filter(m => isRecord(m) && m.internalWorkingSlug === slug);
  const entries = ctx.register.filter(e => e.explainerSlug === slug);
  if (manuscripts.length !== 1) return [`${manuscripts.length} manuscripts use this slug`];
  if (entries.length !== 1) return [`${entries.length} evidence entries name this slug`];
  const m = manuscripts[0] as Record<string, unknown>;
  const b: string[] = [];
  if (m.linkedEvidenceId !== entries[0].id) b.push('the manuscript and the evidence entry do not link to each other');
  b.push(...manuscriptPublicationBlockers(m, ctx.register, ctx.today, ctx.routeEnabled));
  // A public article carries a named reviewer with approved credentials. No
  // configured, active reviewer for this manuscript version means no article.
  b.push(...publicReviewerBlockers(
    { manuscriptId: m.manuscriptId, version: m.version, reviewedBy: m.reviewedBy },
    ctx.reviewers, ctx.reviewAssignments, ctx.today,
  ).map(x => `public reviewer: ${x}`));
  return b;
}

// ── The public display model ───────────────────────────────────────────────────

export interface PublicArticleSection {
  readonly id: SectionId;
  readonly heading: string;
  readonly blocks: readonly ManuscriptBlock[];
}

export interface PublicArticleSource {
  readonly citation: string;
  readonly href: string;
  /** Which identifier the link resolves: "DOI", "PubMed" or "Source". */
  readonly kind: 'DOI' | 'PubMed' | 'Source';
  /** Accessible name for the link, including that it opens in a new tab. */
  readonly linkLabel: string;
}

export interface PublicArticle {
  readonly slug: string;
  readonly path: string;
  readonly canonicalUrl: string;
  readonly headline: string;
  readonly standfirst: string;
  /** The named public reviewer: display name, approved credentials, approved title. Never an internal role. */
  readonly reviewer: PublicReviewer;
  readonly publishedAt: IsoDate;
  readonly publishedLabel: string;
  readonly lastReviewedAt: IsoDate;
  readonly lastReviewedLabel: string;
  /** The later of publication and the manuscript's last review. */
  readonly dateModified: IsoDate;
  /** e.g. "Observational study · Low certainty". */
  readonly evidenceLabel: string;
  /** The ten governed sections, in order. */
  readonly sections: readonly PublicArticleSection[];
  readonly source: PublicArticleSource;
  readonly educationalDisclaimer: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-09-27" → "27 September 2026". Deterministic: no locale, no timezone. */
export function longDate(iso: IsoDate): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const EVIDENCE_TYPE_LABELS: Readonly<Record<Exclude<RegisterEvidenceType, 'PENDING_CLASSIFICATION'>, string>> = {
  RCT: 'Randomised controlled trial',
  'Meta-Analysis': 'Meta-analysis',
  Observational: 'Observational study',
  Guideline: 'Clinical guideline',
  Consensus: 'Consensus statement',
  Review: 'Review',
};

function sourceKind(href: string): PublicArticleSource['kind'] {
  if (href.startsWith('https://doi.org/')) return 'DOI';
  if (href.startsWith('https://pubmed.ncbi.nlm.nih.gov/')) return 'PubMed';
  return 'Source';
}

/**
 * The public article for `slug`, or null. Null is the only answer a refused
 * request gets — no reason, no partial data.
 */
export function resolvePublicArticle(slug: unknown, ctx: PublicArticleContext = productionContext()): PublicArticle | null {
  if (publicArticleBlockers(slug, ctx).length > 0) return null;
  const m = ctx.manuscripts.find(x => isRecord(x) && x.internalWorkingSlug === slug) as EvidenceExplainedManuscript;
  const e = ctx.register.find(x => x.explainerSlug === slug) as EvidenceRegisterEntry;
  const href = primarySourceHref(m);
  const reviewer = resolvePublicReviewer(m, ctx.reviewers, ctx.reviewAssignments, ctx.today);
  // Guaranteed by the blockers; re-checked so the types need no assertion.
  if (href === null || reviewer === null || e.publishedAt === null || e.evidenceType === 'PENDING_CLASSIFICATION') return null;
  const kind = sourceKind(href);
  const citation = m.sourceReferences[0].citation;
  const kindText = kind === 'DOI' ? 'via its DOI' : kind === 'PubMed' ? 'on PubMed' : 'at its publisher';
  return {
    slug: m.internalWorkingSlug,
    path: articlePath(m.internalWorkingSlug),
    canonicalUrl: SITE_ORIGIN + articlePath(m.internalWorkingSlug),
    headline: m.headline,
    standfirst: m.standfirst,
    reviewer,
    publishedAt: e.publishedAt,
    publishedLabel: longDate(e.publishedAt),
    lastReviewedAt: m.lastReviewedAt,
    lastReviewedLabel: longDate(m.lastReviewedAt),
    dateModified: m.lastReviewedAt > e.publishedAt ? m.lastReviewedAt : e.publishedAt,
    evidenceLabel: `${EVIDENCE_TYPE_LABELS[e.evidenceType]} · ${EVIDENCE_QUALITY_LABELS[e.evidenceQuality]}`,
    sections: m.sections.map(s => ({ id: s.id, heading: s.heading, blocks: s.blocks })),
    source: { citation, href, kind, linkLabel: `Read the source publication ${kindText} (opens in a new tab)` },
    educationalDisclaimer: m.educationalDisclaimer,
  };
}

/** Every publicly exposable article, ordered newest first, then by slug. */
export function listPublicArticles(ctx: PublicArticleContext = productionContext()): PublicArticle[] {
  const slugs = new Set(ctx.manuscripts.flatMap(m => (isRecord(m) && typeof m.internalWorkingSlug === 'string' ? [m.internalWorkingSlug] : [])));
  return [...slugs]
    .map(s => resolvePublicArticle(s, ctx))
    .filter((a): a is PublicArticle => a !== null)
    .sort((a, b) => (a.publishedAt !== b.publishedAt ? (a.publishedAt > b.publishedAt ? -1 : 1) : a.slug < b.slug ? -1 : 1));
}

/** The public article path for a register entry, or null — the CCC's link. */
export function publicArticlePathForEvidence(evidenceId: string, ctx: PublicArticleContext = productionContext()): string | null {
  const e = ctx.register.find(x => x.id === evidenceId);
  if (!e || e.explainerSlug === null) return null;
  const a = resolvePublicArticle(e.explainerSlug, ctx);
  return a ? a.path : null;
}

/** Whether a path may carry article analytics: only a publicly exposable article's own path. */
export function isArticleAnalyticsEligible(path: string, ctx: PublicArticleContext = productionContext()): boolean {
  if (!path.startsWith(ARTICLE_BASE_PATH + '/')) return false;
  const a = resolvePublicArticle(path.slice(ARTICLE_BASE_PATH.length + 1), ctx);
  return a !== null && a.path === path;
}

// ── Metadata, structured data and sitemap ──────────────────────────────────────

const PUBLISHER = {
  '@type': 'Organization',
  name: 'MyoGuard Protocol',
  legalName: 'Meridian Wellness Systems LLC',
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/icon.svg`,
} as const;

/** Page metadata for an exposable article. Refused requests never reach this. */
export function articleMetadata(a: PublicArticle): Metadata {
  return {
    title: a.headline,
    description: a.standfirst,
    alternates: { canonical: a.canonicalUrl },
    openGraph: {
      type: 'article',
      title: a.headline,
      description: a.standfirst,
      url: a.canonicalUrl,
      siteName: 'MyoGuard Protocol',
      publishedTime: a.publishedAt,
      modifiedTime: a.dateModified,
    },
    twitter: { card: 'summary_large_image', title: a.headline, description: a.standfirst },
  };
}

/**
 * MedicalWebPage JSON-LD built only from recorded fields. `reviewedBy` carries
 * the controlled public reviewer record — a named person with approved
 * credentials — never the internal governance role, and never an invented
 * name, credential or affiliation.
 */
export function articleJsonLd(a: PublicArticle): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    headline: a.headline,
    name: a.headline,
    description: a.standfirst,
    url: a.canonicalUrl,
    mainEntityOfPage: a.canonicalUrl,
    inLanguage: 'en',
    datePublished: a.publishedAt,
    dateModified: a.dateModified,
    lastReviewed: a.lastReviewedAt,
    reviewedBy: {
      '@type': 'Person',
      // The name alone; the honorific and title are separate controlled fields,
      // and no postnominal is emitted unless a record carries an approved one.
      name: a.reviewer.name,
      ...(a.reviewer.honorific !== null ? { honorificPrefix: a.reviewer.honorific } : {}),
      ...(a.reviewer.credentials.length > 0 ? { honorificSuffix: a.reviewer.credentials.join(', ') } : {}),
      ...(a.reviewer.title !== null ? { jobTitle: a.reviewer.title } : {}),
    },
    audience: { '@type': 'PeopleAudience', audienceType: 'Patients and the public' },
    publisher: PUBLISHER,
    citation: { '@type': 'CreativeWork', name: a.source.citation, url: a.source.href },
    isPartOf: { '@type': 'WebSite', name: 'MyoGuard Protocol', url: SITE_ORIGIN },
  };
}

export interface ArticleSitemapEntry {
  readonly url: string;
  readonly lastModified: Date;
  readonly changeFrequency: 'monthly';
  readonly priority: number;
}

/** Sitemap entries — publicly exposable articles only. */
export function publicArticleSitemapEntries(ctx: PublicArticleContext = productionContext()): ArticleSitemapEntry[] {
  return listPublicArticles(ctx).map(a => ({
    url: a.canonicalUrl,
    lastModified: new Date(`${a.dateModified}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));
}

/** The minimum /learn needs to list an article: nothing beyond what the article itself shows. */
export interface PublicArticleCard {
  readonly path: string;
  readonly headline: string;
  readonly standfirst: string;
  readonly publishedLabel: string;
}

export function publicArticleCards(ctx: PublicArticleContext = productionContext()): PublicArticleCard[] {
  return listPublicArticles(ctx).map(a => ({ path: a.path, headline: a.headline, standfirst: a.standfirst, publishedLabel: a.publishedLabel }));
}
