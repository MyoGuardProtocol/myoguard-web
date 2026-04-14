import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import OnboardingForm from './OnboardingForm';

/**
 * /doctor/onboarding — Physician profile setup.
 *
 * Server-side role gate fires before the form renders:
 *   PHYSICIAN         → /doctor/dashboard (already approved — skip form)
 *   PATIENT           → /dashboard        (wrong portal — bounce back)
 *   PHYSICIAN_PENDING → show form         (newly registered, awaiting review)
 *   no row yet        → show form         (webhook may not have fired yet)
 */
export default async function PhysicianOnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect('/doctor/sign-in');

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { role: true },
  }).catch(() => null);

  if (user?.role === 'PHYSICIAN') redirect('/doctor/dashboard');
  if (user?.role === 'PATIENT')   redirect('/dashboard');

  // PHYSICIAN_PENDING or no row yet → show the registration form
  return <OnboardingForm />;
}
