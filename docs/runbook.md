# MyoGuard Protocol — Operations Runbook

Incident response, deployment procedures, and common troubleshooting for the MyoGuard Protocol app.

---

## Table of Contents

1. [Pre-deploy checklist](#1-pre-deploy-checklist)
2. [Deployment (Vercel)](#2-deployment-vercel)
3. [Database operations](#3-database-operations)
4. [Incident: users can't sign in](#4-incident-users-cant-sign-in)
5. [Incident: dashboard shows "profile data temporarily unavailable"](#5-incident-dashboard-shows-profile-data-temporarily-unavailable)
6. [Incident: email delivery not working](#6-incident-email-delivery-not-working)
7. [Incident: database connection errors](#7-incident-database-connection-errors)
8. [Incident: payments not processing](#8-incident-payments-not-processing)
9. [Health check & diagnostics](#9-health-check--diagnostics)
10. [Environment variables reference](#10-environment-variables-reference)

---

## 1. Pre-deploy checklist

Run before every production deployment:

```bash
# 1. Validate all environment variables
npm run preflight:strict

# 2. Check Prisma schema is in sync
npx prisma validate
npx prisma db push --preview-feature   # or: npx prisma migrate deploy

# 3. Regenerate Prisma client
npx prisma generate

# 4. Build
npm run build
```

If `preflight:strict` exits 1, stop and fix the reported issues before deploying.

---

## 2. Deployment (Vercel)

### Initial setup

1. Connect repo to Vercel (Import Project)
2. Set all environment variables in **Vercel Dashboard → Settings → Environment Variables**
   - Use separate values for Preview vs Production environments
   - Production: `pk_live_` / `sk_live_` Clerk keys; `sk_live_` Stripe key
   - Preview: `pk_test_` / `sk_test_` keys are fine
3. Set `NEXT_PUBLIC_APP_URL` = your Vercel production URL (or `https://myoguard.health` once domain is live)

### Promoting to production

```bash
# Verify current env on Vercel
vercel env ls

# Pull Vercel env to local .env.local for testing
vercel env pull .env.local

# Deploy to production
vercel --prod
```

### Post-deploy verification

1. Visit `https://myoguard.health/admin/health` — confirm all checks are green
2. Create a test sign-up and verify the welcome email arrives
3. Check Supabase → Table Editor → `users` — confirm the new user row was created
4. Confirm the Clerk webhook fired: Clerk Dashboard → Webhooks → recent deliveries

---

## 3. Database operations

### Push schema changes

```bash
# From project root (prisma.config.ts picks up .env automatically)
npx prisma db push

# Expected output: "The database is already in sync with the Prisma schema"
# Or: "Your database is now in sync with your Prisma schema"
```

### Generate Prisma client after schema changes

```bash
npx prisma generate
# Always run this after any schema.prisma edit
```

### Browse data

```bash
npx prisma studio
# Opens http://localhost:5555 — full DB browser
```

### Common Prisma errors

| Error | Cause | Fix |
|-------|-------|-----|
| `P1012: datasource property 'url' is no longer supported` | `url`/`directUrl` in `schema.prisma` (Prisma 7 breaking change) | Remove them from `schema.prisma`; keep only in `prisma.config.ts` |
| `Connection url is empty` | `prisma.config.ts` can't load `.env` | Ensure `import 'dotenv/config'` is at top of `prisma.config.ts` and `.env` exists in project root |
| `Can't reach database server` | `DATABASE_URL` hostname wrong or Supabase paused | Check Supabase project is active; verify hostname in dashboard |
| `password authentication failed` | Wrong password or wrong username format | Confirm `postgres.[project-ref]` username for pooler; `postgres` only for direct |

---

## 4. Incident: users can't sign in

**Symptom:** "No account found for this email address" — user knows they registered.

### Diagnosis

```bash
# Decode which Clerk instance is active
echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" | \
  node -e "
    const k = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
    const enc = k.replace(/^pk_(test|live)_/, '');
    console.log(Buffer.from(enc, 'base64').toString('utf8'));
  "
```

Or check directly: `pk_test_` = dev sandbox, `pk_live_` = production.

### Root causes

**A. Wrong Clerk instance (most common)**
- Test keys (`pk_test_`) and live keys (`pk_live_`) are completely separate user databases
- If users registered under a live instance but the app is using test keys, their accounts don't exist in the test database
- **Fix:** Set the correct `pk_live_` / `sk_live_` keys in Vercel env vars and redeploy

**B. Clerk instance was recreated**
- Creating a new Clerk application creates a new instance — all prior users are in the old instance
- **Fix:** Use the original Clerk application (check Clerk Dashboard for the correct app)

**C. User registered with different email**
- Check Clerk Dashboard → Users → search by email
- **Fix:** Have user try alternative email addresses

**D. Sign-in URL mismatch**
- Clerk Dashboard redirect URLs must match `NEXT_PUBLIC_CLERK_SIGN_IN_URL` in env
- If they don't match, Clerk returns users to the wrong page
- **Fix:** Align Clerk Dashboard → Redirects with env vars (`/sign-in-new`)

---

## 5. Incident: dashboard shows "profile data temporarily unavailable"

**Symptom:** Authenticated user sees amber banner on dashboard instead of their data.

### Diagnosis

Check server logs for:
```
[dashboard] user not found  clerkId=user_xxx
[dashboard] db error        Error: ...
```

### Root causes

**A. User row missing from DB (most common after re-keying Clerk)**
- Clerk webhook wasn't fired or failed when user signed up
- Check: Supabase → Table Editor → `users` → filter by Clerk ID
- **Fix (one-off):** Manually insert the missing user row:
  ```sql
  INSERT INTO users (clerk_id, email, role, created_at)
  VALUES ('user_xxx', 'user@example.com', 'PATIENT', NOW());
  ```
- **Fix (systemic):** Ensure `CLERK_WEBHOOK_SECRET` is set and the webhook endpoint `/api/webhooks/clerk` is registered in Clerk Dashboard

**B. Database unreachable**
- See [Incident: database connection errors](#7-incident-database-connection-errors)

**C. `protocolPlan` relation error**
- If the `protocolPlans` table is missing or has a schema mismatch, the Prisma query including `protocolPlan` in its select will throw
- **Fix:** Run `npx prisma db push` to sync the schema

---

## 6. Incident: email delivery not working

**Symptom A:** "Email delivery is not available right now" amber banner in UI.
**Symptom B:** Welcome email never arrives after sign-up.

### Diagnosis

```bash
# Check if key is set
grep RESEND_API_KEY .env

# Check /api/email-capture response
curl -X POST https://myoguard.health/api/email-capture \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# Look for: {"ok":true,"delivered":false}  → RESEND_API_KEY missing
# Look for: {"ok":true,"delivered":true}   → working
```

Check server logs for:
```
[email-capture] RESEND_API_KEY not configured — skipping delivery
[email/welcome] RESEND_API_KEY not set — skipping welcome email
[email/welcome] Resend error 403 ...
```

### Root causes

**A. `RESEND_API_KEY` not set**
- **Fix:** Get API key from [resend.com/api-keys](https://resend.com/api-keys), set in `.env` and Vercel env vars

**B. `RESEND_API_KEY` is the placeholder value**
- `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` is the example value — it's treated as missing
- **Fix:** Replace with a real key from Resend

**C. Sending domain not verified (403 from Resend)**
- `protocol@myoguard.health` will be rejected until `myoguard.health` is verified in Resend
- **Fix:**
  1. Resend Dashboard → **Domains** → **Add Domain** → `myoguard.health`
  2. Add the SPF, DKIM, and DMARC DNS records via your DNS provider (Cloudflare, etc.)
  3. Click **Verify** — DNS propagation takes 5–60 minutes

**D. Resend rate limit or account issue**
- Check Resend Dashboard → Logs for delivery failures
- Free Resend tier: 100 emails/day; 3,000/month

---

## 7. Incident: database connection errors

**Symptom:** `500 Internal Server Error` on API routes; Prisma errors in logs.

### Common Prisma error codes

| Code | Meaning | Fix |
|------|---------|-----|
| `P1001` | Can't reach database server | Check Supabase project status; verify `DATABASE_URL` hostname |
| `P1002` | Database server reached but timed out | Supabase free tier auto-pauses — visit dashboard to wake it |
| `P2002` | Unique constraint violation | Duplicate record being inserted |
| `P2025` | Record not found | `findUniqueOrThrow`/`update` on non-existent record |

### Supabase free-tier auto-pause

Supabase free projects pause after ~1 week of inactivity. Symptoms:
- `ETIMEDOUT` or `ENOTFOUND` in connection errors
- Health check shows `Connection timed out. Supabase free-tier projects auto-pause after inactivity.`

**Fix:** Visit [supabase.com/dashboard](https://supabase.com/dashboard), open your project — it will resume automatically. Takes ~30 seconds.

### Test the database connection

```bash
# From project root
node -e "
  require('dotenv/config');
  const { PrismaClient } = require('.prisma/client');
  const prisma = new PrismaClient();
  prisma.\$queryRaw\`SELECT 1\`.then(() => { console.log('OK'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); });
"
```

---

## 8. Incident: payments not processing

**Symptom:** Checkout redirects to Stripe but payment doesn't complete; subscription status not updating.

### Diagnosis

1. Check Stripe Dashboard → **Developers** → **Logs** for failed API calls
2. Check Stripe Dashboard → **Webhooks** → endpoint → **recent deliveries** for failed events
3. Check server logs for `[stripe]` prefix errors

### Root causes

**A. Test mode in production**
- `sk_test_` key in production — real card payments will fail (only Stripe test cards work)
- **Fix:** Set `sk_live_` / `pk_live_` keys in Vercel env vars

**B. `STRIPE_PRICE_ID` missing or wrong**
- Checkout session creation fails silently or throws
- **Fix:** Confirm Price ID from Stripe Dashboard → Products

**C. `STRIPE_WEBHOOK_SECRET` missing**
- Stripe webhook events (subscription updates) are rejected with 400
- Subscription status never syncs to database — users remain on free tier after paying
- **Fix:** Set `STRIPE_WEBHOOK_SECRET` from Stripe Dashboard → Webhooks → your endpoint → Signing Secret

**D. Webhook endpoint not registered**
- **Fix:** Stripe Dashboard → Developers → Webhooks → Add endpoint → `https://myoguard.health/api/webhooks/stripe`
- Subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

---

## 9. Health check & diagnostics

### Visual dashboard (browser)

```
https://myoguard.health/admin/health
```
Requires ADMIN role in the database. Shows per-service status with context-specific fix hints.

### JSON API

```bash
curl https://myoguard.health/api/health \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN"
```

Returns a `HealthReport`:
```json
{
  "overall": "warn",
  "environment": "production",
  "timestamp": "2026-03-29T...",
  "checks": [
    { "name": "Database (runtime)", "status": "ok", "message": "Connected and responsive (45 ms)", "detail": "aws-1-us-east-1.pooler.supabase.com:6543" },
    { "name": "Clerk", "status": "warn", "message": "TEST instance active in production", "detail": "Instance: suited-mule-74.clerk.accounts.dev" },
    ...
  ]
}
```

HTTP status: `200` when overall is `ok` or `warn`; `503` when overall is `error`.

### Startup config log

On every server cold start, `instrumentation.ts` runs `checkConfig()` which emits `[config]`-prefixed log lines to stdout:

```
[config] ✓ DATABASE_URL  aws-1-us-east-1.pooler.supabase.com:6543
[config] ✓ DIRECT_URL    db.fyfgsuyytxplewsstwpe.supabase.co:5432
[config] ⚠ CLERK: test instance in production  suited-mule-74.clerk.accounts.dev
[config] ⚠ RESEND_API_KEY placeholder detected — email delivery disabled
```

View in Vercel Dashboard → your deployment → **Functions** → **Logs**.

### Preflight CLI

Run locally or in CI before deployment:

```bash
npm run preflight          # exit 0 if required vars present; exit 1 on errors
npm run preflight:strict   # exit 1 on warnings too
npm run preflight:ci       # same as strict + no ANSI colours (machine-readable)
```

---

## 10. Environment variables reference

See [docs/configuration.md](./configuration.md) for the complete variable reference including:
- Exact URL formats with field-by-field explanations
- Clerk test vs live instance guidance
- Domain verification steps for Resend
- Prisma 7 configuration notes
