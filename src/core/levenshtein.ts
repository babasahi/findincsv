/**
 * Bounded Levenshtein distance, tuned for the hot loop of fuzzy search over
 * ~1M rows: length-difference pre-check, early exit when the running row
 * minimum exceeds the bound, and module-level reused buffers (no per-call
 * allocation). Each Worker gets its own module instance, so the shared
 * buffers are safe.
 */

let v0 = new Int32Array(64);
let v1 = new Int32Array(64);

function ensureCapacity(n: number): void {
  if (v0.length < n + 1) {
    v0 = new Int32Array(n + 1);
    v1 = new Int32Array(n + 1);
  }
}

/**
 * Distance between `a` and the slice b[bStart, bEnd), bounded by `k`.
 * Returns the exact distance if it is <= k, otherwise returns k + 1.
 * The slice parameters let callers scan words of a larger index string
 * without allocating substrings.
 */
export function boundedLevenshtein(
  a: string,
  b: string,
  k: number,
  bStart = 0,
  bEnd: number = b.length,
): number {
  const m = a.length;
  const n = bEnd - bStart;
  if (Math.abs(m - n) > k) return k + 1;
  if (m === 0) return n <= k ? n : k + 1;
  if (n === 0) return m <= k ? m : k + 1;

  ensureCapacity(n);
  for (let j = 0; j <= n; j++) v0[j] = j;

  for (let i = 1; i <= m; i++) {
    v1[0] = i;
    let rowMin = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ac === b.charCodeAt(bStart + j - 1) ? 0 : 1;
      const del = (v0[j] as number) + 1;
      const ins = (v1[j - 1] as number) + 1;
      const sub = (v0[j - 1] as number) + cost;
      const best = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      v1[j] = best;
      if (best < rowMin) rowMin = best;
    }
    if (rowMin > k) return k + 1; // no cell can get back under the bound
    const tmp = v0;
    v0 = v1;
    v1 = tmp;
  }
  const d = v0[n] as number;
  return d <= k ? d : k + 1;
}
