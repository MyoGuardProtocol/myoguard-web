/**
 * adaptiveProtocol.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, deterministic analysis of up to 4 weeks of check-in data against the
 * user's current protocol targets.
 *
 * Rules-based with no AI dependency. Every decision rule is explicit,
 * auditable, and unit-testable. No DB calls — all inputs are passed in.
 *
 * Two public entry points:
 *   analyzeAdherence()      → AdherenceSnapshot (raw metrics + grades)
 *   generateWeeklyFocus()   → WeeklyProtocolFocus (card-ready output)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Input types ──────────────────────────────────────────────────────────────

/** Subset of WeeklyCheckin fields needed for analysis. Most recent first. */
export type CheckinWindow = {
  weekStart:     Date;
  avgProteinG:   number | null;
  totalWorkouts: number | null;
  avgHydration:  number | null;
  avgWeightKg:   number | null;
  energyLevel:   number | null;  // 1 (very low) – 5 (excellent)
  nauseaLevel:   number | null;  // 1 (none)     – 5 (severe)
};

export type ProtocolTargets = {
  proteinTargetG:  number;    // aggressive daily protein target (g)
  hydrationTarget: number;    // daily hydration target (litres)
  riskBand:        RiskBand;
};

export type RiskBand = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

// ─── Output types ─────────────────────────────────────────────────────────────

export type AdherenceGrade = 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN';
export type GIBurden       = 'LOW'  | 'MODERATE' | 'HIGH';
export type WeightTrend    = 'losing' | 'maintaining' | 'gaining' | 'unknown';
export type SignalTrend    = 'improving' | 'stable' | 'declining' | 'unknown';
export type FocusPriority  = 'URGENT' | 'HIGH' | 'NORMAL' | 'MAINTENANCE';

/**
 * The raw computed metrics — used both by the UI card and by focus generation.
 * All percentages are 0–100 (or null when data is unavailable).
 */
export type AdherenceSnapshot = {
  // ── Protein ────────────────────────────────────────────────────────────────
  proteinGrade:       AdherenceGrade;
  proteinAvgG:        number | null;  // average g/day across available weeks
  proteinTargetG:     number;         // target from latest ProtocolPlan
  proteinPct:         number | null;  // (avg / target) × 100

  // ── Hydration ──────────────────────────────────────────────────────────────
  hydrationGrade:     AdherenceGrade;
  hydrationAvgL:      number | null;
  hydrationTargetL:   number;
  hydrationPct:       number | null;

  // ── Workouts ───────────────────────────────────────────────────────────────
  workoutGrade:       AdherenceGrade;
  workoutAvgPerWk:    number | null;
  workoutTargetPerWk: number;        // minimum target derived from riskBand

  // ── Weight ─────────────────────────────────────────────────────────────────
  weightTrend:        WeightTrend;
  weightDeltaKg:      number | null; // total change over the analysis window

  // ── Energy ─────────────────────────────────────────────────────────────────
  energyTrend:        SignalTrend;
  energyAvg:          number | null; // 1–5 average across available weeks

  // ── Nausea / GI ────────────────────────────────────────────────────────────
  nauseaTrend:        SignalTrend;
  nauseaAvg:          number | null; // 1–5 average
  giBurden:           GIBurden;

  weeksAnalysed:      number;        // how many check-ins had usable data
};

export type FocusItem = {
  icon:     string;
  title:    string;
  detail:   string;
  priority: FocusPriority;
};

export type WeeklyProtocolFocus = {
  priority:        FocusPriority;
  primaryFocus:    FocusItem;
  supportingItems: FocusItem[];   // 2–3 items
  positiveNote:    string | null; // celebration when something is going well
  snapshot:        AdherenceSnapshot;
  generatedAt:     string;        // ISO timestamp
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum weekly resistance-training sessions by risk band */
const WORKOUT_TARGETS: Record<RiskBand, number> = {
  CRITICAL: 4,
  HIGH:     3,
  MODERATE: 3,
  LOW:      2,
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Returns the average of an array of numbers, ignoring nulls. */
function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/** Rounds to one decimal place. */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Grades a raw percentage against standard thresholds.
 *   GOOD  ≥ 90%
 *   FAIR  ≥ 70%
 *   POOR  < 70%
 *   UNKNOWN  null input
 */
function gradeAdherence(pct: number | null): AdherenceGrade {
  if (pct === null) return 'UNKNOWN';
  if (pct >= 90)   return 'GOOD';
  if (pct >= 70)   return 'FAIR';
  return 'POOR';
}

/**
 * Grades workout frequency:
 *   GOOD  ≥ target
 *   FAIR  ≥ target × 0.67  (e.g. 2 of 3)
 *   POOR  < that
 */
function gradeWorkouts(avg: number | null, target: number): AdherenceGrade {
  if (avg === null) return 'UNKNOWN';
  if (avg >= target)           return 'GOOD';
  if (avg >= target * 0.67)    return 'FAIR';
  return 'POOR';
}

/**
 * Computes a trend by splitting the window into two halves and comparing
 * averages. Requires at least 2 data points.
 *
 * @param values  Most recent first (same order as DB query).
 * @param higherIsBetter  true for energy (higher = better), false for nausea.
 */
function computeTrend(
  values:          (number | null)[],
  higherIsBetter:  boolean,
): SignalTrend {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return 'unknown';

  // Split: first half = most recent, second half = older
  const mid     = Math.ceil(nums.length / 2);
  const recent  = avg(nums.slice(0, mid))!;
  const earlier = avg(nums.slice(mid))!;
  const diff    = recent - earlier;

  const threshold = 0.5;
  if (higherIsBetter) {
    if (diff >  threshold) return 'improving';
    if (diff < -threshold) return 'declining';
  } else {
    // For nausea: higher = worse
    if (diff >  threshold) return 'declining';   // nausea went up
    if (diff < -threshold) return 'improving';   // nausea went down
  }
  return 'stable';
}

/** Derives GI burden from the nausea average and trend. */
function computeGIBurden(nauseaAvg: number | null, nauseaTrend: SignalTrend): GIBurden {
  if (nauseaAvg === null) return 'LOW';
  if (nauseaAvg >= 3.5 || (nauseaAvg >= 3 && nauseaTrend === 'declining')) return 'HIGH';
  if (nauseaAvg >= 2)   return 'MODERATE';
  return 'LOW';
}

/** Computes weight trend from first and last available data points. */
function computeWeightTrend(
  checkins: CheckinWindow[],
): { trend: WeightTrend; delta: number | null } {
  const withWeight = [...checkins]
    .filter(c => c.avgWeightKg !== null)
    // Sort oldest → newest for delta calculation
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  if (withWeight.length < 2) return { trend: 'unknown', delta: null };

  const oldest = withWeight[0].avgWeightKg!;
  const newest = withWeight[withWeight.length - 1].avgWeightKg!;
  const weeks  = Math.max(
    1,
    (withWeight[withWeight.length - 1].weekStart.getTime() - withWeight[0].weekStart.getTime()) /
    (7 * 24 * 3600 * 1000),
  );
  const deltaPerWk = (newest - oldest) / weeks;
  const totalDelta = r1(newest - oldest);

  if (deltaPerWk < -0.3) return { trend: 'losing',       delta: totalDelta };
  if (deltaPerWk >  0.3) return { trend: 'gaining',      delta: totalDelta };
  return                         { trend: 'maintaining',  delta: totalDelta };
}

// ─── Main analysis function ───────────────────────────────────────────────────

/**
 * Computes the AdherenceSnapshot from up to 4 check-ins and the user's
 * current protocol targets.
 *
 * @param checkins  Up to 4 WeeklyCheckin records, most recent first.
 * @param targets   From the latest ProtocolPlan + MuscleScore.
 */
export function analyzeAdherence(
  checkins: CheckinWindow[],
  targets:  ProtocolTargets,
): AdherenceSnapshot {
  const window = checkins.slice(0, 4); // cap at 4 weeks

  const workoutTarget = WORKOUT_TARGETS[targets.riskBand];

  // ── Protein ────────────────────────────────────────────────────────────────
  const proteinAvgG  = avg(window.map(c => c.avgProteinG));
  const proteinPct   = proteinAvgG !== null ? r1((proteinAvgG / targets.proteinTargetG) * 100) : null;
  const proteinGrade = gradeAdherence(proteinPct);

  // ── Hydration ──────────────────────────────────────────────────────────────
  const hydrationAvgL  = avg(window.map(c => c.avgHydration));
  const hydrationPct   = hydrationAvgL !== null ? r1((hydrationAvgL / targets.hydrationTarget) * 100) : null;
  const hydrationGrade = gradeAdherence(hydrationPct);

  // ── Workouts ───────────────────────────────────────────────────────────────
  const workoutAvgPerWk = avg(window.map(c => c.totalWorkouts));
  const workoutGrade    = gradeWorkouts(workoutAvgPerWk, workoutTarget);

  // ── Weight ─────────────────────────────────────────────────────────────────
  const { trend: weightTrend, delta: weightDeltaKg } = computeWeightTrend(window);

  // ── Energy ─────────────────────────────────────────────────────────────────
  const energyValues = window.map(c => c.energyLevel);
  const energyAvg    = avg(energyValues);
  const energyTrend  = computeTrend(energyValues, true);

  // ── Nausea / GI ────────────────────────────────────────────────────────────
  const nauseaValues = window.map(c => c.nauseaLevel);
  const nauseaAvg    = avg(nauseaValues);
  const nauseaTrend  = computeTrend(nauseaValues, false);
  const giBurden     = computeGIBurden(nauseaAvg, nauseaTrend);

  // ── Count of weeks with at least one non-null metric ──────────────────────
  const weeksAnalysed = window.filter(
    c => c.avgProteinG    !== null ||
         c.totalWorkouts  !== null ||
         c.avgHydration   !== null ||
         c.energyLevel    !== null ||
         c.nauseaLevel    !== null,
  ).length;

  return {
    proteinGrade,
    proteinAvgG:     proteinAvgG !== null ? r1(proteinAvgG) : null,
    proteinTargetG:  targets.proteinTargetG,
    proteinPct,

    hydrationGrade,
    hydrationAvgL:   hydrationAvgL !== null ? r1(hydrationAvgL) : null,
    hydrationTargetL: targets.hydrationTarget,
    hydrationPct,

    workoutGrade,
    workoutAvgPerWk:    workoutAvgPerWk !== null ? r1(workoutAvgPerWk) : null,
    workoutTargetPerWk: workoutTarget,

    weightTrend,
    weightDeltaKg,

    energyTrend,
    energyAvg: energyAvg !== null ? r1(energyAvg) : null,

    nauseaTrend,
    nauseaAvg:  nauseaAvg !== null ? r1(nauseaAvg) : null,
    giBurden,

    weeksAnalysed,
  };
}

// ─── Focus generation ─────────────────────────────────────────────────────────

function computePriority(s: AdherenceSnapshot, band: RiskBand): FocusPriority {
  // Hoist signal checks before any branching so TypeScript's control-flow
  // narrowing inside the complex URGENT predicate doesn't incorrectly
  // exclude 'declining' / 'HIGH' from the subsequent HIGH and MAINTENANCE checks.
  const energyDeclining = s.energyTrend === 'declining';
  const nauseaDeclining = s.nauseaTrend === 'declining';
  const giHigh          = s.giBurden    === 'HIGH';

  const isHighRisk = band === 'HIGH' || band === 'CRITICAL';

  // URGENT: high/critical band + multiple poor metrics or worsening GI
  if (isHighRisk && (
    (s.proteinGrade === 'POOR' && s.workoutGrade === 'POOR') ||
    (s.proteinGrade === 'POOR' && giHigh)                    ||
    (s.proteinGrade === 'POOR' && energyDeclining)
  )) return 'URGENT';

  // HIGH: any POOR metric or worsening signal
  if (
    s.proteinGrade   === 'POOR' ||
    s.workoutGrade   === 'POOR' ||
    s.hydrationGrade === 'POOR' ||
    energyDeclining              ||
    nauseaDeclining              ||
    giHigh
  ) return 'HIGH';

  // MAINTENANCE: all known metrics are GOOD and no worsening signals
  const noWorseSignals = !energyDeclining && !nauseaDeclining && !giHigh;
  const allGood =
    (s.proteinGrade   === 'GOOD' || s.proteinGrade   === 'UNKNOWN') &&
    (s.workoutGrade   === 'GOOD' || s.workoutGrade   === 'UNKNOWN') &&
    (s.hydrationGrade === 'GOOD' || s.hydrationGrade === 'UNKNOWN');

  if (allGood && noWorseSignals) return 'MAINTENANCE';

  return 'NORMAL';
}

function buildPrimaryFocus(s: AdherenceSnapshot, band: RiskBand): FocusItem {
  const priority = computePriority(s, band);
  const isHighRisk = band === 'HIGH' || band === 'CRITICAL';

  // ── Rule 1: GI burden HIGH + nausea worsening ─────────────────────────────
  if (s.giBurden === 'HIGH' && s.nauseaTrend === 'declining' && s.proteinGrade !== 'GOOD') {
    return {
      icon:     '🫁',
      title:    'Manage GI symptoms to protect protein intake',
      detail:
        'Worsening nausea is directly reducing your ability to hit protein targets. ' +
        'Switch to 5–6 small meals using high-protein, easy-to-tolerate foods: cold Greek yoghurt, ' +
        'protein powder in water, cottage cheese. Target protein before any other macro at each sitting.',
      priority,
    };
  }

  // ── Rule 2: Protein POOR + energy declining ────────────────────────────────
  if (s.proteinGrade === 'POOR' && s.energyTrend === 'declining') {
    const gap = s.proteinAvgG !== null
      ? ` You're averaging ${Math.round(s.proteinAvgG)}g — ${Math.round(s.proteinTargetG - s.proteinAvgG)}g below target.`
      : '';
    return {
      icon:     '⚡',
      title:    'Protein deficit + declining energy — muscle loss is accelerating',
      detail:
        `Low protein combined with declining energy is the most high-risk combination during GLP-1 therapy.${gap} ` +
        `Even if appetite is suppressed, prioritise 25–30g protein at breakfast — this single meal has the ` +
        `highest impact on halting lean mass catabolism. Protein shakes (mixed in water) are the most ` +
        `practical route when energy is low.`,
      priority,
    };
  }

  // ── Rule 3: Protein POOR + high/critical band ────────────────────────────
  if (s.proteinGrade === 'POOR' && isHighRisk) {
    const gap = s.proteinAvgG !== null
      ? `${Math.round(s.proteinTargetG - s.proteinAvgG)}g below your ${Math.round(s.proteinTargetG)}g target`
      : `below your ${Math.round(s.proteinTargetG)}g target`;
    return {
      icon:     '🥩',
      title:    'Close the protein gap immediately',
      detail:
        `You're currently ${gap}. At ${band} risk, this gap is directly accelerating lean mass loss. ` +
        `Add one protein-dense meal or shake — Greek yoghurt (150g = 15g), chicken breast (150g = 47g), ` +
        `or a whey scoop (25g). Closing 50% of the gap this week is meaningful progress.`,
      priority,
    };
  }

  // ── Rule 4: Workouts POOR + high/critical band ───────────────────────────
  if (s.workoutGrade === 'POOR' && isHighRisk) {
    const avg = s.workoutAvgPerWk !== null
      ? ` You're averaging ${r1(s.workoutAvgPerWk)} sessions/week.`
      : '';
    return {
      icon:     '🏋️',
      title:    'Add resistance training sessions this week',
      detail:
        `Resistance training is the most protective factor against GLP-1-associated muscle loss.${avg} ` +
        `Even 2 × 20-minute sessions make a measurable difference. If full workouts aren't feasible due to ` +
        `fatigue, body-weight circuits (squat, push-up, row) are enough to signal muscle retention.`,
      priority,
    };
  }

  // ── Rule 5: Protein POOR (any band) ──────────────────────────────────────
  if (s.proteinGrade === 'POOR') {
    const gap = s.proteinAvgG !== null
      ? ` Currently averaging ${Math.round(s.proteinAvgG)}g.`
      : '';
    return {
      icon:     '🥩',
      title:    `Increase daily protein to ${Math.round(s.proteinTargetG)}g`,
      detail:
        `Your daily protein target is ${Math.round(s.proteinTargetG)}g.${gap} ` +
        `Distribute protein evenly across meals — aim for 25–35g per meal to stay above the ` +
        `leucine threshold that activates muscle protein synthesis. Front-load protein at breakfast.`,
      priority,
    };
  }

  // ── Rule 6: Workouts POOR (any band) ─────────────────────────────────────
  if (s.workoutGrade === 'POOR') {
    return {
      icon:     '🏋️',
      title:    `Hit ${s.workoutTargetPerWk} resistance training sessions this week`,
      detail:
        `Aim for ${s.workoutTargetPerWk} resistance sessions this week. Compound movements (squat, ` +
        `deadlift, press) are most effective for muscle retention. 30–45 minutes per session is sufficient.`,
      priority,
    };
  }

  // ── Rule 7: Hydration POOR ────────────────────────────────────────────────
  if (s.hydrationGrade === 'POOR') {
    return {
      icon:     '💧',
      title:    `Increase daily water intake to ${s.hydrationTargetL}L`,
      detail:
        `Adequate hydration supports muscle protein synthesis and reduces GLP-1 GI side effects. ` +
        `Aim for ${s.hydrationTargetL}L spread throughout the day. Electrolytes (sodium, potassium, ` +
        `magnesium) become critical if you're dehydrated — consider an electrolyte supplement.`,
      priority,
    };
  }

  // ── Rule 8: Energy declining ──────────────────────────────────────────────
  if (s.energyTrend === 'declining') {
    return {
      icon:     '⚡',
      title:    'Address declining energy levels',
      detail:
        `Declining energy during GLP-1 therapy can signal protein undereating, electrolyte depletion, ` +
        `or inadequate sleep. Check your protein intake first — even 20g more per day can make a noticeable ` +
        `difference in energy. Ensure you're hitting electrolyte targets (sodium 2–3g, potassium 3–4g daily).`,
      priority,
    };
  }

  // ── Rule 9: Nausea worsening ──────────────────────────────────────────────
  if (s.nauseaTrend === 'declining') {
    return {
      icon:     '🫁',
      title:    'Manage worsening GI symptoms',
      detail:
        `Increasing nausea reduces appetite and protein intake, amplifying lean mass risk. ` +
        `Eat cold or room-temperature foods (tolerated better than hot meals). ` +
        `Avoid high-fat, fried, or spicy foods. Smaller, more frequent meals reduce peak nausea. ` +
        `If nausea continues, discuss dose timing with your prescribing physician.`,
      priority,
    };
  }

  // ── Rule 10: Protein FAIR ────────────────────────────────────────────────
  if (s.proteinGrade === 'FAIR') {
    const pct = s.proteinPct !== null ? `${Math.round(s.proteinPct)}% of your target` : 'close to target';
    return {
      icon:     '🥩',
      title:    'Fine-tune protein consistency',
      detail:
        `You're hitting ${pct}. Small improvements here yield outsized results: ` +
        `add a Greek yoghurt (150g) or hard-boiled eggs (2 eggs = 12g) as a daily habit. ` +
        `Reaching 90%+ of your protein target consistently is the difference between FAIR and GOOD risk control.`,
      priority,
    };
  }

  // ── Default: maintenance ──────────────────────────────────────────────────
  return {
    icon:     '✅',
    title:    'Excellent — maintain your current protocol',
    detail:
      `Your adherence metrics are on track. The best thing you can do this week is stay consistent. ` +
      `Reassess before your next dose escalation and log your check-in each week to maintain this trajectory.`,
    priority: 'MAINTENANCE',
  };
}

function buildSupportingItems(s: AdherenceSnapshot, band: RiskBand): FocusItem[] {
  const items: FocusItem[] = [];
  const priority = computePriority(s, band);

  // ── Workout status (if not already primary focus) ─────────────────────────
  if (s.workoutGrade !== 'UNKNOWN') {
    const label =
      s.workoutGrade === 'GOOD' ? `${r1(s.workoutAvgPerWk ?? 0)} sessions/wk — on track` :
      s.workoutGrade === 'FAIR' ? `${r1(s.workoutAvgPerWk ?? 0)} sessions/wk — add ${Math.ceil((s.workoutTargetPerWk - (s.workoutAvgPerWk ?? 0)))} more` :
                                   `${r1(s.workoutAvgPerWk ?? 0)} sessions/wk — below target`;
    items.push({
      icon:     '🏋️',
      title:    'Training',
      detail:   label,
      priority: s.workoutGrade === 'POOR' ? 'HIGH' : s.workoutGrade === 'FAIR' ? 'NORMAL' : 'MAINTENANCE',
    });
  }

  // ── Hydration status ─────────────────────────────────────────────────────
  if (s.hydrationGrade !== 'UNKNOWN') {
    const label =
      s.hydrationGrade === 'GOOD' ? `${s.hydrationAvgL}L/day — on track` :
      s.hydrationGrade === 'FAIR' ? `${s.hydrationAvgL}L/day — increase toward ${s.hydrationTargetL}L` :
                                     `${s.hydrationAvgL}L/day — well below ${s.hydrationTargetL}L target`;
    items.push({
      icon:     '💧',
      title:    'Hydration',
      detail:   label,
      priority: s.hydrationGrade === 'POOR' ? 'HIGH' : s.hydrationGrade === 'FAIR' ? 'NORMAL' : 'MAINTENANCE',
    });
  }

  // ── Energy signal ────────────────────────────────────────────────────────
  if (s.energyTrend !== 'unknown') {
    const label =
      s.energyTrend === 'improving' ? `Energy improving — avg ${s.energyAvg}/5 this period` :
      s.energyTrend === 'declining' ? `Energy declining — avg ${s.energyAvg}/5, needs attention` :
                                       `Energy stable — avg ${s.energyAvg}/5`;
    items.push({
      icon:     '⚡',
      title:    'Energy',
      detail:   label,
      priority: s.energyTrend === 'declining' ? 'HIGH' : 'NORMAL',
    });
  }

  // ── Weight trend ─────────────────────────────────────────────────────────
  if (s.weightTrend !== 'unknown' && s.weightDeltaKg !== null) {
    const deltaStr = s.weightDeltaKg > 0 ? `+${s.weightDeltaKg}kg` : `${s.weightDeltaKg}kg`;
    const label =
      s.weightTrend === 'losing'       ? `${deltaStr} over period — expected during GLP-1 therapy` :
      s.weightTrend === 'gaining'      ? `${deltaStr} over period — monitor lean mass impact` :
                                          `Weight stable over period`;
    items.push({
      icon:     '⚖️',
      title:    'Weight',
      detail:   label,
      priority: 'NORMAL',
    });
  }

  void priority; // used for context; individual items carry their own priority

  return items.slice(0, 3); // max 3 supporting items
}

function buildPositiveNote(s: AdherenceSnapshot): string | null {
  if (s.proteinGrade === 'GOOD' && s.workoutGrade === 'GOOD') {
    return 'Protein and training both on target — your two most protective factors are working.';
  }
  if (s.proteinGrade === 'GOOD') {
    return `Protein intake is on track at ${Math.round(s.proteinAvgG ?? 0)}g/day — keep it up.`;
  }
  if (s.workoutGrade === 'GOOD') {
    return `Training consistency is strong at ${r1(s.workoutAvgPerWk ?? 0)} sessions/week — your best protective factor.`;
  }
  if (s.energyTrend === 'improving') {
    return 'Your energy levels are trending up — a sign the protocol is working.';
  }
  if (s.nauseaTrend === 'improving') {
    return 'GI symptoms are improving — this should make hitting protein targets easier.';
  }
  if (s.weightTrend === 'maintaining') {
    return 'Weight is stable — healthy signal during GLP-1 dose maintenance.';
  }
  return null;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Generates a card-ready WeeklyProtocolFocus from the user's recent check-in
 * data and their current protocol targets.
 *
 * @param checkins  Up to 4 WeeklyCheckin records, most recent first.
 * @param targets   Protein target, hydration target, and risk band from the
 *                  latest ProtocolPlan + MuscleScore.
 * @returns WeeklyProtocolFocus, always — even with zero check-in data (the card
 *          will show a "start tracking" prompt via weeksAnalysed === 0).
 */
export function generateWeeklyFocus(
  checkins: CheckinWindow[],
  targets:  ProtocolTargets,
): WeeklyProtocolFocus {
  const snapshot       = analyzeAdherence(checkins, targets);
  const priority       = computePriority(snapshot, targets.riskBand);
  const primaryFocus   = buildPrimaryFocus(snapshot, targets.riskBand);
  const supportingItems = buildSupportingItems(snapshot, targets.riskBand);
  const positiveNote   = buildPositiveNote(snapshot);

  return {
    priority,
    primaryFocus,
    supportingItems,
    positiveNote,
    snapshot,
    generatedAt: new Date().toISOString(),
  };
}
