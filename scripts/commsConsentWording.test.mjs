/**
 * scripts/commsConsentWording.test.mjs
 *
 * Phase 1D-C3F-1A — generalisation of consent-wording resolution from one
 * hardcoded surface to a declared registry.
 *
 * Run:  node --import ./scripts/_resolve-ts.mjs scripts/commsConsentWording.test.mjs
 *
 * WHAT IS PROVEN FOR REAL AND WHAT IS STRUCTURAL
 * Surface resolution is a pure function over a module-level registry, so every
 * resolution test calls the real `wordingForSurface` and asserts its result.
 *
 * Row creation touches Prisma, and the only database in this project is
 * production, which this phase forbids writing to. So lazy-creation ordering is
 * asserted against shipped source, as in C3B-C3E.
 *
 *   [behaviour] — calls the shipped function and asserts its result.
 *   [ordering]  — asserts a structural invariant in shipped source.
 *   [safety]    — asserts an invariant whose violation would attach consent to
 *                 the wrong text, fabricate attributable evidence, or open a
 *                 class this phase must leave closed.
 *
 * Touches no database, contacts no provider, sends no email.
 */

import { readFileSync } from 'node:fs';
import {
  CLINICAL_CONTINUITY_SURFACE,
  CLINICAL_CONTINUITY_WORDING,
  CURRENT_WORDING,
  wordingForSurface,
  declaredSurfaces,
  resolveCurrentWordingId,
  resolveWordingIdForSurface,
} from '../src/lib/communications/consentWording.ts';
import { decideFromGovernanceState } from '../src/lib/communications/governance.ts';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
};
const section = s => console.log('\n' + s);

const src   = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');

const WORDING = strip(src('src/lib/communications/consentWording.ts'));
const PREF    = strip(src('app/api/communications/preferences/route.ts'));
const SVC     = strip(src('src/lib/communications/preferenceService.ts'));

// The exact text shipped at C3E (8cf4ac8). Duplicated here deliberately: a test
// that imported the value it is checking would pass no matter what it became.
const C3E_TEXT =
  'I would like to receive MyoGuard clinical continuity emails at my verified ' +
  'email address. These include the Weekly Pulse check-in reminder and the ' +
  'monthly Longitudinal Summary of my recorded protocol data. They are sent on ' +
  'a fixed schedule and may be stopped at any time from this page or from the ' +
  'unsubscribe link in any of these emails. Stopping them does not affect ' +
  'account, security, requested report, or physician workflow messages.';

// ── A. CLINICAL_CONTINUITY is unchanged ──────────────────────────────────────
section('-- A. Existing CLINICAL_CONTINUITY resolution is unchanged --');
{
  const w = wordingForSurface(CLINICAL_CONTINUITY_SURFACE);

  t('[behaviour] the clinical continuity surface resolves', w !== null);
  t('[behaviour] surface name is unchanged',
    CLINICAL_CONTINUITY_SURFACE === 'settings_clinical_continuity');
  t('[safety]    the verbatim text is byte-identical to what C3E shipped',
    w.text === C3E_TEXT);
  t('[safety]    the version is unchanged', w.version === '1.0');
  t('[behaviour] effectiveFrom is unchanged',
    w.effectiveFrom instanceof Date &&
    w.effectiveFrom.toISOString() === '2026-09-15T00:00:00.000Z');

  t('[behaviour] CURRENT_WORDING is still exported (the settings page renders it)',
    typeof CURRENT_WORDING === 'object' && CURRENT_WORDING !== null);
  t('[safety]    CURRENT_WORDING still carries the same text',
    CURRENT_WORDING.text === C3E_TEXT);
  t('[behaviour] CURRENT_WORDING is the clinical continuity wording',
    CURRENT_WORDING === CLINICAL_CONTINUITY_WORDING);

  t('[behaviour] resolveCurrentWordingId is still exported and takes no argument',
    typeof resolveCurrentWordingId === 'function' && resolveCurrentWordingId.length === 0);
  t('[ordering]  resolveCurrentWordingId delegates to the clinical continuity surface',
    /resolveCurrentWordingId[\s\S]{0,200}?resolveWordingIdForSurface\(\s*CLINICAL_CONTINUITY_SURFACE\s*\)/
      .test(WORDING));
}

// ── B. Resolution by surface ─────────────────────────────────────────────────
section('-- B. Wording resolves independently by surface --');
{
  t('[behaviour] resolveWordingIdForSurface is exported and takes a surface',
    typeof resolveWordingIdForSurface === 'function' && resolveWordingIdForSurface.length === 1);
  t('[behaviour] declaredSurfaces lists the declared surfaces',
    Array.isArray(declaredSurfaces()) &&
    declaredSurfaces().includes(CLINICAL_CONTINUITY_SURFACE));
  t('[behaviour] a resolved entry names the surface it was asked for',
    wordingForSurface(CLINICAL_CONTINUITY_SURFACE).surface === CLINICAL_CONTINUITY_SURFACE);
  t('[ordering]  the registry is the single source of declared surfaces',
    /WORDING_REGISTRY/.test(WORDING) &&
    /hasOwnProperty\.call\(\s*WORDING_REGISTRY/.test(WORDING));
}

// ── C. No surface answers for another ────────────────────────────────────────
section('-- C. One surface cannot resolve the wording of another --');
{
  t('[safety] an undeclared surface resolves to null',
    wordingForSurface('settings_something_else') === null);
  t('[safety] the unwritten Protein Guide surface resolves to null',
    wordingForSurface('protein_guide_educational') === null);
  t('[safety] the empty surface resolves to null',
    wordingForSurface('') === null);

  // A bare registry index would return an inherited Object member for these and
  // hand the caller something that is not wording at all.
  for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
    t(`[safety] inherited key ${key} resolves to null`,
      wordingForSurface(key) === null);
  }

  t('[safety] near-miss surfaces do not resolve',
    wordingForSurface('settings_clinical_continuity ') === null &&
    wordingForSurface('Settings_Clinical_Continuity') === null &&
    wordingForSurface('settings_clinical') === null);

  t('[safety] an entry filed under a key it does not name is refused',
    /entry\.surface === surface/.test(WORDING));
}

// ── D. Deterministic versioning ──────────────────────────────────────────────
section('-- D. Versioning is deterministic --');
{
  const a = wordingForSurface(CLINICAL_CONTINUITY_SURFACE);
  const b = wordingForSurface(CLINICAL_CONTINUITY_SURFACE);

  t('[behaviour] repeated resolution returns the same entry', a === b);
  t('[behaviour] repeated resolution returns the same version', a.version === b.version);
  t('[behaviour] repeated resolution returns the same text', a.text === b.text);
  t('[behaviour] version is a semantic pair', /^\d+\.\d+$/.test(a.version));
  t('[safety]    every declared surface has a version and non-empty text',
    declaredSurfaces().every(s => {
      const w = wordingForSurface(s);
      return w && /^\d+\.\d+$/.test(w.version) && typeof w.text === 'string' && w.text.length > 0;
    }));
  t('[safety]    each surface is declared at exactly one version in this build',
    new Set(declaredSurfaces()).size === declaredSurfaces().length);
}

// ── E. Missing wording fails safely ──────────────────────────────────────────
section('-- E. Unconfigured wording fails safely --');
{
  t('[ordering] an undeclared surface is refused before Prisma is imported',
    /if \(!wording\)[\s\S]{0,260}?return null;[\s\S]*?await import\('@\/src\/lib\/prisma'\)/
      .test(WORDING));
  t('[safety]   resolution returns null rather than throwing',
    /: Promise<string \| null>/.test(WORDING) && !/throw new/.test(WORDING));
  t('[safety]   callers cannot supply their own text',
    !/text\s*:\s*(input|args|params)\./.test(WORDING));
  t('[ordering] lazy creation is preserved — read before write',
    /findUnique[\s\S]{0,400}?consentWording\.create/.test(WORDING));
  t('[safety]   no wording is seeded at deploy (creation sits inside a function)',
    !/^\s*await prisma\.consentWording\.create/m.test(WORDING));
  t('[safety]   the unique-constraint race still re-reads rather than failing',
    /catch[\s\S]{0,400}?findUnique/.test(WORDING));
}

// ── F. Protein Guide surface remains unwritten ───────────────────────────────
section('-- F. No Guide surface is declared in this phase --');
{
  t('[safety] exactly one surface is declared in this build',
    declaredSurfaces().length === 1);
  t('[safety] the only declared surface is clinical continuity',
    declaredSurfaces()[0] === CLINICAL_CONTINUITY_SURFACE);
  t('[safety] no placeholder or empty wording is declared',
    !/text:\s*''/.test(WORDING) && !/text:\s*'TBD'/i.test(WORDING));
  t('[safety] no second registry entry exists',
    (WORDING.match(/effectiveFrom:\s*new Date\(/g) || []).length === 1);
}

// ── G. Firewalls this phase must leave closed ────────────────────────────────
section('-- G. EDUCATIONAL and MARKETING remain closed --');
{
  const state = { activeSuppressionReasons: [], preferenceState: 'SUBSCRIBED', recipientVerified: true };

  t('[safety] EDUCATIONAL is still class_not_activated',
    decideFromGovernanceState('EDUCATIONAL', state).policyReason === 'class_not_activated');
  t('[safety] MARKETING is still class_not_activated',
    decideFromGovernanceState('MARKETING', state).policyReason === 'class_not_activated');
  t('[safety] EDUCATIONAL is suppressed, not allowed',
    decideFromGovernanceState('EDUCATIONAL', state).decision === 'SUPPRESS_POLICY');
  t('[safety] MARKETING is suppressed, not allowed',
    decideFromGovernanceState('MARKETING', state).decision === 'SUPPRESS_POLICY');
  t('[safety] only CLINICAL_CONTINUITY is settable from the UI',
    /SETTABLE_CLASSES = \['CLINICAL_CONTINUITY'\]/.test(PREF));
  t('[safety] this phase declares no new capture surface in the preference route',
    !/protein/i.test(PREF));
}

// ── H. Anonymous consent capability is intact ────────────────────────────────
section('-- H. Anonymous consent capability is not broken --');
{
  t('[safety] grantConsent still treats userId as optional',
    /userId\?:\s*string \| null/.test(SVC));
  t('[safety] an anonymous recipient is still created with a null userId',
    /userId:\s*input\.userId \?\? null/.test(SVC));
  t('[safety] grantConsent still requires a wordingId',
    /wordingId:\s*string;/.test(SVC));
  t('[safety] grantConsent still writes the consent ledger',
    /communicationConsentEvent\.create/.test(SVC));
  t('[safety] consent history stays append-only (no update or delete of events)',
    !/communicationConsentEvent\.(update|delete|updateMany|deleteMany)/.test(SVC));
  t('[safety] wording rows are never rewritten in place',
    !/consentWording\.(update|upsert|delete|updateMany|deleteMany)/.test(WORDING));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
