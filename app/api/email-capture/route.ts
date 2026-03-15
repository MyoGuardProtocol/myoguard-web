import { NextRequest, NextResponse } from 'next/server';
import { EmailCaptureSchema } from '@/src/schemas/assessment';

/**
 * POST /api/email-capture
 * Public. Validates payload, then forwards to n8n webhook if configured.
 * Degrades gracefully (logs only) when N8N_WEBHOOK_URL is absent.
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
      { status: 422 }
    );
  }

  const { email, protocolResult, formData } = parsed.data;
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    // Graceful stub — log and return success so the UI behaves correctly
    console.log('[email-capture] N8N_WEBHOOK_URL not set. Captured:', {
      email,
      score: protocolResult.myoguardScore,
      riskBand: protocolResult.riskBand,
      referralSlug: formData.referralSlug ?? null,
    });
    return NextResponse.json({ ok: true, mode: 'stub' });
  }

  try {
    const payload = {
      email,
      protocolResult,
      formData,
      capturedAt: new Date().toISOString(),
      source: 'myoguard-web',
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.N8N_WEBHOOK_SECRET) {
      headers['x-webhook-secret'] = process.env.N8N_WEBHOOK_SECRET;
    }

    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!n8nRes.ok) {
      console.error('[email-capture] n8n returned', n8nRes.status);
      return NextResponse.json({ error: 'Webhook delivery failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email-capture] fetch error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
