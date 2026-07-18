import { normalizeWithMap, type NormalizeOptions } from './normalize.ts';
import { fuzzyThresholdFor } from './match.ts';
import { boundedLevenshtein } from './levenshtein.ts';

/** A half-open [start, end) range into the `display` string. */
export interface HighlightRange {
  start: number;
  end: number;
}

export interface HighlightedCell {
  /**
   * The string the ranges refer to: the NFC form of the original cell, which
   * renders identically to the original. Render THIS text with the ranges.
   */
  display: string;
  /** Merged, sorted ranges to wrap in <mark>. May be empty. */
  ranges: HighlightRange[];
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length <= 1) return ranges;
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const out: HighlightRange[] = [ranges[0] as HighlightRange];
  for (let i = 1; i < ranges.length; i++) {
    const r = ranges[i] as HighlightRange;
    const last = out[out.length - 1] as HighlightRange;
    if (r.start <= last.end) {
      if (r.end > last.end) last.end = r.end;
    } else {
      out.push({ start: r.start, end: r.end });
    }
  }
  return out;
}

/**
 * Compute highlight ranges for one ORIGINAL (un-normalized) cell given the
 * normalized query tokens. Substring occurrences are highlighted exactly;
 * with fuzzy on, whole words within the edit-distance bound are highlighted.
 *
 * The mapping from normalized offsets back to original offsets covers
 * diacritics correctly: token "محمد" over cell "مُحَمَّد" highlights the whole
 * original span, harakat included. Ranges never split the original text in a
 * way that breaks RTL rendering, because they always cover whole source
 * characters (combining marks stay attached to their base letter's range).
 */
export function highlightCell(
  original: string,
  tokens: readonly string[],
  fuzzy: boolean,
  options?: NormalizeOptions,
): HighlightedCell {
  const { norm, source, starts, ends } = normalizeWithMap(original, options);
  const ranges: HighlightRange[] = [];

  const pushRange = (normStart: number, normEnd: number): void => {
    if (normEnd <= normStart) return;
    ranges.push({
      start: starts[normStart] as number,
      end: ends[normEnd - 1] as number,
    });
  };

  for (const token of tokens) {
    if (token.length === 0) continue;

    // Exact (substring) occurrences.
    let from = 0;
    let found = false;
    for (;;) {
      const at = norm.indexOf(token, from);
      if (at < 0) break;
      found = true;
      pushRange(at, at + token.length);
      from = at + 1;
    }

    // Fuzzy: highlight whole words within the bound.
    if (fuzzy && !found) {
      const k = fuzzyThresholdFor(token.length);
      if (k > 0) {
        let wordStart = -1;
        const n = norm.length;
        for (let i = 0; i <= n; i++) {
          const atSpace = i === n || norm.charCodeAt(i) === 0x20;
          if (!atSpace) {
            if (wordStart < 0) wordStart = i;
          } else if (wordStart >= 0) {
            if (boundedLevenshtein(token, norm, k, wordStart, i) <= k) {
              pushRange(wordStart, i);
            }
            wordStart = -1;
          }
        }
      }
    }
  }

  return { display: source, ranges: mergeRanges(ranges) };
}
