import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import OnboardingForm from './OnboardingForm';

/**
 * /doctor/onboarding — Physician profile setup.
 *
 * Server-side role gate fires before the form renders:
 *   PHYSICIAN         → /doctor/patients  (already approved — skip form)
 *   PHYSICIAN_PENDING → /doctor/dashboard (already submitted — skip form)
 *   PATIENT / no row  → show form (new physician flow)
 *
 * This prevents the loop where an existing PHYSICIAN gets sent here by
 * forceRedirectUrl, fills the form, and gets downgraded to PHYSICIAN_PENDING.
 */
export default async function PhysicianOnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect('/doctor/sign-in');

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { role: true },
  }).catch(() => null);

  if (user?.role === 'PHYSICIAN')         redirect('/doctor/dashboard');
  if (user?.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');

  // No row or PATIENT role → show the registration form
  return <OnboardingForm />;
}
