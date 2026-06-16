/**
 * scripts/smoke-routes.mjs
 *
 * Lightweight route smoke test for MyoGuard Protocol.
 * Tests that critical routes return a non-500 response.
 *
 * Usage:
 *   BASE_URL=https://myoguard.health node scripts/smoke-routes.mjs
 *   npm run smoke                          (uses BASE_URL env or localhost:3000)
 *
 * Protected routes (auth-gated): accepts 200, 302, 307, 308, 401, 403.
 * Public routes: accepts 200.
 * Fails only on 5xx errors or network failure.
 *
 * Does NOT require real credentials, does NOT hit Stripe checkout,
 * does NOT send emails, does NOT create test users.
 */

const BASE_URL = process.env.BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

// Routes to test.
// protected: true → accept any non-5xx (auth redirects are expected)
const ROUTES = [
  { path: '/',                              protected: false },
  { path: '/doctor/sign-in',               protected: false },
  { path: '/doctor/sign-up',               protected: false },
  { path: '/doctor/dashboard',             protected: true  },
  { path: '/doctor/patients',              protected: true  },
  { path: '/doctor/start',                 protected: true  },
  { path: '/doctor/start-sheet',           protected: true  },
  { path: '/doctor/practice-intelligence', protected: true  },
  { path: '/doctor/billing',               protected: true  },
  { path: '/api/health',                   protected: true  },
];

// ANSI colour helpers
const GREEN  = s => `\x1b[32m${s}\x1b[0m`;
const RED    = s => `\x1b[31m${s}\x1b[0m`;
const YELLOW = s => `\x1b[33m${s}\x1b[0m`;
const DIM    = s => `\x1b[2m${s}\x1b[0m`;
const BOLD   = s => `\x1b[1m${s}\x1b[0m`;

const ACCEPTED_AUTH_CODES = new Set([200, 302, 307, 308, 401, 403]);

async function smokeTest(route) {
  const url = `${BASE_URL}${route.path}`;
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual', // don't follow redirects — we want the raw status
      headers: { 'User-Agent': 'MyoGuard-Smoke/1.0' },
      signal: AbortSignal.timeout(10_000),
    });

    const ms = Date.now() - start;
    const status = res.status;
    const isServerError = status >= 500;

    // Protected routes: any non-5xx is acceptable
    // Public routes: 200 is expected; 3xx might indicate a misconfiguration but not a crash
    const ok = route.protected
      ? !isServerError
      : status < 500;

    const statusTag = isServerError
      ? RED(`[${status}]`)
      : ACCEPTED_AUTH_CODES.has(status)
      ? GREEN(`[${status}]`)
      : YELLOW(`[${status}]`);

    const typeTag = route.protected ? DIM('(auth)') : DIM('(pub) ');

    console.log(`  ${ok ? GREEN('✓') : RED('✗')} ${statusTag} ${typeTag} ${route.path} ${DIM(`${ms}ms`)}`);

    return { ok, status, path: route.path };
  } catch (err) {
    const ms = Date.now() - start;
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.log(`  ${RED('✗')} ${RED('[ERR]')} ${DIM('     ')} ${route.path} ${DIM(`${ms}ms`)} — ${isTimeout ? 'timeout' : err.message}`);
    return { ok: false, status: null, path: route.path };
  }
}

async function main() {
  console.log('');
  console.log(BOLD('MyoGuard Protocol — Route Smoke Test'));
  console.log(DIM(`Target: ${BASE_URL}`));
  console.log(DIM(`Routes: ${ROUTES.length}`));
  console.log('');

  // Run all requests (sequential to avoid overwhelming the dev server)
  const results = [];
  for (const route of ROUTES) {
    results.push(await smokeTest(route));
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log('');
  console.log(BOLD('Results'));
  console.log(`  ${GREEN(`${passed} passed`)}  ${failed > 0 ? RED(`${failed} failed`) : DIM('0 failed')}`);

  if (failed > 0) {
    console.log('');
    console.log(RED('FAILED routes:'));
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ${RED('✗')} ${r.path} (status: ${r.status ?? 'network error'})`);
    });
    console.log('');
    process.exit(1);
  }

  console.log('');
  process.exit(0);
}

main().catch(err => {
  console.error(RED('Smoke test runner error:'), err);
  process.exit(1);
});
