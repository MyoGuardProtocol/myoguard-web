// Pure config — no posthog-js import. Safe to import in server and client code.

export const POSTHOG_KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY  ?? '';
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/**
 * Analytics is active only when a key is present AND we are in production,
 * or the developer has explicitly opted in via NEXT_PUBLIC_POSTHOG_ENABLED=true.
 * This keeps local dev sessions clean by default.
 */
export const isAnalyticsEnabled =
  !!POSTHOG_KEY &&
  (process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true');

// Never track: names, emails, SRI values,
// symptoms, protein inputs, weight,
// medical values, or any patient clinical data.
// Only track platform usage events.

// ─── URL / path redaction ─────────────────────────────────────────────────────
//
// MyoGuard uses dynamic routes whose segments are bearer tokens or database
// identifiers. PostHog attaches the full URL to every event as $current_url,
// and carries the previous page forward as $referrer — so without redaction a
// single pageview would transmit a report share token or a patient ID.
//
// Every analytics property that can contain a URL or path is rewritten here to
// its literal Next.js route pattern. This is the single choke point: it applies
// to $pageview, $pageleave, and all custom events alike.
//
// Side benefit: analytics reports show one row per ROUTE instead of one row per
// patient, so "top pages" stays legible instead of exploding in cardinality.

/**
 * Non-`utm_` acquisition parameters preserved on analytics URLs.
 * Everything not matched by `isAllowedQueryParam` is dropped.
 *
 * This is a minimum-necessary acquisition allowlist. Two parameters that the
 * app does use are deliberately EXCLUDED, because neither is categorical:
 *
 *   ref — the physician referral code (`/join?ref=DR-OKPALA-472`). The format is
 *         DR-LASTNAME-NNN, so the value embeds a physician's surname. It is a
 *         direct personal identifier and must never reach analytics.
 *
 *   via — read only as `via === 'qr'` in app/invite/[doctorId]/route.ts, but the
 *         value space is unconstrained: any visitor can put arbitrary text in it.
 *         Referral channel is already captured by the event NAME
 *         (qr_referral_opened vs referral_link_opened), so nothing is lost.
 *
 * Adding a parameter here requires establishing that its value space is closed
 * and non-identifying.
 */
const QUERY_ALLOWLIST = new Set(['gclid', 'fbclid']);

/** Campaign attribution parameters that are safe to retain. */
function isAllowedQueryParam(key: string): boolean {
  const k = key.toLowerCase();
  return k.startsWith('utm_') || QUERY_ALLOWLIST.has(k);
}

/**
 * Ordered most-specific first. The first matching rule wins, so nested routes
 * must precede their parents — otherwise `/doctor/patients/<id>/results/<id>`
 * would have only its first segment redacted.
 */
const REDACTION_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/doctor\/patients\/[^/]+\/results\/[^/]+/, '/doctor/patients/[userId]/results/[assessmentId]'],
  [/^\/doctor\/patients\/[^/]+\/evidence/,       '/doctor/patients/[userId]/evidence'],
  [/^\/doctor\/patients\/[^/]+\/print/,          '/doctor/patients/[userId]/print'],
  [/^\/doctor\/patients\/[^/]+/,                 '/doctor/patients/[userId]'],
  [/^\/doctor\/start-sheet\/[^/]+/,              '/doctor/start-sheet/[id]'],
  [/^\/dashboard\/results\/[^/]+/,               '/dashboard/results/[id]'],
  [/^\/report\/[^/]+/,                           '/report/[token]'],
  [/^\/invite\/[^/]+/,                           '/invite/[doctorId]'],
  [/^\/api\/physician\/patients\/[^/]+/,         '/api/physician/patients/[userId]'],
  [/^\/api\/preload\/[^/]+/,                     '/api/preload/[id]'],
];

/**
 * Public content paths whose own slug must survive redaction.
 *
 * `OPAQUE_SEGMENT` below is a deliberately broad safety net: any segment of 16+
 * characters containing a digit is treated as an identifier. That is correct for
 * tokens and wrong for `/learn/protein-on-glp-1`, which is exactly 16 characters
 * and carries a digit only because the medicine class is named "GLP-1". Without
 * this exemption the article — the first measured step of the patient
 * acquisition funnel — reports as `/learn/[id]` and cannot be distinguished from
 * any future page under the same parent.
 *
 * Exact paths only, never prefixes. A path earns a place here by being known
 * public editorial content with a human-authored slug. A bearer token can never
 * equal an entry in this set, so the exemption cannot widen into a leak.
 */
const PUBLIC_CONTENT_PATHS: ReadonlySet<string> = new Set([
  '/learn',
  '/learn/protein-on-glp-1',
]);

/**
 * Catch-all for dynamic routes added after this file was written.
 *
 * Matches a UUID, or any long segment containing a digit — the shape of a cuid,
 * hex token, or nanoid. The digit requirement is what protects real content
 * slugs: "muscle-preservation" and "protein-requirements" have none, so they
 * survive intact and SEO landing-page reporting still works.
 */
const OPAQUE_SEGMENT =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,})$/i;

/** Rewrites a URL path so no identifier or token survives. Never throws. */
export function redactAnalyticsPath(pathname: string): string {
  if (!pathname) return pathname;

  // Known public content is returned verbatim, ahead of both the rules and the
  // safety net. Matched on the path with any trailing slash removed so that
  // `/learn/` and `/learn` are the same page for reporting purposes.
  const exact = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (PUBLIC_CONTENT_PATHS.has(exact)) return pathname;

  let path = pathname;
  for (const [pattern, replacement] of REDACTION_RULES) {
    if (pattern.test(path)) {
      path = path.replace(pattern, replacement);
      break;
    }
  }

  // Safety net — scrub any remaining identifier-shaped segment.
  return path
    .split('/')
    .map(segment => (OPAQUE_SEGMENT.test(segment) ? '[id]' : segment))
    .join('/');
}

/** Redacts a full URL: path segments rewritten, query reduced to the allowlist. */
function redactAnalyticsUrl(rawUrl: string): string {
  // posthog-js uses the sentinel "$direct" when there is no referrer.
  if (!rawUrl || rawUrl.startsWith('$')) return rawUrl;

  try {
    const url = new URL(rawUrl);
    url.pathname = redactAnalyticsPath(url.pathname);

    for (const key of [...url.searchParams.keys()]) {
      if (!isAllowedQueryParam(key)) url.searchParams.delete(key);
    }

    url.hash = ''; // fragments are never needed and may carry tokens
    return url.toString();
  } catch {
    // Not a parseable absolute URL — treat it as a bare path.
    return redactAnalyticsPath(rawUrl);
  }
}

/** Analytics properties that carry a full URL. */
const URL_PROPERTIES = [
  '$current_url', '$initial_current_url',
  '$referrer',    '$initial_referrer',
  '$referring_domain',
] as const;

/** Analytics properties that carry a bare path. */
const PATH_PROPERTIES = ['$pathname', '$initial_pathname'] as const;

/**
 * Wired into `posthog.init({ sanitize_properties })` — runs against the final
 * property bag of EVERY event before it leaves the browser.
 *
 * `$referring_domain` is a hostname and needs no redaction, but is listed so a
 * future PostHog change that widens it cannot silently reintroduce a leak.
 */
export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  if (!properties) return properties;

  for (const key of URL_PROPERTIES) {
    const value = properties[key];
    if (typeof value === 'string') properties[key] = redactAnalyticsUrl(value);
  }

  for (const key of PATH_PROPERTIES) {
    const value = properties[key];
    if (typeof value === 'string') properties[key] = redactAnalyticsPath(value);
  }

  return properties;
}

/**
 * Centralised event name registry.
 * Changing a string here propagates everywhere automatically.
 * PHI must NEVER appear in event names or properties.
 */
export const AnalyticsEvents = {
  LANDING_PAGE_VIEWED:             'landing_page_viewed',

  // ── Patient acquisition funnel (C-FUNNEL-2) ────────────────────────────────
  //
  // Six stages, none of which carries anything about the person who walked
  // them. The only properties any of these events accepts are categorical
  // labels chosen from a closed set in the code that fires them — never an
  // address, a name, a Sarcopenia Risk Index (SRI) value, a clinical input, a
  // share token, a physician or patient identifier, or a Guide request id.
  LEARN_PAGE_VIEWED:               'learn_page_viewed',
  PROTEIN_ARTICLE_VIEWED:          'protein_article_viewed',
  GUIDE_REQUESTED:                 'guide_requested',
  // Fired when /api/guide-request accepts the request, which is the furthest
  // the browser is permitted to see. That route answers a suppressed send
  // exactly as it answers a delivered one, so that a hard-bounced or complained
  // address cannot be confirmed by asking for the Guide. This event therefore
  // means "accepted by the governed delivery pathway", not "landed in an
  // inbox", and no client-side event can mean the latter without undoing the
  // neutrality the route exists to hold.
  GUIDE_DELIVERY_SUCCEEDED:        'guide_delivery_succeeded',
  // Declared, with no firing site. The only Protein Guide PDF link in the
  // product lives in the delivered ESSENTIAL_SERVICE email and points at a
  // static asset under public/. Instrumenting it would mean either adding a
  // redirect through a tracking route or a second link — and the Guide email
  // is governed to carry one link and no tracking. The name is registered here
  // so the funnel vocabulary is complete and a future on-site PDF surface has
  // one obvious event to use; nothing emits it today.
  GUIDE_PDF_CLICKED:               'guide_pdf_clicked',
  PRELIMINARY_SRI_STARTED_FROM_LEARN: 'preliminary_sri_started_from_learn',

  GET_STARTED_CLICKED:             'get_started_clicked',
  ONBOARDING_STARTED:              'onboarding_started',
  ONBOARDING_COMPLETED:            'onboarding_completed',
  PHYSICIAN_APPLICATION_STARTED:   'physician_application_started',
  PHYSICIAN_APPLICATION_SUBMITTED: 'physician_application_submitted',
  SIGN_IN_SUCCESS:                 'sign_in_success',
  DASHBOARD_OPENED:                'dashboard_opened',
  SRI_GENERATED:                   'sri_generated',
  REPORT_VIEWED:                   'report_viewed',
  REFERRAL_LINK_OPENED:            'referral_link_opened',
  QR_REFERRAL_OPENED:              'qr_referral_opened',
  PATIENT_ASSESSMENT_STARTED:      'patient_assessment_started',
  EMAIL_CAPTURE_SUBMITTED:         'email_capture_submitted',
  DOCTOR_SIGNUP_STARTED:           'doctor_signup_started',
  PHYSICIAN_PATIENT_VIEWED:        'physician_patient_viewed',
  PHYSICIAN_EVIDENCE_VIEWED:       'physician_evidence_viewed',
  PATIENT_ASSESSMENT_COMPLETED:    'patient_assessment_completed',
  DOCTOR_SIGNUP_COMPLETED:         'doctor_signup_completed',
  PHYSICIAN_SRI_REVIEWED:          'physician_sri_reviewed',
  DOCTOR_DASHBOARD_OPENED:         'doctor_dashboard_opened',
  PRACTICE_INTELLIGENCE_OPENED:    'practice_intelligence_opened',
  PHYSICIAN_SUMMARY_COPIED:        'physician_summary_copied',
  SOAP_NOTE_COPIED:                'soap_note_copied',
  TIMELINE_COPIED:                 'timeline_copied',
  EVIDENCE_PRINTED:                'evidence_printed',
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
