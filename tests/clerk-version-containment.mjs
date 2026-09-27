/**
 * Clerk Version Containment
 * =========================
 * Run:  npm run test:clerk-version
 *
 * WHY THIS EXISTS
 * September 2026: the sign-in verification code field broke in production
 * with no MyoGuard commit. @clerk/nextjs loaded clerk-js from Clerk's CDN as
 * clerk-js@5, which Clerk resolves to the newest 5.x, and 5.128.0 changed the
 * OTP DOM. MyoGuard's CSS and tests were fixed against 5.128.0 (f34d3aa), and
 * the versions below are pinned so the sign-in UI changes only when we change
 * them on purpose.
 *
 * In this Clerk generation the sign-in UI is not a separate package: its
 * components (ui-common, signin, …) are chunks of clerk-js, served from the
 * same versioned dist folder. Pinning clerk-js pins them.
 *
 * FAILS IF
 *   - any @clerk/* dependency in package.json is a range, tag or other version;
 *   - package-lock.json declares or resolves a different Clerk version, or a
 *     second copy of any @clerk/* package;
 *   - installed node_modules differ from the lockfile;
 *   - ClerkProvider does not pin clerkJSVersion to exactly 5.128.0, or a second
 *     ClerkProvider exists;
 *   - runtime configuration sets clerkJSUrl, NEXT_PUBLIC_CLERK_JS_URL, a
 *     different NEXT_PUBLIC_CLERK_JS_VERSION, or names a floating clerk-js@;
 *   - the installed SDK would no longer turn the pin into an exact script URL.
 *
 * The rendered browser version is asserted in tests/otp-render.e2e.mjs.
 *
 * TO CHANGE A VERSION
 * Update the constants here, package.json, package-lock.json and
 * CLERK_JS_VERSION in app/layout.tsx together, then run npm run test:otp
 * against a local build before committing.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLERK_JS_VERSION = '5.128.0';
// Direct dependency (package.json) and its locked transitive Clerk packages.
const DIRECT = { '@clerk/nextjs': '6.39.0' };
const LOCKED = {
  '@clerk/nextjs': '6.39.0',
  '@clerk/clerk-react': '5.61.3',
  '@clerk/shared': '3.47.2',
  '@clerk/backend': '2.33.0',
  '@clerk/types': '4.101.20',
};

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; console.log('  FAIL  ' + name + (detail ? `  → ${detail}` : '')); }
};
const EXACT = /^\d+\.\d+\.\d+$/;

// ── 1. package.json ──────────────────────────────────────────────────────────
console.log('\n1. package.json');
const pkg = JSON.parse(read('package.json'));
const declared = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies };
const clerkDeclared = Object.entries(declared).filter(([n]) => n.startsWith('@clerk/'));
t('declares the expected Clerk packages only', JSON.stringify(clerkDeclared.map(([n]) => n).sort()) === JSON.stringify(Object.keys(DIRECT).sort()), JSON.stringify(clerkDeclared));
for (const [name, spec] of clerkDeclared) {
  t(`${name} is an exact version (no ^, ~, tag or range)`, EXACT.test(spec), spec);
  t(`${name} is ${DIRECT[name]}`, spec === DIRECT[name], spec);
}
t('no Clerk override or resolution redirects the pin', !JSON.stringify(pkg.overrides ?? {}).includes('@clerk/') && !JSON.stringify(pkg.resolutions ?? {}).includes('@clerk/'));

// ── 2. package-lock.json ─────────────────────────────────────────────────────
console.log('\n2. package-lock.json');
const lock = JSON.parse(read('package-lock.json'));
const rootDeps = { ...lock.packages?.['']?.dependencies, ...lock.packages?.['']?.devDependencies };
for (const [name, v] of Object.entries(DIRECT)) t(`lockfile root declares ${name} ${v}`, rootDeps[name] === v, rootDeps[name]);
for (const [name, v] of Object.entries(LOCKED)) {
  const entry = lock.packages?.[`node_modules/${name}`];
  t(`lockfile resolves ${name} to ${v}`, entry?.version === v, entry?.version);
  t(`lockfile ${name} comes from the npm registry tarball for ${v}`, entry?.resolved === `https://registry.npmjs.org/${name}/-/${name.split('/')[1]}-${v}.tgz`, entry?.resolved);
}
const allClerkEntries = Object.keys(lock.packages ?? {}).filter(k => /(^|\/)node_modules\/@clerk\/[^/]+$/.test(k));
t('no nested or duplicate @clerk/* copies in the lockfile', allClerkEntries.length === Object.keys(LOCKED).length && allClerkEntries.every(k => k.startsWith('node_modules/@clerk/')), JSON.stringify(allClerkEntries));
t('no clerk-js package is installed from npm (it comes from the pinned CDN URL)', !Object.keys(lock.packages ?? {}).some(k => k.endsWith('@clerk/clerk-js')));

// ── 3. Installed node_modules match the lockfile ─────────────────────────────
console.log('\n3. installed node_modules');
if (existsSync(join(ROOT, 'node_modules/@clerk'))) {
  const installed = Object.fromEntries(readdirSync(join(ROOT, 'node_modules/@clerk'))
    .filter(d => statSync(join(ROOT, 'node_modules/@clerk', d)).isDirectory())
    .map(d => [`@clerk/${d}`, JSON.parse(read(`node_modules/@clerk/${d}/package.json`)).version]));
  t('installed @clerk/* set matches the lockfile', JSON.stringify(Object.keys(installed).sort()) === JSON.stringify(Object.keys(LOCKED).sort()), JSON.stringify(installed));
  for (const [name, v] of Object.entries(LOCKED)) t(`installed ${name} is ${v}`, installed[name] === v, installed[name]);
} else {
  console.log('  SKIP  node_modules not installed');
}

// ── 4. ClerkProvider pins clerk-js ───────────────────────────────────────────
console.log('\n4. ClerkProvider');
const walk = dir => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (['node_modules', '.next', '.git'].includes(e.name) ? [] : walk(join(dir, e.name))) : [join(dir, e.name)]);
const SOURCE = [...walk('app'), ...walk('src')].filter(f => /\.(tsx?|jsx?|mjs)$/.test(f));
const providers = SOURCE.filter(f => /<ClerkProvider[\s>]/.test(read(f)));
t('exactly one ClerkProvider (app/layout.tsx)', providers.length === 1 && providers[0].replace(/\\/g, '/') === 'app/layout.tsx', JSON.stringify(providers));
const layout = read('app/layout.tsx');
const provider = layout.match(/<ClerkProvider([\s\S]*?)>\s*<html/)?.[1] ?? '';
t('ClerkProvider passes clerkJSVersion={CLERK_JS_VERSION}', /\bclerkJSVersion=\{CLERK_JS_VERSION\}/.test(provider), provider.slice(0, 120));
const constants = [...layout.matchAll(/const CLERK_JS_VERSION\s*=\s*["']([^"']*)["']/g)].map(m => m[1]);
t(`CLERK_JS_VERSION is exactly "${CLERK_JS_VERSION}"`, constants.length === 1 && constants[0] === CLERK_JS_VERSION, JSON.stringify(constants));
t('clerk-js pin is an exact x.y.z version', EXACT.test(constants[0] ?? ''), constants[0]);
t('ClerkProvider does not override the script URL (clerkJSUrl)', !/clerkJSUrl/.test(provider));
t('ClerkProvider does not switch to the headless variant (clerkJSVariant)', !/clerkJSVariant/.test(provider));
const e2e = read('tests/otp-render.e2e.mjs').match(/const CLERK_JS_VERSION = '([^']*)'/)?.[1];
t('the OTP browser test expects the same clerk-js version', e2e === CLERK_JS_VERSION, e2e);

// ── 5. No floating version anywhere in runtime configuration ─────────────────
console.log('\n5. runtime configuration');
const CONFIG = ['middleware.ts', 'next.config.ts', 'next.config.js', 'next.config.mjs', 'vercel.json',
  '.env', '.env.example', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']
  .filter(f => existsSync(join(ROOT, f)));
const RUNTIME = [...SOURCE, ...CONFIG];
const hits = (re) => RUNTIME.flatMap(f => read(f).split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => re.test(l)).map(([f, n, l]) => /(^|[\\/])\.env/.test(f) ? `${f}:${n}` : `${f}:${n}: ${l.trim().slice(0, 100)}`)); // never print .env contents
t('no clerkJSUrl or NEXT_PUBLIC_CLERK_JS_URL overrides the pinned script', hits(/clerkJSUrl|NEXT_PUBLIC_CLERK_JS_URL/).length === 0, JSON.stringify(hits(/clerkJSUrl|NEXT_PUBLIC_CLERK_JS_URL/)));
const envVersion = hits(/NEXT_PUBLIC_CLERK_JS_VERSION\s*=/);
t('NEXT_PUBLIC_CLERK_JS_VERSION is unset or equal to the pin', envVersion.every(l => new RegExp(`=\\s*["']?${CLERK_JS_VERSION.replace(/\./g, '\\.')}["']?\\s*$`).test(l)), JSON.stringify(envVersion));
const floating = hits(/clerk-js@(?!\d+\.\d+\.\d+\b)/);
t('no floating clerk-js@<major|tag> reference (e.g. @5, @latest)', floating.length === 0, JSON.stringify(floating));
const otherPins = hits(/clerk-js@\d+\.\d+\.\d+/).filter(l => !l.includes(`clerk-js@${CLERK_JS_VERSION}`));
t('no other exact clerk-js version is referenced', otherPins.length === 0, JSON.stringify(otherPins));
const otherProps = hits(/clerkJSVersion\s*[=:]/).filter(l => !/clerkJSVersion=\{CLERK_JS_VERSION\}/.test(l));
t('clerkJSVersion is set only on the ClerkProvider', otherProps.length === 0, JSON.stringify(otherProps));

// ── 6. The installed SDK turns the pin into an exact asset URL ───────────────
console.log('\n6. installed SDK behaviour');
const merge = read('node_modules/@clerk/nextjs/dist/esm/utils/mergeNextClerkPropsWithEnv.js');
t('@clerk/nextjs gives the clerkJSVersion prop precedence over the env variable', /clerkJSVersion:\s*props\.clerkJSVersion\s*\|\|\s*process\.env\.NEXT_PUBLIC_CLERK_JS_VERSION/.test(merge));
const { clerkJsScriptUrl } = await import('@clerk/shared/loadClerkJsScript');
const pk = 'pk_live_' + Buffer.from('clerk.example.com$').toString('base64');
const pinned = clerkJsScriptUrl({ publishableKey: pk, clerkJSVersion: CLERK_JS_VERSION });
t(`pinned script URL is exactly clerk-js@${CLERK_JS_VERSION}`, pinned === `https://clerk.example.com/npm/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/clerk.browser.js`, pinned);
const unpinned = clerkJsScriptUrl({ publishableKey: pk });
t('control: without the pin the SDK would float (proves the pin is what holds it)', /clerk-js@\d+\/dist/.test(unpinned), unpinned);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
