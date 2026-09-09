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
  useEffect(() => {
    if (!isAnalyticsEnabled) return;
    posthog.init(POSTHOG_KEY, {
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
    });
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
