import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import PrintableHandout from './PrintableHandout';

const APP_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '') ||
  'https://myoguard.health';

/**
 * /doctor/invite/print — Printable patient handout.
 *
 * Generates a clean, white PDF-style page containing:
 *  - MyoGuard logo
 *  - Doctor's name
 *  - High-contrast QR code linking to /invite/[doctorId]
 *  - URL fallback and disclaimer
 *
 * Auth: PHYSICIAN role only. PHYSICIAN_PENDING physicians are redirected
 * to the dashboard (account under review, no invite until approved).
 */
export default async function InvitePrintPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/doctor/sign-in');

  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, fullName: true },
  }).catch(() => null);

  if (!physician)                            redirect('/doctor/sign-in');
  if (physician.role === 'PHYSICIAN_PENDING') redirect('/doctor/dashboard');
  if (physician.role !== 'PHYSICIAN')         redirect('/doctor/sign-in');

  const inviteUrl = `${APP_URL}/invite/${physician.id}`;

  return (
    <PrintableHandout
      inviteUrl={inviteUrl}
      doctorName={physician.fullName}
    />
  );
}
