import { NextResponse }       from 'next/server';
import { auth }               from '@clerk/nextjs/server';
import { prisma }             from '@/src/lib/prisma';
import { runHealthChecks }    from '@/src/lib/health';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Returns a structured JSON health report.
 * Requires a valid Clerk session. Attempts an ADMIN role check, but
 * degrades gracefully when the database is unreachable (which is exactly
 * when you need this endpoint most).
 *
 * Response shape: HealthReport (see src/lib/health.ts)
 * Status codes: 200 (any health state), 401 (no session), 403 (not admin)
 *
 * Never leaks secrets — check details show only masked keys and hostnames.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // ADMIN role check with graceful degradation when DB is unreachable.
  // If DB is down we still show the health report — that IS the diagnosis.
  let isAdmin = false;
  try {
    const user = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true },
    });
    isAdmin = user?.role === 'ADMIN';
  } catch {
    // DB unreachable — allow any authenticated user so the health check
    // is still useful when the database is the thing that is broken.
    isAdmin = true;
  }

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
  }

  const report = await runHealthChecks();

  // Map overall status to HTTP status code for easy monitoring integration
  const httpStatus = report.overall === 'error' ? 503 : 200;

  return NextResponse.json(report, { status: httpStatus });
}
