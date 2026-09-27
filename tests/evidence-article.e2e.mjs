/**
 * Evidence Explained article — responsive and accessibility checks
 * =================================================================
 * Run after a build (it uses the built site CSS):
 *   npm run build
 *   npm run test:evidence-article
 *
 * Renders the REAL article renderer (src/components/learn/EvidenceArticle.tsx),
 * wrapped exactly as app/learn/evidence/[slug]/page.tsx wraps it and followed
 * by the site footer from the root layout, with a SYNTHETIC published article
 * built by the real central selector. The real pilot is never rendered: it is
 * DRAFT, and the selector refuses it. The page is loaded into Chrome with the
 * site's built CSS and checked at desktop, 390px, iPhone 13, Galaxy S9+ and
 * 320px for overflow, contrast, type size, heading order, landmarks, keyboard
 * focus, link labelling and fixed overlays.
 */

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createElement } from 'react';
import ReactDOMServer from 'react-dom/server';
import { chromium, devices } from 'playwright-core';
import { EVIDENCE_REGISTER } from '../src/data/evidenceRegister.ts';
import { TREATMENT_TRANSITION_PILOT as PILOT } from '../src/lib/learn/evidenceExplained/manuscripts/treatmentTransitionPilot.ts';
import { resolvePublicArticle } from '../src/lib/learn/evidenceExplained/publicArticles.ts';
import EvidenceArticle from '../src/components/learn/EvidenceArticle.tsx';
import Footer from '../src/components/ui/Footer.tsx';

let pass = 0, fail = 0;
const t = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name + (detail ? `  → ${detail}` : '')); }
};

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHOTS = process.env.SHOTS_DIR ?? join(tmpdir(), 'evidence-article-shots');
mkdirSync(SHOTS, { recursive: true });

// ── Synthetic published article (same construction as the Step 4A suite) ────
const SEED = EVIDENCE_REGISTER.find(e => e.id === PILOT.linkedEvidenceId);
const SLUG = 'synthetic-transition-article';
const swap = s => s.split('10.1111/dom.70660').join('10.5555/synthetic.0001').split('41816857').join('99999991').split('Gasoyan').join('Fixture');
const evidence = {
  ...JSON.parse(swap(JSON.stringify(SEED))), id: 'ev-synthetic-published', status: 'PUBLISHED',
  decision: { by: 'FOUNDER', at: '2026-09-20', rationale: 'Synthetic.' }, publicInterestRationale: 'Synthetic.',
  explainerSlug: SLUG, publishedAt: '2026-09-21', lastReviewedAt: '2026-09-20', reviewDueAt: '2027-03-20',
};
const manuscript = JSON.parse(swap(JSON.stringify(PILOT)));
Object.assign(manuscript, {
  manuscriptId: 'mn-synthetic-published', linkedEvidenceId: evidence.id, internalWorkingSlug: SLUG, manuscriptStatus: 'APPROVED',
  headline: 'Synthetic Explainer Headline for Layout Tests', draftedAt: '2026-09-20', lastReviewedAt: '2026-09-21', reviewDueAt: '2027-03-21',
});
manuscript.sourceReferences[0].evidenceId = evidence.id;
// A synthetic public reviewer. No real reviewer is configured in the repository.
const reviewers = [{
  reviewerId: 'rv-synthetic-reviewer', governanceRole: 'FOUNDER', displayName: 'Alex Fixture',
  credentials: ['MD', 'FACP'], publicTitle: 'Consultant physician', status: 'ACTIVE',
  approvedBy: 'FOUNDER', approvedAt: '2026-09-20',
}];
const reviewAssignments = [{ manuscriptId: manuscript.manuscriptId, manuscriptVersion: manuscript.version, reviewerId: 'rv-synthetic-reviewer' }];
const article = resolvePublicArticle(SLUG, {
  manuscripts: [manuscript], register: [...EVIDENCE_REGISTER, evidence], today: '2026-10-01', routeEnabled: true, reviewers, reviewAssignments,
});
if (!article) { console.error('synthetic article did not resolve'); process.exit(2); }

// ── Page: the route's wrapper, the renderer, the root footer, the built CSS ───
const cssFiles = (function w(d) { return existsSync(d) ? readdirSync(d).flatMap(n => (statSync(join(d, n)).isDirectory() ? w(join(d, n)) : [join(d, n)])) : []; })(join(ROOT, '.next/static'))
  .filter(f => f.endsWith('.css'));
if (cssFiles.length === 0) { console.error('No built CSS in .next/static — run npm run build first.'); process.exit(2); }
const css = cssFiles.map(f => readFileSync(f, 'utf8')).join('\n');
const body = ReactDOMServer.renderToStaticMarkup(
  createElement('div', { className: 'flex flex-col min-h-screen antialiased' },
    createElement('div', { className: 'flex-1' },
      createElement('main', { style: { background: '#080C14', minHeight: '100vh' } },
        createElement('div', { style: { maxWidth: '760px', margin: '0 auto', padding: '56px 20px 80px' } },
          createElement(EvidenceArticle, { article })))),
    createElement(Footer)));
const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`;

// ── Browser checks ────────────────────────────────────────────────────────────
const PROFILES = [
  ['desktop 1280', { viewport: { width: 1280, height: 900 } }],
  ['mobile 390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }],
  ['iPhone 13', devices['iPhone 13']],
  ['Galaxy S9+', devices['Galaxy S9+']],
  ['narrow 320', { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
];

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
catch { browser = await chromium.launch({ headless: true }); }

for (const [name, profile] of PROFILES) {
  console.log(`\n${name}`);
  const L = s => `[${name}] ${s}`;
  const opts = { ...profile }; delete opts.defaultBrowserType;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.setContent(HTML, { waitUntil: 'load' });

  const r = await page.evaluate(() => {
    const parse = c => { const n = (c.match(/[\d.]+/g) ?? []).map(Number); return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 }; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) return c.rgb; } return [255, 255, 255]; };
    const ratio = (fg, bg) => { const F = parse(fg); const m = F.rgb.map((v, i) => v * F.a + bg[i] * (1 - F.a)); const [x, y] = [lum(m), lum(bg)].sort((a, b) => b - a); return (x + 0.05) / (y + 0.05); };

    const vw = document.documentElement.clientWidth;
    const over = sel => [...document.querySelectorAll(sel)].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > vw + 0.5; })
      .map(e => `${e.tagName.toLowerCase()} "${(e.textContent || '').trim().slice(0, 40)}" right=${Math.round(e.getBoundingClientRect().right)}`);
    // The article (everything inside <main>) must never overflow. The site-wide
    // root-layout footer is reported separately: it already overflows at 320px
    // on every production page, independent of this route.
    const wide = over('main, main *');
    const footerWide = over('footer[role="contentinfo"] *');

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const low = [], small = [];
    const articleEl = document.querySelector('article');
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
      const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      const cr = ratio(cs.color, bgOf(el));
      if (cr < need) low.push(`"${n.textContent.trim().slice(0, 30)}" ${cr.toFixed(2)}:1`);
      if (articleEl?.contains(el) && size < 12) small.push(`"${n.textContent.trim().slice(0, 30)}" ${size}px`);
    }
    const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => Number(h.tagName[1]));
    const skips = levels.filter((l, i) => i > 0 && l > levels[i - 1] + 1).length;
    const paras = [...articleEl.querySelectorAll('section p, section li')].map(p => parseFloat(getComputedStyle(p).fontSize));
    const fixed = [...document.querySelectorAll('body *')].filter(e => ['fixed', 'sticky'].includes(getComputedStyle(e).position)).map(e => e.tagName);
    const link = articleEl.querySelector('a[target="_blank"]');
    return {
      scrollW: document.documentElement.scrollWidth, vw, wide: wide.slice(0, 3), footerWide: footerWide.slice(0, 2), low: low.slice(0, 5), small: small.slice(0, 3),
      levels, skips, minBody: Math.min(...paras),
      landmarks: { main: document.querySelectorAll('main').length, nav: [...document.querySelectorAll('nav')].map(n => n.getAttribute('aria-label')),
        article: document.querySelectorAll('article[aria-labelledby]').length, contentinfo: document.querySelectorAll('footer[role="contentinfo"], body > div > footer').length,
        sections: articleEl.querySelectorAll('section[aria-labelledby]').length },
      fixed, linkName: link?.getAttribute('aria-label') ?? null, linkRel: link?.getAttribute('rel') ?? null,
    };
  });

  t(L('no horizontal overflow in the article'), r.wide.length === 0, r.wide.join(', '));
  t(L('page overflow comes only from the known site-wide footer, if at all'), r.scrollW <= r.vw || (r.wide.length === 0 && r.footerWide.length > 0), `scrollWidth ${r.scrollW} vs ${r.vw}`);
  if (r.scrollW > r.vw) console.log(`  WARN  [${name}] pre-existing site-footer overflow (root layout, every page): ${r.footerWide.join(', ')}`);
  t(L('all text meets WCAG AA contrast'), r.low.length === 0, r.low.join(' | '));
  t(L('no article text below 12px'), r.small.length === 0, r.small.join(' | '));
  t(L('body text is at least 16px'), r.minBody >= 16, String(r.minBody));
  t(L('one h1, then h2s, no skipped heading level'), r.levels[0] === 1 && r.levels.filter(l => l === 1).length === 1 && r.skips === 0, JSON.stringify(r.levels));
  t(L('landmarks: one main, labelled breadcrumb nav, labelled article, ten labelled sections, site footer'),
    r.landmarks.main === 1 && r.landmarks.nav.includes('Breadcrumb') && r.landmarks.article === 1 && r.landmarks.sections === 10 && r.landmarks.contentinfo >= 1,
    JSON.stringify(r.landmarks));
  t(L('no fixed or sticky element can cover content'), r.fixed.length === 0, r.fixed.join(','));
  t(L('source link: accessible name says it opens a new tab, rel is safe'),
    /opens in a new tab/.test(r.linkName ?? '') && r.linkRel === 'noopener noreferrer', `${r.linkName} / ${r.linkRel}`);

  // Keyboard: Tab through the article; every focused link must show a visible focus ring.
  const focus = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return null;
      const cs = getComputedStyle(a);
      return { text: a.textContent.trim().slice(0, 30), inArticle: !!a.closest('article'), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, shadow: cs.boxShadow !== 'none' };
    });
    if (f) focus.push(f);
  }
  const articleFocus = focus.filter(f => f.inArticle);
  t(L('keyboard reaches the breadcrumb and the source link'),
    articleFocus.some(f => /MyoGuard Home/.test(f.text)) && articleFocus.some(f => /Read the source publication/.test(f.text)), JSON.stringify(articleFocus.map(f => f.text)));
  t(L('every focused article link shows a visible focus ring'), articleFocus.length > 0 && articleFocus.every(f => f.outline || f.shadow), JSON.stringify(articleFocus));

  await page.screenshot({ path: join(SHOTS, `evidence-article-${name.replace(/\W+/g, '-')}.png`), fullPage: true });
  await ctx.close();
}

await browser.close();
console.log(`\nScreenshots: ${SHOTS}`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
