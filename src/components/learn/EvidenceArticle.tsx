/**
 * src/components/learn/EvidenceArticle.tsx
 *
 * The Evidence Explained article, in Midnight Silk.
 *
 * Presentation only. It receives a `PublicArticle` — the whitelisted display
 * model the central selector builds for a publicly exposable article — and
 * reads nothing else: no registry, no manuscript module, no network. It
 * cannot be handed a draft, because the selector never produces one.
 *
 * The ten governed sections render in the manuscript's order with its exact
 * headings; the Sources section adds the safest source link and the evidence
 * classification. Nothing here adds clinical wording of its own.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { PublicArticle, PublicArticleSection } from '@/src/lib/learn/evidenceExplained/publicArticles';

// ── Midnight Silk tokens ───────────────────────────────────────────────────────

const TEXT = '#F1F5F9';
const BODY = '#CBD5E1';
const MUTED = '#94A3B8';
const ACCENT = '#2DD4BF';
const BORDER = '#1A2744';
const CARD = '#0D1421';

const LABEL: CSSProperties = {
  fontSize: '0.75rem', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 10px 0',
};
const CRUMB: CSSProperties = { fontSize: '0.8125rem', color: MUTED, textDecoration: 'none', letterSpacing: '0.01em' };
const H2: CSSProperties = {
  fontFamily: 'Georgia, serif', fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', fontWeight: 700, color: TEXT, lineHeight: 1.3, margin: '0 0 14px 0',
};
const P: CSSProperties = { fontSize: '1.0625rem', color: BODY, lineHeight: 1.8, margin: '0 0 14px 0', overflowWrap: 'anywhere' };
const UL: CSSProperties = { ...P, listStyle: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '6px' };
const META_TERM: CSSProperties = { fontSize: '0.75rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 };
const META_VALUE: CSSProperties = { fontSize: '0.9375rem', color: TEXT, margin: '2px 0 0 0' };

/** Visible keyboard focus for every link in the article; inline styles cannot express :focus-visible. */
const FOCUS_CSS = `.mg-evidence-article a:focus-visible{outline:2px solid ${ACCENT};outline-offset:3px;border-radius:2px}`;

function Blocks({ section }: { section: PublicArticleSection }) {
  return (
    <>
      {section.blocks.map((b, i) =>
        b.k === 'ul' ? (
          <ul key={i} style={UL}>
            {b.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        ) : (
          <p key={i} style={P}>{b.text}</p>
        ),
      )}
    </>
  );
}

export default function EvidenceArticle({ article }: { article: PublicArticle }) {
  return (
    <article className="mg-evidence-article" aria-labelledby="evidence-article-title">
      <style>{FOCUS_CSS}</style>

      <nav aria-label="Breadcrumb" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
        <Link href="/" style={CRUMB}>← MyoGuard Home</Link>
        <span aria-hidden="true" style={{ ...CRUMB, color: '#334155' }}>·</span>
        <Link href="/learn" style={CRUMB}>Patient Education</Link>
      </nav>

      <header style={{ marginBottom: '40px' }}>
        <p style={LABEL}>Evidence Explained</p>
        <h1
          id="evidence-article-title"
          style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 700, color: TEXT, lineHeight: 1.2, margin: '0 0 20px 0', overflowWrap: 'anywhere' }}
        >
          {article.headline}
        </h1>
        <p style={{ fontSize: '1.125rem', color: MUTED, lineHeight: 1.75, margin: '0 0 28px 0', maxWidth: '680px' }}>
          {article.standfirst}
        </p>
        <dl
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', margin: 0, padding: '18px 20px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}
        >
          <div>
            <dt style={META_TERM}>Clinically reviewed by</dt>
            <dd style={META_VALUE}>
              {article.reviewer.byline}
              {article.reviewer.title !== null && (
                <span style={{ display: 'block', fontSize: '0.8125rem', color: MUTED, marginTop: '2px' }}>{article.reviewer.title}</span>
              )}
            </dd>
          </div>
          <div><dt style={META_TERM}>Published</dt><dd style={META_VALUE}><time dateTime={article.publishedAt}>{article.publishedLabel}</time></dd></div>
          <div><dt style={META_TERM}>Last reviewed</dt><dd style={META_VALUE}><time dateTime={article.lastReviewedAt}>{article.lastReviewedLabel}</time></dd></div>
        </dl>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
        {article.sections.map(s => (
          <section key={s.id} aria-labelledby={`section-${s.id}`} style={s.id === 'educational-disclaimer' ? { padding: '20px 22px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' } : undefined}>
            <h2 id={`section-${s.id}`} style={H2}>{s.heading}</h2>
            <Blocks section={s} />
            {s.id === 'sources' && (
              <>
                <p style={{ ...P, fontSize: '1rem', color: MUTED }}>Evidence: {article.evidenceLabel}</p>
                <p style={{ ...P, margin: 0 }}>
                  <a
                    href={article.source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={article.source.linkLabel}
                    style={{ color: ACCENT, textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    Read the source publication ({article.source.kind}) ↗
                  </a>
                </p>
              </>
            )}
          </section>
        ))}
      </div>

      <footer style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '28px', marginTop: '48px' }}>
        <p style={{ fontSize: '0.75rem', color: MUTED, lineHeight: 1.8, margin: '0 0 6px 0', textAlign: 'center' }}>
          MyoGuard Protocol &middot; Physician-led Clinical Decision Support
        </p>
        <p style={{ fontSize: '0.75rem', color: MUTED, lineHeight: 1.8, margin: '0 0 6px 0', textAlign: 'center' }}>
          &copy; 2026 Meridian Wellness Systems LLC &middot; myoguard.health
        </p>
        <p style={{ fontSize: '0.75rem', color: MUTED, lineHeight: 1.8, margin: 0, textAlign: 'center' }}>
          Built for the global GLP-1 prescribing community
        </p>
      </footer>
    </article>
  );
}
