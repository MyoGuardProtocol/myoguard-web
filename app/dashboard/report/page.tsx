import { auth }                  from '@clerk/nextjs/server';
import { redirect }              from 'next/navigation';
import Link                      from 'next/link';
import { prisma }                from '@/src/lib/prisma';
import { generateWeeklyDigest }  from '@/src/lib/weeklyDigest';
import ShareButton               from './ShareButton';
import DownloadPDFButton         from './DownloadPDFButton';
import PhysicianFeedback         from './PhysicianFeedback';

// ─── Display helpers ──────────────────────────────────────────────────────────

type Band = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

const BAND_LIGHT: Record<Band, {
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

const TREND_LABEL: Record<string, { text: string; colour: string; icon: string }> = {
  improving:    { text: 'Improving',          colour: 'text-emerald-700', icon: '↑' },
  stable:       { text: 'Stable',             colour: 'text-slate-600',   icon: '→' },
  declining:    { text: 'Declining',           colour: 'text-red-700',    icon: '↓' },
  insufficient: { text: 'Insufficient data',  colour: 'text-slate-500',   icon: '–' },
};

const MED_LABEL: Record<string, string> = {
  semaglutide: 'Semaglutide (Ozempic / Wegovy)',
  tirzepatide: 'Tirzepatide (Zepbound / Mounjaro)',
};

const STAGE_LABEL: Record<string, string> = {
  INITIATION:      'Initiation',
  DOSE_ESCALATION: 'Dose escalation',
  MAINTENANCE:     'Maintenance',
  DISCONTINUING:   'Discontinuing',
};

// ─── Clinical interpretation types ────────────────────────────────────────────

interface InterpDriver {
  text:     string;
  severity: 'concern' | 'caution' | 'ok';
}

interface Interpretation {
  riskCategory:       { label: string; detail: string };
  keyDrivers:         InterpDriver[];
  leanMassProjection: string;
  adherenceSignal:    { summary: string; lines: string[] };
}

// ─── Clinical interpretation builder ─────────────────────────────────────────
//
// Pure, deterministic function — no AI calls. Derives physician-friendly
// language from the raw assessment metrics using clinical thresholds.

function buildInterpretation(params: {
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

interface SuggestedAction {
  text:      string;
  urgency:   'urgent' | 'recommended' | 'maintenance';
  timeframe: string;
}

function buildSuggestedActions(params: {
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
  // Each candidate carries a numeric priority (lower = higher priority).
  // Up to 2 clinical candidates are selected; the reassessment anchor is always
  // appended last, giving a 1–3 total output range.

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
    // Low adherence even when intake target is technically within range — habitual deficit
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

  // If no clinical issues were detected, return the reassessment action alone
  return selected.length === 0 ? [reassessAction] : [...selected, reassessAction];
}

// ─── Physician escalation trigger ────────────────────────────────────────────
//
// Deterministic, independent layer of clinical intelligence. Evaluates six
// raw signal inputs against absolute thresholds. Produces a single structured
// output consumed by the alert panel rendered above Clinical Interpretation.
// Does NOT modify or depend on buildInterpretation() or buildSuggestedActions().

interface EscalationSignal {
  escalate: boolean;
  reason:   string;
  urgency:  'urgent' | 'monitor' | 'none';
}

function buildEscalationSignal(params: {
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

  type TriggerLevel = 'urgent' | 'monitor';
  const triggers: Array<{ level: TriggerLevel; text: string }> = [];

  // ── Evaluate each criterion independently ─────────────────────────────────

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
  // Urgent criteria are listed first; monitor-level appended after.
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

function longDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Phase 1 QA Checklist ────────────────────────────────────────────────────
//
// Verify each item in a real browser session before shipping Phase 1.
//
// SHARE FLOW
// □ "Share With My Physician" opens the modal (requires live auth session)
// □ Closing with ESC key or backdrop click works cleanly
// □ Body scroll is locked while modal open; restored on close
// □ QR code is blurred until consent checkbox is checked
// □ Consent persists within the tab session (sessionStorage key: myoguard_share_consent)
// □ Copy link, WhatsApp, and Email disabled until consented
// □ QR code scans correctly and opens /report/[token] without login required
// □ Generating the link twice returns the same stable URL
//
// PHYSICIAN FEEDBACK — SAVE / RELOAD
// □ No saved review → locked button + "Select an impression…" helper text visible
// □ Selecting any field enables the Save button
// □ Save transitions: idle → saving (spinner) → saved (tick + "Physician review saved") → idle (4 s)
// □ After save: "Last reviewed [date]" clock appears in panel header
// □ After save: summary strip shows impression badge, follow-up days, reviewed date
// □ Reloading the page pre-populates all three saved fields correctly
// □ Editing any field after save → button enables; "Unsaved changes" indicator appears
// □ AuditLog row written on every save — verify in Supabase dashboard (action: PHYSICIAN_REVIEW_SAVED)
//
// DIRTY-STATE WARNING
// □ Edit any field without saving → navigate away / refresh → browser "Leave site?" dialog shown
// □ After saving successfully → navigating away does NOT trigger the dialog
//
// PRINT / PDF OUTPUT
// □ window.print() shows only clinical content — no buttons, modals, nav, action bar, or status strip
// □ Escalation alert prints with colour (print-color-adjust: exact set in globals.css)
// □ Physician review section prints saved values only (not editing UI, not transient states)
// □ If no review saved → print shows blank annotation lines + blank signature/date fields
// □ PDF filename defaults to MyoGuard-Report-[Firstname]-[YYYY-MM-DD]
//
// MOBILE RESPONSIVENESS
// □ Action bar buttons wrap cleanly at < 420 px viewport width
// □ Report status strip items wrap without horizontal overflow on narrow screens
// □ Physician review impression cards stack vertically on mobile (grid-cols-1 sm:grid-cols-3)
// □ Score hero layout stays readable at 375 px width
// □ Share modal fits on-screen with overflow-y-auto scroll on small devices
//
// EMPTY / PARTIAL STATES
// □ /dashboard/report with no assessment → nav header present, clean empty-state card, CTA to assessment
// □ /dashboard/report with assessment but no physician review → feedback panel shows locked state
// □ Report status strip shows correct live state for all three indicators on first load

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where:  { clerkId },
    select: {
      id:       true,
      fullName: true,
      email:    true,
      profile:  {
        select: {
          age:           true,
          sex:           true,
          glp1Medication: true,
          glp1DoseMg:    true,
          glp1Stage:     true,
        },
      },
      assessments: {
        orderBy: { assessmentDate: 'desc' },
        take:    5,
        include: {
          muscleScore: {
            select: {
              score:          true,
              riskBand:       true,
              leanLossEstPct: true,
              proteinTargetG: true,
              explanation:    true,
            },
          },
        },
      },
      weeklyCheckins: {
        orderBy: { weekStart: 'desc' },
        take:    4,
        select: {
          weekStart:          true,
          avgProteinG:        true,
          totalWorkouts:      true,
          avgHydration:       true,
          proteinAdherence:   true,
          exerciseAdherence:  true,
        },
      },
    },
  });

  if (!user) redirect('/dashboard');

  const latestAssessment = user.assessments[0];
  if (!latestAssessment?.muscleScore) {
    // No scored assessment yet — show a navigable empty state rather than a
    // dead-end card. Nav header is included so users can return to the dashboard.
    return (
      <main className="min-h-screen bg-slate-50 font-sans">
        {/* Nav stays present so the user is never stranded */}
        <header className="bg-white border-b border-slate-200 px-5 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight">
              Myo<span className="text-teal-600">Guard</span>
            </Link>
            <Link href="/dashboard" className="text-xs font-medium text-teal-600 hover:underline">
              ← Dashboard
            </Link>
          </div>
        </header>
        <div className="flex items-center justify-center px-5 py-20">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
            <p className="text-2xl mb-3">📋</p>
            <p className="text-slate-800 font-semibold mb-2">No assessment on record</p>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              A physician report is generated automatically after your first MyoGuard
              assessment is scored. It only takes a few minutes.
            </p>
            <Link
              href="/"
              className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-colors inline-block"
            >
              Start Your Assessment →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const ms         = latestAssessment.muscleScore;
  const score      = Math.round(ms.score);
  const band       = ms.riskBand as Band;
  const meta       = BAND_LIGHT[band];
  const pointsToLow = score < 80 ? 80 - score : null;

  const digest = await generateWeeklyDigest(user.id);
  const trendCfg = TREND_LABEL[digest?.trendStatus ?? 'insufficient'];

  // Assessments in chronological order for the history table
  const historyAsc = [...user.assessments].reverse();

  const generatedAt = new Date();

  // ── Clinical interpretation + suggested actions (pure, server-side) ──────────
  const sharedSignals = {
    band,
    proteinTargetG:  ms.proteinTargetG,
    proteinIntakeG:  latestAssessment.proteinGrams,
    exerciseDaysWk:  latestAssessment.exerciseDaysWk,
    hydrationLitres: latestAssessment.hydrationLitres,
    fatigue:         latestAssessment.fatigue,
    nausea:          latestAssessment.nausea,
    muscleWeakness:  latestAssessment.muscleWeakness,
    trendStatus:     digest?.trendStatus ?? 'insufficient',
    checkins:        user.weeklyCheckins,
    glp1Stage:       user.profile?.glp1Stage ?? null,
  };

  const interp  = buildInterpretation({ leanLossEstPct: ms.leanLossEstPct, ...sharedSignals });
  const actions = buildSuggestedActions(sharedSignals);

  // Escalation signal — evaluated independently from interpretation + actions
  const signal = buildEscalationSignal({
    riskBand:        band,
    symptomAvg:      (latestAssessment.fatigue + latestAssessment.nausea + latestAssessment.muscleWeakness) / 3,
    proteinDeficit:  ms.proteinTargetG - latestAssessment.proteinGrams,
    exerciseDaysWk:  latestAssessment.exerciseDaysWk,
    hydrationLitres: latestAssessment.hydrationLitres,
    leanLossEstPct:  ms.leanLossEstPct,
    trendStatus:     digest?.trendStatus ?? 'insufficient',
  });

  // ── Physician review — load any previously saved record for this assessment ──
  const savedReview = await prisma.physicianReview.findUnique({
    where:  { assessmentId: latestAssessment.id },
    select: {
      overallImpression: true,
      followUpDays:      true,
      note:              true,
      reviewedAt:        true,
    },
  });

  // Type-narrow the stored string values back to the component's union types.
  // Invalid DB values (defensive) fall back to null rather than throwing.
  const toImpression = (s: string | null): 'stable' | 'monitoring' | 'intervention' | null =>
    s === 'stable' || s === 'monitoring' || s === 'intervention' ? s : null;

  const toFollowUpDays = (n: number | null): 7 | 14 | 21 | 30 | null =>
    n === 7 || n === 14 || n === 21 || n === 30 ? n : null;

  const initialFeedback = savedReview
    ? {
        overallImpression: toImpression(savedReview.overallImpression ?? null),
        followUpDays:      toFollowUpDays(savedReview.followUpDays ?? null),
        note:              savedReview.note ?? '',
        reviewedAt:        savedReview.reviewedAt.toISOString(),
      }
    : null;

  // ── Report status indicators — fetched once at render time ─────────────────
  // Used by the screen-only status strip. Not rendered in print/PDF.
  const existingShareCard = await prisma.shareCard.findFirst({
    where:  { userId: user.id },
    select: { id: true },
  });
  const shareCardExists = existingShareCard !== null;

  // Suggested PDF filename: MyoGuard-Report-Firstname-YYYY-MM-DD
  const firstName      = (user.fullName ?? 'Patient').split(' ')[0];
  const dateStamp      = generatedAt.toISOString().slice(0, 10);           // YYYY-MM-DD
  const pdfFilename    = `MyoGuard-Report-${firstName}-${dateStamp}`;

  return (
    <main className="min-h-screen bg-slate-100 font-sans">

      {/* ── Screen-only nav ── */}
      <header className="print:hidden bg-white border-b border-slate-200 px-5 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight">
            Myo<span className="text-teal-600">Guard</span>
          </Link>
          <Link href="/dashboard" className="text-xs font-medium text-teal-600 hover:underline">
            ← Dashboard
          </Link>
        </div>
      </header>

      {/* ── Screen-only action bar ── */}
      {/*
        Hierarchy: Share (primary — teal outline) | Download PDF (secondary — teal solid).
        PrintButton is intentionally omitted — DownloadPDFButton already triggers the
        browser print dialog with the correct filename hint, covering both use-cases.
        flex-wrap ensures the two buttons collapse to a second line on narrow viewports
        without any horizontal overflow.
      */}
      <div className="print:hidden max-w-3xl mx-auto px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Physician Report</p>
            <p className="text-xs text-slate-500">Download or share with your physician</p>
          </div>
          {/* Primary action first in DOM order matches visual left-to-right reading */}
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton />
            <DownloadPDFButton filename={pdfFilename} />
          </div>
        </div>
      </div>

      {/* ── Report status strip (screen-only, informational) ── */}
      {/*
        Shows the live state of the three key workflow milestones at a glance.
        Intentionally NOT rendered in print/PDF — it is transient screen state,
        not clinical content. Never redesign this into an interactive surface.
      */}
      <div className="print:hidden max-w-3xl mx-auto px-5 pb-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">

          {/* ① Report generated */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
            <span className="text-[11px] text-slate-500 truncate">
              Report generated {shortDate(generatedAt)}
            </span>
          </div>

          {/* ② Share link */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${shareCardExists ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden="true"
            />
            <span className="text-[11px] text-slate-500 truncate">
              {shareCardExists ? 'Share link created' : 'Share link not yet created'}
            </span>
          </div>

          {/* ③ Physician review */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${savedReview ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden="true"
            />
            <span className="text-[11px] text-slate-500 truncate">
              {savedReview
                ? `Physician review saved ${shortDate(savedReview.reviewedAt)}`
                : 'Physician review not yet saved'}
            </span>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REPORT DOCUMENT ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <article
        id="physician-report"
        className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none mb-10 print:mb-0"
      >
        <div className="px-8 py-8 print:px-0 print:py-6 space-y-7">

          {/* ── Document header ── */}
          <div className="flex items-start justify-between border-b-2 border-teal-600 pb-5">
            <div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                Myo<span className="text-teal-600">Guard</span>
                <span className="text-slate-400 font-light ml-1 text-base">Protocol</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Physician-Formulated · Data-Driven Muscle Protection
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                Physician Report
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Generated: {longDate(generatedAt)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                REF: {latestAssessment.id.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* ── Patient info row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 rounded-xl px-5 py-4 border border-slate-200">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Patient</p>
              <p className="text-sm font-bold text-slate-900">{user.fullName}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Assessment Date</p>
              <p className="text-sm font-semibold text-slate-800">{shortDate(latestAssessment.assessmentDate)}</p>
            </div>
            {user.profile?.age && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Age</p>
                <p className="text-sm font-semibold text-slate-800">{user.profile.age} years</p>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── SCORE SUMMARY ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              MyoGuard Muscle Protection Score
            </h2>

            <div className={`rounded-xl border-l-4 ${meta.border.replace('border-', 'border-l-')} border border-l-4 ${meta.border} ${meta.bg} px-5 py-5`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-6xl font-black text-slate-900 tabular-nums leading-none">
                      {score}
                    </span>
                    <span className="text-xl text-slate-400 font-light">/100</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Composite muscle-loss risk score — higher is better
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.border} ${meta.colour}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    {ms.leanLossEstPct}% estimated lean mass loss risk
                  </span>
                </div>
              </div>

              {/* Score bar */}
              <div className="h-3 rounded-full bg-white/70 overflow-hidden flex gap-px mb-3 border border-slate-200">
                <div className="h-full bg-red-200"     style={{ width: '40%' }} />
                <div className="h-full bg-orange-200"  style={{ width: '20%' }} />
                <div className="h-full bg-amber-200"   style={{ width: '20%' }} />
                <div className="h-full bg-emerald-200" style={{ width: '20%' }} />
              </div>
              {/* Score thumb indicator */}
              <div className="relative h-1 mb-4">
                <div
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${meta.barCls}`}
                  style={{ left: `${Math.min(97, Math.max(3, score))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/70 rounded-lg px-3 py-2.5 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                    Distance to Low Risk
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {pointsToLow !== null
                      ? `${pointsToLow} points`
                      : '✓ In optimal zone'}
                  </p>
                </div>
                <div className="bg-white/70 rounded-lg px-3 py-2.5 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                    Daily Protein Target
                  </p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {Math.round(ms.proteinTargetG)} g/day
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── ESCALATION ALERT (conditional) ── */}
          {/* Rendered only when buildEscalationSignal() detects triggered       */}
          {/* criteria. Appears above Clinical Interpretation for maximum        */}
          {/* physician visibility. Prints cleanly with print-color-adjust.      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {signal.escalate && (
            <section aria-live="assertive">
              <div className={`rounded-xl border-2 px-5 py-4 space-y-2.5 ${
                signal.urgency === 'urgent'
                  ? 'border-red-400 bg-red-50'
                  : 'border-amber-400 bg-amber-50'
              }`}>

                {/* ── Header row ── */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Exclamation icon */}
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      signal.urgency === 'urgent' ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      <svg
                        className={`w-4.5 h-4.5 ${signal.urgency === 'urgent' ? 'text-red-700' : 'text-amber-700'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        />
                      </svg>
                    </span>
                    <p className={`text-sm font-black tracking-tight ${
                      signal.urgency === 'urgent' ? 'text-red-900' : 'text-amber-900'
                    }`}>
                      Physician Escalation Alert
                    </p>
                  </div>

                  {/* Urgency badge */}
                  <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded border ${
                    signal.urgency === 'urgent'
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-amber-100 text-amber-700 border-amber-300'
                  }`}>
                    {signal.urgency === 'urgent' ? 'Urgent' : 'Monitor'}
                  </span>
                </div>

                {/* ── Reason ── */}
                <p className={`text-xs leading-relaxed ${
                  signal.urgency === 'urgent' ? 'text-red-800' : 'text-amber-800'
                }`}>
                  {signal.reason}
                </p>

                {/* ── Call to action ── */}
                <p className={`text-[11px] font-semibold ${
                  signal.urgency === 'urgent' ? 'text-red-700' : 'text-amber-700'
                }`}>
                  Consider reassessment or intervention.
                </p>

              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── CLINICAL INTERPRETATION ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Clinical Interpretation
            </h2>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">

              {/* ── Row 1: Risk Category + 30-day projection ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-100">

                {/* Risk category */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">
                    Risk Category
                  </p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border mb-2 ${meta.bg} ${meta.border} ${meta.colour}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {interp.riskCategory.label}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                    {interp.riskCategory.detail}
                  </p>
                </div>

                {/* 30-day lean mass projection */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">
                    30-Day Lean Mass Projection
                  </p>
                  <p className={`text-2xl font-black tabular-nums leading-tight mb-1 ${meta.colour}`}>
                    {ms.leanLossEstPct}%
                    <span className="text-sm font-normal text-slate-500 ml-1">lean loss risk</span>
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {interp.leanMassProjection.split('. ').slice(1).join('. ')}
                  </p>
                </div>
              </div>

              {/* ── Row 2: Key Risk Drivers + Protocol Adherence ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-100">

                {/* Key risk drivers */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Key Risk Drivers
                  </p>
                  <ul className="space-y-2">
                    {interp.keyDrivers.map((driver, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        {/* Severity pill */}
                        <span className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                          driver.severity === 'concern'
                            ? 'bg-red-100 text-red-700'
                            : driver.severity === 'caution'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {driver.severity === 'concern' ? '!' : driver.severity === 'caution' ? '~' : '✓'}
                        </span>
                        <span className={`text-[11px] leading-snug ${
                          driver.severity === 'concern'
                            ? 'text-red-800'
                            : driver.severity === 'caution'
                            ? 'text-amber-800'
                            : 'text-slate-500'
                        }`}>
                          {driver.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Protocol adherence signal */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Protocol Adherence Signal
                  </p>
                  {interp.adherenceSignal.lines.length > 0 ? (
                    <ul className="space-y-2">
                      {interp.adherenceSignal.lines.map((line, i) => {
                        // Colour-code by adherence keyword embedded in the line
                        const isHigh = line.includes('High') || line.includes('Consistent') || line.includes('Strong');
                        const isLow  = line.includes('Low') || line.includes('Poor') || line.includes('Poor');
                        return (
                          <li key={i} className={`text-[11px] leading-snug ${
                            isHigh ? 'text-emerald-700' : isLow ? 'text-red-700' : 'text-slate-700'
                          }`}>
                            {line}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic leading-relaxed">
                      {interp.adherenceSignal.summary}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── SUGGESTED PHYSICIAN ACTIONS ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Suggested Physician Actions
            </h2>

            <ol className="space-y-2.5">
              {actions.map((action, i) => {
                // Per-urgency visual tokens
                const urgencyTokens = {
                  urgent: {
                    cardBorder:  'border-red-200',
                    cardBg:      'bg-red-50/60',
                    numBg:       'bg-red-100 text-red-700',
                    badgeBg:     'bg-red-100 text-red-700 border-red-200',
                    timeBg:      'bg-red-100/70 text-red-600',
                    label:       'Urgent',
                  },
                  recommended: {
                    cardBorder:  'border-amber-200',
                    cardBg:      'bg-amber-50/40',
                    numBg:       'bg-amber-100 text-amber-700',
                    badgeBg:     'bg-amber-100 text-amber-700 border-amber-200',
                    timeBg:      'bg-amber-100/70 text-amber-600',
                    label:       'Recommended',
                  },
                  maintenance: {
                    cardBorder:  'border-emerald-200',
                    cardBg:      'bg-emerald-50/40',
                    numBg:       'bg-emerald-100 text-emerald-700',
                    badgeBg:     'bg-emerald-100 text-emerald-700 border-emerald-200',
                    timeBg:      'bg-emerald-100/70 text-emerald-600',
                    label:       'Maintenance',
                  },
                }[action.urgency];

                return (
                  <li
                    key={i}
                    className={`rounded-xl border px-4 py-3.5 flex items-start gap-3.5 ${urgencyTokens.cardBorder} ${urgencyTokens.cardBg}`}
                  >
                    {/* Step number */}
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black mt-0.5 ${urgencyTokens.numBg}`}>
                      {i + 1}
                    </span>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Badge row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${urgencyTokens.badgeBg}`}>
                          {action.urgency === 'urgent'      && (
                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 2v3m0 2.5v.5" />
                            </svg>
                          )}
                          {action.urgency === 'recommended' && (
                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 1a4 4 0 100 8A4 4 0 005 1zm0 2v2.5l1.5 1" />
                            </svg>
                          )}
                          {action.urgency === 'maintenance' && (
                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2 5l2.5 2.5 3.5-3.5" />
                            </svg>
                          )}
                          {urgencyTokens.label}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgencyTokens.timeBg}`}>
                          {action.timeframe}
                        </span>
                      </div>

                      {/* Action text */}
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {action.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── PHYSICIAN FEEDBACK ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Physician Review
            </h2>
            <PhysicianFeedback
              assessmentId={latestAssessment.id}
              initialFeedback={initialFeedback}
            />
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── TRAJECTORY & PROJECTION ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {digest && (digest.projectedScore !== null || digest.streakWeeks > 0) && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Trend & Consistency
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">30-Day Projection</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-tight">
                    {digest.projectedScore !== null ? Math.round(digest.projectedScore) : '—'}
                    {digest.projectedScore !== null && <span className="text-sm text-slate-400 font-light ml-0.5">/100</span>}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Score Trend</p>
                  <p className={`text-base font-bold ${trendCfg.colour} flex items-center gap-1`}>
                    <span>{trendCfg.icon}</span>
                    {trendCfg.text}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Check-in Streak</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-tight">
                    {digest.streakWeeks}
                    <span className="text-sm text-slate-400 font-light ml-1">
                      wk{digest.streakWeeks !== 1 ? 's' : ''}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400">Best: {digest.bestStreak} wks</p>
                </div>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── SCORE HISTORY ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {historyAsc.length >= 2 && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Assessment History
              </h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Date</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Score</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Risk Band</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyAsc.map((a, i) => {
                      const s    = a.muscleScore ? Math.round(a.muscleScore.score) : null;
                      const prev = historyAsc[i - 1]?.muscleScore?.score ?? null;
                      const delta = s !== null && prev !== null ? Math.round(s - prev) : null;
                      const b    = (a.muscleScore?.riskBand ?? 'HIGH') as Band;
                      const bm   = BAND_LIGHT[b];
                      return (
                        <tr key={a.id} className={i === historyAsc.length - 1 ? 'bg-teal-50/50' : ''}>
                          <td className="px-4 py-2.5 text-slate-700 font-medium">{shortDate(a.assessmentDate)}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900 tabular-nums">{s ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${bm.bg} ${bm.border} ${bm.colour}`}>
                              <span className={`w-1 h-1 rounded-full ${bm.dot}`} />
                              {bm.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {delta !== null ? (
                              <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── MEDICATION & ASSESSMENT INPUTS ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Assessment Inputs
            </h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                {/* Left column */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Body Weight</p>
                  <p className="text-sm font-bold text-slate-900">{latestAssessment.weightKg} kg</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Protein Intake</p>
                  <p className="text-sm font-bold text-slate-900">{Math.round(latestAssessment.proteinGrams)} g/day</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Exercise Frequency</p>
                  <p className="text-sm font-bold text-slate-900">{latestAssessment.exerciseDaysWk} days/week</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Hydration</p>
                  <p className="text-sm font-bold text-slate-900">{latestAssessment.hydrationLitres} L/day</p>
                </div>
                {user.profile?.glp1Medication && (
                  <div className="px-4 py-3 col-span-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">GLP-1 Medication</p>
                    <p className="text-sm font-bold text-slate-900">
                      {MED_LABEL[user.profile.glp1Medication] ?? user.profile.glp1Medication}
                      {user.profile.glp1DoseMg && (
                        <span className="font-normal text-slate-600"> — {user.profile.glp1DoseMg} mg/week</span>
                      )}
                      {user.profile.glp1Stage && (
                        <span className="font-normal text-slate-500"> · {STAGE_LABEL[user.profile.glp1Stage] ?? user.profile.glp1Stage}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              {latestAssessment.symptoms.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Reported Symptoms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {latestAssessment.symptoms.map(s => (
                      <span key={s} className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── CHECK-IN ADHERENCE ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {user.weeklyCheckins.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Weekly Check-in Adherence (last {user.weeklyCheckins.length} weeks)
              </h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Week of</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Avg Protein</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Workouts</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Hydration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {user.weeklyCheckins.map(c => (
                      <tr key={c.weekStart.toISOString()}>
                        <td className="px-4 py-2.5 text-slate-700">{shortDate(c.weekStart)}</td>
                        <td className="px-4 py-2.5 text-slate-800 tabular-nums font-medium">
                          {c.avgProteinG != null
                            ? <><span className="font-bold">{Math.round(c.avgProteinG)}</span> g/day</>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 tabular-nums font-medium">
                          {c.totalWorkouts != null
                            ? <><span className="font-bold">{c.totalWorkouts}</span> sessions</>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 tabular-nums font-medium">
                          {c.avgHydration != null
                            ? <><span className="font-bold">{c.avgHydration}</span> L/day</>
                            : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── CLINICAL EXPLANATION ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
              Clinical Summary
            </h2>
            <div className="border border-slate-200 rounded-xl px-5 py-4 bg-slate-50">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {ms.explanation}
              </p>
            </div>
          </section>

          {/* ── Recommended action ── */}
          {digest?.nextAction && (
            <section>
              <h2 className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.18em] mb-3">
                Recommended Next Step
              </h2>
              <div className={`border rounded-xl px-5 py-4 flex items-start gap-3 ${
                digest.nextActionType === 'urgent'
                  ? 'border-red-200 bg-red-50'
                  : digest.nextActionType === 'recommended'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-teal-200 bg-teal-50'
              }`}>
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {digest.nextActionType === 'urgent' ? '⚠️' : digest.nextActionType === 'recommended' ? '💡' : '✅'}
                </span>
                <p className={`text-sm font-semibold leading-snug ${
                  digest.nextActionType === 'urgent' ? 'text-red-800' : digest.nextActionType === 'recommended' ? 'text-amber-800' : 'text-teal-800'
                }`}>
                  {digest.nextAction}
                </p>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── FOOTER DISCLAIMER ── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <footer className="border-t-2 border-slate-200 pt-5 space-y-2">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">CONFIDENTIALITY NOTICE: </span>
              This document contains protected health information generated by the MyoGuard Protocol
              system. It is intended solely for the named patient and their treating physician.
              Unauthorised disclosure is prohibited.
            </p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">CLINICAL DISCLAIMER: </span>
              MyoGuard Protocol provides clinical decision support and educational guidance based on
              published GLP-1 muscle-loss research. It does not replace the clinical judgement of the
              treating physician. All recommendations should be reviewed in the context of the patient's
              full medical history and current treatment plan.
            </p>
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-slate-400">
                myoguard.health · © {new Date().getFullYear()} MyoGuard Protocol
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                {longDate(generatedAt)}
              </p>
            </div>
          </footer>

        </div>
      </article>

    </main>
  );
}
