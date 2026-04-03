/**
 * Next.js Instrumentation Hook
 * Runs once when the server initialises — before handling any request.
 * Uses dynamic import to avoid loading Node-only modules in the Edge runtime.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in the Node.js server runtime (not Edge or browser)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { checkConfig } = await import('./src/lib/config-check');
    checkConfig();
  }
}
