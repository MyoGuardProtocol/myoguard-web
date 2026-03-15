import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Protected routes — requires a valid Clerk session.
 * Everything else is public (calculator, privacy, referral API, Stripe webhook).
 */
const isProtected = createRouteMatcher([
  '/dashboard(.*)',
  '/checkin(.*)',
  '/doctor(.*)',
  '/api/assessment(.*)',
  '/api/checkins(.*)',
  '/api/stripe/checkout(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
