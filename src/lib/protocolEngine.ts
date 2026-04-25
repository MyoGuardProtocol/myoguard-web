/**
 * protocolEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All MyoGuard calculation logic.
 * Pure functions — zero UI imports, zero side effects.
 *
 * Recovery Modifier (Mission 4)
 * ─────────────────────────────
 * Clinical basis: sleep deprivation suppresses anabolic hormone secretion (GH,
 * IGF-1, testosterone), blunts muscle protein synthesis (MPS) by ~18%, and
 * elevates cortisol — a catabolic hormone that accelerates lean-mass loss in
 * GLP-1 patients already in caloric deficit.
 *
 * Rules implemented:
 *   1. PENALTY — if sleepHours < 6.5 OR sleepQuality < 3:
 *        subtract 10 points from the composite MyoGuard Score.
 *   2. CRITICAL OVERRIDE — if sleepHours < 5.5 AND proteinGrams < proteinTarget:
 *        force riskBand → CRITICAL regardless of the computed score.
 *        (Dual-deficit: inadequate sleep + protein simultaneously removes the
 *        two primary anabolic inputs, making critical risk classification
 *        clinically justified.)
 *   3. recoveryStatus is derived and returned with every result:
 *        'optimal'  — sleep data absent OR (hours ≥ 7 AND quality ≥ 4)
 *        'impaired' — hours < 6.5 OR quality < 3
 *        'critical' — hours < 5.5 AND protein < target
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type RecoveryStatus = 'optimal' | 'impaired' | 'critical';
export type GiSeverity    = 'none' | 'mild' | 'moderate' | 'severe';

export type AssessmentInput = {
  weight:        string;          // raw string from form input
  unit:          'kg' | 'lbs';
  medication:    'semaglutide' | 'tirzepatide';
  doseMg:        number;          // weekly dose in mg
  activityLevel: 'sedentary' | 'moderate' | 'active';
  symptoms:      string[];
  // ── Recovery inputs (optional — form section C) ──────────────────────────
  sleepHours?:    number;         // average hours per night (0–14)
  sleepQuality?:  number;         // 1 (very poor) – 5 (excellent)
  // ── GLP-1 context (optional — unlocks stage multiplier and finer scoring) ─
  glp1Stage?:     'INITIATION' | 'DOSE_ESCALATION' | 'MAINTENANCE' | 'DISCONTINUATION';
  gripStrengthKg?: number;        // hand-grip reading in kg (stored, not scored here)
  exerciseDaysWk?: number;        // exact days/week — replaces bucket scoring when present
};

export type RiskBand = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type ProtocolResult = {
  weightKg:              number;
  proteinStandard:       number;   // g/day (activity-adjusted lower bound / clinical floor)
  proteinAggressive:     number;   // g/day (activity-adjusted upper bound)
  fiber:                 number;   // g/day
  hydration:             number;   // litres/day
  myoguardScore:         number;   // 0–100 composite risk score (higher = safer)
  riskBand:              RiskBand;
  leanLossEstPct:        number;   // estimated lean mass loss % risk
  explanation:           string;   // plain-language clinical summary
  // ── Recovery fields ──────────────────────────────────────────────────────
  recoveryStatus:          RecoveryStatus;
  recoveryModifierApplied: boolean; // true if the 10-pt penalty was applied
  criticalOverrideApplied: boolean; // true if sleep+protein forced CRITICAL
  // ── GI + stage fields ────────────────────────────────────────────────────
  giSeverity:             GiSeverity;
  stageMultiplierApplied: number;   // 1.0 = no stage; >1.0 = risk pressure applied
  proteinStepTargetG:     number | null; // temporary step target for moderate/severe GI
  stepRationale:          string | null; // explains floor/step split and resumption criteria
};

// ─── Protein multipliers by activity level ────────────────────────────────────
const PROTEIN_RANGES: Record<
  AssessmentInput['activityLevel'],
  { low: number; high: number }
> = {
  sedentary: { low: 1.2, high: 1.5 },
  moderate:  { low: 1.4, high: 1.7 },
  active:    { low: 1.6, high: 2.0 },
};

// ─── Dose-risk thresholds (weekly mg) ────────────────────────────────────────
const HIGH_DOSE_THRESHOLDS: Record<AssessmentInput['medication'], number> = {
  semaglutide:  1.0,   // >1 mg/week = maintenance / near-max dose
  tirzepatide:  5.0,   // >5 mg/week = escalation phase
};

// ─── Lean loss % by risk band ─────────────────────────────────────────────────
const LEAN_LOSS_BY_BAND: Record<RiskBand, number> = {
  LOW:      2,
  MODERATE: 8,
  HIGH:     18,
  CRITICAL: 30,
};

// ─── GLP-1 stage risk multipliers ────────────────────────────────────────────
// Applied as risk pressure: each point above 1.0 maps to 100× score penalty.
// MAINTENANCE = 1.0 (no pressure). Higher stages reflect greater catabolic risk.
const STAGE_MULTIPLIERS: Record<string, number> = {
  INITIATION:      1.15,
  DOSE_ESCALATION: 1.25,
  MAINTENANCE:     1.00,
  DISCONTINUATION: 1.10,
};

// ─── Recovery thresholds ──────────────────────────────────────────────────────
const SLEEP_IMPAIRED_HOURS    = 6.5;  // < this → impaired (penalty applies)
const SLEEP_IMPAIRED_QUALITY  = 3;    // < this → impaired (penalty applies)
const SLEEP_CRITICAL_HOURS    = 5.5;  // < this AND protein deficit → CRITICAL override
const RECOVERY_PENALTY_PTS    = 10;   // points deducted from score when impaired

/** Normalise weight to kg regardless of input unit. */
export function toKg(weight: string, unit: 'kg' | 'lbs'): number {
  const raw = parseFloat(weight);
  return unit === 'lbs' ? raw * 0.453592 : raw;
}

// ─── GI severity classifier ───────────────────────────────────────────────────

/**
 * Classify GI symptom burden. Determines whether a step-down protein target
 * is appropriate (moderate/severe) and informs clinical GI guidance.
 *
 * severe   — vomiting or gastroparesis present (highest burden)
 * moderate — nausea AND reduced appetite together
 * mild     — nausea OR reduced appetite OR bloating (single symptom)
 * none     — no qualifying GI symptoms
 */
export function classifyGiSeverity(symptoms: string[]): GiSeverity {
  if (symptoms.includes('Vomiting') || symptoms.includes('Gastroparesis')) return 'severe';
  if (symptoms.includes('Nausea') && symptoms.includes('Reduced appetite'))  return 'moderate';
  if (
    symptoms.includes('Nausea') ||
    symptoms.includes('Reduced appetite') ||
    symptoms.includes('Bloating')
  ) return 'mild';
  return 'none';
}

// ─── Recovery modifier ────────────────────────────────────────────────────────

type RecoveryModifier = {
  status:          RecoveryStatus;
  penaltyApplied:  boolean;
  criticalOverride: boolean;
};

/**
 * Derive recovery state and whether the score penalty / band override apply.
 *
 * @param sleepHours     avg nightly hours (undefined when not collected)
 * @param sleepQuality   1–5 self-report (undefined when not collected)
 * @param proteinGrams   actual protein intake from assessment
 * @param proteinTarget  1.4 g/kg benchmark
 */
function computeRecoveryModifier(
  sleepHours:    number | undefined,
  sleepQuality:  number | undefined,
  proteinGrams:  number,
  proteinTarget: number,
): RecoveryModifier {
  // No sleep data — treat as optimal, no penalty
  if (sleepHours === undefined && sleepQuality === undefined) {
    return { status: 'optimal', penaltyApplied: false, criticalOverride: false };
  }

  const hoursImpaired   = sleepHours  !== undefined && sleepHours  < SLEEP_IMPAIRED_HOURS;
  const qualityImpaired = sleepQuality !== undefined && sleepQuality < SLEEP_IMPAIRED_QUALITY;
  const isImpaired      = hoursImpaired || qualityImpaired;

  // Critical override: severe sleep deprivation AND protein deficit together
  const severeDeprivation  = sleepHours !== undefined && sleepHours < SLEEP_CRITICAL_HOURS;
  const proteinDeficit      = proteinGrams < proteinTarget * 0.85; // <85% of 1.4 g/kg target
  const criticalOverride    = severeDeprivation && proteinDeficit;

  const status: RecoveryStatus = criticalOverride
    ? 'critical'
    : isImpaired
    ? 'impaired'
    : 'optimal';

  return {
    status,
    penaltyApplied:  isImpaired,   // 10-pt deduction applied to score
    criticalOverride,              // forces riskBand to CRITICAL
  };
}

// ─── Score computation ────────────────────────────────────────────────────────

/**
 * Calculate the MyoGuard composite score (0–100, higher = safer).
 * The recovery penalty is applied here so the returned score already
 * reflects sleep status — callers do not need to adjust it separately.
 */
function computeScore(
  activityLevel:          AssessmentInput['activityLevel'],
  symptoms:               string[],
  medication:             AssessmentInput['medication'],
  doseMg:                 number,
  weightKg:               number,
  proteinStandard:        number,
  recovery:               RecoveryModifier,
  exerciseDaysWk?:        number,
  stageMultiplierApplied?: number,
): number {
  let score = 100;

  // Activity penalty — continuous when exerciseDaysWk provided, else 3-bucket fallback.
  // Boundaries match the bucket thresholds: 0→−25, 3→−10, 5→0.
  if (exerciseDaysWk !== undefined) {
    if (exerciseDaysWk >= 5) {
      // no penalty
    } else if (exerciseDaysWk >= 3) {
      score -= Math.round(10 * (5 - exerciseDaysWk) / 2);
    } else {
      score -= Math.round(10 + 15 * (3 - exerciseDaysWk) / 3);
    }
  } else {
    if      (activityLevel === 'sedentary') score -= 25;
    else if (activityLevel === 'moderate')  score -= 10;
    // active: no penalty
  }

  // Symptom penalties
  if (symptoms.includes('Muscle weakness')) score -= 20;
  if (symptoms.includes('Fatigue'))         score -= 15;

  // GI symptoms (max −15 combined)
  const giSymptoms = ['Constipation', 'Nausea', 'Bloating', 'Reduced appetite'];
  const giCount    = symptoms.filter(s => giSymptoms.includes(s)).length;
  score -= Math.min(giCount * 5, 15);

  // High dose risk
  if (doseMg > HIGH_DOSE_THRESHOLDS[medication]) score -= 10;

  // Protein deficit penalty (vs 1.4 g/kg benchmark)
  const proteinTarget = weightKg * 1.4;
  if      (proteinStandard < proteinTarget * 0.70) score -= 15;
  else if (proteinStandard < proteinTarget * 0.90) score -= 8;

  // GLP-1 stage pressure — inverse proportional scaling.
  if (stageMultiplierApplied !== undefined && stageMultiplierApplied > 1.0) {
    score = Math.round(score / stageMultiplierApplied);
  }

  // ── Recovery modifier ─────────────────────────────────────────────────────
  // Applied last so it compounds with all other penalties.
  if (recovery.penaltyApplied) score -= RECOVERY_PENALTY_PTS;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToRiskBand(score: number): RiskBand {
  if (score >= 80) return 'LOW';
  if (score >= 60) return 'MODERATE';
  if (score >= 40) return 'HIGH';
  return 'CRITICAL';
}

function buildExplanation(
  riskBand:               RiskBand,
  medication:             AssessmentInput['medication'],
  activityLevel:          AssessmentInput['activityLevel'],
  symptoms:               string[],
  recovery:               RecoveryModifier,
  giSeverity:             GiSeverity,
  stageMultiplierApplied: number,
): string {
  const medName =
    medication === 'semaglutide' ? 'Semaglutide' : 'Tirzepatide';

  const activityNote =
    activityLevel === 'active'
      ? 'Your active training schedule is your strongest protective factor.'
      : activityLevel === 'moderate'
      ? 'Moderate exercise provides good protection — aim to maintain or increase frequency.'
      : 'Sedentary activity level is the primary driver of lean-mass risk. Resistance training 2–3×/week is the single highest-impact intervention.';

  const symptomNote =
    symptoms.includes('Muscle weakness') || symptoms.includes('Fatigue')
      ? ` ${medName}-related fatigue and muscle weakness signal early sarcopenic risk — priority attention required.`
      : symptoms.length > 0
      ? ` GI symptoms are common with ${medName}; managing them supports dietary protein adherence.`
      : '';

  // Recovery note — appended when sleep data was provided and is suboptimal
  let recoveryNote = '';
  if (recovery.criticalOverride) {
    recoveryNote =
      ' Critical recovery deficit detected: severe sleep deprivation combined with protein insufficiency ' +
      'removes both primary anabolic inputs simultaneously. Muscle protein synthesis is maximally blunted. ' +
      'Immediate intervention on both fronts is required.';
  } else if (recovery.penaltyApplied) {
    recoveryNote =
      ' Insufficient sleep is blunting muscle protein synthesis by an estimated ~18%. ' +
      'Prioritising 7–9 hours of quality sleep is a high-impact, zero-cost intervention.';
  }

  const bandNote: Record<RiskBand, string> = {
    LOW:
      'Risk profile is well-controlled. Maintain current protocol and reassess at each dose escalation.',
    MODERATE:
      'Moderate risk of lean-mass loss. Consistent adherence to protein targets and resistance training is essential.',
    HIGH:
      'Elevated lean-mass risk. Consider consulting a registered dietitian and initiating resistance training immediately.',
    CRITICAL:
      'Critical risk profile. Urgent lifestyle intervention and physician review recommended before next dose escalation.',
  };

  let giNote = '';
  if (giSeverity === 'severe') {
    giNote =
      ' Severe GI symptoms detected. A temporary step-down protein target is active. ' +
      'Full protein floor resumes when your dose has been stable for ≥4 weeks.';
  } else if (giSeverity === 'moderate') {
    giNote =
      ' Moderate GI symptoms are present. A temporary step-down protein target is available ' +
      'to ease dietary tolerance. Aim to return to the full floor within 4 weeks of dose stability.';
  }

  let stageNote = '';
  if (stageMultiplierApplied > 1.0) {
    stageNote =
      ` GLP-1 stage pressure (${stageMultiplierApplied.toFixed(2)}× multiplier) has been factored ` +
      'into your score — this treatment stage carries elevated lean-mass risk.';
  }

  return `${bandNote[riskBand]} ${activityNote}${symptomNote}${recoveryNote}${giNote}${stageNote}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/** Call this from page.tsx and API routes. */
export function calculateProtocol(input: AssessmentInput): ProtocolResult {
  const weightKg = Math.round(toKg(input.weight, input.unit) * 10) / 10;
  const range    = PROTEIN_RANGES[input.activityLevel];

  const proteinStandard   = Math.round(weightKg * range.low  * 10) / 10;
  const proteinAggressive = Math.round(weightKg * range.high * 10) / 10;
  const fiber             = input.symptoms.includes('Constipation') ? 35 : 25;
  const hydration         = Math.round((weightKg * 35) / 1000 * 10) / 10;

  // GLP-1 stage multiplier (1.0 when stage not provided)
  const stageMultiplierApplied = input.glp1Stage
    ? (STAGE_MULTIPLIERS[input.glp1Stage] ?? 1.0)
    : 1.0;

  // GI severity — drives step target and explanation copy
  const giSeverity = classifyGiSeverity(input.symptoms);

  // Protein step target — temporary accommodation; Clinical Protein Floor never reduced
  let proteinStepTargetG: number | null = null;
  let stepRationale: string | null = null;
  if (giSeverity === 'severe') {
    proteinStepTargetG = Math.round(proteinStandard * 0.70);
    stepRationale =
      `Clinical protein floor is unchanged at ${proteinStandard}g/day. ` +
      `A temporary step target of ${proteinStepTargetG}g/day accommodates severe GI symptoms. ` +
      `Full floor resumes when dose has been stable for ≥4 weeks.`;
  } else if (giSeverity === 'moderate') {
    proteinStepTargetG = Math.round(proteinStandard * 0.85);
    stepRationale =
      `Clinical protein floor is unchanged at ${proteinStandard}g/day. ` +
      `A temporary step target of ${proteinStepTargetG}g/day accommodates moderate GI symptoms. ` +
      `Full floor resumes when dose has been stable for ≥4 weeks.`;
  }

  // 1.4 g/kg protein target for recovery critical-override check
  const proteinTarget = weightKg * 1.4;

  // Compute recovery modifier before score — score function needs it
  const recovery = computeRecoveryModifier(
    input.sleepHours,
    input.sleepQuality,
    proteinStandard,
    proteinTarget,
  );

  const baseScore = computeScore(
    input.activityLevel,
    input.symptoms,
    input.medication,
    input.doseMg,
    weightKg,
    proteinStandard,
    recovery,
    input.exerciseDaysWk,
    stageMultiplierApplied,
  );

  // Apply band override: if critical sleep+protein deficit, force CRITICAL
  // regardless of the numeric score value.
  const riskBand: RiskBand = recovery.criticalOverride
    ? 'CRITICAL'
    : scoreToRiskBand(baseScore);

  const leanLossEstPct = LEAN_LOSS_BY_BAND[riskBand];
  const explanation    = buildExplanation(
    riskBand,
    input.medication,
    input.activityLevel,
    input.symptoms,
    recovery,
    giSeverity,
    stageMultiplierApplied,
  );

  return {
    weightKg,
    proteinStandard,
    proteinAggressive,
    fiber,
    hydration,
    myoguardScore:           baseScore,
    riskBand,
    leanLossEstPct,
    explanation,
    recoveryStatus:          recovery.status,
    recoveryModifierApplied: recovery.penaltyApplied,
    criticalOverrideApplied: recovery.criticalOverride,
    giSeverity,
    stageMultiplierApplied,
    proteinStepTargetG,
    stepRationale,
  };
}
