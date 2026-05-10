"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { POSTHOG_KEY, POSTHOG_HOST, isAnalyticsEnabled } from "@/src/lib/posthog";

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
