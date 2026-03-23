/**
 * OTP CSS Regression Audit
 * ========================
 * Run with:  node tests/otp-css-audit.mjs
 *
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Background
 * ----------
 * The MyoGuard global CSS applies `appearance: none` and
 * `background-color: #ffffff !important` to all inputs to fix iOS dark-mode
 * rendering.  This breaks Clerk's OTP verification code boxes in three ways:
 *
 *   1. appearance:none collapses each digit box's intrinsic size.
 *   2. background-color:white overrides Clerk's transparent OTP box styling.
 *   3. font-size:16px on mobile misaligns Clerk's character grid.
 *
 * A reset block in globals.css counteracts these effects specifically for
 * Clerk inputs.  This script audits that the reset block is present and
 * structurally correct so a future refactor cannot silently remove it.
 *
 * History of regressions this prevents
 * -------------------------------------
 * - commit 0448ad3: first fix — used .cl-otpCodeField input (plain class)
 * - commit 8ca3318: "improved" to [class*="cl-"] input only — regressed because
 *   attribute-value selectors can be processed differently by Lightning CSS
 *   in production vs dev mode, and the plain-class fallback was removed.
 * - current fix: uses all three strategies in parallel (plain class selectors
 *   + direct input class + attribute-value belt-and-suspenders).
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLOBALS_CSS = resolve(__dirname, '../app/globals.css');
const LAYOUT_TSX  = resolve(__dirname, '../app/layout.tsx');

let pass = 0;
let fail = 0;

function check(description, condition, hint = '') {
  if (condition) {
    console.log(`  ✓  ${description}`);
    pass++;
  } else {
    console.error(`  ✗  ${description}`);
    if (hint) console.error(`     → ${hint}`);
    fail++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read files
// ─────────────────────────────────────────────────────────────────────────────
const css    = readFileSync(GLOBALS_CSS, 'utf8');
const layout = readFileSync(LAYOUT_TSX,  'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// 1.  @layer clerk must be declared AFTER @import "tailwindcss"
//     If it comes before, Clerk's CSS gets the LOWEST layer priority and
//     Tailwind preflight rules (border-width:0, border-radius:0) win over
//     Clerk's OTP box borders and border-radius, collapsing them visually.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nglobals.css — @layer order');
{
  const importPos     = css.indexOf('@import "tailwindcss"');
  const layerClerkPos = css.indexOf('@layer clerk');
  check(
    '@import "tailwindcss" exists',
    importPos !== -1,
    'globals.css must import tailwindcss',
  );
  check(
    '@layer clerk is declared AFTER @import "tailwindcss"',
    importPos !== -1 && layerClerkPos !== -1 && layerClerkPos > importPos,
    'Move @layer clerk to after @import "tailwindcss" — if declared first, ' +
    'Clerk gets lowest cascade priority and Tailwind preflight wins.',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  Global input rules must use :not([class*="cl-"]) guards
//     Without these guards, appearance:none and background-color:white
//     are applied to Clerk inputs too, collapsing OTP boxes.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nglobals.css — :not([class*="cl-"]) guards on global input rules');
check(
  'input:not([class*="cl-"]) selector present',
  css.includes('input:not([class*="cl-"])'),
  'Add :not([class*="cl-"]) to every global input selector. Without this guard, ' +
  'Clerk OTP inputs receive appearance:none which collapses their digit boxes.',
);
check(
  'appearance:none is NOT applied globally to all inputs (must be scoped)',
  !css.match(/^input\s*,?\s*\n/m) || !css.match(/^\s*appearance:\s*none/m),
  'The raw `input { ... }` selector without :not() guard must not include ' +
  'appearance:none — this would override Clerk OTP inputs.',
);

// ─────────────────────────────────────────────────────────────────────────────
// 3.  Strategy 1: plain class selectors for Clerk OTP containers
//     These are the most reliable — plain class selectors are never altered
//     by Lightning CSS.  This mirrors the fix from commit 0448ad3.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nglobals.css — Strategy 1: plain class selectors (most reliable)');
check(
  '.cl-otpCodeField input selector present',
  css.includes('.cl-otpCodeField input'),
  'Add .cl-otpCodeField input to the Clerk reset block. This plain class ' +
  'selector is never altered by Lightning CSS and covers the outer OTP container.',
);
check(
  '.cl-otpCodeFieldInputs input selector present',
  css.includes('.cl-otpCodeFieldInputs input'),
  'Add .cl-otpCodeFieldInputs input — this is the immediate flex parent of ' +
  'the digit inputs in Clerk v5 DOM and provides higher specificity.',
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.  Strategy 2: direct input class selector
//     Clerk v5 attaches cl-otpCodeFieldInput directly to each <input>.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nglobals.css — Strategy 2: direct input class');
check(
  '.cl-otpCodeFieldInput selector present',
  css.includes('.cl-otpCodeFieldInput'),
  'Add .cl-otpCodeFieldInput to the reset block — Clerk v5 adds this class ' +
  'directly to each <input> element, enabling per-element targeting.',
);

// ─────────────────────────────────────────────────────────────────────────────
// 5.  Strategy 3: attribute-value belt-and-suspenders
//     Covers future Clerk DOM changes.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nglobals.css — Strategy 3: attribute-value fallback');
check(
  '[class*="cl-"] input selector present',
  css.includes('[class*="cl-"] input'),
  'Keep [class*="cl-"] input as a fallback. It covers any Clerk input inside ' +
  'any cl- prefixed container, regardless of DOM structure changes.',
);

// ─────────────────────────────────────────────────────────────────────────────
// 6.  Reset block must restore appearance: auto !important
//     Without !important, our non-important appearance:none from the global
//     rule (which is unlayered and therefore beats @layer clerk) wins.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nglobals.css — Reset block property values');
check(
  'appearance: auto !important present in reset block',
  css.includes('appearance:         auto !important') ||
  css.includes('appearance: auto !important'),
  'The Clerk reset block must include `appearance: auto !important` to override ' +
  'the non-layered appearance:none from the global input rule.',
);
check(
  'background-color: transparent !important present in reset block',
  css.includes('background-color:   transparent !important') ||
  css.includes('background-color: transparent !important'),
  'The Clerk reset block must include `background-color: transparent !important` ' +
  'to override the white background applied to app inputs.',
);
check(
  'color: inherit !important present in reset block',
  css.includes('color:              inherit !important') ||
  css.includes('color: inherit !important'),
  'The Clerk reset block must include `color: inherit !important` to let ' +
  "Clerk's themed text colour apply.",
);

// ─────────────────────────────────────────────────────────────────────────────
// 7.  layout.tsx — Clerk appearance API must set otpCodeFieldInput
//     The appearance API provides visual polish (font-size, border, etc.)
//     as a first-party Clerk mechanism, independent of CSS cascade fights.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nlayout.tsx — Clerk appearance API');
check(
  'ClerkProvider has appearance prop',
  layout.includes('appearance={{'),
  'Add appearance={{ elements: { otpCodeFieldInput: { ... } } }} to ClerkProvider ' +
  'in layout.tsx to set visual styles via Clerk own API.',
);
check(
  'otpCodeFieldInput element is configured',
  layout.includes('otpCodeFieldInput'),
  'Set appearance.elements.otpCodeFieldInput in ClerkProvider to style OTP boxes ' +
  'via Clerk first-party API.',
);
check(
  'fontSize is set on otpCodeFieldInput',
  layout.includes("fontSize:") && layout.includes("otpCodeFieldInput"),
  "Set fontSize on otpCodeFieldInput so Clerk appearance API controls the digit " +
  'size. This is the first-party override, independent of CSS cascade rules.',
);
check(
  'width/height are NOT overridden on otpCodeFieldInput',
  !layout.includes("width:") || !layout.includes("otpCodeFieldInput:"),
  "Do not set width or height on otpCodeFieldInput via the appearance API. " +
  "Clerk sx system sizes each box via t.space.$10. Overriding without a " +
  'sizing parent collapses the boxes.',
);

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
if (fail === 0) {
  console.log(`✓  All ${pass} checks passed — OTP CSS isolation looks correct.\n`);
  process.exit(0);
} else {
  console.error(`✗  ${fail} check(s) failed, ${pass} passed.\n`);
  console.error(
    '   These rules protect the Clerk OTP digit boxes from being broken\n' +
    '   by global CSS resets.  Do not remove or refactor them without\n' +
    '   manually verifying the OTP form on /sign-up (desktop + iOS Safari).\n',
  );
  process.exit(1);
}
