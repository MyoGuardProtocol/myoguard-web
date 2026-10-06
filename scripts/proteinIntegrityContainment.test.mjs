/**
 * scripts/proteinIntegrityContainment.test.mjs
 *
 * Protein Clinical Integrity — P0 immediate containment.
 * Source: Protein Clinical Integrity Gate v1.0.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs --import ./scripts/_load-tsx.mjs scripts/proteinIntegrityContainment.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * Pure functions are called for real: the protocol engine (against a golden
 * fixture generated from the engine BEFORE this build), the shared report
 * functions in reportClinical.ts, the assessment input schema, the weight-unit
 * normaliser and the retired legacy route handler.
 *
 * Whether a server-rendered page shows a value cannot be executed here without a
 * database and a browser, so surface containment is asserted against shipped
 * source with comments stripped, as in proteinContainment.test.mjs.
 *
 *   [behaviour] — calls shipped code and asserts its result.
 *   [safety]    — asserts an invariant whose violation would re-present the
 *                 calculated protein floor as patient intake, or re-assert a
 *                 mis-scaled adherence conclusion.
 *   [preserve]  — asserts genuine data or a correct signal was NOT removed.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync } from 'node:fs';
import { calculateProtocol, toKg } from '../src/lib/protocolEngine.ts';
import { AssessmentInputSchema } from '../src/schemas/assessment.ts';
import {
  buildInterpretation,
  buildSuggestedActions,
  buildEscalationSignal,
} from '../src/lib/reportClinical.ts';
import { PROTEIN_ADHERENCE_INTERPRETATION_WITHHELD } from '../src/lib/clinical/proteinIntegrityContainment.ts';
import { PROTEIN_CEILING_LABEL } from '../src/lib/clinical/proteinContainment.ts';
import {
  LB_TO_KG,
  WEIGHT_KG_RANGE,
  WEIGHT_LB_DISPLAY_RANGE,
  weightInputToKg,
  isAcceptedWeight,
} from '../src/lib/units/weight.ts';
import { POST as legacySavePost } from '../app/api/assessment/save/route.ts';

let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name + (detail ? `  — ${detail}` : '')); }
};
const section = s => console.log('\n' + s);

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/** Shipped source with comments removed, so a containment note never satisfies or trips a check. */
const code = p => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const F = {
  list:      'app/doctor/patients/page.tsx',
  record:    'app/doctor/patients/[userId]/page.tsx',
  physRes:   'app/doctor/patients/[userId]/results/[assessmentId]/page.tsx',
  print:     'app/doctor/patients/[userId]/print/page.tsx',
  drawer:    'src/components/ui/PatientDrawer.tsx',
  token:     'app/report/[token]/page.tsx',
  results:   'app/dashboard/results/[id]/page.tsx',
  report:    'app/dashboard/report/page.tsx',
  form:      'app/dashboard/assessment/page.tsx',
  adherence: 'src/lib/intelligence/adherence.ts',
  engine:    'src/lib/protocolEngine.ts',
};

// Engine-shaped values for a 110 kg moderately active patient: what /api/assessment
// stores as Assessment.proteinGrams (floor) and MuscleScore.proteinTargetG (upper end).
const P110 = calculateProtocol({ weight: '110', unit: 'kg', medication: 'semaglutide', doseMg: 1, activityLevel: 'moderate', symptoms: [] });
const reportParams = (over = {}) => ({
  band: 'MODERATE', leanLossEstPct: 8,
  proteinTargetG: P110.proteinAggressive, proteinIntakeG: P110.proteinStandard,
  exerciseDaysWk: 4, hydrationLitres: 2.5, fatigue: 0, nausea: 0, muscleWeakness: 0,
  trendStatus: 'stable', checkins: [], glp1Stage: 'MAINTENANCE', ...over,
});
const allText = x => JSON.stringify(x);

// ── I. SRI output is identical to the pre-containment golden fixture ────────
section('-- I. SRI values and bands unchanged for fixed fixtures --');
{
  const golden = JSON.parse(read('scripts/fixtures/proteinIntegrity/sri-golden.v1.json'));
  t('[behaviour] I. golden fixture has 24 cases generated at 601742d', golden.cases.length === 24 && golden.engineCommit === '601742d');
  const mismatches = golden.cases.filter(({ input, expected }) => {
    const r = calculateProtocol(input);
    return Object.keys(expected).some(k => JSON.stringify(r[k]) !== JSON.stringify(expected[k]));
  });
  t('[behaviour] I. every SRI value, band, floor, upper end, step target and override matches', mismatches.length === 0, JSON.stringify(mismatches.map(m => m.input)));
  t('[safety]    I. P110 example still yields floor 154 and upper end 187', P110.proteinStandard === 154 && P110.proteinAggressive === 187);
}

// ── A. Patient surfaces do not present the floor as intake ───────────────────
section('-- A. Patient results and report do not present Assessment.proteinGrams as intake --');
{
  for (const f of [F.results, F.report]) {
    const c = code(f);
    t(`[safety]    A. ${f}: no "Protein intake"/"Protein Intake" label`, !/Protein [Ii]ntake/.test(c));
    const uses = c.split('\n').filter(l => /proteinGrams/.test(l));
    t(`[safety]    A. ${f}: proteinGrams only reaches report-function parameters, never markup`,
      uses.every(l => /proteinIntakeG:|proteinDeficit:/.test(l)), JSON.stringify(uses));
  }
  const interp = buildInterpretation(reportParams());
  t('[behaviour] A. no key driver mentions protein, "reported" or a deficit',
    !interp.keyDrivers.some(d => /protein|reported|deficit|below target/i.test(d.text)), allText(interp.keyDrivers));
  t('[preserve]  A. the other key drivers still render (exercise, hydration, symptoms)', interp.keyDrivers.length === 3);
}

// ── B. Physician surfaces do not present the floor as intake ─────────────────
section('-- B. Physician record, results, print, drawer and shared report --');
{
  const BANNED = [
    [/g reported/i, '"g reported"'],
    [/current reported intake/i, '"current reported intake"'],
    [/Critical protein deficit/i, '"Critical protein deficit"'],
    [/below minimum/i, '"below minimum"'],
    [/not a current concern/i, '"not a current concern"'],
    // "Below target" alone is not banned: the print export's hydration row uses
    // it, and hydration is an adjacent finding outside this containment.
    [/Meeting target/, '"Meeting target"'],
    [/protein[^\n]*Below target|Below target[^\n]*protein/i, 'protein "Below target"'],
    [/Protein Intake vs Target/, '"Protein Intake vs Target"'],
    [/'Protein Intake'|>Protein Intake</, '"Protein Intake" label'],
    [/'Daily Protein'/, '"Daily Protein" input'],
  ];
  for (const f of [F.record, F.physRes, F.print, F.drawer, F.token]) {
    const c = code(f);
    const hits = BANNED.filter(([re]) => re.test(c)).map(([, n]) => n);
    t(`[safety]    B. ${f}: no intake/deficit wording built on the floor`, hits.length === 0, hits.join(', '));
  }
  t('[safety]    B. physician record never reads Assessment.proteinGrams', !/proteinGrams/.test(code(F.record)));
  t('[safety]    B. physician results page never reads assessment.proteinGrams', !/proteinGrams/.test(code(F.physRes)));
  t('[safety]    B. print export never reads latest.proteinGrams', !/proteinGrams/.test(code(F.print)));
  t('[safety]    B. shared report never renders proteinGrams in markup',
    code(F.token).split('\n').filter(l => /proteinGrams/.test(l)).every(l => /proteinIntakeG:|proteinDeficit:/.test(l)));
  const d = code(F.drawer);
  t('[safety]    B. drawer reads proteinGrams only in its type declaration',
    d.split('\n').filter(l => /proteinGrams/.test(l)).every(l => /^\s*proteinGrams:\s*number;/.test(l)));
  t('[preserve]  B. drawer keeps the calculated upper end under the governed label', /\{PROTEIN_CEILING_LABEL\}/.test(d) && /ms\.proteinTargetG/.test(d));
  t('[preserve]  B. print keeps the plan upper end under the governed label, without "(standard)"',
    /\{PROTEIN_CEILING_LABEL\}/.test(code(F.print)) && !/\(standard\)/.test(code(F.print)));
  t('[preserve]  B. the governed SRI-R1C ceiling label is unchanged', PROTEIN_CEILING_LABEL === 'Upper end of calculated range');

  const actions = buildSuggestedActions(reportParams({ proteinIntakeG: 60 }));
  t('[behaviour] B. no suggested action is built on protein deficit or "reported intake"',
    !actions.some(a => /protein intake|reported|deficit|dietitian|whey/i.test(a.text)), allText(actions));
  const esc = buildEscalationSignal({ riskBand: 'LOW', symptomAvg: 0, proteinDeficit: 120, exerciseDaysWk: 5, hydrationLitres: 2.5, leanLossEstPct: 2, trendStatus: 'stable' });
  t('[behaviour] B. a large floor-vs-upper "deficit" alone no longer escalates', esc.escalate === false && esc.reason === '');
  const esc2 = buildEscalationSignal({ riskBand: 'HIGH', symptomAvg: 0, proteinDeficit: 120, exerciseDaysWk: 1, hydrationLitres: 2.5, leanLossEstPct: 2, trendStatus: 'stable' });
  t('[preserve]  B. non-protein escalation still fires, with no protein text', esc2.escalate === true && !/protein/i.test(esc2.reason));
}

// ── C. Universal Protein Gap / Deficit outputs are gone ──────────────────────
section('-- C. False "Protein Gap" and "Protein Deficit" outputs --');
{
  const list = code(F.list);
  t('[safety]    C. Patient Command Center no longer pushes "Protein Gap"', !/'Protein Gap'\)/.test(list) && !/push\('Protein Gap'/.test(list));
  t('[safety]    C. getFlags no longer reads patient.proteinGrams', !/patient\.proteinGrams/.test(list));
  t('[preserve]  C. the ProgressLog-based "Protein Deficit" check (logged values) is kept',
    /if \(has72hProteinDeficit\(patient\.recentProteinLogs, target\)\) \{\s*flags\.push\('Protein Deficit'\);\s*\}/.test(list));
  const d = code(F.drawer);
  t('[safety]    C. drawer no longer returns a "Protein Deficit" primary driver', !/driver:\s*'Protein Deficit'/.test(d));
  t('[preserve]  C. drawer still returns GI, recovery and SRI-decline drivers',
    /'GI Burden'/.test(d) && /'Recovery Impairment'/.test(d) && /'SRI Decline'/.test(d));
  const rec = code(F.record);
  t('[safety]    C. record escalation no longer depends on a protein deficit', !/proteinDeficit/.test(rec));
  t('[preserve]  C. record escalation still covers exercise and lean-loss estimate',
    /const escalate =\s*\(latest\?\.exerciseDaysWk \?\? 0\) < 2 \|\|\s*\(latestMs\?\.leanLossEstPct \?\? 0\) > 25;/.test(rec));
  t('[safety]    C. record has no urgent "Increase daily protein" action', !/Increase daily protein/.test(rec));
  t('[safety]    C. record factor cards contain no protein card', !/label:\s*'Protein Intake'/.test(rec));
}

// ── D. SupplementCTA is not triggered by the imputed floor ───────────────────
section('-- D. Supplement prompt --');
{
  for (const f of [F.results, F.report]) {
    const c = code(f);
    t(`[safety]    D. ${f}: no lowProtein derived from proteinGrams`, !/lowProtein\s*=/.test(c));
    t(`[safety]    D. ${f}: SupplementCTA receives no lowProtein`, !/lowProtein=\{/.test(c));
  }
  t('[preserve]  D. SupplementCTA still receives GI and recovery signals',
    [F.results, F.report].every(f => /hasGISymptoms=\{hasGISymptoms\}/.test(code(f)) && /lowRecovery=\{lowRecovery\}/.test(code(f))));
}

// ── E. Mis-scaled adherence interpretation is contained ──────────────────────
section('-- E. Protein adherence interpretation --');
{
  const adherent = [{ proteinAdherence: 0.95, exerciseAdherence: null }, { proteinAdherence: 1.1, exerciseAdherence: null }];
  const interp = buildInterpretation(reportParams({ checkins: adherent }));
  t('[behaviour] E. adherent ratios (0.95, 1.1) no longer read as "Low"', !/Low|Moderate|High \(avg/.test(allText(interp.adherenceSignal)));
  t('[behaviour] E. the withheld notice is shown instead, with no number',
    interp.adherenceSignal.lines.length === 1 && interp.adherenceSignal.lines[0] === PROTEIN_ADHERENCE_INTERPRETATION_WITHHELD);
  t('[safety]    E. withheld notice states no percentage, status or denominator',
    !/\d|%|deficit|target|floor/i.test(PROTEIN_ADHERENCE_INTERPRETATION_WITHHELD));
  const none = buildInterpretation(reportParams({ checkins: [] }));
  t('[preserve]  E. with no check-ins the existing "insufficient data" summary is unchanged',
    none.adherenceSignal.lines.length === 0 && /^Insufficient longitudinal check-in data/.test(none.adherenceSignal.summary));
  const actions = buildSuggestedActions(reportParams({ checkins: [{ proteinAdherence: 0.2, exerciseAdherence: null }] }));
  t('[behaviour] E. no suggested action classifies protein adherence', !actions.some(a => /adherence is averaging/i.test(a.text)));

  const a = code(F.adherence);
  t('[safety]    E. computeAdherence never produces persistent_deficit, near_target or target_achieved',
    !/'persistent_deficit'|'near_target'|'target_achieved'/.test(a));
  t('[safety]    E. computeAdherence computes no average of the stored ratio', !/reduce\(/.test(a) && !/avgAdherence/.test(a));
  t('[safety]    E. with qualifying data it returns insufficient_data with the withheld notice',
    /status:\s*'insufficient_data',\s*confidence:\s*'insufficient_data',\s*explanation:\s*PROTEIN_ADHERENCE_INTERPRETATION_WITHHELD/.test(a));
  t('[preserve]  E. with no qualifying data it keeps the existing "No protein adherence data" text', /No protein adherence data recorded/.test(a));
  t('[safety]    E. drawer no longer renders the stored ratio as a protein percentage bar', !/label="Protein Adherence"/.test(code(F.drawer)));
}

// ── F. Genuine check-in intake is preserved ──────────────────────────────────
section('-- F. Genuine WeeklyCheckin.avgProteinG remains available --');
{
  t('[preserve]  F. drawer check-in history still shows avgProteinG', /c\.avgProteinG != null/.test(code(F.drawer)) && /Math\.round\(c\.avgProteinG\)/.test(code(F.drawer)));
  t('[preserve]  F. shared report check-in table still shows avgProteinG', /Math\.round\(c\.avgProteinG\)/.test(code(F.token)));
  t('[preserve]  F. journey still credits logged intake', /Protein intake logged/.test(code('app/dashboard/journey/page.tsx')));
  t('[preserve]  F. /api/checkins still persists avgProteinG', /avgProteinG:\s*data\.avgProteinG/.test(code('app/api/checkins/route.ts')));
  t('[preserve]  F. Cockpit Level 3 tripwire still uses recentProteinAdherencePct < 60',
    /velFlag === 'critical_review' &&\s*adherencePct != null &&\s*adherencePct < 60/.test(code('src/components/ui/ClinicalCockpit.tsx')));
  t('[preserve]  F. /api/assessment still computes recentProteinAdherencePct against the floor',
    /recentCheckin\.avgProteinG \/ adherenceDenominator/.test(code('app/api/assessment/route.ts')));
}

// ── G. Legacy /api/assessment/save rejects writes ────────────────────────────
section('-- G. Legacy write path --');
{
  const res = await legacySavePost();
  const body = await res.json();
  t('[behaviour] G. POST returns 410 Gone', res.status === 410);
  t('[behaviour] G. body reports failure and names the canonical route', body.ok === false && /\/api\/assessment/.test(body.error));
  const c = code('app/api/assessment/save/route.ts');
  t('[safety]    G. route imports no database client and no auth SDK', !/prisma|@clerk/.test(c));
  t('[safety]    G. route performs no create, update or upsert', !/\.(create|update|upsert|createMany)\(/.test(c));
  t('[safety]    G. route reads no request body', !/req\.json|request\.json|\.json\(\)\s*;?\s*$/m.test(c.replace(/NextResponse\.json/g, '')));
}

// ── H. Canonical /api/assessment path still accepts real submissions ─────────
section('-- H. Canonical assessment pathway --');
{
  const base = { unit: 'kg', medication: 'tirzepatide', doseMg: 5, activityLevel: 'moderate', symptoms: ['Nausea'], exerciseDaysWk: 3, glp1Stage: 'DOSE_ESCALATION' };
  const ok = AssessmentInputSchema.safeParse({ ...base, weight: '89' });
  t('[behaviour] H. a dashboard-shaped kg payload validates', ok.success);
  t('[behaviour] H. the validated payload still generates a protocol', ok.success && calculateProtocol(ok.data).weightKg === 89);
  t('[behaviour] H. extra fields are still stripped (proteinGrams never reaches the engine — Decision A pending)',
    AssessmentInputSchema.safeParse({ ...base, weight: '89', proteinGrams: 120 }).data?.proteinGrams === undefined);
  t('[behaviour] H. lbs payloads are still accepted and converted by the engine',
    AssessmentInputSchema.safeParse({ ...base, weight: '200', unit: 'lbs' }).success);
  for (const [w, u] of [['29.9', 'kg'], ['250.1', 'kg'], ['abc', 'kg'], ['', 'kg'], ['560', 'lbs'], ['-5', 'kg']]) {
    t(`[behaviour] H. server rejects weight "${w}" ${u}`, !AssessmentInputSchema.safeParse({ ...base, weight: w, unit: u }).success);
  }
  for (const [w, u] of [['30', 'kg'], ['250', 'kg'], ['67', 'lbs'], ['551', 'lbs']]) {
    t(`[behaviour] H. server accepts boundary weight "${w}" ${u}`, AssessmentInputSchema.safeParse({ ...base, weight: w, unit: u }).success);
  }
  const route = read('app/api/assessment/route.ts');
  t('[preserve]  H. /api/assessment still validates with AssessmentInputSchema and calls calculateProtocol',
    /AssessmentInputSchema\.safeParse\(body\)/.test(route) && /calculateProtocol\(input\)/.test(route));
}

// ── J. kg/lb normalisation reaches the engine as the same weight ─────────────
section('-- J. kg/lb normalisation (PROT-UNIT-001) --');
{
  const engineSrc = read(F.engine);
  t('[behaviour] J. LB_TO_KG equals the factor in protocolEngine toKg', new RegExp(`raw \\* ${String(LB_TO_KG).replace('.', '\\.')}\\b`).test(engineSrc));
  const samples = ['30', '66', '67', '89', '89.5', '120', '196', '200', '250', '330.25', '551'];
  const parity = samples.every(s => ['kg', 'lbs'].every(u => weightInputToKg(s, u) === toKg(s, u)));
  t('[behaviour] J. weightInputToKg matches engine toKg exactly for kg and lbs', parity);

  const common = { medication: 'semaglutide', doseMg: 2.4, activityLevel: 'active', symptoms: ['Fatigue'], sleepHours: 6, glp1Stage: 'INITIATION' };
  const viaLbs  = calculateProtocol({ ...common, weight: '200', unit: 'lbs' });
  const normKg  = String(weightInputToKg('200', 'lbs'));
  const viaForm = calculateProtocol({ ...common, weight: normKg, unit: 'kg' });
  t('[behaviour] J. 200 lb normalised in the form reaches the engine as 90.7 kg', viaForm.weightKg === 90.7);
  t('[behaviour] J. 200 lb via the form and 200 lb via engine toKg give identical protocol output',
    JSON.stringify(viaForm) === JSON.stringify(viaLbs));
  t('[behaviour] J. 90.7184 kg typed directly gives the same output', JSON.stringify(calculateProtocol({ ...common, weight: '90.7184', unit: 'kg' })) === JSON.stringify(viaLbs));
  t('[behaviour] J. kg entry is unchanged by normalisation', String(weightInputToKg('89', 'kg')) === '89');

  t('[behaviour] J. range is the existing 30–250 kg', WEIGHT_KG_RANGE.min === 30 && WEIGHT_KG_RANGE.max === 250);
  t('[behaviour] J. lb display bounds derive from it (67–551)', WEIGHT_LB_DISPLAY_RANGE.min === 67 && WEIGHT_LB_DISPLAY_RANGE.max === 551);
  t('[behaviour] J. a 200 lb entry is not mistaken for 200 kg', isAcceptedWeight('200', 'lbs') && weightInputToKg('200', 'lbs') < 100);

  const form = code(F.form);
  t('[safety]    J. the form submits the normalised kilogram value with unit "kg"',
    /weight:\s*String\(parsedWeight\),\s*unit:\s*'kg'/.test(form) && /parsedWeight\s*=\s*weightInputToKg\(String\(form\.weightKg\), weightUnit\)/.test(form));
  t('[safety]    J. the form offers kg and lbs and clears the value on switch',
    /\(\['kg', 'lbs'\] as const\)/.test(form) && /weightKg: ''/.test(form));
  t('[safety]    J. the form does not bundle the protocol engine into the client', !/protocolEngine/.test(form));
}

// ── K. Inaccurate assessment hint removed; protein field otherwise unchanged ─
section('-- K. Authenticated assessment protein hint --');
{
  const form = code(F.form);
  t('[safety]    K. "Used to assess adequacy against your clinical protein floor." is gone', !/assess adequacy/i.test(form));
  t('[safety]    K. no replacement clinical claim beside the field', !/clinical protein floor/i.test(form));
  t('[preserve]  K. the protein field is still present and required (0–350 g)',
    /id="proteinGrams"/.test(form) && /\.min\(1, 'Daily protein intake is required'\)/.test(form) && /n >= 0 && n <= 350/.test(form));
  t('[preserve]  K. the payload still sends proteinGrams (pathway unchanged pending Decision A)', /proteinGrams:\s*parseFloat\(form\.proteinGrams\)/.test(form));
  t('[safety]    K. no provenance states introduced', !/REPORTED|ESTIMATED|UNKNOWN/.test(form));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
