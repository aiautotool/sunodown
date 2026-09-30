import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
/** Match Vite's extensionless imports and @/ alias for Node regression tests. */
export async function resolve(specifier, context, nextResolve) {
  const base = specifier.startsWith('@/')
    ? new URL(specifier.slice(2), root).href
    : specifier.startsWith('.') && context.parentURL
      ? new URL(specifier, context.parentURL).href
      : null;
  if (base) {
    for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
      const url = base + suffix;
      const path = fileURLToPath(url);
      if (existsSync(path) && statSync(path).isFile()) return nextResolve(url, context);
    }
  }
  return nextResolve(specifier, context);
}
