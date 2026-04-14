import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';

/**
 * /doctor/onboarding
 *
 * Credentials are now captured at /doctor/sign-up.  This page acts as a
 * routing gate only:
 *
 *   PHYSICIAN (approved)   → /doctor/dashboard
 *   Has PhysicianApplication row → /doctor/onboarding/pending (awaiting review)
 *   No application row       → /doctor/sign-up (skipped registration)
 */
export default async function PhysicianOnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect('/doctor/sign-in');

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { role: true, email: true },
  }).catch(() => null);

  // Already fully approved — go to dashboard
  if (user?.role === 'PHYSICIAN') redirect('/doctor/dashboard');

  // Patients should not reach this route
  if (user?.role === 'PATIENT') redirect('/dashboard');

  // Check for an existing application row
  const email = user?.email;
  if (email) {
    const application = await prisma.physicianApplication.findUnique({
      where:  { email },
      select: { id: true },
    }).catch(() => null);

    if (application) {
      // Application submitted — show the pending screen
      redirect('/doctor/onboarding/pending');
    }
  }

  // No application found — physician skipped registration
  redirect('/doctor/sign-up');
}
