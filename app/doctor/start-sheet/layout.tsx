/**
 * app/doctor/start-sheet/layout.tsx
 *
 * Server-side subscription gate for all routes under /doctor/start-sheet.
 * Covers both /doctor/start-sheet (the client-side form) and
 * /doctor/start-sheet/[id] (the protocol PDF view), neither of which
 * can perform server-side auth checks independently.
 *
 * Gate logic:
 *   – Unauthenticated              → /doctor/sign-in
 *   – No DB user / PATIENT role    → /doctor/dashboard
 *   – PHYSICIAN_PENDING            → /doctor/dashboard  (holding screen)
 *   – PHYSICIAN + non-ACTIVE sub   → /doctor/billing?status=access_required
 *   – ADMIN                        → pass through (admin bypasses billing gate)
 *   – PHYSICIAN + ACTIVE           → render children
 */

import { auth }     from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma }   from '@/src/lib/prisma';

export default async function StartSheetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/doctor/sign-in');

  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: { role: true, subscriptionStatus: true },
  });

  if (!user)                              redirect('/doctor/dashboard');
  if (user.role === 'PHYSICIAN_PENDING')  redirect('/doctor/dashboard');
  if (user.role === 'PATIENT')            redirect('/dashboard');
  if (user.role !== 'PHYSICIAN' && user.role !== 'ADMIN') redirect('/doctor/dashboard');

  // ADMIN bypasses subscription gate
  if (user.role !== 'ADMIN' && user.subscriptionStatus !== 'ACTIVE') {
    redirect('/doctor/billing?status=access_required');
  }

  return <>{children}</>;
}
