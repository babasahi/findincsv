import { boundedLevenshtein } from './levenshtein.ts';

/**
 * Fuzzy tolerance by token length: short tokens are exact-only to avoid
 * flooding results; medium tokens allow 1 edit; long tokens allow 2.
 */
export function fuzzyThresholdFor(tokenLength: number): number {
  return tokenLength < 4 ? 0 : tokenLength <= 6 ? 1 : 2;
}

const SPACE = 0x20;

/**
 * Does one query token match a row's normalized index string?
 * - substring match always counts ("john" → "applejohn"), or
 * - with fuzzy on, the token is within the bounded edit distance of some
 *   whitespace-separated word of the index string.
 */
export function tokenMatchesIndex(indexStr: string, token: string, fuzzy: boolean): boolean {
  if (indexStr.includes(token)) return true;
  if (!fuzzy) return false;
  const k = fuzzyThresholdFor(token.length);
  if (k === 0) return false;

  // Scan whitespace-separated words without allocating substrings.
  let wordStart = -1;
  const n = indexStr.length;
  for (let i = 0; i <= n; i++) {
    const atSpace = i === n || indexStr.charCodeAt(i) === SPACE;
    if (!atSpace) {
      if (wordStart < 0) wordStart = i;
    } else if (wordStart >= 0) {
      if (boundedLevenshtein(token, indexStr, k, wordStart, i) <= k) return true;
      wordStart = -1;
    }
  }
  return false;
}

/**
 * A row matches iff EVERY token matches its index string — order-independent,
 * with anything allowed between tokens. "saleh dahi" and "dahi saleh" both
 * match "saleh mahfoud dahi".
 */
export function rowMatches(indexStr: string, tokens: readonly string[], fuzzy: boolean): boolean {
  for (const t of tokens) {
    if (!tokenMatchesIndex(indexStr, t, fuzzy)) return false;
  }
  return true;
}
