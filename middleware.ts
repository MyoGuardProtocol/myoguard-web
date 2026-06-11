import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

/**
 * Route matchers
 *
 * /dashboard(.*)               – requires session (patient routes)
 * /doctor/onboarding/form(.*)  – requires session
 * /doctor/dashboard(.*)        – requires session
 * /doctor/patients(.*)         – requires session
 * /doctor/start(.*)            – requires session
 * /doctor/invite(.*)           – requires session
 * /admin/physicians(.*)        – requires session
 * /admin/health(.*)            – requires session
 *
 * Public (no session required):
 *   /sign-in, /sign-up, /doctor/sign-in, /doctor/sign-up, /
 *   /doctor/onboarding/pending  — static holding page, no session needed
 *   /admin/physician-approved   — static confirmation page
 *   /admin/physician-flagged    — static confirmation page
 *   /admin/token-expired        — static confirmation page
 *   /api/doctor/register        — custom physician registration (creates Clerk user)
 *   /api/admin/verify-physician — one-click email action links (clicked from email)
 * Page-level auth() calls perform DB role checks (PHYSICIAN, ADMIN, etc.).
 * Middleware only guarantees a valid Clerk session exists for protected paths.
 */

const isProtectedPatientRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/checkin(.*)',
]);

const isProtectedDoctorRoute = createRouteMatcher([
  '/doctor/onboarding/form(.*)',
  '/doctor/dashboard(.*)',
  '/doctor/patients(.*)',
  '/doctor/start(.*)',
  '/doctor/invite(.*)',
]);

const isProtectedAdminRoute = createRouteMatcher([
  '/admin/physicians(.*)',
  '/admin/health(.*)',
]);

// ── Clerk handler ────────────────────────────────────────────────────────────
// Stored as a constant so the outer middleware wrapper can invoke it
// selectively — only for routes not in CLERK_BYPASS_PATHS.
const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedPatientRoute(req)) { await auth.protect(); }
  if (isProtectedDoctorRoute(req))  { await auth.protect(); }
  if (isProtectedAdminRoute(req))   { await auth.protect(); }
});

// ── Routes that bypass Clerk entirely ───────────────────────────────────────
//
// These paths receive server-to-server POST requests (Stripe, etc.) with no
// Clerk session tokens.
//
// WHY this must be OUTSIDE clerkMiddleware:
//   Clerk v6 runs its internal auth-handshake resolution — including any 307
//   redirect it may emit — before the user handler function is called.
//   A bypass placed inside clerkMiddleware() executes too late: Clerk's wrapper
//   has already evaluated auth state and may have issued a redirect before the
//   handler body runs.
//   By intercepting here, clerkMiddleware never starts for these paths.
//
// Security for /api/stripe/webhook:
//   HMAC signature verification via stripe.webhooks.constructEvent(rawBody,
//   sig, STRIPE_WEBHOOK_SECRET) inside the route handler is the sole and
//   sufficient authentication mechanism. No Clerk session is expected or needed.
const CLERK_BYPASS_PATHS = ['/api/stripe/webhook'];

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (CLERK_BYPASS_PATHS.includes(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
