/**
 * scripts/publicGuideEntry.test.mjs
 *
 * Phase C3F-3D — the public Protein Guide entry point.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/publicGuideEntry.test.mjs
 *
 * WHY THIS SUITE EXISTS
 * /learn/protein-on-glp-1 is the first surface where an anonymous member of the
 * public meets MyoGuard clinical content. Three things could go wrong here that
 * would not be caught anywhere else: an unreviewed clinical sentence could be
 * written directly into the page, the request panel could quietly become a
 * subscription, and the Guide could become gated behind the SRI. Each has its
 * own section below.
 *
 *   [lock]     — clinical wording on the public page comes from the approved
 *                manuscript and nowhere else.
 *   [safety]   — an invariant whose violation would put an unapproved claim, an
 *                implied consent, or a commercial ask in front of the public.
 *   [flow]     — the request reaches the one governed delivery pathway.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync } from 'node:fs';
import { GUIDE_PAGES, GUIDE_COVER } from '../src/lib/guide/proteinGuideContent.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const TOPIC  = strip(src('app/learn/protein-on-glp-1/page.tsx'));
const INDEX  = strip(src('app/learn/page.tsx'));
const FORM   = strip(src('src/components/guide/GuideRequestForm.tsx'));
const SITEMAP = src('app/sitemap.ts');
const ALL    = TOPIC + INDEX + FORM;

section('-- A. Clinical wording comes from the approved manuscript --');
{
  // The page renders blocks out of the content module rather than writing prose.
  t('[lock]   the topic page renders manuscript content rather than its own',
    /from '@\/src\/lib\/guide\/proteinGuideContent'/.test(TOPIC)
    && /GUIDE_PAGES/.test(TOPIC) && /GUIDE_COVER/.test(TOPIC));

  // Every substantial run of visible text written directly into these files must
  // be declared here. Anything else is a clinical sentence someone typed into a
  // page instead of putting it through an approved manuscript.
  const DECLARED_UI_COPY = [
    // Supplied verbatim by the C3F-3D brief.
    'A physician-led educational guide to help you understand protein, nutrition and muscle health during treatment.',
    // The Guide's own approved subtitle — Manuscript v1.2 Page 1, and the
    // brief's CTA wording. Asserted against the manuscript just below.
    'Protein-Smart Eating During GLP-1 Weight Loss',
    // Page and section furniture. No clinical claim in any of them.
    'Protein and Muscle Health During GLP-1 Treatment',
    'Plain-language education for people being treated with GLP-1 and related medicines, intended to be read alongside advice from your own clinician.',
    'Read the education page and request the MyoGuard Protein Guide by email →',
    'Thank you — your request has been received',
    'If the Guide can be delivered to that address, it is on its way. It may take a few minutes to arrive, and it is worth checking your spam folder if you do not see it.',
    'This is a one-time delivery. Requesting the Guide does not subscribe you to anything. See our',
    // House footer, per the project footer standard.
    'MyoGuard Protocol &middot; Physician-led Clinical Decision Support',
    '&copy; 2026 Meridian Wellness Systems LLC &middot; myoguard.health',
    'Built for the global GLP-1 prescribing community',
  ].map(s => s.replace(/\s+/g, ' ').trim());

  // JSX text nodes only — not code, not style objects.
  const textNodes = [...ALL.matchAll(/>\s*([A-Z][^<>{}]{40,}?)\s*</g)]
    .map(m => m[1].replace(/\s+/g, ' ').trim());
  const undeclared = textNodes.filter(n => !DECLARED_UI_COPY.some(d => d.startsWith(n) || n.startsWith(d)));
  t('[lock]   no undeclared prose is written directly into the public pages'
    + (undeclared.length ? ` — found: "${undeclared[0].slice(0, 80)}"` : ''),
    undeclared.length === 0);

  // Safety material must travel with the protein material. Page 5 is the renal
  // checkpoint; rendering the protein pages without it would strip the caveat
  // that governs everything else on the page.
  t('[safety] the renal safety page is rendered on the public page',
    /ManuscriptSection n=\{5\}/.test(TOPIC));
  t('[safety] the page renders whole manuscript pages, not selected sentences',
    /page\.blocks\.map/.test(TOPIC) && !/blocks\.slice\(0/.test(TOPIC));
  t('[safety] the clinical disclaimer and positioning tail are rendered',
    /positioningTail/.test(TOPIC) && /About MyoGuard/.test(TOPIC));

  // Every citation marker shown must resolve to a visible source.
  const refs = GUIDE_PAGES.at(-1).blocks.find(b => b.k === 'refs');
  t('[lock]   the nine references reach the public page with the tail',
    refs.items.length === 9
    && GUIDE_PAGES.at(-1).blocks.findIndex(b => b.k === 'h3' && b.text === 'About MyoGuard')
       < GUIDE_PAGES.at(-1).blocks.findIndex(b => b.k === 'refs'));
  t('[lock]   citation markers are rendered for cited claims',
    /sup/.test(TOPIC) && /b\.cite/.test(TOPIC));

  // The CTA subtitle is approved wording, not a line written for the landing
  // page — so it must still match the manuscript it came from.
  t('[lock]   the CTA subtitle is the manuscript\'s own approved subtitle',
    FORM.includes(GUIDE_COVER.subtitle)
    && GUIDE_COVER.subtitle === 'Protein-Smart Eating During GLP-1 Weight Loss');
}

section('-- B. The request panel is not a subscription --');
{
  t('[flow]   the form posts to the one governed delivery pathway',
    /fetch\('\/api\/guide-request'/.test(FORM));
  t('[flow]   it posts an address and nothing else',
    /JSON\.stringify\(\{ email \}\)/.test(FORM));
  t('[safety] no second delivery pathway is introduced',
    !/\/api\/email-capture|\/api\/protocol-email|resend|Resend/.test(ALL));

  t('[safety] no consent is taken, implied or recorded',
    !/grantConsent|consent|optIn|opt-in|checkbox|type="checkbox"/i.test(ALL));
  // The governance classes are uppercase identifiers. Matched case-sensitively,
  // because "educational guide" is the brief's own descriptor and must not trip
  // an assertion about communication permissions.
  t('[safety] no EDUCATIONAL or MARKETING permission is created',
    !/\bEDUCATIONAL\b|\bMARKETING\b/.test(ALL)
    && !/newsletter|nurture|mailing list/i.test(ALL));
  t('[safety] no subscription language anywhere on the public surface',
    !/subscribe to|sign up for updates|join our|stay in touch|keep me posted/i.test(ALL));

  // Explicitly forbidden by the brief: it describes a subscription the person
  // has not entered, on a one-time ESSENTIAL_SERVICE request.
  t('[safety] the forbidden "No spam. Unsubscribe anytime." line is absent',
    !/no spam/i.test(ALL) && !/unsubscribe anytime/i.test(ALL));
  t('[safety] the panel states plainly that this is a one-time delivery',
    /one-time delivery/.test(FORM) && /does not subscribe you to anything/.test(FORM));
  t('[safety] the panel links to the privacy policy',
    /href="\/privacy"/.test(FORM));

  // The route answers a suppressed send exactly as a delivered one. The UI must
  // not undo that by asserting delivery.
  t('[safety] success copy does not assert that mail was sent',
    /If the Guide can be delivered to that address/.test(FORM)
    && !/We have sent|Check your inbox now|Your Guide has been sent/i.test(FORM));
  t('[safety] failure copy never describes the address',
    !/that address is already|already registered|not found|unknown address/i.test(FORM));
}

section('-- C. The Guide is not gated behind the SRI --');
{
  t('[flow]   no assessment is required to reach the Guide',
    !/assessment|\/dashboard\/assessment|complete the SRI|take the/i.test(ALL));
  t('[flow]   the panel needs an email address and nothing more',
    (FORM.match(/<input/g) || []).length === 1);
  t('[safety] no weight, dose, medication or symptom field is collected',
    !/weightKg|myoguardScore|riskBand|leanLossEstPct|medication|dose|symptom/i.test(ALL));
  t('[safety] no sign-up or account creation is required',
    !/sign-up|sign-in|createAccount|register/i.test(ALL));
}

section('-- D. Clinical positioning --');
{
  t('[safety] the SRI is never called a calculator',
    !/calculator/i.test(ALL));
  t('[safety] the SRI is never described as a score',
    !/\bscores?\b/i.test(ALL));
  t('[safety] MyoGuard is positioned as Clinical Decision Support',
    /Physician-led Clinical Decision Support/.test(TOPIC));
  t('[safety] the entity is named in full',
    /Meridian Wellness Systems LLC/.test(TOPIC) && !/Meridian Health/.test(ALL));

  t('[safety] no individualized protein target is introduced',
    !/g\s*\/\s*kg|grams? per kilo|\d+\s*g of protein (a|per) day|your protein target/i.test(ALL));
  t('[safety] no claim that GLP-1 therapy causes disproportionate muscle loss',
    !/causes? (disproportionate|significant|severe) muscle loss|muscle wasting/i.test(ALL));
  t('[safety] no claim that the Guide prevents or protects against muscle loss',
    !/prevents? muscle loss|protects? (your )?muscle|preserves? (your )?muscle|stop(s)? muscle loss/i.test(ALL));
  t('[safety] no individualized medical advice is offered',
    !/you should eat|we recommend you|your personalised plan|tailored to you/i.test(ALL));
  t('[safety] no urgency, scarcity or conversion pressure',
    !/limited time|act now|don't miss|only \d+ left|hurry|exclusive offer/i.test(ALL));
}

section('-- E. Surface, routing and discovery --');
{
  t('[flow]   the canonical route is /learn/protein-on-glp-1',
    /const CANONICAL = 'https:\/\/myoguard\.health\/learn\/protein-on-glp-1'/.test(TOPIC)
    && /alternates: \{ canonical: CANONICAL \}/.test(TOPIC));
  t('[flow]   the parent /learn index exists so the topic page is not orphaned',
    /export default function LearnIndexPage/.test(INDEX)
    && /href="\/learn\/protein-on-glp-1"/.test(INDEX));
  t('[flow]   both routes are declared in the sitemap',
    /\/learn`/.test(SITEMAP) && /\/learn\/protein-on-glp-1`/.test(SITEMAP));
  t('[flow]   structured data describes a patient-facing medical page',
    /MedicalWebPage/.test(TOPIC) && /'@type': 'Patient'/.test(TOPIC));

  t('[safety] Midnight Silk is used — no white surface on the public pages',
    /#080C14/.test(TOPIC) && /#0D1421/.test(TOPIC)
    && !/background: '#fff|background: 'white|#FFFFFF/i.test(TOPIC + INDEX));
  t('[safety] the page is static — no Prisma, no secret, no server data access',
    !/PrismaClient|prisma|DATABASE_URL|process\.env/i.test(TOPIC + INDEX));
  t('[safety] only the request panel is a client component',
    /'use client'/.test(FORM) && !/'use client'/.test(TOPIC) && !/'use client'/.test(INDEX));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
