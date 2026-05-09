# MyoGuard Protocol — Claude Code Guardrails

## Entity
Meridian Wellness Systems LLC
Wyoming, USA

## Product
MyoGuard Protocol

Physician-led Clinical Decision Support (CDS) platform for patients using GLP-1 therapies, focused on:
- Sarcopenia Risk Index (SRI)
- muscle preservation
- protein optimization
- GI tolerance considerations
- age-adjusted anabolic resistance
- physician oversight workflows

## Non-Negotiable Terminology
Never use:
- calculator
- score

Use only:
- Sarcopenia Risk Index (SRI)
- SRI
- Clinical Decision Support
- physician-led monitoring

## Clinical Positioning
MyoGuard is not a consumer wellness gimmick or fitness tracker.

It is:
- physician-led
- CDS-oriented
- clinically structured
- supervised by physicians

Final clinical authority:
Dr. Onyekachukwu Okpala

## Design Philosophy
“Midnight Silk”

Visual identity:
- premium clinical sanctuary
- dark navy / charcoal backgrounds
- Georgia serif typography
- teal accent: #2DD4BF
- calm, low-cortisol clinical feel
- no loud startup styling

## Current Stack
- Next.js App Router
- TypeScript
- TailwindCSS
- Prisma
- Supabase PostgreSQL
- Clerk
- Stripe
- Resend
- Vercel

## Role Discipline
Claude Code handles execution only.

Do not invent product strategy.
Do not redesign core UX unless specifically instructed.
Do not alter clinical logic unless explicitly asked.

## Protected Areas
Do not modify unless specifically instructed:
- `protocolEngine.ts`
- assessment logic
- Prisma schema
- auth / middleware / Clerk flows
- Stripe / billing logic
- referral / preload logic

## Coding Standards
- Inspect existing architecture before editing.
- Use Next.js App Router conventions.
- Prefer Metadata API for SEO.
- Keep components modular.
- Avoid destructive edits.
- Preserve Midnight Silk branding.
- Explain all file changes clearly.
- Run build/type check after changes where appropriate.

## Current Priorities
1. SEO metadata audit and implementation
2. Production cleanup
3. Route consistency
4. Public route hardening
5. Physician onboarding polish
6. Mobile optimization
7. Stripe production readiness

## Output Requirement
After each task, report:
1. Files created
2. Files modified
3. What changed
4. What was not touched
5. Build result
