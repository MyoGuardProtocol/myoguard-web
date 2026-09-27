/**
 * OTP Render Regression Test
 * ==========================
 * Run against a LOCAL build:
 *   npm run build && npx next start -p 3001
 *   npm run test:otp            (BASE_URL defaults to http://localhost:3001)
 *
 * WHY THIS EXISTS
 * Production P0, 27 September 2026: the email verification code field on the
 * Clerk sign-in "Check your email" screen was invisible and could not be
 * focused on iPhone, Android and desktop. Nothing in this repository changed.
 * Clerk's UI (clerk-js) is loaded from Clerk's CDN at @5, and 5.128.0 replaced
 * six <input> boxes with one real <input data-input-otp> laid over six <div>
 * segments. globals.css still sized every "Clerk input" to 44px, so the real
 * input shrank to a 4px tappable strip, and the segments lost their fill and
 * had only a black 11% edge on a dark card.
 *
 * tests/otp-css-audit.mjs checks the CSS text and passed throughout. This test
 * renders the real Clerk component in a real browser and fails on what a user
 * would see — whatever Clerk's DOM becomes next.
 *
 * HOW IT REACHES THE CODE SCREEN WITHOUT AN ACCOUNT OR A CODE
 * Clerk's Frontend API calls are answered inside the browser: sign-in
 * creation returns a synthetic sign-in whose only factor is email_code,
 * prepare returns an unverified verification, and every attempt is refused
 * with "Incorrect code". No Clerk user is needed, no email is sent, no code is
 * generated, and only the dummy "000000" is ever typed. The page still loads
 * the real clerk-js and the app's real CSS. Refuses to run against anything
 * but localhost.
 *
 * FAILS IF THE OTP CONTROL
 *   - is missing;
 *   - is hidden (display, visibility, opacity);
 *   - has no usable size, or does not span the visible boxes;
 *   - cannot be focused by a tap on ANY visible box;
 *   - has pointer-events disabled;
 *   - shows unreadable digits, caret or box edges (contrast);
 *   - loses its numeric keyboard, one-time-code autofill or screen-reader label;
 *   - shifts the layout when a validation error appears;
 * and if the alternative sign-in method buttons are unreadable.
 */

import { chromium, devices } from 'playwright-core';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';
const host = new URL(BASE_URL).hostname;
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`Refusing to run: BASE_URL must be localhost (got ${host}). This test rewrites Clerk API responses.`);
  process.exit(2);
}

let pass = 0, fail = 0;
const t = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name + (detail ? `  → ${detail}` : '')); }
};

// ── Contrast (WCAG relative luminance), alpha composited over the background ──
const parse = c => { const n = (c.match(/[\d.]+/g) ?? []).map(Number); return c.startsWith('color(srgb') ? { rgb: n.slice(0, 3).map(v => v * 255), a: n[3] ?? 1 } : { rgb: n.slice(0, 3), a: n[3] ?? 1 }; };
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (fg, bg) => { const F = parse(fg), B = parse(bg).rgb; const m = F.rgb.map((v, i) => v * F.a + B[i] * (1 - F.a)); const [x, y] = [lum(m), lum(B)].sort((a, b) => b - a); return (x + 0.05) / (y + 0.05); };
const CARD = 'rgb(13, 20, 33)'; // Midnight Silk card surface #0D1421

// ── Synthetic Clerk sign-in (email_code only) ─────────────────────────────────
const signIn = (verification = null) => ({
  object: 'sign_in_attempt', id: 'sia_otp_regression', status: 'needs_first_factor',
  supported_identifiers: ['email_address'],
  supported_first_factors: [{ strategy: 'email_code', safe_identifier: 'o***@example.com', email_address_id: 'idn_otp_regression', primary: true }],
  supported_second_factors: null, first_factor_verification: verification, second_factor_verification: null,
  identifier: 'otp-regression+clerk_test@example.com', user_data: null, created_session_id: null,
  abandon_at: Date.now() + 864e5, locale: 'en', timezone: 'UTC', client_trust_state: 'new',
});
const VERIFYING = { object: 'verification', status: 'unverified', strategy: 'email_code', attempts: 0, expire_at: Date.now() + 6e5, error: null };

async function openCodeScreen(browser, profile, path) {
  const opts = { ...profile }; delete opts.defaultBrowserType;
  const ctx = await browser.newContext({ ...opts, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const attempts = [];
  let stage = null;
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(/\/v1\/client\/sign_ins/, route => {
    const url = route.request().url();
    if (/attempt_first_factor/.test(url)) {
      attempts.push((new URLSearchParams(route.request().postData() ?? '').get('code') ?? '').length); // length only
      return json(route, { errors: [{ code: 'form_code_incorrect', message: 'Incorrect code', long_message: 'Incorrect code', meta: { param_name: 'code' } }] }, 422);
    }
    stage = /prepare_first_factor/.test(url) ? signIn(VERIFYING) : signIn();
    return json(route, { response: stage, client: null });
  });
  // Keep the synthetic sign-in on any client refresh.
  await page.route(/\/v1\/client(\?|$)/, async route => {
    const resp = await route.fetch();
    const j = await resp.json().catch(() => null);
    if (j?.response && stage) j.response.sign_in = stage;
    return route.fulfill({ response: resp, body: JSON.stringify(j) });
  });
  await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('input[name="identifier"]', { timeout: 90000 });
  await page.fill('input[name="identifier"]', 'otp-regression+clerk_test@example.com');
  await page.click('button.cl-formButtonPrimary');
  await page.waitForSelector('.cl-otpCodeField', { timeout: 30000 });
  await page.waitForTimeout(1200);
  return { ctx, page, attempts, touch: !!opts.hasTouch };
}

// Everything about the control, read from the live DOM.
const snapshot = page => page.evaluate(() => {
  const field = document.querySelector('.cl-otpCodeField');
  const inputs = field ? [...field.querySelectorAll('input')] : [];
  const single = inputs.find(i => i.hasAttribute('data-input-otp')) ?? (inputs.length === 1 ? inputs[0] : null);
  const boxes = single ? [...field.querySelectorAll('.cl-otpCodeFieldInput')] : inputs; // legacy: the inputs are the boxes
  const box = el => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: r.x, y: r.y, w: r.width, h: r.height, display: c.display, visibility: c.visibility, opacity: +c.opacity, pointerEvents: c.pointerEvents, color: c.color, bg: c.backgroundColor, borderW: parseFloat(c.borderTopWidth), borderC: c.borderTopColor, text: el.innerText?.trim() ?? el.value }; };
  const targets = single ? [single] : inputs;
  const hits = boxes.map(b => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return targets.some(t => t === el || t.contains(el)); });
  const cont = document.querySelector('button.cl-formButtonPrimary');
  return {
    found: !!field && targets.length > 0,
    mode: single ? 'single-input' : `legacy-${inputs.length}`,
    input: single ? { ...box(single), autocomplete: single.getAttribute('autocomplete'), inputMode: single.getAttribute('inputmode'), ariaLabel: single.getAttribute('aria-label'), value: single.value } : null,
    boxes: boxes.map(box),
    hits,
    caretBg: (() => { const bar = field?.querySelector('.cl-otpCodeFieldInput [class] > [class]'); return bar ? getComputedStyle(bar).backgroundColor : null; })(),
    continueY: cont ? cont.getBoundingClientRect().y : null,
    focused: targets.includes(document.activeElement),
  };
});

const PROFILES = [
  ['desktop 1280', { viewport: { width: 1280, height: 900 } }],
  ['iPhone 13', devices['iPhone 13']],
  ['Android 320', { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
];
const PATHS = ['/sign-in-new', '/doctor/sign-in'];

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
catch { browser = await chromium.launch({ headless: true }); }

for (const path of PATHS) {
  for (const [name, profile] of PROFILES) {
    console.log(`\n${path} — ${name}`);
    const label = s => `[${path} ${name}] ${s}`;
    const { ctx, page, touch } = await openCodeScreen(browser, profile, path);
    const s = await snapshot(page);

    t(label('OTP control is present'), s.found, JSON.stringify({ mode: s.mode }));
    if (!s.found) { await ctx.close(); continue; }
    const target = s.input ?? s.boxes[0];
    t(label('OTP control is not hidden'), target.display !== 'none' && target.visibility !== 'hidden' && target.opacity > 0, JSON.stringify(target));
    t(label('OTP control has pointer-events'), target.pointerEvents !== 'none', target.pointerEvents);
    t(label('six visible boxes are rendered'), s.boxes.length === 6 && s.boxes.every(b => b.w >= 24 && b.h >= 24 && b.display !== 'none' && b.visibility !== 'hidden' && b.opacity > 0), JSON.stringify(s.boxes.map(b => [Math.round(b.w), Math.round(b.h)])));
    if (s.input) {
      const row = { left: Math.min(...s.boxes.map(b => b.x)), right: Math.max(...s.boxes.map(b => b.x + b.w)) };
      t(label('input spans every box (usable dimensions)'), s.input.x <= row.left + 1 && s.input.x + s.input.w >= row.right - 1 && s.input.h >= 24, `input ${Math.round(s.input.x)}→${Math.round(s.input.x + s.input.w)} vs boxes ${Math.round(row.left)}→${Math.round(row.right)}, h ${Math.round(s.input.h)}`);
      t(label('numeric keyboard and one-time-code autofill'), s.input.inputMode === 'numeric' && s.input.autocomplete === 'one-time-code', `${s.input.inputMode} / ${s.input.autocomplete}`);
      t(label('screen-reader label present'), !!s.input.ariaLabel, s.input.ariaLabel);
    }
    t(label('a tap on EVERY box reaches the input'), s.hits.every(Boolean), JSON.stringify(s.hits));
    const b = s.boxes[1];
    t(label('box edge is visible on the card (≥3:1)'), b.borderW >= 1 && contrast(b.borderC, CARD) >= 3, `${b.borderW}px ${b.borderC} → ${contrast(b.borderC, CARD).toFixed(2)}:1`);

    // Tap the last box, type, check focus, digits and caret.
    await page.locator('.cl-headerTitle').click();
    const last = s.boxes[s.boxes.length - 1];
    if (touch) await page.touchscreen.tap(last.x + last.w / 2, last.y + last.h / 2); else await page.mouse.click(last.x + last.w / 2, last.y + last.h / 2);
    const focusedAfterTap = (await snapshot(page)).focused;
    t(label('tapping a box focuses the input'), focusedAfterTap);
    await page.keyboard.type('000');
    await page.waitForTimeout(300);
    const typed = await snapshot(page);
    const digitBoxes = typed.boxes.filter(x => x.text === '0');
    t(label('typed digits appear in the boxes'), digitBoxes.length === 3, JSON.stringify(typed.boxes.map(x => x.text)));
    t(label('digits are readable (≥4.5:1)'), digitBoxes.length > 0 && digitBoxes.every(x => contrast(x.color, x.bg === 'rgba(0, 0, 0, 0)' ? CARD : x.bg) >= 4.5), digitBoxes.map(x => `${x.color} on ${x.bg}`).join(', '));
    if (s.input) {
      const caretOn = typed.boxes[3]?.bg === 'rgba(0, 0, 0, 0)' ? CARD : typed.boxes[3]?.bg;
      t(label('caret is visible (≥3:1)'), !!typed.caretBg && contrast(typed.caretBg, caretOn) >= 3, `${typed.caretBg} on ${caretOn}`);
    }
    await ctx.close();

    // Empty Continue: refused, error shown, no layout shift.
    { const o = await openCodeScreen(browser, profile, path);
      const before = await snapshot(o.page);
      await o.page.click('button.cl-formButtonPrimary'); await o.page.waitForTimeout(1500);
      const after = await snapshot(o.page);
      const err = await o.page.locator('.cl-otpCodeFieldErrorText').count();
      t(label('Continue with no code submits no digits'), o.attempts.every(n => n === 0), JSON.stringify(o.attempts));
      t(label('validation error is shown'), err > 0);
      t(label('validation error causes no layout shift'), Math.abs(after.continueY - before.continueY) <= 1, `${Math.round(after.continueY - before.continueY)}px`);
      await o.ctx.close(); }

    // Paste the full dummy code.
    { const o = await openCodeScreen(browser, profile, path);
      await o.page.evaluate(() => navigator.clipboard.writeText('000000'));
      await o.page.locator('.cl-otpCodeField input').first().focus();
      await o.page.keyboard.press('Control+V'); await o.page.waitForTimeout(1500);
      t(label('pasting a full code submits all six digits'), o.attempts.includes(6), JSON.stringify(o.attempts));
      await o.ctx.close(); }
  }
}

// Alternative sign-in methods (patient sign-in shows "Use another method").
{ console.log('\n/sign-in-new — alternative methods');
  const o = await openCodeScreen(browser, PROFILES[0][1], '/sign-in-new');
  const link = o.page.getByText('Use another method');
  t('[alt] "Use another method" is visible', await link.isVisible());
  const lc = await link.evaluate(e => getComputedStyle(e).color);
  t('[alt] "Use another method" is readable (≥4.5:1)', contrast(lc, CARD) >= 4.5, `${lc} → ${contrast(lc, CARD).toFixed(2)}:1`);
  await link.click(); await o.page.waitForTimeout(1200);
  const buttons = await o.page.evaluate(() => [...document.querySelectorAll('.cl-alternativeMethodsBlockButton, .cl-socialButtonsBlockButton')].map(b => { const c = getComputedStyle(b); return { text: b.innerText.trim(), color: c.color, bg: c.backgroundColor }; }));
  t('[alt] alternative methods are listed', buttons.length > 0);
  for (const b of buttons) {
    const r = contrast(b.color, b.bg === 'rgba(0, 0, 0, 0)' ? CARD : b.bg);
    t(`[alt] "${b.text.slice(0, 32)}" is readable (≥4.5:1)`, r >= 4.5, `${b.color} on ${b.bg} → ${r.toFixed(2)}:1`);
  }
  const back = o.page.getByText(/^Back$/);
  if (await back.count()) { await back.first().click(); await o.page.waitForTimeout(1000); t('[alt] Back returns to the code screen', (await o.page.locator('.cl-otpCodeField').count()) > 0); }
  await o.ctx.close(); }

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
