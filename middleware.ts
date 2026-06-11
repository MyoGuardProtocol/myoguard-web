import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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

export default clerkMiddleware(async (auth, req) => {
  // ── Stripe webhook bypass ────────────────────────────────────────────────────
  // Stripe delivers server-to-server POSTs with no Clerk session tokens.
  // Without this bypass, clerkMiddleware enters its auth-handshake state and
  // issues a 307 redirect before the route handler executes.
  // Security: HMAC signature verification (STRIPE_WEBHOOK_SECRET) inside the
  // route handler is the sole and sufficient auth mechanism for this path.
  if (req.nextUrl.pathname === '/api/stripe/webhook') {
    return NextResponse.next();
  }

  if (isProtectedPatientRoute(req)) {
    await auth.protect();
  }
  if (isProtectedDoctorRoute(req)) {
    await auth.protect();
  }
  if (isProtectedAdminRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
