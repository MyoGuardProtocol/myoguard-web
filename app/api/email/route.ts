import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

/**
 * POST /api/email
 * Internal — called fire-and-forget from /api/user/onboard after sign-up.
 * Sends a welcome email via Resend.
 * Requires: RESEND_API_KEY
 */
export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f766e;">
    <tr><td align="center" style="padding:10px 24px;">
      <p style="margin:0;font-size:11px;color:#ccfbf1;">Physician-Formulated &nbsp;·&nbsp; Evidence-Based Protocol &nbsp;·&nbsp; GLP-1 Specialist Tool</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-bottom:1px solid #e2e8f0;">
    <tr><td align="center" style="padding:20px 24px;">
      <p style="margin:0;font-size:22px;font-weight:900;color:#0f172a;">Myo<span style="color:#0d9488;">Guard</span> <span style="font-weight:300;color:#94a3b8;font-size:16px;">Protocol</span></p>
      <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">Muscle Protection · GLP-1 Therapy</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:24px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;color:#0f172a;">Welcome to MyoGuard, ${firstName} &#128075;</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
            Your muscle-protection journey starts now. MyoGuard helps you preserve lean muscle mass
            while on GLP-1 therapy — one of the most overlooked risks in weight-loss treatment.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
            Run your first assessment to get your personalised protein, fibre, and hydration protocol
            plus your MyoGuard Score.
          </p>
          <a href="${APP_URL}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;">
            Start Your Assessment &#8594;
          </a>
        </td></tr>
        <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px;">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">
            &#169; 2026 MyoGuard Protocol &nbsp;&middot;&nbsp;
            <a href="${APP_URL}" style="color:#0d9488;text-decoration:none;">myoguard.health</a>
            &nbsp;&middot;&nbsp; Dr. Onyeka Okpala, MD &nbsp;&middot;&nbsp;
            <a href="${APP_URL}/privacy" style="color:#0d9488;text-decoration:none;">Privacy Policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'MyoGuard Protocol <protocol@myoguard.health>',
        to:      email,
        subject: 'Welcome to MyoGuard Protocol',
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[email/welcome] Resend error', res.status, errText);
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 });
    }

    const result = await res.json() as { id?: string };
    console.log('[email/welcome] Sent — id:', result.id, 'to:', email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email/welcome] fetch threw', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
