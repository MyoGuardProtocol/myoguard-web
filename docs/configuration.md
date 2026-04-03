# MyoGuard Protocol — Configuration Reference

Complete reference for all environment variables used by the application.
Copy `.env.example` → `.env` and fill in values. Run `npm run preflight` to validate.

---

## Quick-start checklist

| # | Variable | Required | Where to get it |
|---|----------|----------|-----------------|
| 1 | `DATABASE_URL` | ✅ | Supabase Dashboard → Settings → Database → Connection Pooling |
| 2 | `DIRECT_URL` | ✅ (for migrations) | Supabase Dashboard → Settings → Database → Direct Connection |
| 3 | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk Dashboard → API Keys |
| 4 | `CLERK_SECRET_KEY` | ✅ | Clerk Dashboard → API Keys |
| 5 | `CLERK_WEBHOOK_SECRET` | ⚠️ | Clerk Dashboard → Webhooks → Signing Secret |
| 6 | `RESEND_API_KEY` | ⚠️ | resend.com → API Keys |
| 7 | `NEXT_PUBLIC_APP_URL` | ⚠️ | Your Vercel URL or `https://myoguard.health` |
| 8 | `STRIPE_SECRET_KEY` | ⚠️ (payments) | Stripe Dashboard → Developers → API Keys |
| 9 | `STRIPE_PRICE_ID` | ⚠️ (payments) | Stripe Dashboard → Products |
| 10 | `STRIPE_WEBHOOK_SECRET` | ⚠️ (payments) | Stripe Dashboard → Webhooks |

✅ = app will crash or silently fail without this
⚠️ = feature will be degraded or disabled without this

---

## Database

### `DATABASE_URL`
**Required.** Prisma runtime connection through PgBouncer (transaction-mode pooler).

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Critical details:**
- Port **6543** — this is the pooler port, not the direct database port
- Username **must** be `postgres.[project-ref]` (e.g. `postgres.fyfgsuyytxplewsstwpe`) for Supabase regional pooler routing — using just `postgres` silently routes to the wrong host
- Query string `?pgbouncer=true` disables Prisma features incompatible with PgBouncer (e.g. `LISTEN/NOTIFY`, prepared statements)

**Where to find:** Supabase Dashboard → your project → Settings → Database → **Connection Pooling** tab → Transaction mode → copy the connection string.

---

### `DIRECT_URL`
**Required for migrations.** Direct connection to Postgres, bypassing PgBouncer.

```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Critical details:**
- Port **5432** — direct Postgres port
- Username is just `postgres` (no project ref suffix needed for direct connections)
- This URL is used **only** by `prisma.config.ts` during `prisma db push` / `prisma migrate` — it is never used at application runtime

**Where to find:** Supabase Dashboard → Settings → Database → **Direct Connection** section.

---

## Clerk Authentication

### `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`
**Required.** Authentication provider keys.

**⚠️ Test vs Live instances are completely separate:**
- `pk_test_` / `sk_test_` → Dev sandbox. Users created here **do not exist** in the live instance.
- `pk_live_` / `sk_live_` → Production. Users created here **do not exist** in the dev instance.
- Swapping keys in a running production app will make all existing users appear to vanish.

**To decode which Clerk instance a key belongs to:**
```bash
echo "pk_test_c3VpdGVkLW11bGUtNzQuY2xlcmsuYWNjb3VudHMuZGV2JA" | sed 's/^pk_test_//' | base64 -d
# → suited-mule-74.clerk.accounts.dev
```

**Where to find:** Clerk Dashboard → your application → **API Keys** section.

---

### Clerk redirect variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in-new` | Where Clerk widget redirects for sign-in |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up-new` | Where Clerk widget redirects for sign-up |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` | After sign-in when no `redirect_url` param |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` | After sign-up when no `redirect_url` param |

These are also set as props on `<ClerkProvider>` in `app/layout.tsx` to prevent redirect loops caused by delayed env var hydration on the client.

---

### `CLERK_WEBHOOK_SECRET`
**Required for user sync.** Verifies Svix signatures on Clerk webhook payloads.

When a user signs up via Clerk, Clerk POSTs a `user.created` event to `/api/webhooks/clerk`. The handler creates a corresponding row in the `users` table in Supabase. Without this secret, the signature check fails with 400 and no user row is created — the user will get "profile not found" errors on the dashboard.

**Where to find:** Clerk Dashboard → **Webhooks** → add/edit endpoint → **Signing Secret**.

**Events to subscribe:** `user.created` (add `user.updated` and `user.deleted` if you want full sync).

**Webhook endpoint URL to register in Clerk:**
- Local dev: use [ngrok](https://ngrok.com) or [Clerk Dev Tunnel](https://clerk.com/docs/references/nextjs/overview#clerk-dev-tunnel) → `https://[tunnel].ngrok.io/api/webhooks/clerk`
- Production: `https://myoguard.health/api/webhooks/clerk`

---

## Resend (Email Delivery)

### `RESEND_API_KEY`
**Required for email.** Authenticates outbound email via the Resend API.

Used by:
- `POST /api/email` — welcome email after sign-up
- `POST /api/email-capture` — lead capture + protocol email delivery

Without a valid key, both routes return `{ ok: true, delivered: false }` and the UI shows an amber "Email delivery is not available right now" banner.

**Where to find:** [resend.com](https://resend.com) → **API Keys** → Create API key.

**Domain verification (required for production):**
The from-address is `protocol@myoguard.health`. Resend will reject sends until `myoguard.health` is verified:
1. Resend Dashboard → **Domains** → Add Domain → enter `myoguard.health`
2. Add the DNS records Resend provides (SPF, DKIM, DMARC) via your DNS provider
3. Click **Verify** — takes 5–60 minutes for DNS propagation

---

## Stripe (Payments)

### `STRIPE_SECRET_KEY`
Backend key for creating checkout sessions and verifying payment status. Use `sk_test_` in dev, `sk_live_` in production.

### `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
Frontend key for Stripe.js. Use `pk_test_` in dev, `pk_live_` in production.

### `STRIPE_PRICE_ID`
The Price ID for the premium subscription product (e.g. `price_1ABC...`). Found in Stripe Dashboard → Products → your product → Pricing section.

### `STRIPE_WEBHOOK_SECRET`
Verifies Stripe webhook signatures. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

**Webhook endpoint:** `https://myoguard.health/api/webhooks/stripe`

---

## App

### `NEXT_PUBLIC_APP_URL`
The canonical public URL of the app. Used in email templates for CTA buttons and footer links.

- Local dev: `http://localhost:3000`
- Production: `https://myoguard.health`

⚠️ Do not set this to `localhost` in production — all email links will be broken.

---

## Runtime diagnostics

Once deployed, visit `/admin/health` (ADMIN role required) to see the live status of all configuration checks. This page shows:

- Database connectivity and latency
- Clerk instance type (test vs live)
- Resend, Stripe, webhook secret status
- App URL correctness

Or hit the JSON endpoint directly:
```
GET /api/health
Authorization: Bearer <clerk-session-token>
```

---

## Prisma configuration (Prisma 7)

MyoGuard uses **Prisma 7**, which moved connection URLs out of `prisma/schema.prisma` into `prisma.config.ts`:

```ts
// prisma.config.ts
import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
```

The `datasource` block in `schema.prisma` contains **only** `provider = "postgresql"` — no `url` or `directUrl` properties. Adding them back causes `P1012` validation errors.
