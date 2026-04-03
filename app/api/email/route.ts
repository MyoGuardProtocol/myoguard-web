import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/src/lib/email';
export const dynamic = 'force-dynamic';

/**
 * POST /api/email
 * Internal — called fire-and-forget from /api/user/onboard after sign-up.
 * Sends a welcome email via Resend.
 * Requires: RESEND_API_KEY
 */
export async function POST(req: NextRequest) {
  console.log("🔥 EMAIL CAPTURE ROUTE HIT");

  if (!process.env.RESEND_API_KEY) {
    console.warn('[email/welcome] RESEND_API_KEY not set — skipping welcome email');
    return NextResponse.json({ ok: true, mode: 'stub' });
  }

  let body: { email?: string; firstName?: string };
  try {
    body = await req.json() as { email?: string; firstName?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, firstName = 'there' } = body;
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  await sendWelcomeEmail({ email, firstName });
  return NextResponse.json({ ok: true });
}
