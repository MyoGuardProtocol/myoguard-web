import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import { calculateProtocol, type AssessmentInput, type ProtocolResult } from '@/src/lib/protocolEngine';
import { AssessmentInputSchema } from '@/src/schemas/assessment';

/**
 * POST /api/assessment
 * Auth required. Saves a scored Assessment + MuscleScore + ProtocolPlan to DB.
 * All three records are written in a single transaction — atomic and idempotent
 * (ProtocolPlan uses upsert on assessmentId so retries never produce duplicates).
 *
 * GET /api/assessment
 * Auth required. Returns the user's last 10 assessments with muscleScore +
 * protocolPlan included (for dashboard and history pages).
 */

// ── Protocol plan content builder ─────────────────────────────────────────────
// Derives actionable ProtocolPlan fields from the assessment input + computed
// result. Kept here, not in protocolEngine, because it references clinical copy
// that belongs to the application layer, not the pure calculation layer.
function buildProtocolPlanContent(
  input:  AssessmentInput,
  result: ProtocolResult,
): {
  proteinTargetG:   number;
  proteinSources:   string[];
  supplementation:  string[];
  trainingPlan:     string;
  hydrationTarget:  number;
  electrolyteNotes: string;
  giGuidance:       string;
} {
  // ── Protein sources ─────────────────────────────────────────────────────────
  const proteinSources = [
    'Chicken breast — 31g protein / 100g',
    'Greek yoghurt (0% fat) — 10g protein / 100g',
    'Whole eggs — 13g protein / 100g',
    'Cottage cheese — 11g protein / 100g',
    'Salmon (wild-caught) — 25g protein / 100g',
    'Lean beef mince — 26g protein / 100g',
    'Edamame — 11g protein / 100g (plant-based option)',
  ];

  // ── Supplementation — tiered by risk band ──────────────────────────────────
  const supplementation: string[] = [
    // Creatine is appropriate for every GLP-1 user regardless of risk level
    'Creatine monohydrate — 3–5g daily (supports lean mass retention on GLP-1)',
  ];

  if (result.riskBand === 'CRITICAL' || result.riskBand === 'HIGH') {
    supplementation.push('BCAAs — 5–10g peri-workout (leucine threshold support for muscle protein synthesis)');
    supplementation.push('Magnesium glycinate — 200–400mg nightly (muscle function, sleep quality, GLP-1 fatigue)');
  }

  supplementation.push('Vitamin D3 + K2 — 2,000–4,000 IU D3 daily (muscle function; deficiency is common in GLP-1 users)');

  if (input.symptoms.includes('Constipation')) {
    supplementation.push('Psyllium husk — 5–10g daily with water (soluble fibre for GI regularity)');
  }

  // ── Training plan — scaled to activity level ───────────────────────────────
  let trainingPlan: string;

  if (input.activityLevel === 'active') {
    trainingPlan =
      'Continue current training frequency (5+ days/week). Prioritise compound resistance movements ' +
      '(squat, deadlift, bench press, barbell row). Ensure 0.3–0.5g protein per kg body weight within ' +
      '2 hours post-workout. Apply progressive overload each session — this is the primary signal for ' +
      'muscle retention during caloric restriction.';
  } else if (input.activityLevel === 'moderate') {
    trainingPlan =
      'Increase to 4–5 resistance training sessions per week over the next 4 weeks. Focus on compound ' +
      'movements with progressive overload. Add one additional full-body session to your current schedule ' +
      'as the immediate next step. Resistance training is more protective against GLP-1 muscle loss than ' +
      'cardio — prioritise it.';
  } else {
    trainingPlan =
      'Begin with 2–3 full-body resistance training sessions per week — this is the single highest-impact ' +
      'action you can take right now. Start with bodyweight or light resistance (goblet squat, push-up, ' +
      'dumbbell row). Consistency matters more than intensity at this stage. Add one additional session ' +
      'every 2–3 weeks as you build the habit.';
  }

  // ── Electrolyte notes ──────────────────────────────────────────────────────
  const medName = input.medication === 'tirzepatide' ? 'Tirzepatide' : 'Semaglutide';
  const electrolyteNotes =
    `${medName} users frequently experience electrolyte depletion due to reduced food volume and ` +
    `increased urinary losses. Target: sodium 2–3g/day, potassium 3–4g/day, magnesium 400mg/day. ` +
    (input.medication === 'tirzepatide'
      ? 'Tirzepatide produces stronger appetite suppression than semaglutide — an electrolyte supplement ' +
        '(e.g. LMNT, Ultima Replenisher) on training days is strongly recommended.'
      : 'Consider an electrolyte supplement on days where food intake is particularly low due to appetite suppression.');

  // ── GI guidance — symptom-specific ────────────────────────────────────────
  const giParts: string[] = [];

  if (input.symptoms.includes('Nausea')) {
    giParts.push(
      'Nausea: Eat 4–6 small meals per day. Prioritise protein first at every meal. ' +
      'Avoid high-fat, fried, or spicy foods. Cold or room-temperature foods are often ' +
      'better tolerated than hot meals.',
    );
  }
  if (input.symptoms.includes('Constipation')) {
    giParts.push(
      `Constipation: Target ${result.fiber}g fibre/day from whole foods (oats, legumes, leafy ` +
      `vegetables). Drink at least ${result.hydration}L water daily. Psyllium husk (5–10g/day) ` +
      'can bridge gaps if dietary fibre is insufficient.',
    );
  }
  if (input.symptoms.includes('Reduced appetite')) {
    giParts.push(
      'Reduced appetite: Prioritise protein at every meal before other macros. Use protein shakes ' +
      'or Greek yoghurt to hit daily targets when appetite is suppressed. Do not skip meals — muscle ' +
      'catabolism accelerates in a prolonged deficit without adequate protein intake.',
    );
  }
  if (input.symptoms.includes('Bloating')) {
    giParts.push(
      'Bloating: Temporarily reduce high-FODMAP foods (onion, garlic, legumes). Eat slowly and ' +
      'chew thoroughly. Smaller meal volumes help significantly. Probiotics (Lactobacillus strains) ' +
      'may reduce bloating for some users.',
    );
  }

  const giGuidance =
    giParts.length > 0
      ? giParts.join(' | ')
      : `No active GI symptoms reported. Continue current dietary approach and monitor for changes at ` +
        `each dose escalation. Target ${result.fiber}g fibre/day and ${result.hydration}L hydration as ` +
        'preventive measures.';

  return {
    proteinTargetG:   result.proteinAggressive,
    proteinSources,
    supplementation,
    trainingPlan,
    hydrationTarget:  result.hydration,
    electrolyteNotes,
    giGuidance,
  };
}

// ── POST — create assessment + muscle score + protocol plan ───────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AssessmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Resolve internal user ID from Clerk ID.
  // Three-phase provisioning — prevents the "Unique constraint failed on the
  // fields: (email)" error that occurs when:
  //   - The Clerk webhook already created a row with the user's email, AND
  //   - The clerkId lookup misses for any reason (timing, ID format drift, etc.)
  //
  // Phase 1 — fast indexed lookup by clerkId (happy path, almost always hits)
  // Phase 2a — if miss: look up by email; if found, stamp the current clerkId
  // Phase 2b — if still no row: safe to create (neither clerkId nor email exists)
  let user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { id: true },
  });

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const email    = clerkUser.emailAddresses[0]?.emailAddress ?? '';
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'MyoGuard User';

    // Phase 2a — row exists by email but clerkId not yet attached
    const byEmail = await prisma.user.findUnique({
      where:  { email },
      select: { id: true },
    });

    if (byEmail) {
      user = await prisma.user.update({
        where:  { id: byEmail.id },
        data:   { clerkId: userId },
        select: { id: true },
      });
    } else {
      // Phase 2b — truly new user; safe to create.
      user = await prisma.user.create({
        data:   { clerkId: userId, email, fullName, role: 'PATIENT', subscriptionStatus: 'FREE' },
        select: { id: true },
      });
    }
  }

  const input    = parsed.data;
  const protocol = calculateProtocol(input);

  // ── Lean mass velocity — requires prior assessment; computed before transaction ─
  const priorAssessment = await prisma.assessment.findFirst({
    where:   { userId: user.id },
    orderBy: { assessmentDate: 'desc' },
    select:  {
      assessmentDate: true,
      muscleScore:    { select: { score: true, leanLossEstPct: true } },
    },
  });

  let leanVelocityPct:  number | null = null;
  let leanVelocityFlag: string        = 'insufficient_data';

  if (priorAssessment?.muscleScore) {
    const daysSince = (Date.now() - new Date(priorAssessment.assessmentDate).getTime())
      / (1000 * 60 * 60 * 24);

    if (daysSince >= 14) {
      const isWorsening = protocol.myoguardScore < priorAssessment.muscleScore.score;
      if (!isWorsening) {
        leanVelocityFlag = 'stable';
      } else {
        const delta = protocol.leanLossEstPct - priorAssessment.muscleScore.leanLossEstPct;
        if (delta >= 10) {
          leanVelocityPct  = delta;
          leanVelocityFlag = 'critical_review';
        } else if (delta >= 5) {
          leanVelocityPct  = delta;
          leanVelocityFlag = 'concerning';
        } else {
          leanVelocityFlag = 'stable';
        }
      }
    }
  }

  // Map activityLevel string → Prisma enum
  const activityMap: Record<string, string> = {
    sedentary: 'SEDENTARY',
    moderate:  'MODERATELY_ACTIVE',
    active:    'VERY_ACTIVE',
  };
  void activityMap; // referenced for future UserProfile writes

  // Map riskBand string → Prisma enum (values already match)
  const riskBandMap: Record<string, 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'> = {
    LOW:      'LOW',
    MODERATE: 'MODERATE',
    HIGH:     'HIGH',
    CRITICAL: 'CRITICAL',
  };

  const planContent = buildProtocolPlanContent(input, protocol);

  try {
    // ── Atomic transaction: Assessment + MuscleScore + ProtocolPlan ──────────
    // All three records are created together. ProtocolPlan uses upsert on the
    // unique assessmentId so a retry never produces a duplicate plan row.
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const assessment = await tx.assessment.create({
        data: {
          userId:          user.id,
          weightKg:        protocol.weightKg,
          proteinGrams:    protocol.proteinStandard,
          // Use exact days when provided; fall back to bucket midpoints for legacy callers
          exerciseDaysWk:  input.exerciseDaysWk
            ?? (input.activityLevel === 'active' ? 5 : input.activityLevel === 'moderate' ? 3 : 1),
          hydrationLitres: protocol.hydration,
          symptoms:        input.symptoms,
          fatigue:         input.symptoms.includes('Fatigue')          ? 1 : 0,
          nausea:          input.symptoms.includes('Nausea')           ? 1 : 0,
          muscleWeakness:  input.symptoms.includes('Muscle weakness')  ? 1 : 0,
          score:           protocol.myoguardScore,
          riskBand:        riskBandMap[protocol.riskBand],
          sleepHours:      input.sleepHours      ?? null,
          sleepQuality:    input.sleepQuality    ?? null,
          recoveryStatus:  protocol.recoveryStatus,
          glp1Stage:       input.glp1Stage       ?? null,
          gripStrengthKg:  input.gripStrengthKg  ?? null,
        },
      });

      // MuscleScore and ProtocolPlan can be written in parallel once we have
      // the Assessment ID — they have no dependency on each other.
      const [muscleScore, protocolPlan] = await Promise.all([
        tx.muscleScore.create({
          data: {
            userId:                user.id,
            assessmentId:          assessment.id,
            score:                 protocol.myoguardScore,
            riskBand:              riskBandMap[protocol.riskBand],
            leanLossEstPct:        protocol.leanLossEstPct,
            proteinTargetG:        protocol.proteinAggressive,
            explanation:           protocol.explanation,
            proteinStandardG:      protocol.proteinStandard,
            proteinStepTargetG:    protocol.proteinStepTargetG   ?? null,
            stepRationale:         protocol.stepRationale        ?? null,
            giSeverity:            protocol.giSeverity,
            leanVelocityPct:       leanVelocityPct               ?? null,
            leanVelocityFlag:      leanVelocityFlag,
            stageMultiplierApplied: protocol.stageMultiplierApplied,
          },
        }),
        // Upsert: safe to call on retry — conflict on assessmentId is a no-op
        // (same data written again, idempotent).
        tx.protocolPlan.upsert({
          where:  { assessmentId: assessment.id },
          create: {
            userId:       user.id,
            assessmentId: assessment.id,
            ...planContent,
          },
          update: planContent,
        }),
      ]);

      return { assessment, muscleScore, protocolPlan };
    });

    return NextResponse.json({
      assessmentId: result.assessment.id,
      score:        protocol.myoguardScore,
      riskBand:     protocol.riskBand,
    });
  } catch (err) {
    console.error('[POST /api/assessment]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET — last 10 assessments with muscle scores and protocol plans ────────────
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { clerkId: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ assessments: [] });
  }

  try {
    const assessments = await prisma.assessment.findMany({
      where:   { userId: user.id },
      orderBy: { assessmentDate: 'desc' },
      take:    10,
      include: {
        muscleScore: {
          select: {
            score:          true,
            riskBand:       true,
            leanLossEstPct: true,
            explanation:    true,
          },
        },
        protocolPlan: {
          select: {
            proteinTargetG:   true,
            supplementation:  true,
            trainingPlan:     true,
            hydrationTarget:  true,
            electrolyteNotes: true,
            giGuidance:       true,
          },
        },
      },
    });

    return NextResponse.json({ assessments });
  } catch (err) {
    console.error('[GET /api/assessment]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
