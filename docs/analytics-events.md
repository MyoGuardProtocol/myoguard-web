# MyoGuard Protocol — Analytics Event Reference

PostHog project API key and host are configured via `NEXT_PUBLIC_POSTHOG_KEY` and
`NEXT_PUBLIC_POSTHOG_HOST`. See `.env.example` for setup instructions.

Analytics are **disabled in development** unless `NEXT_PUBLIC_POSTHOG_ENABLED=true` is set.

---

## Privacy Rules

| Rule | Detail |
|---|---|
| No PHI | Patient names, email addresses, DOB, weight, and clinical inputs are **never** sent to PostHog |
| No raw SRI values | SRI composite output is not transmitted. Only `risk_band` (LOW / MODERATE / HIGH) is captured on `sri_generated` |
| No assessment payloads | Form field values from the SRI form, protocol details, and drug dosage data are excluded |
| No identifiers in URLs | Enforced by `sanitize_properties` — see **URL Redaction** below. `$current_url`, `$pathname` and `$referrer` are rewritten to Next.js route patterns before any event leaves the browser |
| No autocapture | PostHog `autocapture: false` — all events are explicit and reviewed |
| Server-side only where possible | Referral events are captured via server-side PostHog HTTP API, not the browser SDK |

---

## Event Catalogue

### `landing_page_viewed`
- **Trigger:** On mount of the homepage (`app/page.tsx`)
- **Properties:** none
- **Business meaning:** Top-of-funnel — measures unique visits to the SRI landing page
- **PHI exclusions:** none captured

---

### `get_started_clicked`
- **Trigger:** Click on any "Create free account" / "Activate Full Clinical Protocol" CTA on the landing page
- **Properties:** `location` — one of `hero`, `results_cta`, `email_gate`
- **Business meaning:** Conversion intent signal — identifies which CTA placement drives sign-up clicks
- **PHI exclusions:** none captured

---

### `sri_generated`
- **Trigger:** User submits the SRI form and a result is rendered (`handleCalculate` in `app/page.tsx`)
- **Properties:** `risk_band` — `LOW` | `MODERATE` | `HIGH`
- **Business meaning:** Core product usage metric — indicates the SRI tool was used to completion
- **PHI exclusions:** Raw SRI composite, protein targets, weight, drug, dose, and GI symptoms are **not** sent

---

### `onboarding_started`
- **Trigger:** Defined; not yet wired — reserved for `/onboarding` page when patient begins account setup
- **Properties:** none
- **Business meaning:** Patient funnel step — new user initiated the onboarding sequence

---

### `onboarding_completed`
- **Trigger:** Defined; not yet wired — reserved for post-onboarding dashboard redirect
- **Properties:** none
- **Business meaning:** Patient funnel step — user reached dashboard after full onboarding

---

### `physician_application_started`
- **Trigger:** On mount of `OnboardingForm.tsx` (physician credential submission form)
- **Properties:** none
- **Business meaning:** Physician acquisition funnel — physician began credential registration
- **PHI exclusions:** NPI, specialty, name, and country are **not** sent

---

### `physician_application_submitted`
- **Trigger:** Successful POST to `/api/doctor/onboarding` inside `OnboardingForm.tsx`
- **Properties:** none
- **Business meaning:** Physician acquisition funnel — credential application submitted for review
- **PHI exclusions:** Credential data (NPI, license number, specialty) is **not** sent

---

### `sign_in_success`
- **Trigger:** Defined; not yet wired — recommended implementation via Clerk webhook (`user.session.created`) or `PostAuthSync.tsx`
- **Properties:** none
- **Business meaning:** Active user signal — distinguishes returning vs. new users

---

### `dashboard_opened`
- **Trigger:** On mount of `app/dashboard/page.tsx` via `AnalyticsMount`
- **Properties:** none
- **Business meaning:** Patient engagement — user actively accessed their clinical dashboard
- **PHI exclusions:** User role, name, and assessment data are **not** sent

---

### `report_viewed`
- **Trigger:** On mount of `app/dashboard/report/page.tsx` (authenticated) or `app/report/[token]/page.tsx` (shared token)
- **Properties:** `context` — `shared_token` (public report only; absent on authenticated report)
- **Business meaning:** Engagement depth — patient or physician opened the full clinical report
- **PHI exclusions:** Assessment content, SRI output, and patient identity are **not** sent

---

### `referral_link_opened`
- **Trigger:** `GET /invite/[doctorId]` route handler — fired server-side via PostHog HTTP API before the referral cookie is set and the redirect fires
- **Properties:** `doctor_id` — a **SHA-256 hash** of the physician's internal `User.id`. The raw database ID is never transmitted. The hash is stable, so referral volume remains comparable per physician, but the value is not usable outside the application.
- **Business meaning:** Referral funnel — a patient followed a physician's invite link
- **PHI exclusions:** Patient identity is unknown at this point; no patient data sent

---

### `qr_referral_opened`
- **Trigger:** Same route as `referral_link_opened` but with `?via=qr` query parameter present
- **Properties:** `doctor_id` — SHA-256 hashed, as above
- **Business meaning:** Referral channel attribution — distinguishes QR code scans from manual link sharing
- **Implementation note:** Physician-generated QR codes must append `?via=qr` to the invite URL for this event to fire

---

## Event Summary Table

| Event | Fired from | Type | Status |
|---|---|---|---|
| `landing_page_viewed` | `app/page.tsx` | Client | ✅ Wired |
| `get_started_clicked` | `app/page.tsx` | Client | ✅ Wired |
| `onboarding_started` | — | Client | 🔲 Reserved |
| `onboarding_completed` | — | Client | 🔲 Reserved |
| `physician_application_started` | `OnboardingForm.tsx` | Client | ✅ Wired |
| `physician_application_submitted` | `OnboardingForm.tsx` | Client | ✅ Wired |
| `sign_in_success` | — | Client | 🔲 Reserved |
| `dashboard_opened` | `app/dashboard/page.tsx` | Client (mount) | ✅ Wired |
| `sri_generated` | `app/page.tsx` | Client | ✅ Wired |
| `report_viewed` | `app/dashboard/report/page.tsx`, `app/report/[token]/page.tsx` | Client (mount) | ✅ Wired |
| `referral_link_opened` | `app/invite/[doctorId]/route.ts` | Server | ✅ Wired |
| `qr_referral_opened` | `app/invite/[doctorId]/route.ts` | Server | ✅ Wired (`?via=qr`) |

---

## Architecture Notes

- **Client events** use `posthog-js` via `PostHogProvider` (mounted in `app/layout.tsx`)
- **Server route events** use fire-and-forget `fetch()` to the PostHog HTTP Capture API — no package dependency
- **Server component events** use `AnalyticsMount` — a thin `"use client"` component that fires once on mount without converting the parent server component
- **`autocapture: false`** prevents PostHog from capturing click text, input values, or form data automatically
- **`isAnalyticsEnabled`** guard in `src/lib/posthog.ts` ensures zero events leave the browser in development unless explicitly opted in
- **`disable_session_recording: true`** is set in code, not merely left off in the PostHog dashboard — a dashboard toggle must never be able to start recording clinical forms or credential fields. `mask_all_text` and `mask_all_element_attributes` are set as a second layer.
- **`person_profiles: 'identified_only'`** with no `posthog.identify()` call anywhere — no person profile is ever created for a patient or physician

---

## URL Redaction (Build 8C-1)

MyoGuard uses dynamic routes whose segments are bearer tokens or database
identifiers. PostHog attaches the full URL to every event as `$current_url`, and
carries the previous page forward as `$referrer`. Without redaction, a single
pageview would transmit a report share token or a patient ID to a third party.

`sanitize_properties` — wired in `PostHogProvider.tsx`, implemented in
`src/lib/posthog.ts` — runs against the final property bag of **every** event
(`$pageview`, `$pageleave`, and all custom events alike). It is the single choke
point for this class of leak.

**Properties rewritten:** `$current_url`, `$initial_current_url`, `$referrer`,
`$initial_referrer`, `$referring_domain`, `$pathname`, `$initial_pathname`.

| Actual route | Transmitted as |
|---|---|
| `/report/<share-token>` | `/report/[token]` |
| `/doctor/patients/<userId>` | `/doctor/patients/[userId]` |
| `/doctor/patients/<userId>/evidence` | `/doctor/patients/[userId]/evidence` |
| `/doctor/patients/<userId>/print` | `/doctor/patients/[userId]/print` |
| `/doctor/patients/<userId>/results/<assessmentId>` | `/doctor/patients/[userId]/results/[assessmentId]` |
| `/dashboard/results/<id>` | `/dashboard/results/[id]` |
| `/doctor/start-sheet/<id>` | `/doctor/start-sheet/[id]` |
| `/invite/<doctorId>` | `/invite/[doctorId]` |

Query strings are reduced to a **minimum-necessary acquisition allowlist** —
`utm_*`, `gclid`, `fbclid`. All other parameters and the URL fragment are
dropped, so a future token-bearing query parameter cannot leak. A catch-all also
rewrites any UUID-shaped or long identifier-shaped segment to `[id]`, so routes
added after this build are covered by default.

Two parameters the app itself uses are **deliberately excluded**, because
neither has a closed, non-identifying value space:

| Parameter | Why excluded |
|---|---|
| `ref` | The physician referral code (`/join?ref=DR-OKPALA-472`). Format is `DR-LASTNAME-NNN`, so the value **embeds a physician's surname** — a direct personal identifier. |
| `via` | Read only as `via === 'qr'` in `app/invite/[doctorId]/route.ts`, but nothing constrains the value: any visitor can supply arbitrary text. Referral channel is already captured by the event **name** (`qr_referral_opened` vs `referral_link_opened`), so no analytic value is lost. |

Adding a parameter to the allowlist requires first establishing that its value
space is closed and non-identifying.

Public content slugs are deliberately **not** redacted — `/research/muscle-preservation`
and similar must survive intact or SEO landing-page reporting is destroyed.

**Regression guard:** `npm run audit:analytics` (`scripts/analytics-url-audit.mjs`)
asserts every row above, plus the preservation of public routes. It requires no
PostHog key, no network, and no database. Run it before enabling analytics and
after adding any dynamic route.
