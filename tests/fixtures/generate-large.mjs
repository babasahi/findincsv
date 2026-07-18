#!/usr/bin/env node
/**
 * Generate a large synthetic CSV fixture for e2e/perf testing.
 * Usage: node tests/fixtures/generate-large.mjs [rows] [outfile]
 * Writes to tests/fixtures/generated/ (gitignored) by default.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const FIRST = ['محمد', 'أحمد', 'علي', 'حسن', 'خالد', 'سعيد', 'فاطمة', 'عائشة', 'مريم', 'نور',
  'Saleh', 'Omar', 'Yousef', 'Huda', 'Sara', 'Khalid', 'Mona', 'Rania', 'Tariq', 'Zainab'];
const MIDDLE = ['بن عبدالله', 'محفوظ', 'بن سالم', 'عبد الرحمن', 'الدين', 'Mahfoud', 'Abdulla', 'Salem', '', ''];
const LAST = ['العتيبي', 'الشمري', 'القحطاني', 'الدوسري', 'الهاجري', 'المري', 'النعيمي',
  'Dahi', 'AlFarsi', 'Haddad', 'Najjar', 'Aswad'];
const CITY = ['الرياض', 'جدة', 'الدوحة', 'دبي', 'أبوظبي', 'الكويت', 'المنامة', 'مسقط', 'عمّان', 'القاهرة'];

/** Deterministic PRNG so fixtures are reproducible. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCsv(rows, { needleAt } = {}) {
  const rand = mulberry32(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const lines = ['full_name,city,member_id'];
  for (let i = 0; i < rows; i++) {
    if (needleAt !== undefined && i === needleAt) {
      lines.push('Saleh Mahfoud Dahi,Riyadh,999999');
      continue;
    }
    const name = [pick(FIRST), pick(MIDDLE), pick(LAST)].filter(Boolean).join(' ');
    lines.push(`${name},${pick(CITY)},${100000 + i}`);
  }
  return lines.join('\n') + '\n';
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = Number(process.argv[2] ?? 100_000);
  const out = process.argv[3] ?? join(HERE, 'generated', `large-${rows}.csv`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, generateCsv(rows, { needleAt: Math.floor(rows / 2) }));
  console.log(`wrote ${rows} rows to ${out}`);
}
