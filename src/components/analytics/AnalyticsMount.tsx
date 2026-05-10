"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { isAnalyticsEnabled, type AnalyticsEvent } from "@/src/lib/posthog";

interface Props {
  event: AnalyticsEvent;
  properties?: Record<string, string | number | boolean>;
}

/**
 * Drop-in client component for server components that need to fire a single
 * analytics event on mount without themselves becoming client components.
 *
 * Usage (inside any server component JSX):
 *   <AnalyticsMount event={AnalyticsEvents.DASHBOARD_OPENED} />
 *
 * The ref prevents double-firing in React 18+ StrictMode.
 * Returns null — no DOM output.
 */
export default function AnalyticsMount({ event, properties }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !isAnalyticsEnabled) return;
    fired.current = true;
    posthog.capture(event, properties);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
