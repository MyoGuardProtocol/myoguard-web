/**
 * protocolEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All MyoGuard calculation logic, extracted from app/page.tsx.
 * Pure functions — zero UI imports, zero side effects.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type AssessmentInput = {
  weight: string;         // raw string from form input
  unit: "kg" | "lbs";
  medication: "semaglutide" | "tirzepatide";
  doseMg: number;         // weekly dose in mg
  activityLevel: "sedentary" | "moderate" | "active";
  symptoms: string[];
};

export type RiskBand = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type ProtocolResult = {
  weightKg: number;
  // Protein range — lower bound = standard, upper = aggressive
  proteinStandard: number;    // g/day (activity-adjusted lower bound)
  proteinAggressive: number;  // g/day (activity-adjusted upper bound)
  fiber: number;              // g/day (elevated if constipation)
  hydration: number;          // litres/day
  myoguardScore: number;      // 0–100 composite risk score
  riskBand: RiskBand;
  leanLossEstPct: number;     // estimated lean mass loss % risk
  explanation: string;        // plain-language summary for results panel
};

// ─── Multipliers by activity level ──────────────────────────────────────────
const PROTEIN_RANGES: Record<
  AssessmentInput["activityLevel"],
  { low: number; high: number }
> = {
  sedentary: { low: 1.2, high: 1.5 },
  moderate:  { low: 1.4, high: 1.7 },
  active:    { low: 1.6, high: 2.0 },
};

// ─── Dose-risk thresholds (weekly mg) ────────────────────────────────────────
const HIGH_DOSE_THRESHOLDS: Record<AssessmentInput["medication"], number> = {
  semaglutide:  1.0, // >1 mg/week = maintenance / near-max dose
  tirzepatide:  5.0, // >5 mg/week = escalation phase
};

// ─── Lean loss risk band → estimated pct ─────────────────────────────────────
const LEAN_LOSS_BY_BAND: Record<RiskBand, number> = {
  LOW:      2,
  MODERATE: 8,
  HIGH:     18,
  CRITICAL: 30,
};

/** Normalise weight to kg regardless of input unit. */
export function toKg(weight: string, unit: "kg" | "lbs"): number {
  const raw = parseFloat(weight);
  return unit === "lbs" ? raw * 0.453592 : raw;
}

/**
 * Calculate the MyoGuard composite score (0–100).
 * Lower score = higher muscle-loss risk.
 */
function computeScore(
  activityLevel: AssessmentInput["activityLevel"],
  symptoms: string[],
  medication: AssessmentInput["medication"],
  doseMg: number,
  weightKg: number,
  proteinStandard: number
): number {
  let score = 100;

  // Activity penalty
  if (activityLevel === "sedentary") score -= 25;
  else if (activityLevel === "moderate") score -= 10;
  // active: no penalty

  // Symptom penalties
  if (symptoms.includes("Muscle weakness")) score -= 20;
  if (symptoms.includes("Fatigue")) score -= 15;

  // GI symptoms (max −15 combined)
  const giSymptoms = ["Constipation", "Nausea", "Bloating", "Reduced appetite"];
  const giCount = symptoms.filter((s) => giSymptoms.includes(s)).length;
  score -= Math.min(giCount * 5, 15);

  // High dose risk
  if (doseMg > HIGH_DOSE_THRESHOLDS[medication]) score -= 10;

  // Protein deficit penalty (vs 1.4 g/kg target)
  const proteinTarget = weightKg * 1.4;
  if (proteinStandard < proteinTarget * 0.7) score -= 15;
  else if (proteinStandard < proteinTarget * 0.9) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToRiskBand(score: number): RiskBand {
  if (score >= 80) return "LOW";
  if (score >= 60) return "MODERATE";
  if (score >= 40) return "HIGH";
  return "CRITICAL";
}

function buildExplanation(
  riskBand: RiskBand,
  medication: AssessmentInput["medication"],
  activityLevel: AssessmentInput["activityLevel"],
  symptoms: string[]
): string {
  const medName =
    medication === "semaglutide" ? "Semaglutide" : "Tirzepatide";

  const activityNote =
    activityLevel === "active"
      ? "Your active training schedule is your strongest protective factor."
      : activityLevel === "moderate"
      ? "Moderate exercise provides good protection — aim to maintain or increase frequency."
      : "Sedentary activity level is the primary driver of lean-mass risk. Resistance training 2–3×/week is the single highest-impact intervention.";

  const symptomNote =
    symptoms.includes("Muscle weakness") || symptoms.includes("Fatigue")
      ? ` ${medName}-related fatigue and muscle weakness signal early sarcopenic risk — priority attention required.`
      : symptoms.length > 0
      ? ` GI symptoms are common with ${medName}; managing them supports dietary protein adherence.`
      : "";

  const bandNote: Record<RiskBand, string> = {
    LOW:
      "Risk profile is well-controlled. Maintain current protocol and reassess at each dose escalation.",
    MODERATE:
      "Moderate risk of lean-mass loss. Consistent adherence to protein targets and resistance training is essential.",
    HIGH:
      "Elevated lean-mass risk. Consider consulting a registered dietitian and initiating resistance training immediately.",
    CRITICAL:
      "Critical risk profile. Urgent lifestyle intervention and physician review recommended before next dose escalation.",
  };

  return `${bandNote[riskBand]} ${activityNote}${symptomNote}`;
}

/** Main export — call this from page.tsx and API routes. */
export function calculateProtocol(input: AssessmentInput): ProtocolResult {
  const weightKg = Math.round(toKg(input.weight, input.unit) * 10) / 10;
  const range = PROTEIN_RANGES[input.activityLevel];

  const proteinStandard   = Math.round(weightKg * range.low  * 10) / 10;
  const proteinAggressive = Math.round(weightKg * range.high * 10) / 10;
  const fiber             = input.symptoms.includes("Constipation") ? 35 : 25;
  const hydration         = Math.round((weightKg * 35) / 1000 * 10) / 10;

  const myoguardScore = computeScore(
    input.activityLevel,
    input.symptoms,
    input.medication,
    input.doseMg,
    weightKg,
    proteinStandard
  );

  const riskBand       = scoreToRiskBand(myoguardScore);
  const leanLossEstPct = LEAN_LOSS_BY_BAND[riskBand];
  const explanation    = buildExplanation(
    riskBand,
    input.medication,
    input.activityLevel,
    input.symptoms
  );

  return {
    weightKg,
    proteinStandard,
    proteinAggressive,
    fiber,
    hydration,
    myoguardScore,
    riskBand,
    leanLossEstPct,
    explanation,
  };
}
