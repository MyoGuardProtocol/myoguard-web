import { NextResponse } from "next/server";

/**
 * POST /api/protocol-email — DISABLED (SRI Containment C1, K2-C).
 *
 * This route emailed the public Preliminary SRI: the composite value, the
 * Preliminary band with its colour and guidance text, and the lean and
 * recovery sub-values. Every section of that email was built on those values,
 * so it cannot be sent meaningfully without them, and no replacement content is
 * authorised. The send path is therefore disabled rather than rewritten.
 *
 * The handler reads nothing, validates nothing, consumes no throttle budget,
 * writes no CommunicationEvent and sends no email. It answers 410 Gone with an
 * empty body. The landing page no longer calls it.
 */
export async function POST() {
  return new NextResponse(null, { status: 410 });
}
