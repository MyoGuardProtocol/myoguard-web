/**
 * app/learn/evidence/[slug]/page.tsx
 *
 * Evidence Explained — the one public article route.
 *
 * GOVERNED BY ONE SELECTOR
 * The page and its metadata both ask `resolvePublicArticle`, the central
 * public-exposure selector (src/lib/learn/evidenceExplained/publicArticles.ts).
 * Anything it refuses — unknown or malformed slug, a draft or unapproved
 * manuscript, evidence that is not PUBLISHED, an overdue review, any
 * disagreement between manuscript and register — gets the ordinary site 404
 * from `notFound()`, with the site's default metadata and nothing about the
 * article: no title, description, Open Graph data, JSON-LD or analytics event.
 * The route existing is not publication authority.
 *
 * RENDERED PER REQUEST
 * `force-dynamic`, and no `generateStaticParams`: the selector runs on every
 * request with today's date, so an article whose review falls due stops being
 * served that day without a deploy, and the build never pre-renders article
 * HTML. There is no index page, query-string route or id-based route.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EvidenceArticle from '@/src/components/learn/EvidenceArticle';
import AnalyticsMount from '@/src/components/analytics/AnalyticsMount';
import { AnalyticsEvents } from '@/src/lib/posthog';
import {
  articleJsonLd,
  articleMetadata,
  resolvePublicArticle,
} from '@/src/lib/learn/evidenceExplained/publicArticles';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = resolvePublicArticle((await params).slug);
  if (!article) notFound();
  return articleMetadata(article);
}

export default async function EvidenceExplainedArticlePage({ params }: Props) {
  const article = resolvePublicArticle((await params).slug);
  if (!article) notFound();

  return (
    <main style={{ background: '#080C14', minHeight: '100vh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(article)).replace(/</g, '\\u003c') }}
      />
      {/* Fires only here, after the selector has accepted the article, so a
          refused or 404 request can never produce an article view. */}
      <AnalyticsMount event={AnalyticsEvents.EVIDENCE_ARTICLE_VIEWED} properties={{ article: article.slug }} />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 20px 80px' }}>
        <EvidenceArticle article={article} />
      </div>
    </main>
  );
}
