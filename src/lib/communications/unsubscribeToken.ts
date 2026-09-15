/**
 * src/lib/communications/unsubscribeToken.ts
 *
 * Signed, opaque unsubscribe tokens for email-borne recipient choice.
 *
 * WHY A STATELESS TOKEN AND NOT THE REPOSITORY'S EXISTING IDIOM
 * The platform's other token (`PhysicianApplication.adminToken`) is a stored
 * opaque HMAC with a 48-hour expiry, verified by database lookup. That pattern
 * is right there and wrong here, for two reasons:
 *
 *   1. An unsubscribe link must work whenever the recipient finds the email.
 *      An expiring unsubscribe link turns a promise into a trap.
 *   2. A stored token needs a row per recipient per class. A recipient may have
 *      a governed identity with no CommunicationRecipient row at all, and this
 *      layer must not manufacture one just to let someone opt out.
 *
 * WHY NON-EXPIRY IS SAFE HERE
 * Capability is deliberately minimal: this token can ONLY withdraw. It cannot
 * subscribe, cannot re-subscribe, cannot read an address, cannot reveal
 * anything about the recipient. A leaked or forwarded token's worst outcome is
 * an unwanted unsubscribe, which the authenticated settings surface can undo.
 * A bearer credential whose only power is to reduce what we send is acceptable
 * in a way that a general-purpose one would not be.
 *
 * REVOCATION AND ROTATION
 * Stateless tokens cannot be revoked individually. Rotation is the only lever,
 * and rotating invalidates every link in every email already delivered — the
 * precise failure this design exists to avoid. So `v` (token version) selects
 * the signing key: a future rotation adds v2 for new links while v1 stays
 * verifiable indefinitely. Never remove an old verification key.
 *
 * No JWT library. Node crypto only.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Name of the required server secret. Never logged, never returned. */
export const UNSUBSCRIBE_SECRET_ENV = 'COMMS_UNSUBSCRIBE_SECRET';

/** Key-strength floor. Matches the identity layer's reasoning. */
export const MIN_SECRET_LENGTH = 32;

/** Current signing key generation. See the rotation note above. */
export const CURRENT_TOKEN_VERSION = 1;

/**
 * The only purpose this token may carry. Bound into the signed payload so a
 * token minted for unsubscribe can never be replayed as anything else, even if
 * a future phase adds other token kinds under the same secret.
 */
export const UNSUBSCRIBE_PURPOSE = 'unsub' as const;

/**
 * Classes a recipient may withdraw from. ESSENTIAL_SERVICE and
 * OPERATIONAL_INTERNAL are absent by construction — an allowlist, not a
 * denylist, so neither can be reached by tampering, by a new enum member, or
 * by a caller mistake.
 */
export const OPTIONAL_CLASSES = [
  'CLINICAL_CONTINUITY',
  'EDUCATIONAL',
  'MARKETING',
] as const;

export type OptionalClass = (typeof OPTIONAL_CLASSES)[number];

export function isOptionalClass(value: string): value is OptionalClass {
  return (OPTIONAL_CLASSES as readonly string[]).includes(value);
}

export type UnsubscribePayload = {
  /** Token version — selects the signing key. */
  v:  number;
  /** Pseudonymous recipient key (HMAC of the address). Never the address. */
  k:  string;
  /** Key version of `k`, so identity rotation stays resolvable. */
  kv: number;
  /** Channel. */
  ch: 'EMAIL' | 'SMS';
  /** The class the email belonged to. */
  cl: OptionalClass;
  /** Bounded purpose. */
  p:  typeof UNSUBSCRIBE_PURPOSE;
};

export type TokenFailure =
  | 'secret_unavailable'
  | 'malformed'
  | 'bad_signature'
  | 'wrong_purpose'
  | 'unsupported_version'
  | 'class_not_optional'
  | 'unsupported_channel';

export type VerifyResult =
  | { ok: true;  payload: UnsubscribePayload }
  | { ok: false; reason: TokenFailure };

// ─── Secret ───────────────────────────────────────────────────────────────────

function signingKey(): string | null {
  const secret = process.env[UNSUBSCRIBE_SECRET_ENV];
  if (!secret || secret.trim().length < MIN_SECRET_LENGTH) return null;
  return secret;
}

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const unb64url = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

function sign(payloadPart: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadPart).digest('base64url');
}

// ─── Mint ─────────────────────────────────────────────────────────────────────

/**
 * Produces `<payload>.<signature>`, or null when the secret is unusable.
 *
 * Null is the fail-closed signal. Callers that are REQUIRED to carry a
 * recipient-choice link must not send when it is returned — recipient choice
 * outranks delivery.
 */
export function mintUnsubscribeToken(args: {
  recipientKey:       string;
  keyVersion:         number;
  channel:            'EMAIL' | 'SMS';
  communicationClass: OptionalClass;
}): string | null {
  const secret = signingKey();
  if (!secret) {
    console.error(
      `[comms/unsubscribe-token] ${UNSUBSCRIBE_SECRET_ENV} is missing or too weak — cannot mint.`,
    );
    return null;
  }

  const payload: UnsubscribePayload = {
    v:  CURRENT_TOKEN_VERSION,
    k:  args.recipientKey,
    kv: args.keyVersion,
    ch: args.channel,
    cl: args.communicationClass,
    p:  UNSUBSCRIBE_PURPOSE,
  };

  const part = b64url(JSON.stringify(payload));
  return `${part}.${sign(part, secret)}`;
}

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Validates signature, purpose, version, channel and class.
 *
 * Every field that matters is inside the signed payload, so changing the class
 * from CLINICAL_CONTINUITY to anything else — including a non-optional class —
 * invalidates the signature. The allowlist check afterwards is a second,
 * independent refusal for the same attack.
 */
export function verifyUnsubscribeToken(token: string): VerifyResult {
  const secret = signingKey();
  if (!secret) {
    console.error(
      `[comms/unsubscribe-token] ${UNSUBSCRIBE_SECRET_ENV} is missing or too weak — cannot verify.`,
    );
    return { ok: false, reason: 'secret_unavailable' };
  }

  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: 'malformed' };
  }

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: 'malformed' };

  const part      = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  // Constant-time comparison, matching the timingSafeEqual idiom already used
  // by the admin-token verifier.
  const expected = sign(part, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: UnsubscribePayload;
  try {
    payload = JSON.parse(unb64url(part)) as UnsubscribePayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (payload?.p !== UNSUBSCRIBE_PURPOSE)            return { ok: false, reason: 'wrong_purpose' };
  if (payload.v !== CURRENT_TOKEN_VERSION)           return { ok: false, reason: 'unsupported_version' };
  if (payload.ch !== 'EMAIL' && payload.ch !== 'SMS') return { ok: false, reason: 'unsupported_channel' };
  if (typeof payload.k !== 'string' || !/^[0-9a-f]{64}$/.test(payload.k)) {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof payload.kv !== 'number') return { ok: false, reason: 'malformed' };
  if (!isOptionalClass(payload.cl))   return { ok: false, reason: 'class_not_optional' };

  return { ok: true, payload };
}

// ─── URL helper ───────────────────────────────────────────────────────────────

const PRODUCTION_URL = 'https://myoguard.health';
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
const APP_URL =
  rawAppUrl && !rawAppUrl.includes('localhost') && !rawAppUrl.includes('127.0.0.1')
    ? rawAppUrl.replace(/\/$/, '')
    : PRODUCTION_URL;

/** Public confirmation surface. GET only; never mutates. */
export function unsubscribeUrlFor(token: string): string {
  return `${APP_URL}/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** Authenticated preference centre — the destination the email footer promises. */
export function settingsUrl(): string {
  return `${APP_URL}/settings`;
}

// ─── RFC 8058 one-click (Phase 1D-C3D) ────────────────────────────────────────

/** The mutation endpoint. POST only — there is deliberately no GET handler. */
const ONE_CLICK_PATH = '/api/communications/unsubscribe';

/**
 * The apex 307-redirects to www for every path, including API routes. A browser
 * following the body link handles that invisibly, but RFC 8058 one-click is a
 * machine POST issued by a mail client, and a redirected POST is not reliably
 * re-issued with its method and body intact. The header therefore names the
 * host that answers directly.
 *
 * Only the apex is rewritten. Any other configured origin is left alone.
 */
function oneClickOrigin(): string {
  return APP_URL.replace(/^https:\/\/myoguard\.health$/, 'https://www.myoguard.health');
}

/**
 * The URL a mail client POSTs to when the recipient presses its own unsubscribe
 * button. Carries the same signed, downgrade-only capability as the body link —
 * there is no second, weaker token and no separate unsubscribe service.
 *
 * The token is in the query string because RFC 8058 fixes the request body as
 * `List-Unsubscribe=One-Click`, leaving the URL as the only place a
 * recipient-specific capability can travel. It is opaque and contains no
 * address.
 */
export function unsubscribeOneClickUrlFor(token: string): string {
  return `${oneClickOrigin()}${ONE_CLICK_PATH}?t=${encodeURIComponent(token)}`;
}

/**
 * The two headers that let a mail client offer a native unsubscribe control.
 *
 * `List-Unsubscribe-Post` is what distinguishes RFC 8058 one-click from the
 * older RFC 2369 header: it tells the client the URL accepts an unattended POST,
 * so it can unsubscribe without opening a browser. Both are only ever attached
 * to governed optional-class mail; ESSENTIAL_SERVICE carries no opt-out, and
 * the token itself cannot encode a non-optional class.
 */
export function listUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    'List-Unsubscribe':      `<${unsubscribeOneClickUrlFor(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
