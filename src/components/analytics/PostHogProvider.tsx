"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import {
  POSTHOG_KEY,
  POSTHOG_HOST,
  isAnalyticsEnabled,
  sanitizeAnalyticsProperties,
} from "@/src/lib/posthog";

/**
 * Initialises PostHog, once, as early as this module is evaluated.
 *
 * WHY THIS IS NOT IN AN EFFECT — the C-FUNNEL-2B defect.
 * It was, and that was wrong in a way that lost events silently. This provider
 * wraps `{children}` in the root layout, so every instrumented page is a
 * DESCENDANT of it, and React runs descendant effects before ancestor effects.
 * Any component firing an event from a mount effect — `AnalyticsMount`, the
 * landing page's own `landing_page_viewed` — therefore ran BEFORE `init()`, and
 * posthog-js discards a `capture()` made before initialisation with nothing but
 * a console warning. On a first page load the entry page's mount event was
 * always lost; the same event survived on client-side navigation, because by
 * then init had long since run. That is why the defect looked intermittent.
 *
 * `$pageview` escaped it by accident rather than design: `PageView` sits inside
 * a Suspense boundary reading `useSearchParams()`, so its effect re-fires once
 * the client resolves the query string, by which time init has completed.
 *
 * Module evaluation happens when the chunk loads, before React renders anything
 * and therefore before every effect in the tree. Moving the call here makes
 * initialisation ordering-independent, so no call site needs to know about it
 * and none had to change.
 *
 * Idempotent and SSR-safe: guarded on `window`, and the flag makes a second
 * call a no-op if this module is ever evaluated twice. No option, event name,
 * UTM handling or person-profile policy is altered — this changes WHEN init
 * runs and nothing else.
 */
const POSTHOG_INIT_OPTIONS = {
  api_host: POSTHOG_HOST,
  capture_pageview: false,   // manual via PageView component
  capture_pageleave: true,
  autocapture: false,        // explicit events only — no accidental PHI capture
  persistence: "localStorage+cookie",

  // Anonymous-only. No posthog.identify() call exists anywhere in the app,
  // so no person profile is ever created for a patient or physician.
  person_profiles: "identified_only",

  // Session recording is refused in code, not merely left off in the
  // PostHog dashboard — a dashboard toggle must never be able to start
  // recording clinical forms (/dashboard/assessment, /doctor/start-sheet)
  // or credential fields (NPI, licence number) on a health platform.
  disable_session_recording: true,
  mask_all_text: true,
  mask_all_element_attributes: true,

  // Strips report share tokens and patient/assessment/physician IDs out of
  // $current_url, $pathname and $referrer on every event. See src/lib/posthog.ts.
  sanitize_properties: sanitizeAnalyticsProperties,
} as const;

let posthogReady = false;

function ensurePostHogInitialised(): void {
  if (posthogReady) return;
  if (typeof window === 'undefined') return;   // never during SSR / prerender
  if (!isAnalyticsEnabled) return;             // no key, or not production

  posthogReady = true;
  posthog.init(POSTHOG_KEY, POSTHOG_INIT_OPTIONS);
}

// Runs on import — ahead of the first render, and so ahead of every effect.
ensurePostHogInitialised();

/**
 * Fires a PostHog $pageview on every client-side navigation.
 * Must live inside a Suspense boundary because useSearchParams()
 * opts the subtree out of static prerendering.
 */
function PageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isAnalyticsEnabled) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Root analytics provider — mount once in app/layout.tsx inside ClerkProvider.
 *
 * Behaviour:
 *  • Production (NEXT_PUBLIC_POSTHOG_KEY set): initialises PostHog and tracks pageviews.
 *  • Development (no key or NEXT_PUBLIC_POSTHOG_ENABLED != "true"): PHProvider is still
 *    rendered so usePostHog() is always safe to call, but posthog.init() is skipped,
 *    meaning no events leave the browser.
 */
export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt and braces. Initialisation already happened at module evaluation
  // above; this covers the one case module scope cannot — a module graph
  // evaluated on the server and only hydrated here. It is idempotent, so on
  // every normal load it is a no-op.
  useEffect(() => {
    ensurePostHogInitialised();
  }, []);

  return (
    <PHProvider client={posthog}>
      {isAnalyticsEnabled && (
        <Suspense>
          <PageView />
        </Suspense>
      )}
      {children}
    </PHProvider>
  );
}
