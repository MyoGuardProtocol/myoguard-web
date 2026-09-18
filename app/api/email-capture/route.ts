import { NextRequest, NextResponse } from 'next/server';
import { EmailCaptureSchema } from '@/src/schemas/assessment';
// Authoritative band union, re-exported from src/lib/protocolEngine via
// src/types. Type-only import — erased at compile time, so it adds no runtime
// dependency on the engine and cannot introduce a cycle.
import type { RiskBand } from '@/src/types';
// Canonical escaper for this email layer. `explanation` is free-form clinical
// text that must stay free-form, so it is encoded at the output boundary
// rather than constrained by the schema.
import { escapeHtml } from '@/src/lib/email/templates/BaseEmail';
import { consumeRecipientBudget } from '@/src/lib/emailThrottle';
import { sendServiceEmail } from '@/src/lib/communications/serviceEmail';
import { PROTEIN_GUIDANCE_PENDING_SHORT } from '@/src/lib/clinical/proteinContainment';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myoguard.health';

/** Template identity recorded on CommunicationEvent — never the rendered output. */
const TEMPLATE_ID = 'service.protocol_delivery.v1';

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
  console.log("🔥 EMAIL CAPTURE ROUTE HIT");

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

  // ── Recipient throttle ──────────────────────────────────────────────────
  //
  // After validation (a malformed request must not consume budget) and before
  // BOTH downstream side effects — Resend delivery and the n8n forward — since
  // either can originate contact with the recipient. The budget is shared with
  // /api/protocol-email: one recipient, one allowance across both routes.
  //
  // Note this is the one place the route does not return 200. The "always 200"
  // convention below exists so a delivery misconfiguration still reads as a
  // successful form submission; a throttled request is a refused submission and
  // must be distinguishable. The message is neutral and reveals nothing about
  // this address's history.
  const throttle = await consumeRecipientBudget(email);

  if (throttle.outcome === 'throttled') {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }
  if (throttle.outcome === 'unavailable') {
    // Fail closed — no Resend call, no n8n forward.
    return NextResponse.json(
      { ok: false, error: 'Temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }

  // ── 1. Governed email delivery (Phase 1D-C3E) ────────────────────────────
  //
  // Requested one-shot delivery, so ESSENTIAL_SERVICE. Asking for the protocol
  // is not consent to anything further: no CommunicationRecipient, no
  // CommunicationPreference and no CommunicationConsentEvent is written here,
  // and none may be added later on the strength of this request.
  //
  // `delivered` still drives the UI's honest confirmation. A suppressed
  // destination reports delivered:false, which is accurate — the email was not
  // sent — without disclosing why.
  let delivered = false;

  try {
    const html = buildProtocolEmail({ email, protocolResult, formData });

    const sent = await sendServiceEmail({
      to:         email,
      subject:    'Your MyoGuard Protocol is Ready',
      html,
      from:       'MyoGuard Health <hello@myoguard.health>',
      replyTo:    'hello@myoguard.health',
      templateId: TEMPLATE_ID,
      context:    'public:protocol-delivery',
    });

    delivered = sent.outcome === 'sent';
  } catch (err) {
    // Transient failure — UI shows the delivery-failed state. The error is
    // logged without the address it concerns.
    console.error('[email-capture] governed send threw', err);
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
    // Narrowed to the authoritative union so the band-keyed maps below are
    // exhaustively checked. EmailCaptureSchema already validates this value
    // against the same four bands, so no runtime behaviour changes.
    riskBand:          RiskBand;
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

// One label per authoritative band. HIGH and CRITICAL are clinically distinct
// and must never share a label: collapsing them would stop a CRITICAL result
// — including one set by the engine's recovery override — from reaching the
// patient as critical.
// Exhaustively typed over the authoritative RiskBand union: adding a band to
// the engine without adding it here is now a compile error rather than a
// silent fall-through to a default label or colour.
const RISK_LABELS: Record<RiskBand, string> = {
  LOW:      'Low Risk',
  MODERATE: 'Moderate Risk',
  HIGH:     'High Risk',
  CRITICAL: 'Critical Risk',
};

const RISK_COLOURS: Record<RiskBand, { bg: string; text: string; border: string }> = {
  LOW:      { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  MODERATE: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  HIGH:     { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  CRITICAL: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
};

function buildProtocolEmail({ protocolResult, formData }: TemplateData): string {
  const score     = Math.round(protocolResult.myoguardScore);
  // Authoritative band from the engine — includes the CRITICAL recovery
  // override, so it is never re-derived from `score`. Summary wording below is
  // band-based: point-distance framing is gamified and implies a precision the
  // SRI does not claim.
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
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#2dd4bf;text-transform:uppercase;letter-spacing:0.15em;">Your Sarcopenia Risk Index (SRI)</p>
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
                      band === 'LOW'
                        ? 'Your SRI is currently in the Low Risk band. Continue your current protein intake and activity to maintain muscle protection.'
                        : `Your SRI is currently in the ${riskLabel} band. Consistent protein intake and activity may support muscle protection. Review this result with your physician.`
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
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(protocolResult.explanation)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Protocol targets — 3 cards -->
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Your Daily Protocol</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Protein -->
                  <td width="32%" style="padding-right:6px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;">
                      <tr>
                        <td style="padding:16px 14px;">
                          <!-- SRI-R1C: the individualized protein range is withheld
                               from this public, unauthenticated pathway. No renal
                               information exists for these recipients and no clinician
                               is involved, so no personal figure is asserted. -->
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#0d9488;text-transform:uppercase;">Protein</p>
                          <p style="margin:0;font-size:12px;font-weight:600;color:#0f172a;line-height:1.35;">${PROTEIN_GUIDANCE_PENDING_SHORT}</p>
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
                      Your current risk band is <strong>${RISK_LABELS[band] ?? band}</strong>, based on your GLP-1 dose and activity pattern.
                      Protein needs differ between individuals and should be set with a clinician.
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
                © 2026 Meridian Wellness Systems LLC · <a href="${APP_URL}" style="color:#0d9488;text-decoration:none;">myoguard.health</a> ·
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
