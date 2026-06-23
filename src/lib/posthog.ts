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
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
