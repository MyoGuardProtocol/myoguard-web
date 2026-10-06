/**
 * app/api/assessment/save/route.ts — RETIRED.
 *
 * Protein Clinical Integrity P0 containment (C4). This legacy route wrote
 * Assessment and MuscleScore rows outside the canonical /api/assessment pathway:
 * it accepted a client-supplied SRI value and band, wrote `proteinGrams: protein
 * ?? 0` and `weightKg: weight ?? 0`, and applied its own protein-target formula.
 * Nothing in the repository has called it since 25 April 2026 (bce0ad3).
 *
 * It now writes nothing and reads nothing: it returns 410 Gone for every POST.
 * It imports no database client and no auth SDK, so it cannot reach either.
 * Assessments are created only through /api/assessment. Historical rows written
 * by this route are untouched.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RETIRED_ROUTE_ERROR =
  'This endpoint has been retired. Assessments are submitted through /api/assessment.';

export async function POST() {
  return NextResponse.json({ ok: false, error: RETIRED_ROUTE_ERROR }, { status: 410 });
}
