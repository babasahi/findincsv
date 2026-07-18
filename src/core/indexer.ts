import { normalizeArabic, type NormalizeOptions } from './normalize.ts';

/** Search scope: every column joined by a space, or a single column index. */
export type SearchScope = 'all' | number;

/** The normalized index string for one row under the given scope. */
export function makeIndexString(
  row: readonly string[],
  scope: SearchScope,
  options?: NormalizeOptions,
): string {
  const raw = scope === 'all' ? row.join(' ') : (row[scope] ?? '');
  return normalizeArabic(raw, options);
}

/**
 * Build the full index for a scope. Callers that need to keep a UI responsive
 * (the search worker) should instead loop over `makeIndexString` in chunks and
 * report progress; this convenience form is for tests and scripts.
 */
export function buildIndex(
  rows: readonly (readonly string[])[],
  scope: SearchScope,
  options?: NormalizeOptions,
): string[] {
  const out = new Array<string>(rows.length);
  for (let i = 0; i < rows.length; i++) {
    out[i] = makeIndexString(rows[i] as readonly string[], scope, options);
  }
  return out;
}
