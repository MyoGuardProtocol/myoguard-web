/**
 * scripts/closureRemediation.test.mjs
 *
 * Platform Hardening v1 — closure remediation.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/closureRemediation.test.mjs
 *
 * WHY THIS SUITE EXISTS
 * The closure audit found two defects that the hardening programme had never
 * caught, because both live in rendered copy rather than in logic. The code was
 * hardened; some of the words were not.
 *
 * The first was prohibited terminology on live patient surfaces — including the
 * share report, which patients send to physicians and family, so the banned
 * wording travelled outside the product under the MyoGuard name. The second was
 * a set of outbound retailer links carrying a referral code, rendered inside a
 * patient clinical report beside dosed supplement recommendations, with no
 * commercial disclosure anywhere.
 *
 * Both were single lines of copy. Both are pinned here so closure means
 * something.
 *
 *   [term]   — canonical terminology on a patient-facing surface.
 *   [commerce] — no purchase pathway from a patient clinical surface.
 *   [scope]  — something this remediation was explicitly forbidden to touch.
 *
 * Pure static analysis. Touches no database, contacts no provider, sends no
 * email.
 */

import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const SHARE      = strip(src('app/report/[token]/page.tsx'));
const DASH_REPT  = strip(src('app/dashboard/report/page.tsx'));
const DASH_HOME  = strip(src('app/dashboard/page.tsx'));
const ASSESS     = strip(src('app/dashboard/assessment/page.tsx'));
const SUPP       = strip(src('src/components/ui/SupplementCTA.tsx'));

/** Visible JSX text and rendered string literals on a patient surface. */
const rendered = s => [
  ...[...s.matchAll(/>\s*([^<>{}]{2,200}?)\s*</g)].map(m => m[1]),
  ...[...s.matchAll(/'([^']{2,200})'/g)].map(m => m[1]),
  ...[...s.matchAll(/"([^"]{2,200})"/g)].map(m => m[1]),
].map(x => x.replace(/\s+/g, ' ').trim());

// ─────────────────────────────────────────────────────────────────────────────
section('-- A. Prohibited terminology is gone from patient-facing surfaces --');
{
  // The exact strings the closure audit found rendered in production.
  const BANNED = [
    'MyoGuard Muscle Protection Score',
    'Muscle Protection Score',
    'improves score accuracy',
    'Calculating your score',
  ];
  for (const [label, body] of [
    ['share report',      SHARE],
    ['patient report',    DASH_REPT],
    ['patient dashboard', DASH_HOME],
    ['assessment form',   ASSESS],
  ]) {
    for (const phrase of BANNED) {
      t(`[term]   ${label}: "${phrase}" absent`, !body.includes(phrase));
    }
  }

  // The share link is the surface that leaves the product, so it is asserted
  // hardest: no bare "Score" may survive in anything it renders.
  const shareText = rendered(SHARE);
  t('[term]   share report renders no bare "Score" anywhere',
    !shareText.some(x => /\bScores?\b/.test(x)));
  t('[term]   patient dashboard renders no bare "Score" label',
    !rendered(DASH_HOME).some(x => /^Scores?$/.test(x)));

  // "calculate" is prohibited alongside "score"; the loading state broke both.
  t('[term]   assessment form uses "generate", never "calculate"',
    !/Calculating|calculator/i.test(ASSESS.replace(/canCalculate|handleCalculate/g, '')));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- B. Canonical terminology is present --');
{
  t('[term]   share report names the Sarcopenia Risk Index (SRI)',
    /MyoGuard Sarcopenia Risk Index \(SRI\)/.test(SHARE));
  t('[term]   patient report names the Sarcopenia Risk Index (SRI)',
    /MyoGuard Sarcopenia Risk Index \(SRI\)/.test(DASH_REPT));
  t('[term]   share history table column reads SRI',
    /\['Date','SRI','Risk Band','Change'\]/.test(SHARE));
  t('[term]   patient dashboard tile reads SRI',
    />SRI<\/p>/.test(DASH_HOME));
  t('[term]   assessment optional-field hint reads SRI',
    /\(optional — improves SRI accuracy\)/.test(ASSESS));
  t('[term]   assessment loading state reads "Generating your SRI…"',
    /'Generating your SRI…'/.test(ASSESS));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- C. No patient-facing supplement purchase pathway --');
{
  // The referral code is the thing that must never reappear in any form.
  t('[commerce] no referral code is exposed',
    !/rcode=|PNB3943/i.test(SUPP));
  t('[commerce] no retailer is named or linked',
    !/iherb|amazon|thorne\.com|shop\.|store\./i.test(SUPP));
  t('[commerce] no affiliate constant or link builder survives',
    !/AFFILIATE_LINK|SUPPLEMENT_PROVIDERS\s*[:=]|function getProviderLink/.test(SUPP));

  // Nothing in this component may be clickable outward. Asserted on the markup
  // rather than on a URL pattern, so a differently-shaped link still fails.
  t('[commerce] the component renders no anchor element',
    !/<a[\s>]/.test(SUPP));
  t('[commerce] the component renders no href at all',
    !/href\s*=/.test(SUPP));
  t('[commerce] nothing opens a new tab',
    !/target\s*=\s*["']_blank/.test(SUPP));
  // Word-bounded deliberately: an unbounded /Order/i matches "border", which
  // appears in every inline style on this component.
  t('[commerce] no purchase call-to-action copy remains',
    !/\blinkText\b|View [^<>{}]{0,40}\boptions\b|\bBuy\b|\bShop\b|\bOrder now\b|\bPurchase\b/i
      .test(SUPP));

  // A disclosure was explicitly rejected as a substitute for removal. If one
  // appears, it means links came back with a notice attached.
  t('[commerce] no affiliate disclosure was added in place of removal',
    !/affiliate|commission|we may earn|sponsored/i.test(SUPP));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- D. Scope: what this remediation was forbidden to change --');
{
  // The educational content stays exactly as it was. Rewriting doses and
  // claims is a separate, still-open decision.
  t('[scope]  all five supplement categories remain',
    (SUPP.match(/\bid:\s*'/g) || []).length === 5);
  t('[scope]  every category keeps its label, rationale and formulation',
    (SUPP.match(/label:\s*'/g) || []).length === 5
    && (SUPP.match(/rationale:\s*'/g) || []).length === 5
    && (SUPP.match(/formulation:\s*'/g) || []).length === 5);
  t('[scope]  the doses are untouched',
    /creatine monohydrate 3–5 g\/day/.test(SUPP)
    && /Psyllium husk 5–10 g\/day/.test(SUPP)
    && /Berberine 500 mg/.test(SUPP));
  t('[scope]  the clinician-discussion qualification is retained',
    /educational support pathways to discuss with your clinician/.test(SUPP));

  // /api/analytics was to be left alone even though its only patient-side
  // writer has just been removed.
  const ROUTE = strip(src('app/api/analytics/route.ts'));
  t('[scope]  /api/analytics route is still present and unmodified in shape',
    /prisma\.analyticsEvent\.create/.test(ROUTE)
    && /eventType/.test(ROUTE));
  t('[scope]  SUPPLEMENT_CLICK now has no firing site anywhere',
    !/'SUPPLEMENT_CLICK'|"SUPPLEMENT_CLICK"/.test(SUPP));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
