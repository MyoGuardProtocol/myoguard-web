// MyoGuard Clinical Email Layer
// These emails are clinical continuity communications, not marketing.
// Tone: restrained clinical correspondence.
// Never: urgency manipulation, streak gamification, wellness-coach language,
// product promotion, emojis.
// Always: physician-aligned, CDS-positioned, institutionally restrained.

// Scheduled email triggers such as weekly reminders,
// monthly summaries, and physician priority notifications
// require Vercel Cron or an equivalent scheduler.
// Scheduling is intentionally deferred to BUILD 4C.
// This layer only provides templates and service primitives.

import { Resend } from 'resend';
import { EMAIL_TOKENS } from './tokens';
import { baseEmail, type BaseEmailOptions } from './templates/BaseEmail';

// ─── Resend client ────────────────────────────────────────────────────────────
//
// Single instance — never instantiate Resend elsewhere in this directory.
// RESEND_API_KEY must be set in the environment; the raw key is never
// exposed to client code or logged.

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        '[email] RESEND_API_KEY is not configured — email service unavailable.',
      );
    }
    _resend = new Resend(key);
  }
  return _resend;
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  /** Recipient address or addresses (max 50 per Resend). */
  to: string | string[];

  /** Email subject line. */
  subject: string;

  /** Complete rendered HTML string (use a builder below or baseEmail()). */
  html: string;

  /**
   * Sender address in `"Name <address>"` format.
   * Defaults to EMAIL_TOKENS.from.system if omitted.
   * Pass EMAIL_TOKENS.from.patient or .physician where appropriate.
   */
  from?: string;

  /** Optional reply-to address. */
  replyTo?: string;
}

export interface SendEmailResult {
  /** Resend message ID on success; undefined on failure. */
  id: string | undefined;

  /** Error instance if the send failed; null on success. */
  error: Error | null;
}

/**
 * sendEmail()
 *
 * Central Resend send primitive. All new email sends in this codebase
 * should flow through here — not through raw fetch or separate Resend
 * instantiations.
 *
 * Does NOT modify existing route handlers (app/api/*). Those continue
 * operating via their own Resend instances until explicitly migrated.
 */
export async function sendEmail({
  to,
  subject,
  html,
  from   = EMAIL_TOKENS.from.system,
  replyTo,
}: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const client = getResend();

    const { data, error } = await client.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      console.error('[email/send] Resend API error:', error.name, error.message);
      return { id: undefined, error: new Error(error.message) };
    }

    return { id: data?.id, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email/send] Unexpected error:', message);
    return { id: undefined, error: new Error(message) };
  }
}

// ─── Template builders ────────────────────────────────────────────────────────
//
// Each builder wraps baseEmail() with the correct audience classification.
// Callers pass title, preheader, and pre-composed content HTML.
//
// Convention:
//   const html = buildPatientEmail({ title, preheader, content });
//   await sendEmail({ to, subject: title, html, from: EMAIL_TOKENS.from.patient });

type BuildOptions = Omit<BaseEmailOptions, 'audience'>;

/**
 * buildPatientEmail()
 *
 * Produces a patient-facing email with Midnight Silk dark card (default)
 * and "PATIENT COMMUNICATION" metadata classification.
 *
 * Recommended from: EMAIL_TOKENS.from.patient
 */
export function buildPatientEmail(options: BuildOptions): string {
  return baseEmail({
    ...options,
    variant:  options.variant ?? 'dark',
    audience: 'patient',
  });
}

/**
 * buildPhysicianEmail()
 *
 * Produces a physician-facing email with Midnight Silk dark card (default)
 * and "PHYSICIAN COMMUNICATION" metadata classification.
 *
 * Recommended from: EMAIL_TOKENS.from.physician
 */
export function buildPhysicianEmail(options: BuildOptions): string {
  return baseEmail({
    ...options,
    variant:  options.variant ?? 'dark',
    audience: 'physician',
  });
}

/**
 * buildSystemEmail()
 *
 * Produces a system / admin notification with Midnight Silk dark card (default)
 * and "SYSTEM NOTIFICATION" metadata classification.
 *
 * Recommended from: EMAIL_TOKENS.from.system
 */
export function buildSystemEmail(options: BuildOptions): string {
  return baseEmail({
    ...options,
    variant:  options.variant ?? 'dark',
    audience: 'system',
  });
}

// ─── Re-exports ───────────────────────────────────────────────────────────────
// Advanced usage: callers that need the base builder or token values directly.

export { baseEmail } from './templates/BaseEmail';
export type { BaseEmailOptions } from './templates/BaseEmail';
export { EMAIL_TOKENS } from './tokens';
