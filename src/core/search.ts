import { normalizeArabic, type NormalizeOptions } from './normalize.ts';
import { tokenize } from './tokenize.ts';
import { rowMatches, type MatchMode } from './match.ts';

export interface SearchOptions {
  /** Typo tolerance (bounded edit distance per token). Default on in the UI. */
  fuzzy: boolean;
  /** Maximum number of row indices returned; the true total is always counted. */
  limit: number;
  /** Exact-step strictness: 'loose' (default), 'prefix', or 'whole' word. */
  matchMode?: MatchMode;
  normalize?: NormalizeOptions;
}

export interface SearchResult {
  /** True total number of matching rows (counted over the whole index). */
  total: number;
  /** Indices of the first `limit` matching rows. */
  indices: number[];
  /** The normalized query tokens actually used (for highlighting). */
  tokens: string[];
}

/**
 * Run a query against a prebuilt index. An empty/whitespace query matches
 * every row (the tool doubles as a plain CSV viewer).
 */
export function searchIndex(
  index: readonly string[],
  query: string,
  { fuzzy, limit, matchMode = 'loose', normalize }: SearchOptions,
): SearchResult {
  const tokens = tokenize(normalizeArabic(query, normalize));
  const indices: number[] = [];
  let total = 0;

  if (tokens.length === 0) {
    total = index.length;
    const cap = Math.min(limit, index.length);
    for (let i = 0; i < cap; i++) indices.push(i);
    return { total, indices, tokens };
  }

  for (let i = 0; i < index.length; i++) {
    if (rowMatches(index[i] as string, tokens, fuzzy, matchMode)) {
      total++;
      if (indices.length < limit) indices.push(i);
    }
  }
  return { total, indices, tokens };
}
