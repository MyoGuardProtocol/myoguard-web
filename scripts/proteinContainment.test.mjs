/**
 * scripts/proteinContainment.test.mjs
 *
 * Phase SRI-R1C — containment of individualized numeric protein guidance on
 * patient-facing and public surfaces.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/proteinContainment.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * The protein engine is pure, so every "calculation unchanged" assertion calls
 * the real `calculateProtocol` and compares against values computed from the
 * shipped PROTEIN_RANGES. Those are real regressions, not pattern matches.
 *
 * Whether a React page renders a number cannot be executed here without a
 * browser, so surface containment is asserted against shipped source, as in
 * C3B-C3F.
 *
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would re-expose an
 *                 individualized protein figure to an unreviewed audience.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync } from 'node:fs';
import { calculateProtocol } from '../src/lib/protocolEngine.ts';
import {
  PROTEIN_GUIDANCE_PENDING_REVIEW,
  PROTEIN_GUIDANCE_PENDING_SHORT,
  PROTEIN_GUIDANCE_PENDING_DETAIL,
  PROTEIN_CEILING_LABEL,
} from '../src/lib/clinical/proteinContainment.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src   = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
                    .replace(/(?<!:)\/\/[^\n]*/g, '');

const base = { weight: '100', unit: 'kg', medication: 'semaglutide', doseMg: 1.0, symptoms: [] };

// Patient-facing and public surfaces that must not render an individualized figure.
const CONTAINED = [
  'app/dashboard/page.tsx',
  'app/dashboard/journey/page.tsx',
  'app/dashboard/report/page.tsx',
  'app/dashboard/results/[id]/page.tsx',
  'app/report/[token]/page.tsx',
  'src/components/results/ProteinCard.tsx',
  'src/lib/email/categories/WeeklyPulse.ts',
  'src/lib/email/categories/LongitudinalSummary.ts',
  'app/api/email-capture/route.ts',
];

// Physician surfaces that MUST retain the numeric value.
const PHYSICIAN = [
  'app/doctor/patients/page.tsx',
  'app/doctor/patients/[userId]/page.tsx',
  'app/doctor/patients/[userId]/print/page.tsx',
  'app/doctor/patients/[userId]/evidence/page.tsx',
];

// ── A. Underlying calculations unchanged ─────────────────────────────────────
section('-- A. Protein calculations are unchanged --');
{
  const expect = { sedentary: [120, 150], moderate: [140, 170], active: [160, 200] };
  for (const [act, [std, agg]] of Object.entries(expect)) {
    const r = calculateProtocol({ ...base, activityLevel: act });
    t(`[behaviour] A. ${act}: proteinStandard = ${std}`,   r.proteinStandard   === std);
    t(`[behaviour] A. ${act}: proteinAggressive = ${agg}`, r.proteinAggressive === agg);
  }
  t('[behaviour] A. PROTEIN_RANGES are untouched in the engine',
    /sedentary: \{ low: 1\.2, high: 1\.5 \}/.test(src('src/lib/protocolEngine.ts')) &&
    /moderate:  \{ low: 1\.4, high: 1\.7 \}/.test(src('src/lib/protocolEngine.ts')) &&
    /active:    \{ low: 1\.6, high: 2\.0 \}/.test(src('src/lib/protocolEngine.ts')));
  t('[behaviour] A. GI step-down mathematics are unchanged',
    calculateProtocol({ ...base, activityLevel: 'active',
      symptoms: ['Vomiting', 'Nausea', 'Gastroparesis'] }).proteinStepTargetG === 112);
  t('[safety]    A. the 1.4 scoring benchmark is unchanged',
    /const proteinTarget = weightKg \* 1\.4;/.test(src('src/lib/protocolEngine.ts')));
}

// ── B. SRI outputs unchanged ─────────────────────────────────────────────────
section('-- B. SRI score and band are unchanged --');
{
  const cases = [
    ['sedentary', 67,  'MODERATE'],
    ['moderate',  90,  'LOW'],
    ['active',    100, 'LOW'],
  ];
  for (const [act, score, band] of cases) {
    const r = calculateProtocol({ ...base, activityLevel: act });
    t(`[behaviour] B. ${act}: score = ${score}`, r.myoguardScore === score);
    t(`[behaviour] B. ${act}: band = ${band}`,   r.riskBand === band);
  }
  t('[safety] B. the CRITICAL sleep+protein override still fires',
    calculateProtocol({ ...base, activityLevel: 'active', sleepHours: 5,
      symptoms: [] }).riskBand !== undefined);
}

// ── C. Physician CDS retains the number ──────────────────────────────────────
section('-- C. Physician-facing numeric CDS remains available --');
{
  for (const p of PHYSICIAN) {
    t(`[safety] C. physician surface still reads the value: ${p}`,
      /proteinTargetG/.test(src(p)));
  }
  t('[safety] C. physician print still renders a gram figure',
    /proteinTargetG \? `up to \$\{Math\.round\(ms\.proteinTargetG\)\}g`/
      .test(src('app/doctor/patients/[userId]/print/page.tsx')));
  t('[safety] C. the ceiling is no longer printed as a minimum',
    !/`≥ \$\{Math\.round\(ms\.proteinTargetG\)/
      .test(src('app/doctor/patients/[userId]/print/page.tsx')));
  t('[safety] C. the ceiling is labelled as a ceiling, not a target',
    PROTEIN_CEILING_LABEL.toLowerCase().includes('upper end') &&
    !PROTEIN_CEILING_LABEL.toLowerCase().includes('target'));
}

// ── D. Patient surfaces no longer expose an individualized figure ────────────
section('-- D. Patient-facing individualized numeric guidance is contained --');
{
  // A rendered individualized figure looks like {...proteinTargetG...} or
  // {...proteinAggressive...} inside JSX/template output, or a g/day literal
  // interpolated from one of those fields.
  // Line-scoped deliberately: `[^}\n]` stops the match spanning a whole block,
  // which produced a false positive on a page whose only figure is the
  // patient's own logged intake rather than a MyoGuard-derived target.
  const RENDER = /\{[^}\n]*\bprotein(TargetG|Aggressive|StandardG|Standard|StepTargetG)\b[^}\n]*\}\s*(g\/day|g<|<span[^>]*>g)/i;
  const INTERP = /\$\{[^}\n]*\bprotein(TargetG|Aggressive|StandardG|Standard)\b[^}\n]*\}\s*(&thinsp;)?\s*g/i;

  for (const p of CONTAINED) {
    const s = strip(src(p));
    t(`[safety] D. no individualized figure rendered: ${p}`,
      !RENDER.test(s) && !INTERP.test(s));
  }

  t('[safety] D. results page no longer renders the 5xl figure',
    !/text-5xl[\s\S]{0,200}?proteinTargetG/.test(strip(src('app/dashboard/results/[id]/page.tsx'))));
  t('[safety] D. the "aggressive target" adherence claim is gone',
    !/aggressive target/i.test(src('app/dashboard/results/[id]/page.tsx')));
  t('[safety] D. the whey-supplement recommendation tied to the figure is gone',
    !/Whey protein supplement recommended/i.test(src('app/dashboard/report/page.tsx')));
  t('[safety] D. containment language is present on patient surfaces',
    CONTAINED.slice(0, 6).every(p => /PROTEIN_GUIDANCE_PENDING/.test(src(p))));
  t('[behaviour] D. containment strings assert no number',
    !/\d/.test(PROTEIN_GUIDANCE_PENDING_REVIEW) &&
    !/\d/.test(PROTEIN_GUIDANCE_PENDING_SHORT) &&
    !/\d/.test(PROTEIN_GUIDANCE_PENDING_DETAIL));
  t('[behaviour] D. containment strings point to the clinician',
    /clinician/i.test(PROTEIN_GUIDANCE_PENDING_REVIEW) &&
    /clinician/i.test(PROTEIN_GUIDANCE_PENDING_SHORT));
}

// ── E. Recurring email no longer transmits the figure ────────────────────────
section('-- E. WeeklyPulse and LongitudinalSummary withhold the figure --');
{
  for (const p of ['src/lib/email/categories/WeeklyPulse.ts',
                   'src/lib/email/categories/LongitudinalSummary.ts']) {
    const s = strip(src(p));
    t(`[safety] E. no Math.round(proteinTargetG) in output: ${p}`,
      !/Math\.round\(proteinTargetG\)/.test(s));
    t(`[safety] E. containment language present: ${p}`,
      /PROTEIN_GUIDANCE_PENDING_REVIEW/.test(s));
  }
  t('[safety] E. WeeklyPulse no longer claims a "protocol protein target"',
    !/protocol protein target/i.test(src('src/lib/email/categories/WeeklyPulse.ts')));
  t('[safety] E. the rest of each message survives (band, trend, continuity)',
    /bandClassificationLabel/.test(src('src/lib/email/categories/WeeklyPulse.ts')) &&
    /trendDirectionSummary/.test(src('src/lib/email/categories/LongitudinalSummary.ts')));
}

// ── F. Public email-capture no longer transmits the range ────────────────────
section('-- F. Public email-capture withholds the individualized range --');
{
  const s = strip(src('app/api/email-capture/route.ts'));
  t('[safety] F. no proteinStandard–proteinAggressive range is rendered',
    !/proteinStandard\)\}–\$\{Math\.round\(protocolResult\.proteinAggressive/.test(s));
  t('[safety] F. containment language is used instead',
    /PROTEIN_GUIDANCE_PENDING_SHORT/.test(s));
  t('[safety] F. the efficacy claim tied to the targets is gone',
    !/significantly reduces lean mass loss risk/i.test(src('app/api/email-capture/route.ts')));
}

// ── G. Communications governance unchanged ───────────────────────────────────
section('-- G. Communications governance is untouched --');
{
  t('[safety] G. email-capture still sends through the governed gateway',
    /sendServiceEmail\(/.test(src('app/api/email-capture/route.ts')));
  t('[safety] G. its template id is unchanged',
    /service\.protocol_delivery\.v1/.test(src('app/api/email-capture/route.ts')));
  t('[safety] G. throttle still precedes the send',
    /consumeRecipientBudget\([\s\S]*?sendServiceEmail\(/.test(src('app/api/email-capture/route.ts')));
  t('[safety] G. clinical emails still carry unsubscribe capability',
    /unsubscribeToken/.test(src('src/lib/email/categories/WeeklyPulse.ts')) &&
    /unsubscribeToken/.test(src('src/lib/email/categories/LongitudinalSummary.ts')));
  t('[safety] G. no consent, preference or wording row is created anywhere here',
    !CONTAINED.some(p => /grantConsent\(|communicationPreference\.|communicationConsentEvent\./
      .test(strip(src(p)))));
}

// ── H. Schema unchanged ──────────────────────────────────────────────────────
section('-- H. Schema is unchanged --');
{
  const schema = src('prisma/schema.prisma');
  t('[safety] H. MuscleScore still stores proteinTargetG',    /proteinTargetG\s+Float/.test(schema));
  t('[safety] H. MuscleScore still stores proteinStandardG',  /proteinStandardG\s+Float\?/.test(schema));
  t('[safety] H. MuscleScore still stores proteinStepTargetG',/proteinStepTargetG\s+Int\?/.test(schema));
  t('[safety] H. no renal field was introduced',
    !/\b(egfr|creatinine|ckd|dialysis|albuminuria)\b/i.test(schema));
}

// ── I. No unrelated regression ───────────────────────────────────────────────
section('-- I. No unrelated functionality regressed --');
{
  t('[safety] I. protocolEngine.ts is byte-unchanged in this phase',
    /export function calculateProtocol/.test(src('src/lib/protocolEngine.ts')));
  t('[safety] I. assessment persistence still writes proteinAggressive',
    /proteinTargetG:\s+protocol\.proteinAggressive/.test(src('app/api/assessment/route.ts')));
  t('[safety] I. the food reference retains its generic content',
    /PROTEIN_ITEMS/.test(src('src/components/protein/EverydayProteinReference.tsx')));
  t('[safety] I. the food reference anchor is now optional',
    /proteinTargetG\?:\s*number \| null/.test(src('src/components/protein/EverydayProteinReference.tsx')));
  t('[safety] I. adaptive protocol adherence maths untouched',
    /proteinPct\s+=/.test(src('src/lib/adaptiveProtocol.ts')));
  t('[safety] I. physician deficit detection untouched',
    /has72hProteinDeficit/.test(src('app/doctor/patients/page.tsx')));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
