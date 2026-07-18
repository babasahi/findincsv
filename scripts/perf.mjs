#!/usr/bin/env node
/**
 * Synthetic 1M-row performance check for the search core. Fails (exit 1)
 * when a budget is blown, so CI catches speed regressions.
 *
 * Budgets are looser than the product targets (exact <100ms, fuzzy <500ms on
 * a user machine) because CI runners are slow and shared; the point is to
 * catch order-of-magnitude regressions, not to be a benchmark.
 *
 * Runs on Node >= 22.18 (native TypeScript type-stripping for the imports).
 */
import { buildIndex } from '../src/core/indexer.ts';
import { searchIndex } from '../src/core/search.ts';
import { generateCsv } from '../tests/fixtures/generate-large.mjs';

const ROWS = Number(process.env.PERF_ROWS ?? 1_000_000);
const BUDGET_MS = {
  index: Number(process.env.PERF_BUDGET_INDEX ?? 30_000),
  exact: Number(process.env.PERF_BUDGET_EXACT ?? 500),
  fuzzy: Number(process.env.PERF_BUDGET_FUZZY ?? 2_500),
};

console.log(`generating ${ROWS.toLocaleString()} synthetic rows…`);
const csv = generateCsv(ROWS, { needleAt: Math.floor(ROWS / 2) });
const rows = csv
  .trimEnd()
  .split('\n')
  .slice(1)
  .map((line) => line.split(','));

const time = (label, fn) => {
  const t0 = performance.now();
  const out = fn();
  const ms = performance.now() - t0;
  console.log(`${label}: ${ms.toFixed(0)}ms`);
  return { ms, out };
};

const { ms: indexMs, out: index } = time('build index (all columns)', () =>
  buildIndex(rows, 'all'),
);

const queries = {
  'exact latin (saleh dahi)': { q: 'saleh dahi', fuzzy: false, budget: BUDGET_MS.exact },
  'exact arabic (محمد العتيبي)': { q: 'محمد العتيبي', fuzzy: false, budget: BUDGET_MS.exact },
  'fuzzy latin (soleh dohi)': { q: 'soleh dohi', fuzzy: true, budget: BUDGET_MS.fuzzy },
  'fuzzy arabic (محمود العتيبى)': { q: 'محمود العتيبى', fuzzy: true, budget: BUDGET_MS.fuzzy },
};

let failed = false;
if (indexMs > BUDGET_MS.index) {
  console.error(`✗ index build blew its ${BUDGET_MS.index}ms budget`);
  failed = true;
}

for (const [label, { q, fuzzy, budget }] of Object.entries(queries)) {
  // Warm run then measured run, to keep JIT noise out of the number.
  searchIndex(index, q, { fuzzy, limit: 1000 });
  const { ms, out } = time(label, () => searchIndex(index, q, { fuzzy, limit: 1000 }));
  console.log(`  → ${out.total.toLocaleString()} matches`);
  if (ms > budget) {
    console.error(`✗ "${label}" blew its ${budget}ms budget (${ms.toFixed(0)}ms)`);
    failed = true;
  }
}

// Sanity: the seeded needle must be found.
const needle = searchIndex(index, 'dahi mahfoud saleh', { fuzzy: false, limit: 10 });
if (needle.total < 1) {
  console.error('✗ needle row not found — search correctness regression!');
  failed = true;
}

process.exit(failed ? 1 : 0);
