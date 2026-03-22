import { NextRequest, NextResponse } from 'next/server';
import { EmailCaptureSchema } from '@/src/schemas/assessment';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

/**
 * POST /api/email-capture
 * Public. Sends the user's MyoGuard protocol to their email via Resend,
 * and optionally forwards to n8n for CRM/automation workflows.
 *
 * Requires: RESEND_API_KEY (for email delivery)
 * Optional: N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET (for automation)
 *
 * Degrades gracefully when keys are absent — returns 200 so the UI always
 * shows the confirmation state, even in local dev without credentials.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = EmailCaptureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { email, protocolResult, formData } = parsed.data;

  // ── 1. Resend email delivery ─────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;

  // Track whether the email was actually delivered so the UI can show an
  // honest confirmation vs. a "not configured" fallback message.
  let delivered = false;

  if (!resendKey) {
    // Key is absent — log clearly so the operator knows why email is missing.
    // Return ok:true so the request doesn't error, but delivered:false so the
    // UI can tell the user the email was NOT sent (rather than lying to them).
    console.warn(
      '[email-capture] RESEND_API_KEY is not set. ' +
      'Add it to .env to enable email delivery. Email NOT sent to:', email,
    );
  } else {
    try {
      const html = buildProtocolEmail({ email, protocolResult, formData });

      const resendRes = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    `MyoGuard Protocol <protocol@myoguard.health>`,
          to:      email,
          subject: 'Your MyoGuard Muscle Protection Plan',
          html,
          reply_to: "myoguardprotocol@gmail.com"
        }),
      });

      if (resendRes.ok) {
        const result = await resendRes.json() as { id?: string };
        console.log('[email-capture] Resend delivered — id:', result.id, 'to:', email);
        delivered = true;
      } else {
        const errText = await resendRes.text();
        console.error('[email-capture] Resend error', resendRes.status, errText);
        // delivered stays false — UI will show a delivery-failed message.
      }
    } catch (err) {
      console.error('[email-capture] Resend fetch threw', err);
      // delivered stays false — transient network failure, UI shows error state.
    }
  }

  // ── 2. n8n webhook (optional CRM/automation path) ───────────────────────
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (webhookUrl) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (process.env.N8N_WEBHOOK_SECRET) {
        headers['x-webhook-secret'] = process.env.N8N_WEBHOOK_SECRET;
      }

      const n8nRes = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          protocolResult,
          formData,
          capturedAt: new Date().toISOString(),
          source:     'myoguard-web',
        }),
      });

      if (n8nRes.ok) {
        console.log('[email-capture] n8n webhook delivered');
      } else {
        console.error('[email-capture] n8n returned', n8nRes.status);
      }
    } catch (err) {
      console.error('[email-capture] n8n fetch threw', err);
    }
  }

  // Always return 200 — the form submission itself succeeded even if email
  // delivery did not. The `delivered` flag lets the UI differentiate.
  return NextResponse.json({ ok: true, delivered });
}

// ─── Email template ──────────────────────────────────────────────────────────

type TemplateData = {
  email:          string;
  protocolResult: {
    myoguardScore:     number;
    riskBand:          string;
    proteinStandard:   number;
    proteinAggressive: number;
    fiber:             number;
    hydration:         number;
    leanLossEstPct:    number;
    explanation:       string;
  };
  formData: {
    medication:    string;
    doseMg:        number;
    activityLevel: string;
    symptoms:      string[];
  };
};

const RISK_LABELS: Record<string, string> = {
  LOW:      'Low Risk',
  MODERATE: 'Moderate Risk',
  HIGH:     'High Risk',
  CRITICAL: 'Critical Risk',
};

const RISK_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  LOW:      { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  MODERATE: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  HIGH:     { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  CRITICAL: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
};

function buildProtocolEmail({ protocolResult, formData }: TemplateData): string {
  const score     = Math.round(protocolResult.myoguardScore);
  const band      = protocolResult.riskBand;
  const riskLabel = RISK_LABELS[band] ?? 'Unknown';
  const riskColor = RISK_COLOURS[band] ?? RISK_COLOURS.HIGH;
  const medLabel  = formData.medication === 'semaglutide' ? 'Semaglutide' : 'Tirzepatide';

  // Score track bar width (0–100 → 0%–100%)
  const trackPct = `${score}%`;
  const trackBg  =
    band === 'LOW'      ? '#22c55e' :
    band === 'MODERATE' ? '#f59e0b' :
    band === 'HIGH'     ? '#f97316' :
                          '#ef4444';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your MyoGuard Muscle Protection Plan</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;">

  <!-- Trust strip -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f766e;">
    <tr>
      <td align="center" style="padding:10px 24px;">
        <p style="margin:0;font-size:11px;color:#ccfbf1;letter-spacing:0.05em;">
          Physician-Formulated &nbsp;·&nbsp; Evidence-Based Protocol &nbsp;·&nbsp; GLP-1 Specialist Tool
        </p>
      </td>
    </tr>
  </table>

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-bottom:1px solid #e2e8f0;">
    <tr>
      <td align="center" style="padding:20px 24px;">
        <p style="margin:0;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.02em;">
          Myo<span style="color:#0d9488;">Guard</span> <span style="font-weight:300;color:#94a3b8;font-size:16px;">Protocol</span>
        </p>
        <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">Muscle Protection · GLP-1 Therapy</p>
      </td>
    </tr>
  </table>

  <!-- Main card -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Intro -->
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.1em;">Protocol Generated</p>
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:#0f172a;line-height:1.2;">
                Your MyoGuard Muscle Protection Plan
              </h1>
              <p style="margin:0;font-size:14px;color:#64748b;line-height:1.5;">
                Based on your ${medLabel} ${formData.doseMg}mg · ${formData.activityLevel} activity assessment.
                Here is everything you need to protect your lean muscle mass during GLP-1 therapy.
              </p>
            </td>
          </tr>

          <!-- Score card -->
          <tr>
            <td style="padding-bottom:16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#2dd4bf;text-transform:uppercase;letter-spacing:0.15em;">Your MyoGuard Score</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:52px;font-weight:900;color:#ffffff;line-height:1;">${score}</span>
                          <span style="font-size:20px;color:#64748b;font-weight:300;"> / 100</span>
                        </td>
                        <td align="right" valign="middle">
                          <span style="display:inline-block;padding:6px 14px;border-radius:50px;font-size:12px;font-weight:700;background:${riskColor.bg};color:${riskColor.text};border:1px solid ${riskColor.border};">
                            ${riskLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                    <!-- Progress track -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                      <tr>
                        <td style="background:#334155;border-radius:4px;height:8px;overflow:hidden;">
                          <div style="width:${trackPct};height:8px;background:${trackBg};border-radius:4px;"></div>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">${
                      score < 80
                        ? `${80 - score} points from the Low Risk zone`
                        : 'You are in the optimal Low Risk zone ✓'
                    }</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Explanation -->
          <tr>
            <td style="padding-bottom:16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.08em;">Clinical Summary</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${protocolResult.explanation}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Protocol targets — 3 cards -->
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Your Daily Targets</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Protein -->
                  <td width="32%" style="padding-right:6px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;">
                      <tr>
                        <td style="padding:16px 14px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#0d9488;text-transform:uppercase;">Protein</p>
                          <p style="margin:0;font-size:20px;font-weight:900;color:#0f172a;line-height:1.1;">${Math.round(protocolResult.proteinStandard)}–${Math.round(protocolResult.proteinAggressive)}<span style="font-size:12px;font-weight:400;color:#64748b;">g</span></p>
                          <p style="margin:4px 0 0;font-size:10px;color:#64748b;">per day</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Fibre -->
                  <td width="32%" style="padding-right:6px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;">
                      <tr>
                        <td style="padding:16px 14px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;">Fibre</p>
                          <p style="margin:0;font-size:20px;font-weight:900;color:#0f172a;line-height:1.1;">${Math.round(protocolResult.fiber)}<span style="font-size:12px;font-weight:400;color:#64748b;">g</span></p>
                          <p style="margin:4px 0 0;font-size:10px;color:#64748b;">per day</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Hydration -->
                  <td width="32%">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;">
                      <tr>
                        <td style="padding:16px 14px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#0284c7;text-transform:uppercase;">Hydration</p>
                          <p style="margin:0;font-size:20px;font-weight:900;color:#0f172a;line-height:1.1;">${protocolResult.hydration.toFixed(1)}<span style="font-size:12px;font-weight:400;color:#64748b;">L</span></p>
                          <p style="margin:4px 0 0;font-size:10px;color:#64748b;">per day</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Lean loss risk -->
          ${protocolResult.leanLossEstPct > 0 ? `
          <tr>
            <td style="padding-bottom:16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#b45309;">⚠ Lean Mass Loss Risk</p>
                    <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
                      Estimated <strong>${protocolResult.leanLossEstPct}%</strong> lean mass loss risk with current GLP-1 dose and activity pattern.
                      Following the protein and exercise targets above significantly reduces this risk.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <a href="${APP_URL}/dashboard" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:0.01em;">
                Track Your Progress on Dashboard →
              </a>
              <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">
                Create a free account to save weekly check-ins and monitor your score over time.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding-top:20px;padding-bottom:20px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">
                This protocol is an educational nutritional reference tool only. It does not constitute a physician–patient relationship or individualised medical advice.<br />
                Review all recommendations with your prescribing physician before commencing supplementation.<br /><br />
                © 2026 MyoGuard Protocol · <a href="${APP_URL}" style="color:#0d9488;text-decoration:none;">myoguard.health</a> · Dr. Onyeka Okpala, MD ·
                <a href="${APP_URL}/privacy" style="color:#0d9488;text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
