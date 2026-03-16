/**
 * src/lib/reportClinical.ts
 *
 * Shared clinical functions consumed by both:
 *   - app/dashboard/report/page.tsx  (authenticated physician-facing report)
 *   - app/report/[token]/page.tsx    (public shared-link physician report)
 *
 * All functions are pure and deterministic — no async I/O, no AI calls.
 * They derive physician-readable language from raw assessment metrics using
 * evidence-based clinical thresholds for GLP-1 muscle-loss risk.
 *
 * Export surface:
 *   Types:     Band, InterpDriver, Interpretation, SuggestedAction, EscalationSignal
 *   Constants: BAND_LIGHT
 *   Functions: buildInterpretation, buildSuggestedActions, buildEscalationSignal
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Band = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

export const BAND_LIGHT: Record<Band, {
  label:   string;
  colour:  string;
  bg:      string;
  border:  string;
  dot:     string;
  barCls:  string;
}> = {
  CRITICAL: { label: 'Critical Risk', colour: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     barCls: 'bg-red-500'     },
  HIGH:     { label: 'High Risk',     colour: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  dot: 'bg-orange-500',  barCls: 'bg-orange-500'  },
  MODERATE: { label: 'Moderate Risk', colour: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   barCls: 'bg-amber-500'   },
  LOW:      { label: 'Low Risk',      colour: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', barCls: 'bg-emerald-500' },
};

export interface InterpDriver {
  text:     string;
  severity: 'concern' | 'caution' | 'ok';
}

export interface Interpretation {
  riskCategory:       { label: string; detail: string };
  keyDrivers:         InterpDriver[];
  leanMassProjection: string;
  adherenceSignal:    { summary: string; lines: string[] };
}

export interface SuggestedAction {
  text:      string;
  urgency:   'urgent' | 'recommended' | 'maintenance';
  timeframe: string;
}

export interface EscalationSignal {
  escalate: boolean;
  reason:   string;
  urgency:  'urgent' | 'monitor' | 'none';
}

// ─── Clinical interpretation builder ─────────────────────────────────────────
//
// Pure, deterministic function — no AI calls. Derives physician-friendly
// language from the raw assessment metrics using clinical thresholds.

export function buildInterpretation(params: {
  band:            Band;
  leanLossEstPct:  number;
  proteinTargetG:  number;
  proteinIntakeG:  number;
  exerciseDaysWk:  number;
  hydrationLitres: number;
  fatigue:         number;
  nausea:          number;
  muscleWeakness:  number;
  trendStatus:     string;
  checkins:        Array<{ proteinAdherence: number | null; exerciseAdherence: number | null }>;
  glp1Stage?:      string | null;
}): Interpretation {
  const {
    band, leanLossEstPct, proteinTargetG, proteinIntakeG,
    exerciseDaysWk, hydrationLitres, fatigue, nausea, muscleWeakness,
    trendStatus, checkins, glp1Stage,
  } = params;

  // ── Risk category description ───────────────────────────────────────────────
  const RISK_DETAIL: Record<Band, string> = {
    CRITICAL: 'Immediate clinical review warranted; high probability of accelerated sarcopenic change if current trajectory is maintained.',
    HIGH:     'Significant muscle catabolism risk detected; physician discussion and protocol escalation are recommended at earliest opportunity.',
    MODERATE: 'One or more myoprotective markers are suboptimal; targeted protocol adjustment is advised to prevent risk progression.',
    LOW:      'Myoprotective targets are within acceptable range; patient should sustain current protocol to maintain this classification.',
  };
  const riskCategory = { label: BAND_LIGHT[band].label, detail: RISK_DETAIL[band] };

  // ── Key risk drivers ────────────────────────────────────────────────────────
  const drivers: InterpDriver[] = [];

  // 1. Protein deficit
  const proteinDeficit = proteinTargetG - proteinIntakeG;
  if (proteinDeficit > 30) {
    drivers.push({
      severity: 'concern',
      text: `Protein deficit: −${Math.round(proteinDeficit)} g/day below target (reported ${Math.round(proteinIntakeG)} g, target ${Math.round(proteinTargetG)} g) — primary anabolic stimulus insufficient`,
    });
  } else if (proteinDeficit > 10) {
    drivers.push({
      severity: 'caution',
      text: `Protein intake below target (${Math.round(proteinIntakeG)} g/day; target ${Math.round(proteinTargetG)} g/day) — gap may be addressable through meal timing or supplementation`,
    });
  } else {
    drivers.push({
      severity: 'ok',
      text: `Protein intake meeting or approaching target (${Math.round(proteinIntakeG)} g/day of ${Math.round(proteinTargetG)} g/day target)`,
    });
  }

  // 2. Exercise frequency
  if (exerciseDaysWk < 2) {
    drivers.push({
      severity: 'concern',
      text: `Insufficient resistance exercise stimulus (${exerciseDaysWk} day${exerciseDaysWk !== 1 ? 's' : ''}/week) — minimum 2 sessions/week required to preserve muscle during GLP-1 therapy`,
    });
  } else if (exerciseDaysWk < 4) {
    drivers.push({
      severity: 'caution',
      text: `Sub-optimal exercise frequency (${exerciseDaysWk} days/week) — 4+ sessions/week is recommended for adequate myoprotective stimulus`,
    });
  } else {
    drivers.push({
      severity: 'ok',
      text: `Adequate resistance exercise frequency (${exerciseDaysWk} days/week)`,
    });
  }

  // 3. Hydration
  if (hydrationLitres < 1.5) {
    drivers.push({
      severity: 'concern',
      text: `Inadequate hydration (${hydrationLitres} L/day) — may impair renal clearance, electrolyte balance, and downstream protein synthesis`,
    });
  } else if (hydrationLitres < 2.0) {
    drivers.push({
      severity: 'caution',
      text: `Borderline hydration intake (${hydrationLitres} L/day) — encourage progressive increase toward 2.0 L/day minimum`,
    });
  } else {
    drivers.push({
      severity: 'ok',
      text: `Adequate hydration (${hydrationLitres} L/day)`,
    });
  }

  // 4. Symptom burden
  const symptomAvg = (fatigue + nausea + muscleWeakness) / 3;
  if (symptomAvg > 6) {
    drivers.push({
      severity: 'concern',
      text: `Elevated symptom burden (fatigue ${fatigue}/10, muscle weakness ${muscleWeakness}/10, nausea ${nausea}/10) — likely impairing dietary adherence and exercise tolerance`,
    });
  } else if (symptomAvg > 3) {
    drivers.push({
      severity: 'caution',
      text: `Moderate symptom burden (avg ${symptomAvg.toFixed(1)}/10) — monitor impact on protocol adherence; consider GI management strategies`,
    });
  } else {
    drivers.push({
      severity: 'ok',
      text: 'Symptom burden low; adherence is unlikely to be symptom-limited at current presentation',
    });
  }

  // 5. GLP-1 dose escalation flag
  if (glp1Stage === 'DOSE_ESCALATION') {
    drivers.push({
      severity: 'caution',
      text: 'Active GLP-1 dose escalation phase — this is a heightened muscle loss risk period; increased monitoring frequency is recommended',
    });
  }

  // Sort: concerns → cautions → ok
  const SEV_ORDER: Record<InterpDriver['severity'], number> = { concern: 0, caution: 1, ok: 2 };
  drivers.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  // ── 30-day lean mass projection ─────────────────────────────────────────────
  const TREND_PROJECTION: Record<string, string> = {
    improving:    'Trajectory currently improving — lean mass loss risk is attenuating with present adherence.',
    stable:       'Trajectory stable — sustained adherence is required to maintain current risk classification.',
    declining:    'Trajectory declining — protocol escalation is recommended to arrest progression.',
    insufficient: 'Insufficient longitudinal data for trajectory assessment; recommend reassessment in 2–4 weeks.',
  };
  const leanMassProjection =
    `Estimated lean mass loss risk at current assessment cycle: ${leanLossEstPct}%. ` +
    (TREND_PROJECTION[trendStatus] ?? TREND_PROJECTION.insufficient);

  // ── Protocol adherence signal ────────────────────────────────────────────────
  const withProtein  = checkins.filter(c => c.proteinAdherence  != null);
  const withExercise = checkins.filter(c => c.exerciseAdherence != null);

  const avgProteinAdh  = withProtein.length
    ? Math.round(withProtein.reduce((s, c) => s + c.proteinAdherence!, 0) / withProtein.length)
    : null;
  const avgExerciseAdh = withExercise.length
    ? Math.round(withExercise.reduce((s, c) => s + c.exerciseAdherence!, 0) / withExercise.length)
    : null;

  if (avgProteinAdh === null && avgExerciseAdh === null) {
    return {
      riskCategory,
      keyDrivers: drivers,
      leanMassProjection,
      adherenceSignal: {
        summary: 'Insufficient longitudinal check-in data. Weekly monitoring is recommended to establish adherence trends.',
        lines:   [],
      },
    };
  }

  const lines: string[] = [];

  if (avgProteinAdh !== null) {
    if (avgProteinAdh >= 80) {
      lines.push(`Protein adherence: High (avg ${avgProteinAdh}%) — dietary target met consistently`);
    } else if (avgProteinAdh >= 50) {
      lines.push(`Protein adherence: Moderate (avg ${avgProteinAdh}%) — adherence gaps present; consider supplementation or meal-timing strategies`);
    } else {
      lines.push(`Protein adherence: Low (avg ${avgProteinAdh}%) — primary intervention target; deficit is compounding catabolism risk`);
    }
  }

  if (avgExerciseAdh !== null) {
    if (avgExerciseAdh >= 80) {
      lines.push(`Exercise adherence: Consistent (avg ${avgExerciseAdh}%) — resistance stimulus adequate`);
    } else if (avgExerciseAdh >= 50) {
      lines.push(`Exercise adherence: Inconsistent (avg ${avgExerciseAdh}%) — structured scheduling and accountability recommended`);
    } else {
      lines.push(`Exercise adherence: Poor (avg ${avgExerciseAdh}%) — muscle stimulus insufficient; likely contributor to elevated lean loss risk`);
    }
  }

  const bothKnown  = avgProteinAdh !== null && avgExerciseAdh !== null;
  const bothStrong = bothKnown && avgProteinAdh >= 70 && avgExerciseAdh >= 70;
  const bothPoor   = bothKnown && avgProteinAdh < 50  && avgExerciseAdh < 50;

  if (bothStrong) lines.push('Overall adherence signal: Strong — continue current protocol approach');
  else if (bothPoor) lines.push('Overall adherence signal: Poor — multidomain intervention review indicated');

  return { riskCategory, keyDrivers: drivers, leanMassProjection, adherenceSignal: { summary: '', lines } };
}

// ─── Suggested physician actions ─────────────────────────────────────────────
//
// Deterministic function — no AI calls. Produces 1–3 prioritised, actionable
// recommendations from the same clinical signals used in buildInterpretation().
// Actions are ranked by clinical urgency; the reassessment timing anchor always
// appears as the final entry.

export function buildSuggestedActions(params: {
  band:            Band;
  proteinTargetG:  number;
  proteinIntakeG:  number;
  exerciseDaysWk:  number;
  hydrationLitres: number;
  fatigue:         number;
  nausea:          number;
  muscleWeakness:  number;
  trendStatus:     string;
  checkins:        Array<{ proteinAdherence: number | null; exerciseAdherence: number | null }>;
  glp1Stage?:      string | null;
}): SuggestedAction[] {
  const {
    band, proteinTargetG, proteinIntakeG, exerciseDaysWk,
    hydrationLitres, fatigue, nausea, muscleWeakness,
    trendStatus, checkins, glp1Stage,
  } = params;

  const proteinDeficit = proteinTargetG - proteinIntakeG;
  const symptomAvg     = (fatigue + nausea + muscleWeakness) / 3;

  // ── Compute adherence averages from check-ins ────────────────────────────────
  const withProtein  = checkins.filter(c => c.proteinAdherence  != null);
  const withExercise = checkins.filter(c => c.exerciseAdherence != null);
  const avgProteinAdh  = withProtein.length
    ? Math.round(withProtein.reduce((s, c) => s + c.proteinAdherence!, 0) / withProtein.length)
    : null;
  const avgExerciseAdh = withExercise.length
    ? Math.round(withExercise.reduce((s, c) => s + c.exerciseAdherence!, 0) / withExercise.length)
    : null;

  // ── Build a prioritised pool of clinical candidates ──────────────────────────
  type Candidate = { priority: number; action: SuggestedAction };
  const candidates: Candidate[] = [];

  // 1. Symptom burden — gates adherence; highest priority when severe
  if (symptomAvg > 6) {
    candidates.push({
      priority: 1,
      action: {
        urgency:   'urgent',
        timeframe: 'Immediate',
        text: `Review GLP-1 dosing schedule. Severe symptom burden (fatigue ${fatigue}/10, muscle weakness ${muscleWeakness}/10, nausea ${nausea}/10) is likely impairing protocol adherence. Consider dose adjustment, antiemetic support, or temporary titration pause.`,
      },
    });
  } else if (symptomAvg > 3) {
    candidates.push({
      priority: 6,
      action: {
        urgency:   'recommended',
        timeframe: 'At next visit',
        text: 'Review GI management strategies (small frequent meals, protein timing around doses) to reduce symptom impact on dietary adherence.',
      },
    });
  }

  // 2. Protein deficit — primary anabolic driver
  if (proteinDeficit > 30) {
    candidates.push({
      priority: 2,
      action: {
        urgency:   'urgent',
        timeframe: 'Immediate',
        text: `Increase daily protein intake to the protocol target of ${Math.round(proteinTargetG)} g/day (current reported intake: ${Math.round(proteinIntakeG)} g/day; deficit: −${Math.round(proteinDeficit)} g/day). Consider referral to a registered dietitian for structured supplementation planning.`,
      },
    });
  } else if (proteinDeficit > 10) {
    candidates.push({
      priority: 3,
      action: {
        urgency:   'recommended',
        timeframe: 'Within 7 days',
        text: `Increase daily protein intake toward the ${Math.round(proteinTargetG)} g/day protocol target. Meal timing optimisation and whey protein supplementation (20–40 g/serving post-exercise) may address the current gap of −${Math.round(proteinDeficit)} g/day.`,
      },
    });
  }

  // 3. Exercise frequency — myoprotective stimulus
  if (exerciseDaysWk < 2) {
    candidates.push({
      priority: 2,
      action: {
        urgency:   'urgent',
        timeframe: 'Immediate',
        text: 'Prescribe a structured resistance training programme: minimum 2 sessions/week incorporating compound movements (squat, hip hinge, press, row) to counter GLP-1-associated sarcopenic change.',
      },
    });
  } else if (exerciseDaysWk < 4) {
    candidates.push({
      priority: 5,
      action: {
        urgency:   'recommended',
        timeframe: 'Within 14 days',
        text: `Encourage progression from ${exerciseDaysWk} to ≥4 resistance training sessions/week. A written exercise prescription or physiotherapy referral may improve adherence and provide appropriate progressive overload.`,
      },
    });
  }

  // 4. Hydration deficit
  if (hydrationLitres < 1.5) {
    candidates.push({
      priority: 7,
      action: {
        urgency:   'recommended',
        timeframe: 'Within 7 days',
        text: `Advise incremental increase in fluid intake toward ≥2.0 L/day (currently ${hydrationLitres} L/day). Electrolyte supplementation may be warranted given GLP-1-related GI symptoms affecting fluid retention.`,
      },
    });
  }

  // 5. Adherence-based action (only when explicit check-in data confirms low adherence)
  if (avgProteinAdh !== null && avgProteinAdh < 50 && proteinDeficit <= 10) {
    candidates.push({
      priority: 4,
      action: {
        urgency:   'recommended',
        timeframe: 'Within 7 days',
        text: `Protein adherence is averaging ${avgProteinAdh}% over recent check-ins. Consider a behavioural coaching session or app-based meal tracking to improve consistency with the ${Math.round(proteinTargetG)} g/day target.`,
      },
    });
  }

  // 6. Dose escalation phase monitoring
  if (glp1Stage === 'DOSE_ESCALATION') {
    candidates.push({
      priority: 8,
      action: {
        urgency:   'recommended',
        timeframe: 'Bi-weekly until stable',
        text: 'Schedule bi-weekly MyoGuard check-ins during active dose escalation to detect early sarcopenic change before it becomes clinically significant.',
      },
    });
  }

  // Select top 2 clinical candidates by priority
  candidates.sort((a, b) => a.priority - b.priority);
  const selected = candidates.slice(0, 2).map(c => c.action);

  // ── Reassessment anchor (always appended last) ───────────────────────────────
  const REASSESS: Record<Band, { days: number; urgency: SuggestedAction['urgency'] }> = {
    CRITICAL: { days:  7, urgency: 'urgent'      },
    HIGH:     { days: 14, urgency: 'urgent'      },
    MODERATE: { days: 21, urgency: 'recommended' },
    LOW:      { days: 30, urgency: 'maintenance' },
  };
  const { days: reassessDays, urgency: reassessUrgency } = REASSESS[band];
  const decliningNote = trendStatus === 'declining'
    ? ' Score is on a declining trajectory — prompt follow-up is essential.'
    : '';

  const reassessAction: SuggestedAction = {
    urgency:   reassessUrgency,
    timeframe: band === 'LOW' ? 'Monthly' : `Within ${reassessDays} days`,
    text:
      band === 'LOW'
        ? 'Continue monthly MyoGuard assessments to maintain low-risk classification. No immediate intervention required — sustain current protocol.'
        : `Reassess MyoGuard score within ${reassessDays} days following protocol adjustment to confirm adequate clinical response.${decliningNote}`,
  };

  return selected.length === 0 ? [reassessAction] : [...selected, reassessAction];
}

// ─── Physician escalation trigger ────────────────────────────────────────────
//
// Deterministic, independent layer of clinical intelligence. Evaluates six
// raw signal inputs against absolute thresholds. Produces a single structured
// output consumed by the alert panel rendered above Clinical Interpretation.
// Does NOT modify or depend on buildInterpretation() or buildSuggestedActions().

export function buildEscalationSignal(params: {
  riskBand:        Band;
  symptomAvg:      number;
  proteinDeficit:  number;
  exerciseDaysWk:  number;
  hydrationLitres: number;
  leanLossEstPct:  number;
  trendStatus:     string;
}): EscalationSignal {
  const {
    riskBand, symptomAvg, proteinDeficit, exerciseDaysWk,
    hydrationLitres, leanLossEstPct, trendStatus,
  } = params;

  // Suppress unused-variable warning for riskBand — it is intentionally
  // available for future threshold expansion without being evaluated today.
  void riskBand;

  type TriggerLevel = 'urgent' | 'monitor';
  const triggers: Array<{ level: TriggerLevel; text: string }> = [];

  // 1. Severe symptom burden — gates all adherence downstream
  if (symptomAvg > 6) {
    triggers.push({
      level: 'urgent',
      text:  `Severe symptom burden (avg ${symptomAvg.toFixed(1)}/10) indicating likely GLP-1 intolerance and significant adherence impairment`,
    });
  }

  // 2. Critical protein deficit — primary sarcopenic driver
  if (proteinDeficit > 30) {
    triggers.push({
      level: 'urgent',
      text:  `Critical protein deficit (−${Math.round(proteinDeficit)} g/day) — anabolic stimulus severely insufficient for muscle preservation during GLP-1 therapy`,
    });
  }

  // 3. Critically low exercise — unmitigated sarcopenic risk
  if (exerciseDaysWk < 2) {
    triggers.push({
      level: 'urgent',
      text:  `Critically low resistance exercise stimulus (${exerciseDaysWk} day${exerciseDaysWk !== 1 ? 's' : ''}/week) — sarcopenic risk is currently unmitigated by mechanical loading`,
    });
  }

  // 4. Rapid lean mass loss — threshold of >5% estimated loss
  if (leanLossEstPct > 5) {
    triggers.push({
      level: 'urgent',
      text:  `Rapid estimated lean mass loss (${leanLossEstPct}%) — exceeds the acceptable threshold for standard GLP-1 monitoring protocol`,
    });
  }

  // 5. Declining score trajectory — progressive deterioration
  if (trendStatus === 'declining') {
    triggers.push({
      level: 'urgent',
      text:  'MyoGuard score on a declining trajectory — progressive deterioration detected across recent assessment cycles',
    });
  }

  // 6. Inadequate hydration — compounds catabolism; lower urgency
  if (hydrationLitres < 1.5) {
    triggers.push({
      level: 'monitor',
      text:  `Inadequate hydration (${hydrationLitres} L/day) — may compound catabolism risk and impair renal protein metabolism`,
    });
  }

  // ── No triggers ────────────────────────────────────────────────────────────
  if (triggers.length === 0) {
    return { escalate: false, reason: '', urgency: 'none' };
  }

  // ── Determine overall urgency ──────────────────────────────────────────────
  const hasUrgent = triggers.some(t => t.level === 'urgent');
  const urgency: 'urgent' | 'monitor' = hasUrgent ? 'urgent' : 'monitor';

  // ── Build a single reason string ───────────────────────────────────────────
  const ordered = [
    ...triggers.filter(t => t.level === 'urgent'),
    ...triggers.filter(t => t.level === 'monitor'),
  ];

  const reason =
    ordered.length === 1
      ? `${ordered[0].text}.`
      : `Multiple escalation criteria identified: ${ordered.map(t => t.text).join('; ')}.`;

  return { escalate: true, reason, urgency };
}
