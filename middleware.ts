import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Route matchers
 *
 * /doctor/sign-in    – public (must stay unprotected or sign-in is unreachable)
 * /doctor/sign-up    – public
 * /invite/[doctorId] – public (sets referral cookie then redirects to sign-up)
 * /doctor/onboarding  – requires session; redirects unauthenticated → /doctor/sign-in
 * /doctor/dashboard   – requires session; redirects unauthenticated → /doctor/sign-in
 * /doctor/patients/*  – requires session; redirects unauthenticated → /doctor/sign-in
 * /doctor/start       – requires session; redirects unauthenticated → /doctor/sign-in
 * /admin/*            – requires session; uses default Clerk sign-in URL (/sign-in-new)
 *
 * Page-level auth() calls perform DB role checks (PHYSICIAN, ADMIN, etc.).
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
  if (isProtectedDoctorRoute(req)) {
    // Override Clerk's default sign-in redirect so unauthenticated physicians
    // land on the physician sign-in page, not the patient /sign-in-new route.
    await auth.protect();
  }

  if (isProtectedAdminRoute(req)) {
    // Admins sign in via the standard Clerk flow (NEXT_PUBLIC_CLERK_SIGN_IN_URL).
    // No override needed — default Clerk behavior routes to /sign-in-new.
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
