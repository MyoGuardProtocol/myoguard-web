/**
 * scripts/landingProductState.test.mjs
 *
 * Phase C-FUNNEL-2C — the public landing page's product state.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/landingProductState.test.mjs
 *
 * WHY THIS SUITE EXISTS
 * Founder production review of the Preliminary SRI journey found an
 * authenticated visitor being shown two contradictory things at once: a locked
 * panel telling them to enter an email to unlock the report, and directly below
 * it a confirmation that they were signed in and that the report had already
 * been emailed to them. Neither half was harmless. The first asked for
 * something already given; the second asserted a delivery that had not
 * happened, because the only code that sends that email is unreachable when
 * signed in.
 *
 * Both were one missing condition away from returning, so they are pinned here.
 *
 *   [state]   — the right thing renders for the right authentication state.
 *   [truth]   — the page does not claim something that did not happen.
 *   [safety]  — a boundary this correction was forbidden to weaken.
 *   [measure] — instrumentation the correction had to leave exactly alone.
 *
 * Pure static analysis. Touches no database, contacts no provider, sends no
 * email, and needs no PostHog key.
 */

import { readFileSync } from 'node:fs';
import { AnalyticsEvents } from '../src/lib/posthog.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const HOME     = strip(src('app/page.tsx'));
const PROVIDER = strip(src('src/components/analytics/PostHogProvider.tsx'));

// ─────────────────────────────────────────────────────────────────────────────
section('-- A. Authentication state resolves before anything auth-dependent renders --');
{
  // `isSignedIn` alone is not enough: it is undefined until Clerk answers, so
  // `!isSignedIn` is true during loading and the anonymous surfaces flashed.
  t('[state]  the page reads isLoaded alongside isSignedIn',
    /const \{ isSignedIn, isLoaded \} = useUser\(\)/.test(HOME));

  t('[state]  the unauthenticated conversion bridge waits for Clerk',
    /\{isLoaded && !isSignedIn && \(/.test(HOME));

  t('[state]  the email gate / signed-in branch waits for Clerk',
    /\{!isLoaded \? null : isSignedIn \? \(/.test(HOME));

  // Every auth-dependent branch must be behind isLoaded. A bare `!isSignedIn &&`
  // or `isSignedIn ?` that is not is exactly the flicker this fixes.
  t('[state]  no auth-dependent branch renders before Clerk resolves',
    !/\{!isSignedIn && \(/.test(HOME)
    && !/\{isSignedIn \? \(/.test(HOME));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- B. A signed-in visitor is never asked for an email to unlock --');
{
  const ANON_INSTRUCTION = 'Enter your email to unlock the complete clinical report.';

  t('[state]  the unlock instruction still exists for anonymous visitors',
    HOME.includes(ANON_INSTRUCTION));

  // It must be inside an isSignedIn branch, not standing unconditionally in the
  // locked overlay as it was. Asserted structurally: the instruction and the
  // signed-in alternative are the two arms of one ternary.
  t('[state]  the unlock instruction is an authentication-dependent branch',
    /isSignedIn\s*\?\s*'Continue from your dashboard\.'\s*:\s*'Enter your email to unlock the complete clinical report\.'/
      .test(HOME.replace(/\s+/g, ' ')));

  t('[state]  the signed-in alternative promises no access',
    /'Continue from your dashboard\.'/.test(HOME)
    && !/unlock|full clinical report|complete report/i.test('Continue from your dashboard.'));

  // The lock is a boundary, not copy. It stays unconditional for everyone.
  t('[safety] the locked panel itself is still shown to every visitor',
    /Full protocol locked/.test(HOME)
    && !/isSignedIn[^\n]*Full protocol locked/.test(HOME));
  t('[safety] the blurred protocol remains non-interactive and unreleased',
    /select-none pointer-events-none/.test(HOME)
    && /backdrop-blur-sm/.test(HOME));
  t('[safety] authentication alone is never said to release the full output',
    !/signed in[^.]*unlocks|account[^.]*unlocks the full|now have access to the full/i.test(HOME));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- C. The page does not claim an email that was never sent --');
{
  // THE DEFECT: this sentence rendered unconditionally for signed-in visitors,
  // while the only code that sends it is reachable only when signed out.
  t('[truth]  the false "report has been sent" claim is gone',
    !/Your protocol report has been sent to your email/.test(HOME));

  t('[truth]  the signed-in state offers the dashboard action instead',
    /Save this assessment to your dashboard to track progress over time\./.test(HOME)
    && /href="\/dashboard\/assessment"/.test(HOME));

  // The genuine confirmation stays exactly where a send really did occur —
  // the `submitted` branch, downstream of a successful POST.
  t('[truth]  the real send confirmation still exists on the send path',
    /Protocol report sent to \{email\}/.test(HOME));
  t('[truth]  the real confirmation is still gated on submitted',
    HOME.indexOf('setSubmitted(true)') > 0
    && HOME.indexOf('Protocol report sent to {email}') > HOME.indexOf('!submitted ?'));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- D. No new send pathway, and the anonymous capture is untouched --');
{
  // The correction removed a false claim. It must not have added a send to
  // make the claim true, which would have created an unrequested email to an
  // authenticated user and a communications-governance question with it.
  t('[safety] exactly one email send call exists on this page',
    (HOME.match(/fetch\("\/api\/protocol-email"/g) || []).length === 1);
  t('[safety] no second delivery endpoint was introduced',
    !/\/api\/guide-request|\/api\/email-capture|sendServiceEmail|resend/i.test(HOME));
  t('[safety] the send is still reachable only from the anonymous gate',
    HOME.indexOf('handleEmailSubmit') > 0
    && /onClick=\{handleEmailSubmit\}/.test(HOME)
    && HOME.indexOf('onClick={handleEmailSubmit}') > HOME.indexOf('!submitted ?'));
  t('[safety] no consent or preference is created anywhere on the page',
    !/grantConsent|CommunicationPreference|ConsentEvent|\bEDUCATIONAL\b|\bMARKETING\b/.test(HOME));

  // The anonymous journey is unchanged in every respect that matters.
  t('[state]  the anonymous email gate still collects one address',
    /placeholder="Enter your email address"/.test(HOME)
    && /Send my protocol report/.test(HOME));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- E. Instrumentation this correction had to leave alone --');
{
  // C-FUNNEL-2C was explicitly barred from touching the sri_generated firing
  // site: its failure in the Founder journey is unproven, and changing it would
  // destroy the evidence. This asserts it survives, verbatim and guarded.
  t('[measure] sri_generated still fires from handleCalculate, guarded',
    /if \(isAnalyticsEnabled\) \{\s*posthog\.capture\(AnalyticsEvents\.SRI_GENERATED, \{ risk_band: risk \}\);\s*\}/
      .test(HOME));
  t('[measure] sri_generated fires immediately after the result is set',
    HOME.indexOf('setResult({ leanScore, recoveryScore, composite, risk })') <
      HOME.indexOf('AnalyticsEvents.SRI_GENERATED')
    && HOME.indexOf('AnalyticsEvents.SRI_GENERATED') -
       HOME.indexOf('setResult({ leanScore, recoveryScore, composite, risk })') < 200);
  t('[measure] sri_generated carries only the categorical risk band',
    /AnalyticsEvents\.SRI_GENERATED, \{ risk_band: risk \}/.test(HOME));

  // Names are a contract with the analytics that already exist in production.
  for (const [key, value] of [
    ['LANDING_PAGE_VIEWED',     'landing_page_viewed'],
    ['SRI_GENERATED',           'sri_generated'],
    ['EMAIL_CAPTURE_SUBMITTED', 'email_capture_submitted'],
    ['GET_STARTED_CLICKED',     'get_started_clicked'],
  ]) {
    t(`[measure] ${key} name is unchanged`, AnalyticsEvents[key] === value);
  }

  t('[measure] every landing-page capture is still behind the enable gate',
    (HOME.match(/posthog\.capture\(/g) || []).length ===
    (HOME.match(/isAnalyticsEnabled\)?\s*\{?\s*posthog\.capture\(/g) || []).length);

  // The three GET_STARTED_CLICKED sites and their location labels survive the
  // auth-branch edits around them.
  t('[measure] the three get_started_clicked locations are intact',
    /location: "hero"/.test(HOME)
    && /location: "results_cta"/.test(HOME)
    && /location: "email_gate"/.test(HOME));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- F. PostHog is ready before any first-load capture runs --');
{
  // THE C-FUNNEL-2B DEFECT. init() lived in the provider's effect, and the
  // provider wraps {children} — so every instrumented descendant's mount effect
  // ran first and its event was discarded before initialisation.
  t('[measure] init is called at module scope, not from inside an effect',
    /^ensurePostHogInitialised\(\);$/m.test(PROVIDER));
  t('[measure] the effect no longer owns initialisation',
    !/useEffect\(\(\) => \{\s*if \(!isAnalyticsEnabled\) return;\s*posthog\.init\(/.test(PROVIDER));
  t('[measure] initialisation is idempotent',
    /if \(posthogReady\) return;/.test(PROVIDER)
    && /posthogReady = true;/.test(PROVIDER));
  t('[measure] initialisation never runs during SSR or prerender',
    /typeof window === 'undefined'/.test(PROVIDER));
  t('[measure] the enable gate still guards initialisation',
    /if \(!isAnalyticsEnabled\) return;/.test(PROVIDER));

  // Config must be carried over untouched — this phase changed WHEN init runs,
  // nothing about HOW. Person-profile policy and UTM handling in particular.
  t('[safety] every init option is preserved verbatim',
    /capture_pageview: false/.test(PROVIDER)
    && /capture_pageleave: true/.test(PROVIDER)
    && /autocapture: false/.test(PROVIDER)
    && /disable_session_recording: true/.test(PROVIDER)
    && /mask_all_text: true/.test(PROVIDER)
    && /mask_all_element_attributes: true/.test(PROVIDER)
    && /persistence: "localStorage\+cookie"/.test(PROVIDER)
    && /sanitize_properties: sanitizeAnalyticsProperties/.test(PROVIDER));
  t('[safety] person-profile policy is unchanged',
    /person_profiles: "identified_only"/.test(PROVIDER));
  t('[safety] no identify() call was introduced',
    !/posthog\.identify/.test(PROVIDER + HOME));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
