import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './prisma';

type AdminUser = {
  id:       string;
  role:     string;
  clerkId:  string;
  email:    string;
  fullName: string;
};

export type RequireAdminResult =
  | { user: AdminUser; clerkId: string;      error: null }
  | { user: null;      clerkId: string|null; error: 'UNAUTHENTICATED' | 'FORBIDDEN' };

/**
 * requireAdmin()
 *
 * Resolves the calling Clerk session → DB user → ADMIN role check.
 *
 * Two-phase lookup (mirrors the doctor dashboard pattern):
 *
 * Phase 1 — fast path:
 *   Look up User by clerkId from the session. This is the normal case.
 *
 * Phase 2 — email fallback (clerkId auto-heal):
 *   If no row is found by clerkId, fetch the Clerk email and try to find
 *   a row by email. If the row exists AND its role is ADMIN, stamp the
 *   current session clerkId onto it and proceed.
 *
 *   This heals the common mismatch where:
 *     • Clerk account was deleted/recreated (new userId, same email)
 *     • Account was migrated from Clerk test → production keys
 *     • DB row was seeded with a placeholder clerkId
 *
 *   The fallback ONLY heals rows already marked ADMIN in the DB —
 *   it cannot elevate a non-admin account.
 *
 * Usage:
 *   const { user, clerkId, error } = await requireAdmin();
 *   if (error === 'UNAUTHENTICATED') return ... 401
 *   if (error === 'FORBIDDEN')       return ... 403
 *   // user and clerkId are non-null here
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { user: null, clerkId: null, error: 'UNAUTHENTICATED' };

  // ── Phase 1: fast path — clerkId lookup ───────────────────────────────────
  let user = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, clerkId: true, email: true, fullName: true },
  });

  // ── Phase 2: email fallback — auto-heal stale clerkId ────────────────────
  if (!user) {
    const clerkUser = await currentUser();
    const email     = clerkUser?.emailAddresses?.[0]?.emailAddress ?? '';

    if (email) {
      const byEmail = await prisma.user.findUnique({
        where:  { email },
        select: { id: true, role: true, clerkId: true, email: true, fullName: true },
      });

      // Only heal ADMIN rows — never elevates a non-admin account.
      if (byEmail?.role === 'ADMIN') {
        user = await prisma.user.update({
          where:  { id: byEmail.id },
          data:   { clerkId },
          select: { id: true, role: true, clerkId: true, email: true, fullName: true },
        }).catch(() => null);
      }
    }
  }

  if (!user || user.role !== 'ADMIN') {
    return { user: null, clerkId, error: 'FORBIDDEN' };
  }

  return { user, clerkId, error: null };
}
