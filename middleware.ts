import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Route matchers
 *
 * /doctor             – public landing (no auth required — it's the entry CTA)
 * /doctor/onboarding  – requires Clerk session (Clerk redirects to sign-in if missing)
 * /doctor/dashboard   – requires session; page handles role-based rendering
 * /doctor/patients/*  – requires session; page enforces PHYSICIAN role
 * /doctor/start       – requires session; page enforces PHYSICIAN role
 * /admin/*            – requires session; page enforces ADMIN role
 *
 * Individual pages perform DB-level role checks.
 * Middleware only guarantees a valid Clerk session exists for protected paths.
 */
const isProtectedDoctorRoute = createRouteMatcher([
  '/doctor/onboarding(.*)',
  '/doctor/dashboard(.*)',
  '/doctor/patients(.*)',
  '/doctor/start(.*)',
]);

const isProtectedAdminRoute = createRouteMatcher([
  '/admin(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedDoctorRoute(req) || isProtectedAdminRoute(req)) {
    // auth.protect() redirects unauthenticated users to /sign-in automatically
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
