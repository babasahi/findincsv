/**
 * Arabic-first text normalization — the core asset of this product.
 *
 * The normalization table below is applied to BOTH the indexed data and the
 * user's query, so that e.g. "مُحَمَّد", "محمّد" and "محمد" all compare equal.
 *
 * Every rule is individually toggleable and individually unit-tested
 * (tests/unit/normalize.test.ts). Any change here REQUIRES new/updated tests.
 *
 * This module is pure TypeScript with no DOM access so it can run in a Web
 * Worker and be tested exhaustively in Node.
 */

export interface NormalizeOptions {
  /** Strip Latin combining diacritics (NFD + drop U+0300–U+036F): "Sáleh" → "saleh". */
  stripLatinDiacritics?: boolean;
  /** Lowercase (affects Latin; Arabic has no case). */
  lowercase?: boolean;
  /**
   * Strip Arabic tashkeel/harakat (combining marks): U+0610–U+061A,
   * U+064B–U+065F, U+0670, U+06D6–U+06DC, U+06DF–U+06E8, U+06EA–U+06ED.
   */
  stripTashkeel?: boolean;
  /** Strip tatweel/kashida U+0640 (ـ). */
  stripTatweel?: boolean;
  /** Unify alef forms: أ (U+0623), إ (U+0625), آ (U+0622), ٱ (U+0671) → ا (U+0627). */
  unifyAlef?: boolean;
  /** Alef maqsura ى (U+0649) → ي (U+064A). */
  unifyAlefMaqsura?: boolean;
  /** Ta marbuta ة (U+0629) → ه (U+0647). */
  unifyTaMarbuta?: boolean;
  /** Hamza carriers: ؤ (U+0624) → و (U+0648); ئ (U+0626) → ي (U+064A); drop ء (U+0621). */
  unifyHamzaCarriers?: boolean;
  /** Map Arabic-Indic ٠–٩ (U+0660–U+0669) and Eastern ۰–۹ (U+06F0–U+06F9) digits → 0–9. */
  unifyDigits?: boolean;
  /** Collapse whitespace runs to a single space and trim. */
  collapseWhitespace?: boolean;
}

export const DEFAULT_NORMALIZE_OPTIONS: Required<NormalizeOptions> = {
  stripLatinDiacritics: true,
  lowercase: true,
  stripTashkeel: true,
  stripTatweel: true,
  unifyAlef: true,
  unifyAlefMaqsura: true,
  unifyTaMarbuta: true,
  unifyHamzaCarriers: true,
  unifyDigits: true,
  collapseWhitespace: true,
};

/** Result of normalizing while keeping a map back to the source string. */
export interface NormalizedText {
  /** The normalized string. */
  norm: string;
  /**
   * The NFC-normalized source the offsets refer to. Visually identical to the
   * input; display THIS string when using the offsets below.
   */
  source: string;
  /** starts[j] = UTF-16 index in `source` of the char that produced norm[j]. */
  starts: number[];
  /** ends[j] = exclusive UTF-16 end index in `source` for norm[j]. */
  ends: number[];
}

function isTashkeel(cp: number): boolean {
  return (
    (cp >= 0x0610 && cp <= 0x061a) ||
    (cp >= 0x064b && cp <= 0x065f) ||
    cp === 0x0670 ||
    (cp >= 0x06d6 && cp <= 0x06dc) ||
    (cp >= 0x06df && cp <= 0x06e8) ||
    (cp >= 0x06ea && cp <= 0x06ed)
  );
}

const WHITESPACE_RE = /\s/;

/**
 * Core normalizer. When `withMap` is false the map arrays stay empty, which is
 * markedly faster — index building over ~1M rows uses that path.
 */
function normalizeCore(input: string, opts: Required<NormalizeOptions>, withMap: boolean): NormalizedText {
  const source = input.normalize('NFC');
  let norm = '';
  const starts: number[] = [];
  const ends: number[] = [];

  // Whitespace-run state for collapseWhitespace.
  let pendingSpaceAt = -1; // source index of the first whitespace in the current run
  let idx = 0; // UTF-16 index into source of the current code point

  const emit = (chars: string, srcStart: number, srcEnd: number): void => {
    if (chars.length === 0) return;
    if (pendingSpaceAt >= 0) {
      if (norm.length > 0) {
        norm += ' ';
        if (withMap) {
          starts.push(pendingSpaceAt);
          ends.push(pendingSpaceAt + 1);
        }
      }
      pendingSpaceAt = -1;
    }
    norm += chars;
    if (withMap) {
      for (let i = 0; i < chars.length; i++) {
        starts.push(srcStart);
        ends.push(srcEnd);
      }
    }
  };

  for (const c of source) {
    const start = idx;
    const len = c.length; // 2 for surrogate pairs
    idx += len;
    const cp = c.codePointAt(0) as number;

    // ---- whitespace ----
    if (WHITESPACE_RE.test(c)) {
      if (opts.collapseWhitespace) {
        if (pendingSpaceAt < 0) pendingSpaceAt = start;
      } else {
        emit(c, start, start + len);
      }
      continue;
    }

    // ---- ASCII fast path ----
    if (cp < 0x80) {
      let out = c;
      if (opts.lowercase && cp >= 0x41 && cp <= 0x5a) out = String.fromCharCode(cp + 32);
      emit(out, start, start + len);
      continue;
    }

    // ---- Arabic-specific rules (checked before generic decomposition,
    //      because e.g. أ would otherwise NFD-decompose to ا + U+0654) ----
    if (opts.stripTashkeel && isTashkeel(cp)) continue;
    if (opts.stripTatweel && cp === 0x0640) continue;
    if (opts.unifyAlef && (cp === 0x0623 || cp === 0x0625 || cp === 0x0622 || cp === 0x0671)) {
      emit('ا', start, start + len);
      continue;
    }
    if (opts.unifyAlefMaqsura && cp === 0x0649) {
      emit('ي', start, start + len);
      continue;
    }
    if (opts.unifyTaMarbuta && cp === 0x0629) {
      emit('ه', start, start + len);
      continue;
    }
    if (opts.unifyHamzaCarriers) {
      if (cp === 0x0624) {
        emit('و', start, start + len);
        continue;
      }
      if (cp === 0x0626) {
        emit('ي', start, start + len);
        continue;
      }
      if (cp === 0x0621) continue; // standalone hamza dropped
    }
    if (opts.unifyDigits) {
      if (cp >= 0x0660 && cp <= 0x0669) {
        emit(String.fromCharCode(0x30 + (cp - 0x0660)), start, start + len);
        continue;
      }
      if (cp >= 0x06f0 && cp <= 0x06f9) {
        emit(String.fromCharCode(0x30 + (cp - 0x06f0)), start, start + len);
        continue;
      }
    }

    // ---- generic path: Latin diacritics + lowercase ----
    let out = c;
    if (opts.stripLatinDiacritics) {
      const d = c.normalize('NFD');
      if (d.length > 1) {
        let kept = '';
        for (const dc of d) {
          const dcp = dc.codePointAt(0) as number;
          if (dcp >= 0x0300 && dcp <= 0x036f) continue;
          kept += dc;
        }
        // Recompose whatever marks survived so toggled-off rules stay stable.
        out = kept.normalize('NFC');
      }
    }
    if (opts.lowercase) out = out.toLowerCase();
    emit(out, start, start + len);
  }

  return { norm, source, starts, ends };
}

/** Normalize a string for matching. Defaults are the shipping defaults. */
export function normalizeArabic(s: string, options?: NormalizeOptions): string {
  const opts = options ? { ...DEFAULT_NORMALIZE_OPTIONS, ...options } : DEFAULT_NORMALIZE_OPTIONS;
  return normalizeCore(s, opts, false).norm;
}

/** Normalize while keeping offsets back to the (NFC) source — used for highlighting. */
export function normalizeWithMap(s: string, options?: NormalizeOptions): NormalizedText {
  const opts = options ? { ...DEFAULT_NORMALIZE_OPTIONS, ...options } : DEFAULT_NORMALIZE_OPTIONS;
  return normalizeCore(s, opts, true);
}
