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

/**
 * Centralised event name registry.
 * Changing a string here propagates everywhere automatically.
 * PHI must NEVER appear in event names or properties.
 */
export const AnalyticsEvents = {
  LANDING_PAGE_VIEWED:             'landing_page_viewed',
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
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
