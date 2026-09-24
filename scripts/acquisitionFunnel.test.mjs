/**
 * scripts/acquisitionFunnel.test.mjs
 *
 * Phase C-FUNNEL-2 — the minimum patient acquisition funnel.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/acquisitionFunnel.test.mjs
 *
 * WHY THIS SUITE EXISTS
 * The C-FUNNEL-1 audit found a funnel that was severed at four points and
 * measured at none. Every break was one deleted line away from returning, and
 * an unmeasured funnel fails silently — the events simply never arrive and
 * nothing says so. These assertions pin the chain and its instrumentation in
 * place, and, just as importantly, pin the three things the Founder decided
 * must NOT move: the Guide stays independently accessible, the delivered email
 * keeps its single link, and nothing identifying reaches analytics.
 *
 *   [chain]   — the hop from one funnel stage to the next actually exists.
 *   [measure] — the stage emits an event, and the event is a registered name.
 *   [privacy] — what is emitted carries nothing about the person.
 *   [hold]    — a governed position C-FUNNEL-2 was told to leave alone.
 *
 * Pure static analysis. Touches no database, contacts no provider, sends no
 * email, and needs no PostHog key.
 */

import { readFileSync } from 'node:fs';
import { AnalyticsEvents, isAnalyticsEnabled, redactAnalyticsPath } from '../src/lib/posthog.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const HOME     = strip(src('app/page.tsx'));
const INDEX    = strip(src('app/learn/page.tsx'));
const TOPIC    = strip(src('app/learn/protein-on-glp-1/page.tsx'));
const FORM     = strip(src('src/components/guide/GuideRequestForm.tsx'));
const SRI      = strip(src('src/components/learn/PreliminarySriLink.tsx'));
const MOUNT    = strip(src('src/components/analytics/AnalyticsMount.tsx'));
const PROVIDER = strip(src('src/components/analytics/PostHogProvider.tsx'));
const CONFIG   = src('src/lib/posthog.ts');
const EMAIL    = strip(src('src/lib/guide/renderProteinGuide.ts'));
const ROUTE    = strip(src('app/api/guide-request/route.ts'));
const LAYOUT   = strip(src('app/layout.tsx'));
const PDFMOD   = strip(src('src/lib/guide/proteinGuidePdf.ts'));

/** Every posthog.capture(...) call in a file, as its raw argument text. */
const captures = s => [...s.matchAll(/posthog\.capture\(([^;]*?)\)\s*;/g)].map(m => m[1]);

// ─────────────────────────────────────────────────────────────────────────────
section('-- A. The funnel chain is unbroken --');
{
  // Stage 1. C-FUNNEL-1 found /learn had ZERO inbound links from the product:
  // the sitemap was the only file in the repository that named it.
  t('[chain]  the main site links into /learn',
    /href="\/learn"/.test(HOME));

  // Stage 2. The index offers the article.
  t('[chain]  /learn links to the article',
    /href="\/learn\/protein-on-glp-1"/.test(INDEX));

  // Stage 3. The article carries the request panel.
  t('[chain]  the article carries the Guide request panel',
    /<GuideRequestForm\s*\/>/.test(TOPIC));

  // Stage 4. The request reaches the one governed delivery pathway.
  t('[chain]  the request panel posts to /api/guide-request',
    /fetch\('\/api\/guide-request'/.test(FORM));

  // Stage 5. C-FUNNEL-1 found the success state was a dead end — a message and
  // nothing else. It now carries exactly one onward step.
  t('[chain]  the success state offers the onward step',
    /status === 'sent'/.test(FORM)
    && /<PreliminarySriLink source="guide_success"/.test(FORM));

  // Stage 6. And so does the article, for the reader who never asks for the
  // Guide at all — which C-FUNNEL-1 found had no forward path of any kind.
  t('[chain]  the article offers the onward step',
    /<PreliminarySriLink source="article"/.test(TOPIC));

  // Stage 7. The onward step lands on the public preliminary instrument.
  t('[chain]  the onward step reaches the public preliminary SRI',
    /'\/#sri-form'/.test(SRI) && /id="sri-form"/.test(HOME));

  // The circularity C-FUNNEL-1 reported: the article's only link pointed back
  // at its own index. That link is fine — it is no longer the only one.
  t('[chain]  the article is no longer a closed loop with its index',
    /href="\/learn"/.test(TOPIC) && /PreliminarySriLink/.test(TOPIC));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- B. Every funnel stage is measured --');
{
  const REQUIRED = [
    ['LEARN_PAGE_VIEWED',                  'learn_page_viewed'],
    ['PROTEIN_ARTICLE_VIEWED',             'protein_article_viewed'],
    ['GUIDE_REQUESTED',                    'guide_requested'],
    ['GUIDE_DELIVERY_SUCCEEDED',           'guide_delivery_succeeded'],
    ['GUIDE_PDF_CLICKED',                  'guide_pdf_clicked'],
    ['PRELIMINARY_SRI_STARTED_FROM_LEARN', 'preliminary_sri_started_from_learn'],
  ];
  for (const [key, value] of REQUIRED) {
    t(`[measure] ${key} is a registered event name`, AnalyticsEvents[key] === value);
  }

  t('[measure] /learn emits its view event',
    /<AnalyticsMount event=\{AnalyticsEvents\.LEARN_PAGE_VIEWED\}/.test(INDEX));
  t('[measure] the article emits its view event',
    /<AnalyticsMount event=\{AnalyticsEvents\.PROTEIN_ARTICLE_VIEWED\}/.test(TOPIC));
  t('[measure] the Guide request is counted at submit',
    /AnalyticsEvents\.GUIDE_REQUESTED/.test(FORM));
  t('[measure] acceptance by the delivery pathway is counted',
    /AnalyticsEvents\.GUIDE_DELIVERY_SUCCEEDED/.test(FORM));
  t('[measure] the onward step is counted',
    /AnalyticsEvents\.PRELIMINARY_SRI_STARTED_FROM_LEARN/.test(SRI));

  // Pre-existing instrumentation the brief requires be preserved.
  t('[hold]    SRI_GENERATED instrumentation is preserved',
    /AnalyticsEvents\.SRI_GENERATED/.test(HOME)
    && AnalyticsEvents.SRI_GENERATED === 'sri_generated');
  t('[hold]    the landing and get-started events are preserved',
    /AnalyticsEvents\.LANDING_PAGE_VIEWED/.test(HOME)
    && /AnalyticsEvents\.GET_STARTED_CLICKED/.test(HOME));

  // GUIDE_PDF_CLICKED is registered with no firing site, on purpose: the only
  // PDF link is in the delivered email, and instrumenting it would mean adding
  // tracking to an ESSENTIAL_SERVICE message. If a firing site is ever added,
  // it must be on a MyoGuard web surface — never in the email.
  t('[hold]    no PDF-click tracking was added to the delivered email',
    !/guide_pdf_clicked|GUIDE_PDF_CLICKED|posthog/i.test(EMAIL));

  // The whole funnel must be legible per route. `/learn/protein-on-glp-1` is
  // exactly 16 characters and carries the digit of "GLP-1", so the generic
  // identifier heuristic used to collapse it to `/learn/[id]`.
  t('[measure] the article reports under its own path, not as an identifier',
    redactAnalyticsPath('/learn/protein-on-glp-1') === '/learn/protein-on-glp-1'
    && redactAnalyticsPath('/learn') === '/learn');
  t('[privacy] an identifier-shaped path under /learn is still redacted',
    redactAnalyticsPath('/learn/c9f2a41be77d4e0a8b15') === '/learn/[id]');
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- C. Nothing identifying reaches analytics --');
{
  // The brief's prohibited list, as it would appear in a property bag.
  const FORBIDDEN =
    /email|address|\bname\b|myoguardScore|riskBand|leanLossEstPct|weightKg|protein|symptom|medication|dose|token|clerkId|userId|patientId|physicianId|doctorId|requestId|guideId/i;

  const funnelCaptures = [
    ...captures(INDEX), ...captures(TOPIC), ...captures(FORM), ...captures(SRI),
  ];
  t('[privacy] every funnel capture call is free of identifying arguments',
    funnelCaptures.length > 0 && funnelCaptures.every(c => !FORBIDDEN.test(c)));

  // The two view events take no properties at all.
  t('[privacy] the two view events carry no properties',
    !/AnalyticsMount event=\{AnalyticsEvents\.LEARN_PAGE_VIEWED\}\s+properties/.test(INDEX)
    && !/AnalyticsMount event=\{AnalyticsEvents\.PROTEIN_ARTICLE_VIEWED\}\s+properties/.test(TOPIC));

  // The Guide events take none either — not even a hash of the address, which
  // would be a stable identifier under another name.
  t('[privacy] the Guide events carry no properties',
    /posthog\.capture\(AnalyticsEvents\.GUIDE_REQUESTED\)/.test(FORM)
    && /posthog\.capture\(AnalyticsEvents\.GUIDE_DELIVERY_SUCCEEDED\)/.test(FORM));
  t('[privacy] no hashing or encoding of the address appears in the panel',
    !/hash|sha|md5|btoa|encodeURIComponent\(email\)|digest/i.test(FORM));

  // The onward event carries one label from a closed union, and nothing else.
  t('[privacy] the onward event carries only a categorical source label',
    /posthog\.capture\(AnalyticsEvents\.PRELIMINARY_SRI_STARTED_FROM_LEARN, \{ source \}\)/
      .test(SRI.replace(/\s+/g, ' '))
    && /type PreliminarySriSource = 'article' \| 'guide_success'/.test(SRI));

  // The server route must stay out of analytics entirely: it is the one place
  // that holds the address and knows the true delivery outcome.
  t('[privacy] the delivery route sends nothing to analytics',
    !/posthog|analytics|AnalyticsEvents/i.test(ROUTE));

  // Session recording and autocapture would defeat all of the above.
  t('[privacy] autocapture and session recording remain refused in code',
    /autocapture: false/.test(PROVIDER)
    && /disable_session_recording: true/.test(PROVIDER)
    && /mask_all_text: true/.test(PROVIDER));
  t('[privacy] the URL sanitiser is still wired into init',
    /sanitize_properties: sanitizeAnalyticsProperties/.test(PROVIDER));
  t('[privacy] no identify() call exists on the funnel surfaces',
    !/posthog\.identify/.test(HOME + INDEX + TOPIC + FORM + SRI));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- D. PostHog remains fail-closed without a production key --');
{
  // The gate is a key AND an environment. No key means no init and no capture,
  // which is the behaviour that makes it safe to ship this instrumentation
  // before the production key is set.
  t('[privacy] the enable gate requires a key to be present',
    /!!POSTHOG_KEY &&/.test(CONFIG));
  t('[privacy] init is skipped entirely when the gate is closed',
    /if \(!isAnalyticsEnabled\) return;\s*posthog\.init\(/.test(PROVIDER));
  t('[privacy] the pageview component is not even rendered when closed',
    /\{isAnalyticsEnabled && \(/.test(PROVIDER));
  t('[privacy] the shared mount helper checks the gate before capturing',
    /if \(fired\.current \|\| !isAnalyticsEnabled\) return;/.test(MOUNT));

  // Every capture added by C-FUNNEL-2 on a funnel surface is guarded.
  for (const [label, file] of [['request panel', FORM], ['onward panel', SRI]]) {
    const calls = captures(file).length;
    const guards = (file.match(/if \(isAnalyticsEnabled\)/g) || []).length;
    t(`[privacy] every capture in the ${label} is behind the gate`,
      calls > 0 && guards >= calls);
  }

  // This suite runs with no key, so the gate must actually be closed here.
  t('[privacy] with no key configured, analytics is disabled in this process',
    isAnalyticsEnabled === false);

  // The provider is mounted once, at the root, so every surface inherits it.
  t('[measure] the provider is mounted at the application root',
    /<PostHogProvider>/.test(LAYOUT));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- E. Governed positions C-FUNNEL-2 must not move --');
{
  // SUPERSEDED, and deliberately recorded as such. C-FUNNEL-2 originally held
  // this email to a single link. Production end-to-end review found that a
  // recipient opening the Guide from their inbox days later had no route to the
  // Preliminary SRI at all, because the only offer lived in a browser success
  // state they had long closed. The Founder authorised one secondary
  // continuation on 23 September 2026.
  //
  // TWO is now the number, and these assertions defend it against a third —
  // checked against the SOURCE, so a link cannot be introduced behind a
  // conditional the rendered fixture happens not to exercise.
  t('[hold]    the Guide email source contains exactly two hrefs',
    (EMAIL.match(/href=/g) || []).length === 2);
  t('[hold]    the primary link is still the PDF action',
    /proteinGuidePdfUrl/.test(EMAIL)
    && EMAIL.indexOf('renderPdfAction()') < EMAIL.indexOf('renderSriContinuation()'));
  t('[hold]    exactly one Preliminary SRI continuation exists',
    (EMAIL.match(/renderSriContinuation\(\)/g) || []).length === 2 // definition + one call
    && (EMAIL.match(/#sri-form/g) || []).length === 1);
  t('[chain]  the continuation routes to the existing public SRI entry point',
    /GUIDE_EMAIL_ORIGIN/.test(EMAIL) && /#sri-form/.test(EMAIL)
    && !/\/api\/|new Route|assessment/i.test(EMAIL));

  // The continuation is an offer to act once on a public page. It must never
  // become a subscription, a nurture sequence or a commercial placement.
  t('[hold]    no marketing, nurture or affiliate content entered the email',
    !/newsletter|nurture|mailing list|unsubscribe anytime|affiliate|discount|offer ends|buy now/i
      .test(EMAIL));
  t('[hold]    the email grants no EDUCATIONAL or MARKETING permission',
    !/\bEDUCATIONAL\b|\bMARKETING\b|grantConsent|CommunicationPreference|ConsentEvent/.test(EMAIL));

  // Attribution rides the existing analytics architecture: utm_* is already
  // preserved through the PostHog sanitiser, so no new event, table or endpoint
  // was created. The values are fixed for every recipient.
  t('[privacy] attribution is a fixed campaign label, not a recipient token',
    /utm_source=protein_guide_email/.test(EMAIL)
    && !/encodeURIComponent|recipientKey|token|email\)/.test(EMAIL.split('PRELIMINARY_SRI_URL')[1] ?? ''));

  // The committed PDF is printed from this same HTML. The continuation is a
  // screen affordance and must stay out of the artifact and out of its drift
  // signature — otherwise an eight-page clinical document grows a ninth block.
  t('[hold]    the continuation is excluded from the printed artifact',
    /class="mg-action mg-continue"/.test(EMAIL)
    && /mg-continue/.test(PDFMOD)
    && /\.mg-action\{display:none!important\}/.test(EMAIL));

  // Founder decision 2. The Guide is reachable without the SRI, from a page
  // that asks for an address and nothing else.
  // The onward panel must RENDER only after a successful request. Measured on
  // the JSX usage, not the import, which necessarily sits at the top of the
  // file and says nothing about where the element appears.
  const successGuard = FORM.indexOf("if (status === 'sent')");
  const onwardUsage  = FORM.indexOf('<PreliminarySriLink');
  t('[hold]    the Guide remains independently accessible',
    /<GuideRequestForm\s*\/>/.test(TOPIC)
    && (FORM.match(/<input/g) || []).length === 1
    && successGuard > 0 && onwardUsage > successGuard);

  // The consent architecture. Requesting a document is not subscribing, and
  // this phase created no preference, no consent event and no wording row.
  t('[hold]    no consent is created anywhere on the funnel',
    !/grantConsent|CommunicationPreference|ConsentEvent/.test(INDEX + TOPIC + FORM + SRI + ROUTE));
  t('[hold]    the delivery route is still classified ESSENTIAL_SERVICE',
    /sendServiceEmail/.test(ROUTE) && !/sendEducationalEmail|sendMarketingEmail/.test(ROUTE));

  // Retention and erasure. This phase wrote no schema and no data.
  t('[hold]    the funnel surfaces touch no database',
    !/PrismaClient|from '@\/src\/lib\/prisma'/.test(INDEX + TOPIC + FORM + SRI));

  // Terminology, per the project's non-negotiable rules.
  t('[hold]    the instrument is named in full and never called a calculator',
    /Sarcopenia Risk Index \(SRI\)/.test(SRI)
    && !/calculator/i.test(INDEX + TOPIC + FORM + SRI));
  t('[hold]    no "score" wording entered the funnel surfaces',
    !/\bscores?\b/i.test(INDEX + TOPIC + FORM + SRI));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- F. Public journey containment (C-FUNNEL-2A) --');
{
  // ── The route out ────────────────────────────────────────────────────────
  //
  // Founder production review found both education pages had no way back to
  // the public site. These visitors arrive from search and Pinterest with no
  // account and no session, so the route home must be the public home page —
  // a dashboard link would send a stranger at a sign-in wall.
  t('[chain]  the article offers a public route home',
    /href="\/"/.test(TOPIC) && /← MyoGuard Home/.test(TOPIC));
  t('[chain]  /learn offers a public route home',
    /href="\/"/.test(INDEX) && /← MyoGuard Home/.test(INDEX));
  t('[safety] neither page routes a signed-out visitor at a dashboard',
    !/Back to Dashboard|href="\/dashboard/i.test(TOPIC + INDEX));
  t('[chain]  the article still links to its own index as well',
    /href="\/learn"/.test(TOPIC));

  // ── Still exactly one email capture ──────────────────────────────────────
  //
  // The early offer is an anchor to the panel, not another panel. This is the
  // assertion that stops it quietly growing a field of its own.
  t('[safety] the article renders exactly one Guide request panel',
    (TOPIC.match(/<GuideRequestForm/g) || []).length === 1);
  t('[safety] the article itself collects no input of any kind',
    !/<input/.test(TOPIC) && !/<form/.test(TOPIC));
  t('[safety] the early offer is an anchor, not a second pathway',
    /href="#guide-request"/.test(TOPIC)
    && /id="guide-request"/.test(TOPIC)
    && !/fetch\(/.test(TOPIC));
  t('[safety] only one call reaches the Guide delivery route',
    ((TOPIC + FORM).match(/\/api\/guide-request/g) || []).length === 1);

  // The early offer must stay uninstrumented: the brief preserves the event
  // definitions as designed, and the reader who takes the anchor is counted
  // once, at the panel, exactly as the reader who scrolls to it.
  t('[hold]    the early offer emits no analytics event of its own',
    captures(TOPIC).length === 0);

  // ── The corrected sequence ───────────────────────────────────────────────
  //
  // Education establishes the evidence and the practical problem, THEN the ask,
  // then the positioning tail, then the optional onward path. Ordering is the
  // whole point of C-FUNNEL-2A, so it is asserted positionally rather than by
  // mere presence.
  const at = needle => TOPIC.indexOf(needle);
  const order = [
    ['breadcrumb',      at('← MyoGuard Home')],
    ['early offer',     at('href="#guide-request"')],
    ['page 2 evidence', at('<ManuscriptSection n={2}')],
    ['page 3 beyond',   at('<ManuscriptSection n={3}')],
    ['page 4 eating',   at('<ManuscriptSection n={4}')],
    ['Guide panel',     at('id="guide-request"')],
    ['About / refs',    at('positioningTail().map')],
    ['optional SRI',    at('<PreliminarySriLink source="article"')],
  ];
  t('[chain]  every stage of the page is present',
    order.every(([, i]) => i > 0));
  t('[chain]  the page runs education → ask → references → optional SRI',
    order.every(([, i], k) => k === 0 || i > order[k - 1][1]));

  // Named explicitly, because these two are the regressions that matter: the
  // ask must follow all three substantive sections, and precede the close.
  t('[chain]  the email capture follows all three substantive sections',
    at('id="guide-request"') > at('<ManuscriptSection n={4}'));
  t('[chain]  the email capture precedes About MyoGuard and the references',
    at('id="guide-request"') < at('positioningTail().map'));

  // ── Untouched by this phase ──────────────────────────────────────────────
  t('[hold]    the request panel component was not modified by the move',
    /fetch\('\/api\/guide-request'/.test(FORM)
    && (FORM.match(/<input/g) || []).length === 1
    && /AnalyticsEvents\.GUIDE_REQUESTED/.test(FORM)
    && /AnalyticsEvents\.GUIDE_DELIVERY_SUCCEEDED/.test(FORM)
    && /<PreliminarySriLink source="guide_success"/.test(FORM));
  t('[hold]    the article still renders whole manuscript pages, unselected',
    /page\.blocks\.map/.test(TOPIC) && !/blocks\.slice\(0/.test(TOPIC));
  t('[hold]    the article pages are still 2, 3 and 4',
    /ARTICLE_PAGES = \[2, 3, 4\]/.test(TOPIC));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
