/**
 * src/components/learn/EvidenceExplainedDiscovery.tsx
 *
 * The Evidence Explained section of /learn. Renders nothing at all unless the
 * central selector has at least one publicly exposable article, so /learn is
 * unchanged — markup and text — until an article is published. Presentation
 * only: it receives cards and reads nothing.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { PublicArticleCard } from '@/src/lib/learn/evidenceExplained/publicArticles';

const LABEL: CSSProperties = {
  fontSize: '10px', fontWeight: 700, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 10px 0',
};
const CARD: CSSProperties = {
  background: '#0D1421', border: '1px solid #1A2744', borderRadius: '16px', padding: '24px 28px', display: 'block', textDecoration: 'none',
};

export default function EvidenceExplainedDiscovery({ articles }: { articles: readonly PublicArticleCard[] }) {
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby="evidence-explained-heading" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 id="evidence-explained-heading" style={{ ...LABEL, margin: 0 }}>Evidence Explained</h2>
      {articles.map(a => (
        <Link key={a.path} href={a.path} style={CARD}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px 0', lineHeight: 1.3 }}>
            {a.headline}
          </h3>
          <p style={{ fontSize: '0.9375rem', color: '#94A3B8', lineHeight: 1.8, margin: '0 0 10px 0' }}>{a.standfirst}</p>
          <p style={{ fontSize: '0.8125rem', color: '#94A3B8', margin: 0 }}>Published {a.publishedLabel} · Read the explainer →</p>
        </Link>
      ))}
    </section>
  );
}
