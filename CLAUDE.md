# MyoGuard Protocol — Claude Code Operating Instructions

## Entity

Meridian Wellness Systems LLC
Wyoming-based clinical technology firm
Trading name: MyoGuard Protocol

## Platform Classification

Physician-led Clinical Decision Support (CDS)
Core instrument: Sarcopenia Risk Index (SRI)
Domain: myoguard.health

## Terminology Rules (Non-Negotiable)

* ALWAYS: "Sarcopenia Risk Index (SRI)"
* ALWAYS: "Clinical Decision Support (CDS)"
* ALWAYS: "generate" not "calculate"
* NEVER: "calculator"
* NEVER: "score" in UI context
* NEVER: "Meridian Health Holding"
* NEVER: "Meridian Health" alone — use full entity name

## Design System — Midnight Silk

* Background: #080C14
* Card surface: #0D1421
* Border: #1A2744
* Primary accent: #2DD4BF
* Text primary: #F1F5F9
* Text secondary: #94A3B8
* Headings: Georgia serif
* Body: system sans-serif
* No white backgrounds on authenticated pages

## Tech Stack

* Framework: Next.js 16 App Router
* Language: TypeScript
* Auth: Clerk (OTP for physicians, standard for patients)
* Database: Prisma + Supabase PostgreSQL
* Email: Resend
* Payments: Lemon Squeezy (active), Stripe (pending)
* Hosting: Vercel
* QR: qrcode.react

## Protected Files — Never Modify Without Explicit Approval

* src/lib/protocolEngine.ts
* middleware.ts
* prisma/schema.prisma (destructive changes only)
* Any Clerk configuration
* Any Stripe/Lemon Squeezy billing logic

## Architecture Rules

* Always read files before editing
* Always run npm run build before committing
* Never bypass /api/assessment
* Never commit without build confirmation
* Never add new PrismaClient() — use singleton at src/lib/prisma.ts
* Never expose DATABASE_URL in client code
* Add fields to schema with npx prisma db push (not migrate dev — broken history)

## Route Structure

* Patient routes: /dashboard/*
* Physician routes: /doctor/*
* Admin routes: /admin/*
* Public: /, /sign-in-new, /sign-up-new, /join, /invite/*

## Active Clerk Routes

* Sign in: /sign-in-new (NEXT_PUBLIC_CLERK_SIGN_IN_URL)
* Sign up: /sign-up-new (NEXT_PUBLIC_CLERK_SIGN_UP_URL)

## Physician Roles

* PHYSICIAN_PENDING: awaiting admin approval
* PHYSICIAN: approved, full access
* PATIENT: patient dashboard access
* ADMIN: admin panel access

## Clinical Positioning

* All outputs are CDS — not medical advice
* Physician oversight is mandatory
* SRI is expert-consensus framework — not validated instrument (yet)
* Provisional patent pending before pharma outreach

## Security Rules

* Never expose API secrets in client code
* Never expose Supabase service role key
* Never expose Clerk secret keys
* Never log PHI to analytics providers
* Never place patient-identifiable data in URLs
* Never disable authentication checks for convenience

## SEO + Metadata Rules

* Preserve canonical URLs
* Preserve robots and sitemap routes
* Preserve structured data JSON-LD
* Never introduce broken OG image references
* Maintain Midnight Silk social preview consistency

## Footer Standard (All Pages)

Line 1: "MyoGuard Protocol · Physician-led Clinical Decision Support"
Line 2: "© 2026 Meridian Wellness Systems LLC · myoguard.health"
Line 3: "Built for the global GLP-1 prescribing community"

## Deployment Philosophy

* One targeted prompt per deployment
* Diagnose before writing code
* Build must be clean before commit
* No destructive changes without explicit approval
* Test on mobile (iPhone) after every deploy
