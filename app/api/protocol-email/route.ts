import { NextRequest, NextResponse } from "next/server";

const PRODUCTION_URL = "https://myoguard.health";
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const APP_URL =
  rawAppUrl && !rawAppUrl.includes("localhost") && !rawAppUrl.includes("127.0.0.1")
    ? rawAppUrl
    : PRODUCTION_URL;

const RISK_LABELS: Record<string, string> = {
  LOW: "Low Risk",
  MODERATE: "Moderate Risk",
  HIGH: "High Risk",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "#0d9488",
  MODERATE: "#d97706",
  HIGH: "#dc2626",
};

const RISK_GUIDANCE: Record<string, string> = {
  LOW: "Your protein intake and recovery environment are well-matched to your current GLP-1 dose stage. Continue your current protocol with quarterly monitoring.",
  MODERATE: "Protein adequacy or recovery environment is suboptimal relative to your GLP-1 dose stage. Supplementation and structured resistance training are recommended.",
  HIGH: "Significant lean mass loss risk detected. Immediate protocol review is indicated — your current inputs are not meeting the threshold required to protect skeletal muscle at your GLP-1 dose.",
};

export async function POST(req: NextRequest) {
  try {
    const { email, score, leanScore, recoveryScore, risk } = await req.json() as {
      email: string;
      score: number;
      leanScore: number;
      recoveryScore: number;
      risk: string;
    };

    console.log("[protocol-email] received:", { email, score, risk });

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error("[protocol-email] RESEND_API_KEY not set");
      return NextResponse.json({ error: "Email service unavailable" }, { status: 500 });
    }

    const riskLabel = RISK_LABELS[risk] ?? risk;
    const riskColor = RISK_COLORS[risk] ?? "#64748b";
    const guidance = RISK_GUIDANCE[risk] ?? "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;">

  <!-- Header band -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f766e;">
    <tr><td align="center" style="padding:10px 24px;">
      <p style="margin:0;font-size:11px;color:#ccfbf1;">Physician-Formulated &nbsp;·&nbsp; Evidence-Based Protocol &nbsp;·&nbsp; GLP-1 Specialist Tool</p>
    </td></tr>
  </table>

  <!-- Logo -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-bottom:1px solid #e2e8f0;">
    <tr><td align="center" style="padding:20px 24px;">
      <p style="margin:0;font-size:22px;font-weight:900;color:#0f172a;">Myo<span style="color:#0d9488;">Guard</span> <span style="font-weight:300;color:#94a3b8;font-size:16px;">Protocol</span></p>
      <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">Muscle Protection · GLP-1 Therapy</p>
    </td></tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

        <!-- Intro -->
        <tr><td style="padding-bottom:24px;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">Your MyoGuard Protocol Report</h1>
          <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
            Based on the clinical parameters you entered, here is your personalised sarcopenia risk assessment.
          </p>
        </td></tr>

        <!-- Score card -->
        <tr><td style="padding-bottom:20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">MyoGuard Composite Score</p>
              <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
                <span style="font-size:48px;font-weight:900;color:#0f172a;line-height:1;">${score}</span>
                <span style="font-size:16px;color:#94a3b8;">/100</span>
                <span style="font-size:14px;font-weight:700;color:${riskColor};margin-left:8px;">${riskLabel}</span>
              </div>
              <!-- Score bar -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;">
                <tr><td width="${score}%" style="background:${riskColor};height:8px;border-radius:4px;"></td><td></td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Sub-scores -->
        <tr><td style="padding-bottom:20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-spacing:0;">
            <tr>
              <td width="48%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Lean Mass Risk</p>
                <p style="margin:0 0 2px;font-size:28px;font-weight:900;color:#0f172a;line-height:1;">${leanScore}<span style="font-size:13px;color:#94a3b8;font-weight:400;">/100</span></p>
                <p style="margin:0;font-size:11px;color:#94a3b8;">Protein + GLP-1 dose + GI burden</p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Recovery Environment</p>
                <p style="margin:0 0 2px;font-size:28px;font-weight:900;color:#0f172a;line-height:1;">${recoveryScore}<span style="font-size:13px;color:#94a3b8;font-weight:400;">/100</span></p>
                <p style="margin:0;font-size:11px;color:#94a3b8;">Nocturnal GH/IGF-1 context</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Clinical guidance -->
        <tr><td style="padding-bottom:20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;">Clinical Assessment</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;">${guidance}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Protocol targets -->
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#0f172a;">Core Protocol Targets</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;color:#64748b;">Protein target</span>
                  </td>
                  <td align="right" style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;font-weight:600;color:#0f172a;">1.6 g/kg body weight/day</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;color:#64748b;">Fibre target</span>
                  </td>
                  <td align="right" style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;font-weight:600;color:#0f172a;">25–35 g/day (GI-staged)</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;color:#64748b;">Supplement stack</span>
                  </td>
                  <td align="right" style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;font-weight:600;color:#0f172a;">Whey · Creatine · Vit D · Omega-3</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;color:#64748b;">Resistance training</span>
                  </td>
                  <td align="right" style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;font-weight:600;color:#0f172a;">3× per week minimum</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;">
                    <span style="font-size:12px;color:#64748b;">Monitoring labs</span>
                  </td>
                  <td align="right" style="padding:6px 0;">
                    <span style="font-size:12px;font-weight:600;color:#0f172a;">Ferritin · B12 · Zinc · Mg · Thiamine</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding-bottom:28px;text-align:center;">
          <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Create your free account to track adherence, get personalised targets, and connect with a physician.</p>
          <a href="${APP_URL}/sign-up" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;">
            Create Free Account &rarr;
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px;">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.8;">
            &copy; 2026 MyoGuard Protocol &nbsp;&middot;&nbsp; MyoGuard Clinical Oversight<br/>
            <a href="${APP_URL}" style="color:#0d9488;text-decoration:none;">myoguard.health</a>
            &nbsp;&middot;&nbsp;
            <a href="${APP_URL}/privacy" style="color:#0d9488;text-decoration:none;">Privacy Policy</a>
          </p>
          <p style="margin:12px 0 0;font-size:10px;color:#cbd5e1;text-align:center;line-height:1.6;">
            For educational use only. Not a substitute for clinical consultation.
            Scores are generated from self-reported inputs and do not constitute a medical diagnosis.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MyoGuard Protocol <noreply@myoguard.health>",
        to: email,
        subject: "Your MyoGuard Protocol Report",
        html,
        reply_to: "hello@myoguard.health",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[protocol-email] Resend error", res.status, errText);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    const data = await res.json() as { id?: string };
    console.log("[protocol-email] result:", data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[protocol-email] Unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
