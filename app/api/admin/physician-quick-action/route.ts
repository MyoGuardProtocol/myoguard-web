import { NextResponse } from 'next/server';

/**
 * GET /api/admin/physician-quick-action
 *
 * RETIRED — this route has been decommissioned.
 *
 * Reason: GET-based state mutation, debug logging of security tokens to
 * production logs, missing User.role update on approval, and wrong sign-in
 * URL in activation email. All approval flows are now handled by:
 *
 *   • POST /api/admin/physician-review  (admin panel — requireAdmin() protected)
 *   • GET  /api/admin/verify-physician  (HMAC email-link approval)
 *
 * This stub returns 410 Gone so any stale links fail loudly rather than
 * silently succeeding or exposing credentials.
 */
export async function GET() {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f172a;color:#94a3b8;">
<h2 style="color:#f87171;">Route Retired</h2>
<p>This approval link is no longer valid.</p>
<p>Please use the <a href="https://myoguard.health/admin/physicians" style="color:#2dd4bf;">admin panel</a> to review physician applications.</p>
</body></html>`,
    {
      status:  410,
      headers: { 'Content-Type': 'text/html' },
    },
  );
}
