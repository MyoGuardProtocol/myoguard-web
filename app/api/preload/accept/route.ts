import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/preload/accept?id=<preloadId>&ref=<referralCode>
 *
 * Sets the mgPreloadId cookie then redirects back to /join?ref=<code>.
 * Used by the join page Server Component — cookies() cannot be set during
 * rendering, so we bounce through this handler instead.
 */
export async function GET(req: NextRequest) {
  const id  = req.nextUrl.searchParams.get('id')  ?? '';
  const ref = req.nextUrl.searchParams.get('ref') ?? '';

  const redirectTarget = ref
    ? `/join?ref=${encodeURIComponent(ref)}`
    : '/join';

  const response = NextResponse.redirect(new URL(redirectTarget, req.url));

  if (id) {
    response.cookies.set('mgPreloadId', id, {
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  return response;
}
