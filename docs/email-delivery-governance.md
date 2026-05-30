# MyoGuard Protocol — Clinical Email Delivery Governance

> **Core Principle:** "The safest email is the email not unnecessarily sent."
>
> These are clinical continuity communications, not marketing campaigns.
> Suppression is a feature, not a failure. Every suppression is logged for auditability.

---

## Overview

BUILD 4C-ii introduces governed, database-anchored scheduled delivery for the two clinical continuity email categories established in BUILD 4B-ii:

| Email Category | Trigger | Audience |
|---|---|---|
| Weekly Pulse Check-In | Vercel Cron — Monday 09:00 UTC | Patients |
| Longitudinal Reflection Summary | Vercel Cron — 1st of month, 09:00 UTC | Patients |

Scheduled delivery does **not** replace on-demand admin dispatch (`/api/email/weekly-pulse`, `/api/email/longitudinal-summary`). Both surfaces coexist. The on-demand routes bypass cron governance and are intended for admin testing and individual one-off sends.

---

## CRON_SECRET Setup

### What it is

`CRON_SECRET` is a Bearer token that Vercel Cron includes in the `Authorization` header of every cron request. Both cron routes verify this token before executing any logic.

### Generating a value

```bash
openssl rand -base64 32
```

Or use any secure random string generator. Store the result — you cannot retrieve it later.

### Where to set it

**Local development** (`.env.local` — never commit):
```
CRON_SECRET=your-generated-secret-here
```

**Vercel (production):**
1. Open the Vercel dashboard → Project → Settings → Environment Variables
2. Add `CRON_SECRET` with the same value
3. Set scope: **Production** (and Preview if testing there)
4. Redeploy after adding

### Security rules

- Never log `CRON_SECRET` or expose it in response bodies
- Never commit it to the repository
- If compromised: rotate immediately in Vercel dashboard and update `.env.local`
- If `CRON_SECRET` is missing at runtime: cron routes return HTTP 500 and log a configuration error

---

## Cron Schedule

| Route | Schedule Expression | Meaning |
|---|---|---|
| `/api/cron/weekly-pulse` | `0 9 * * 1` | Monday, 09:00 UTC |
| `/api/cron/longitudinal-summary` | `0 9 1 * *` | 1st of month, 09:00 UTC |

Schedules are defined in `vercel.json` and documented in `src/lib/email/governance/cadence.ts` (`CRON_SCHEDULES`).

Vercel Cron fires cron jobs as HTTP GET requests to the specified path, with `Authorization: Bearer <CRON_SECRET>` in the header.

---

## Suppression Philosophy

Suppression is a success state, not a failure state.

Every suppression reason is:
- **Deterministic** — the same patient state produces the same outcome
- **Logged** — reason code written to console at each execution
- **Audit-safe** — no PHI in any suppression log line (userId is an internal CUID)
- **Institutionally restrained** — suppression protects patients from unnecessary contact

A suppressed patient is correctly governed. A suppressed batch is a well-governed execution.

---

## Cadence Rules

Defined in `src/lib/email/governance/cadence.ts`.

### Window anchor — `Notification.createdAt` only

All suppression and idempotency window queries must use `Notification.createdAt`, **not** `Notification.sentAt`.

**Rationale:**
- `createdAt` is non-nullable (`@default(now())`). It is always set on every Notification write.
- `sentAt` is nullable (`DateTime?`). A Notification with `sentAt = null` would fall outside any `sentAt`-based window query, producing false negatives and allowing duplicate sends.

This constraint is enforced in `suppression.ts` and `idempotency.ts` and must never be bypassed.

### Weekly Pulse cadence

| Rule | Value |
|---|---|
| Delivery window | Once per patient per 7 days |
| Suppression anchor | `Notification.type = WEEKLY_REMINDER`, `createdAt > now - 7 days` |
| Recent check-in window | 5 days — suppress if patient completed a WeeklyCheckin within this window |
| Minimum data requirement | At least 1 Assessment on record |

### Longitudinal Summary cadence

| Rule | Value |
|---|---|
| Delivery window | Once per patient per 30 days |
| Suppression anchor | `Notification.type = LONGITUDINAL_SUMMARY`, `createdAt > now - 30 days` |
| Minimum data — Condition A | ≥ 2 Assessments in prior 60 days |
| Minimum data — Condition B | ≥ 3 WeeklyCheckin records in prior 30 days |
| Data requirement logic | Condition A **OR** Condition B must be met |

---

## Suppression Checks

### Weekly Pulse — suppression hierarchy

Evaluated in order. First match wins.

| Priority | Check | Reason code |
|---|---|---|
| 1 | `User.email` is empty or falsy | `no_email_address` |
| 2 | `User.isVerified = false` | `email_not_verified` |
| 3 | No Assessment records exist for patient | `no_assessment_history` |
| 4 | `WEEKLY_REMINDER` Notification exists within 7 days (`createdAt`) | `weekly_pulse_sent_within_cadence_window` |
| 5 | WeeklyCheckin with non-null `completedAt` within 5 days | `patient_completed_checkin_within_5_days` |
| — | None of the above — patient is eligible | `eligible` |

### Longitudinal Summary — suppression hierarchy

| Priority | Check | Reason code |
|---|---|---|
| 1 | `User.email` is empty or falsy | `no_email_address` |
| 2 | `LONGITUDINAL_SUMMARY` Notification exists within 30 days (`createdAt`) | `longitudinal_summary_sent_within_cadence_window` |
| 3 | Neither minimum data condition met | `insufficient_longitudinal_data` |
| — | None of the above — patient is eligible | `eligible` |

---

## Batch Limit

Maximum **50 patients** are processed per cron execution.

If more than 50 patients are eligible after suppression:
- The 50 patients with the oldest last check-in date (ascending) are processed first
- Remaining patients are processed in the next cron execution
- No patients are permanently skipped — they cycle through naturally

The 50-patient limit prevents unbounded send volume in a single invocation and provides a natural delivery throughput ceiling.

---

## Idempotency

Two-layer design:

**Layer 1 — Suppression (pre-qualification):**
Before a patient enters the send queue, the Notification table is queried for a recent record of the correct type within the cadence window. Patients with a recent record are excluded entirely.

**Layer 2 — Pre-send guard:**
Immediately before calling `sendEmail()` for each patient, the Notification table is re-queried. This guards against the case where two concurrent cron invocations both pass Layer 1 before either writes a Notification record.

Both layers query: `userId + type + createdAt > (now - cadence window)`.

No Redis, no distributed locks, no in-memory state. All idempotency is database-anchored.

**Residual risk:** If two invocations are simultaneous and both pass Layer 2 before either writes, the patient could receive two emails in that cycle. The probability is low (Vercel does not typically double-fire within a single cadence window). The 7-day and 30-day windows ensure this cannot result in sustained over-communication.

---

## Notification Logging

Every successful cron-triggered send writes a `Notification` record.

| Field | Weekly Pulse | Longitudinal Summary |
|---|---|---|
| `type` | `WEEKLY_REMINDER` | `LONGITUDINAL_SUMMARY` |
| `subject` | `MyoGuard Weekly Pulse Check-In` | `Your MyoGuard Longitudinal Summary` |
| `body` | `{ riskBand, trendStatus }` (JSON) | `{ riskBand, trendStatus, assessmentCount }` (JSON) |
| `sentAt` | Set to send time | Set to send time |
| `createdAt` | Auto — `@default(now())` | Auto — `@default(now())` |

`createdAt` is the idempotency and dedup anchor. `sentAt` is informational.

---

## AuditLog Behavior

Each cron execution writes one `AuditLog` record (fire-and-forget — failure does not block the cron response).

| Field | Value |
|---|---|
| `actorId` | `"system:cron"` (sentinel for system-generated entries) |
| `action` | `"CRON_EXECUTED"` |
| `targetType` | `"CronExecution"` |
| `targetId` | `null` (batch operation — no single target) |
| `metadata` | Structured JSON (see below) |

### Example AuditLog `metadata` payload

**Weekly Pulse:**
```json
{
  "cronType": "weekly_pulse",
  "candidateCount": 142,
  "patientsProcessed": 50,
  "emailsSent": 38,
  "suppressed": 98,
  "errors": 2,
  "executionMs": 4821
}
```

**Longitudinal Summary:**
```json
{
  "cronType": "longitudinal_summary",
  "candidateCount": 142,
  "patientsProcessed": 31,
  "emailsSent": 28,
  "suppressed": 111,
  "errors": 0,
  "executionMs": 6103
}
```

The `AuditLog.metadata` field is `Json?` — structured payloads are stored natively without encoding.

---

## Governance File Structure

```
src/lib/email/governance/
  cadence.ts        — Delivery windows, batch limits, suppression thresholds
  suppression.ts    — All suppression check functions (database-anchored)
  idempotency.ts    — Layer 2 pre-send idempotency guard

app/api/cron/
  weekly-pulse/
    route.ts        — Cron route: auth, fan-out, AuditLog, response
  longitudinal-summary/
    route.ts        — Cron route: auth, fan-out, AuditLog, response

app/api/email/
  weekly-pulse/
    route.ts        — On-demand admin dispatch (bypasses cron governance)
  longitudinal-summary/
    route.ts        — On-demand admin dispatch (bypasses cron governance)
```

---

## NotificationType Enum — Relevant Values

| Value | Purpose | Added |
|---|---|---|
| `WEEKLY_REMINDER` | Weekly Pulse delivery anchor | Initial schema |
| `LONGITUDINAL_SUMMARY` | Longitudinal Summary delivery anchor | BUILD 4C-ii |
| `PHYSICIAN_REVIEW` | Physician Priority Review anchor | BUILD 4C-i |
| `REPORT_READY` | Retained — original purpose | Initial schema |

---

## What Is Deferred

The following are explicitly out of scope for BUILD 4C-ii and are not implemented:

- **Email preferences UI** — no patient-facing unsubscribe or frequency settings
- **Unsubscribe management** — no one-click unsubscribe or suppression list UI
- **Retry queue** — failed sends are logged and counted; no automatic retry
- **Delivery analytics dashboard** — operational data is in AuditLog; no UI surface
- **Physician notification preferences** — not implemented
- **Patient notification preferences** — not implemented
- **Engagement scoring** — not implemented; suppression is clinical, not behavioral
- **Streak gamification** — not implemented in this layer

---

*MyoGuard Protocol — Meridian Wellness Systems LLC*
*Clinical Decision Support · myoguard.health*
