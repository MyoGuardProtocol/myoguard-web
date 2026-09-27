/**
 * scripts/_resolve-ts.mjs
 *
 * Minimal module-resolution shim so `node scripts/*.test.mjs` can import the
 * project's real TypeScript modules (Node 24 strips the types itself).
 *
 * Two gaps it closes, both purely about how Node finds files:
 *   • the "@/..." tsconfig path alias
 *   • extensionless relative imports ("../tokens" → "../tokens.ts")
 *
 * Resolution only. It never transforms code, so tests still exercise the
 * shipped modules exactly as the application imports them.
 *
 * Usage:
 *   node --import ./scripts/_resolve-ts.mjs scripts/<name>.test.mjs
 */
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);

const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.js', '/index.ts', '/index.js'];

function firstExisting(baseHref) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const href = baseHref + suffix;
    try {
      if (existsSync(fileURLToPath(href))) return href;
    } catch {
      /* not a file URL — fall through */
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // "server-only" marks a module as never shippable to a browser. Next.js
  // resolves it under the "react-server" condition to an empty module on the
  // server and fails the build if a client component imports it. These tests
  // run as the server, so they resolve it the same way.
  if (specifier === 'server-only') {
    return nextResolve(specifier, { ...context, conditions: [...(context.conditions ?? []), 'react-server'] });
  }

  // "next/link", "next/navigation" … are CommonJS entry files at the package
  // root ("next/link.js"). Bundlers add the extension; Node's ESM resolver
  // does not, so add it here.
  if (/^next\/[a-z-]+$/.test(specifier)) {
    try { return await nextResolve(specifier, context); } catch { return nextResolve(specifier + '.js', context); }
  }

  // "@/x/y" → <repo root>/x/y
  if (specifier.startsWith('@/')) {
    const hit = firstExisting(new URL(specifier.slice(2), ROOT).href);
    if (hit) return nextResolve(hit, context);
  }

  // "./x" or "../x" with no extension → try the TS/JS variants
  if (specifier.startsWith('.') && context.parentURL) {
    const hit = firstExisting(new URL(specifier, context.parentURL).href);
    if (hit) return nextResolve(hit, context);
  }

  return nextResolve(specifier, context);
}

register(import.meta.url, pathToFileURL('./'));
