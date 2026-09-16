import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/src/lib/prisma';
import { sendServiceEmail } from '@/src/lib/communications/serviceEmail';

/** Template identity recorded on CommunicationEvent — never the rendered output. */
const TEMPLATE_ID = 'service.patient_invitation.v1';

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

// ─── Email via the governed gateway ───────────────────────────────────────────
//
// Renamed from `sendEmail` in Phase 1D-C3E so it cannot be mistaken for the
// canonical gateway of the same name that now sits underneath it.

async function sendInviteEmail(to: string, doctorName: string, inviteUrl: string) {

  const cleanName          = doctorName.replace(/^Dr\.?\s*/i, '').trim();
  const displayDoctorName  = `Dr. ${cleanName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:540px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:#1a1a1a;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
      <p style="margin:0;font-size:26px;font-weight:900;letter-spacing:-0.02em;">
        <span style="color:#ffffff;">Myo</span><span style="color:#2dd4bf;">Guard</span>
      </p>
      <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Protocol Platform</p>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:36px 32px;">

      <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#0f172a;">
        You've been invited by ${displayDoctorName}
      </h1>

      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.7;font-family:Georgia,'Times New Roman',serif;">
        ${displayDoctorName} is using the MyoGuard Protocol Platform to protect their patients'
        muscle health during GLP-1 therapy.
      </p>

      <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.7;">
        As their patient, you'll receive a personalised muscle protection protocol —
        including your protein targets, supplement guidance, and weekly check-in monitoring.
      </p>

      <div style="text-align:center;margin-bottom:32px;">
        <a href="${inviteUrl}"
           style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:700;padding:15px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;">
          Accept ${displayDoctorName}'s Invitation →
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 20px;" />

      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;text-align:center;">
        You were invited by ${displayDoctorName}. If you don't recognise this invitation, you can ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;text-align:center;">
      MyoGuard Protocol Platform · <a href="https://myoguard.health" style="color:#0d9488;text-decoration:none;">myoguard.health</a>
    </p>

  </div>
</body>
</html>`;

  // ESSENTIAL_SERVICE: an invitation the recipient's own clinician initiated.
  // This is the C2 carve-out that was specified but never implemented — the
  // invitation is not preference-suppressible, but a hard bounce, spam
  // complaint or admin suppression on this address is absolute and now blocks
  // it.
  //
  // No userId is passed. The recipient is an invited patient with no account;
  // the physician is the sender, not the subject, and labelling the event with
  // the physician's id would misattribute it. The recipient stays pseudonymous
  // — keyed by recipientKey alone, with no CommunicationRecipient row created.
  return sendServiceEmail({
    to,
    subject:    `${displayDoctorName} has invited you to their MyoGuard Protocol`,
    html,
    from:       `${displayDoctorName} via MyoGuard <hello@myoguard.health>`,
    replyTo:    'hello@myoguard.health',
    templateId: TEMPLATE_ID,
    context:    'physician:patient-invitation',
  });
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
      const sent = await sendInviteEmail(trimmed, doctorName, inviteUrl);

      // A governed refusal is not an outage. 409 tells the physician the
      // invitation did not go out — which they need to know, or they will wait
      // on a patient who never heard from us — without disclosing the
      // recipient's delivery history. Same status the governed admin send
      // routes already use for a suppressed decision.
      if (sent.outcome === 'suppressed') {
        return NextResponse.json(
          { error: 'This address cannot currently receive invitations.' },
          { status: 409 },
        );
      }
      if (sent.outcome !== 'sent') {
        return NextResponse.json(
          { error: 'Invitation could not be sent. Please try again shortly.' },
          { status: 500 },
        );
      }
    } else {
      // SMS is untouched by C3E and remains dormant — no Twilio credentials in
      // production. It is deliberately NOT routed through the email gateway.
      await sendSms(trimmed, doctorName, inviteUrl);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[invite/send]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
