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
 * Match strictness for the exact (non-fuzzy) step:
 * - 'loose' (default): token may appear anywhere, mid-word included.
 * - 'prefix': token must match the start of a whitespace-delimited word.
 * - 'whole': token must equal an entire whitespace-delimited word.
 */
export type MatchMode = 'loose' | 'prefix' | 'whole';

/** Calls `fn(wordStart, wordEnd)` for each whitespace-delimited word in `str`. */
function forEachWord(str: string, fn: (start: number, end: number) => boolean): boolean {
  let wordStart = -1;
  const n = str.length;
  for (let i = 0; i <= n; i++) {
    const atSpace = i === n || str.charCodeAt(i) === SPACE;
    if (!atSpace) {
      if (wordStart < 0) wordStart = i;
    } else if (wordStart >= 0) {
      if (fn(wordStart, i)) return true;
      wordStart = -1;
    }
  }
  return false;
}

function boundedSubstringMatch(indexStr: string, token: string, mode: MatchMode): boolean {
  if (mode === 'loose') return indexStr.includes(token);
  return forEachWord(indexStr, (start, end) => {
    if (mode === 'whole') {
      return end - start === token.length && indexStr.startsWith(token, start);
    }
    return end - start >= token.length && indexStr.startsWith(token, start);
  });
}

/**
 * Does one query token match a row's normalized index string?
 * - substring match always counts first, constrained by `mode` ("john" →
 *   "applejohn" only in 'loose' mode), or
 * - with fuzzy on, the token is within the bounded edit distance of some
 *   whitespace-separated word of the index string (always whole-word,
 *   regardless of `mode`).
 */
export function tokenMatchesIndex(
  indexStr: string,
  token: string,
  fuzzy: boolean,
  mode: MatchMode = 'loose',
): boolean {
  if (boundedSubstringMatch(indexStr, token, mode)) return true;
  if (!fuzzy) return false;
  const k = fuzzyThresholdFor(token.length);
  if (k === 0) return false;

  return forEachWord(
    indexStr,
    (start, end) => boundedLevenshtein(token, indexStr, k, start, end) <= k,
  );
}

/**
 * A row matches iff EVERY token matches its index string — order-independent,
 * with anything allowed between tokens. "saleh dahi" and "dahi saleh" both
 * match "saleh mahfoud dahi".
 */
export function rowMatches(
  indexStr: string,
  tokens: readonly string[],
  fuzzy: boolean,
  mode: MatchMode = 'loose',
): boolean {
  for (const t of tokens) {
    if (!tokenMatchesIndex(indexStr, t, fuzzy, mode)) return false;
  }
  return true;
}
