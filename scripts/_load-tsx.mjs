/**
 * scripts/_load-tsx.mjs
 *
 * Minimal loader shim so `node scripts/*.test.mjs` can import the project's
 * real .tsx components and render them with react-dom/server. Node strips
 * TypeScript types itself but cannot compile JSX; this compiles .tsx only,
 * with the repo's own `typescript` package, and leaves every other file to
 * Node. Pair it with _resolve-ts.mjs, which handles "@/..." and extensionless
 * imports.
 *
 * Usage:
 *   node --import ./scripts/_resolve-ts.mjs --import ./scripts/_load-tsx.mjs scripts/<name>.test.mjs
 */
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    const fileName = fileURLToPath(url);
    const { outputText } = ts.transpileModule(await readFile(fileName, 'utf8'), {
      fileName,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}

register(import.meta.url, pathToFileURL('./'));
