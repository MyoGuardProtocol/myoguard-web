import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';

const APP_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '') ||
  'https://myoguard.health';

// ─── Validation helpers ───────────────────────────────────────────────────────

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isPhone(v: string) {
  return /^\+?[\d\s\-().]{7,15}$/.test(v);
}

function normalizePhone(v: string) {
  // Strip formatting chars; preserve leading +
  const stripped = v.replace(/[\s\-().]/g, '');
  return stripped.startsWith('+') ? stripped : stripped;
}

// ─── Email via Resend ─────────────────────────────────────────────────────────

async function sendEmail(to: string, doctorName: string, inviteUrl: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured on this server.');

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="font-size:24px;font-weight:900;color:#0f172a;margin:0 0 4px;">
      Myo<span style="color:#0d9488;">Guard</span>
    </p>
    <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 28px;">
      Protocol Platform
    </p>
    <h1 style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 12px;">
      You've been invited to MyoGuard
    </h1>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 16px;">
      <strong>${doctorName}</strong> has invited you to join their patient panel on
      MyoGuard — a physician-guided muscle protection platform for GLP-1 therapy.
    </p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px;">
      Your personalised protocol will be tailored to preserve lean muscle mass, reduce
      side effects, and improve your outcomes during treatment.
    </p>
    <a href="${inviteUrl}"
       style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;">
      Accept Invitation →
    </a>
    <p style="margin-top:32px;font-size:11px;color:#94a3b8;line-height:1.6;">
      © 2026 MyoGuard Protocol · MyoGuard Clinical Oversight ·
      <a href="${APP_URL}/privacy" style="color:#0d9488;text-decoration:none;">Privacy Policy</a>
    </p>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:     'MyoGuard Health <hello@myoguard.health>',
      to,
      subject:  `${doctorName} invited you to MyoGuard`,
      html,
      reply_to: 'hello@myoguard.health',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

// ─── SMS via Twilio (REST, no SDK required) ───────────────────────────────────

async function sendSms(to: string, doctorName: string, inviteUrl: string) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const tok  = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !tok || !from) {
    throw new Error(
      'SMS is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ' +
      'and TWILIO_FROM_NUMBER in your environment variables.',
    );
  }

  const body   = `${doctorName} invited you to MyoGuard — a physician-guided muscle protection protocol. Sign up here: ${inviteUrl}`;
  const phone  = normalizePhone(to);
  const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const res = await fetch(apiUrl, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${Buffer.from(`${sid}:${tok}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: phone, Body: body }).toString(),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Twilio error ${res.status}: ${err}`);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * POST /api/invite/send
 *
 * Auth-required. Only callable by a PHYSICIAN.
 * Accepts { contact: string, doctorId: string }.
 * Auto-detects email vs phone and routes to the appropriate sender.
 *
 * Email: Resend (RESEND_API_KEY)
 * SMS:   Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { contact, doctorId } = body as Record<string, unknown>;

  if (
    typeof contact  !== 'string' || !contact.trim() ||
    typeof doctorId !== 'string' || !doctorId.trim()
  ) {
    return NextResponse.json(
      { error: 'contact and doctorId are required strings' },
      { status: 422 },
    );
  }

  const trimmed = contact.trim();

  if (!isEmail(trimmed) && !isPhone(trimmed)) {
    return NextResponse.json(
      { error: 'Enter a valid email address or phone number.' },
      { status: 422 },
    );
  }

  // Verify the caller is the physician whose doctorId was passed.
  // Prevents one physician spoofing another's invite link.
  const physician = await prisma.user.findUnique({
    where:  { clerkId },
    select: { id: true, role: true, fullName: true },
  });

  if (!physician || (physician.role !== 'PHYSICIAN' && physician.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (physician.id !== doctorId.trim()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const inviteUrl  = `${APP_URL}/invite/${physician.id}`;
  const doctorName = physician.fullName;

  try {
    if (isEmail(trimmed)) {
      await sendEmail(trimmed, doctorName, inviteUrl);
    } else {
      await sendSms(trimmed, doctorName, inviteUrl);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[invite/send]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
