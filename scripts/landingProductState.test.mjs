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
 * SRI Containment C1 (Founder ruling after the SRI Residual Integrity Test):
 * the Preliminary result, the locked panel, the email gate and its send were
 * removed from the page and replaced by the Founder-approved interim copy.
 * Sections A–E now pin that contained state; F is unchanged.
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

  // SRI Containment C1: the conversion bridge and the email gate were removed
  // with the Preliminary result. The one remaining auth-dependent branch is the
  // continuation action under the approved copy.
  t('[state]  the continuation action waits for Clerk',
    /\{!isLoaded \? null : isSignedIn \? \(/.test(HOME));

  // Every auth-dependent branch must be behind isLoaded. A bare `!isSignedIn &&`
  // or `isSignedIn ?` that is not is exactly the flicker this fixes.
  t('[state]  no auth-dependent branch renders before Clerk resolves',
    !/\{!isSignedIn && \(/.test(HOME)
    && !/\{isSignedIn \? \(/.test(HOME));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- B. SRI Containment C1 (K2): the Preliminary result is not shown --');
{
  // Founder-approved interim copy, verbatim.
  for (const line of [
    'Thank you — your responses have been received.',
    'MyoGuard is a physician-led platform. Your muscle-health risk assessment is completed as part of a physician-reviewed process rather than generated automatically from this short questionnaire.',
    'Continue to create your account and begin your physician-reviewed assessment.',
  ]) {
    t(`[state]  approved copy present: "${line.slice(0, 40)}…"`, HOME.includes(line));
  }
  t('[state]  the approved copy appears only once the entries are received',
    /\{received && \(/.test(HOME) && /setReceived\(true\)/.test(HOME));

  // No value, band, band colour, sub-value or derived text survives.
  t('[safety] no Preliminary value, band or sub-value is computed or held',
    !/computeLeanMassScore|computeRecoveryScore|getRisk\(|RISK_META|setResult\(|composite|leanScore|recoveryScore/.test(HOME));
  t('[safety] no band label, risk-range or /100 rendering remains',
    !/Low Risk|Moderate Risk|High Risk|Preliminary risk range|\/100|Clinical Assessment/.test(HOME));
  t('[safety] the live recovery label beside the sleep slider is gone',
    !/sleepLabel|Optimal for muscle recovery|recovery deficit|recovery impairment/.test(HOME));
  t('[safety] nothing from the form is written to browser storage',
    !/sessionStorage|localStorage/.test(HOME));

  // The pre-existing continuation actions are retained, unchanged.
  t('[state]  the visitor action is the existing sign-up link',
    /href="\/sign-up"/.test(HOME) && /Activate Full Clinical Protocol →/.test(HOME));
  t('[state]  the signed-in action is the existing dashboard link',
    /href="\/dashboard\/assessment"/.test(HOME) && /Go to my dashboard →/.test(HOME));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- C. SRI Containment C1 (K2-C): no email is sent from this page --');
{
  t('[safety] the Preliminary SRI email is no longer requested',
    !/\/api\/protocol-email/.test(HOME) && !/handleEmailSubmit/.test(HOME));
  t('[safety] no second delivery endpoint was introduced',
    !/\/api\/guide-request|\/api\/email-capture|sendServiceEmail|resend/i.test(HOME));
  t('[safety] no consent or preference is created anywhere on the page',
    !/grantConsent|CommunicationPreference|ConsentEvent|\bEDUCATIONAL\b|\bMARKETING\b/.test(HOME));
  t('[truth]  no delivery confirmation is claimed',
    !/Protocol report sent to|report has been sent/i.test(HOME));
}

// ─────────────────────────────────────────────────────────────────────────────
section('-- E. Instrumentation --');
{
  // SRI Containment C1 (K3): sri_generated keeps firing from handleCalculate,
  // guarded, but carries no property — the risk_band property is removed.
  t('[measure] sri_generated still fires from handleCalculate, guarded, with no property',
    /if \(isAnalyticsEnabled\) \{\s*posthog\.capture\(AnalyticsEvents\.SRI_GENERATED\);\s*\}/
      .test(HOME));
  t('[safety]  sri_generated carries no SRI-derived property',
    !/AnalyticsEvents\.SRI_GENERATED\s*,/.test(HOME) && !/risk_band/.test(HOME));

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

  // The email_gate location was removed with the email gate (C1, K2-C).
  t('[measure] the remaining get_started_clicked locations are intact',
    /location: "hero"/.test(HOME)
    && /location: "results_cta"/.test(HOME));
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
    && /capture_pageleave: false/.test(PROVIDER)   // P0 2026-09-29: page-leave capture disabled
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
