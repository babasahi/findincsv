#!/usr/bin/env node
/**
 * Privacy lint — enforced in CI, required for merge.
 *
 * The product promise is "your file never leaves your browser". This check
 * fails the build if:
 *   1. Telemetry code (src/telemetry/**) references identifiers that could
 *      carry user content (queries, cells, rows, filenames, input values).
 *   2. Any code OUTSIDE src/telemetry imports the Sentry SDK or calls
 *      plausible directly — all telemetry must go through the scrubbed
 *      wrappers.
 *   3. Worker/core code (which touches file data) performs network calls.
 *
 * If you hit a false positive, do NOT weaken a pattern casually — see
 * CLAUDE.md; privacy rules outrank features.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const TELEMETRY_DIR = join(SRC, 'telemetry');

/** Patterns that suggest user content flowing into telemetry code. */
const FORBIDDEN_IN_TELEMETRY = [
  /\bquer(y|ies)\b/i,
  /\bcells?\b/i,
  /\brow\s*\[/,
  /\browData\b/i,
  /\bfile\s*\.\s*name\b/i,
  /\bfile_?name\b/i,
  /\bsearchTerm\b/i,
  /\.value\b/,
  /\binnerText\b/,
  /\btextContent\b/,
  /localStorage|sessionStorage|document\.cookie/,
];

/** Network primitives forbidden in code that touches file data. */
const FORBIDDEN_NETWORK = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /navigator\s*\.\s*sendBeacon/,
  /new\s+EventSource/,
];

const DATA_DIRS = [join(SRC, 'core'), join(SRC, 'workers')];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|js|mjs|astro)$/.test(name)) yield p;
  }
}

/**
 * Remove comments, plus any line preceded by a `privacy-lint-allow-next-line`
 * marker. The marker is for lines that DESTROY data (e.g. the scrubber
 * overwriting an error message) — never for lines that read or send it. Each
 * marker must carry a justification and survives review like any other code.
 */
function stripComments(code) {
  const lines = code.split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && /privacy-lint-allow-next-line/.test(lines[i - 1])) {
      kept.push('');
    } else {
      kept.push(lines[i]);
    }
  }
  return kept.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const failures = [];

// 1. Telemetry code must not reference content-bearing identifiers.
for (const file of walk(TELEMETRY_DIR)) {
  const code = stripComments(readFileSync(file, 'utf8'));
  for (const re of FORBIDDEN_IN_TELEMETRY) {
    const m = code.match(re);
    if (m) {
      failures.push(`${relative(ROOT, file)}: forbidden pattern ${re} ("${m[0]}")`);
    }
  }
}

// 2. Sentry/plausible only through the wrappers.
for (const file of walk(SRC)) {
  if (file.startsWith(TELEMETRY_DIR)) continue;
  const code = stripComments(readFileSync(file, 'utf8'));
  if (/@sentry\//.test(code)) {
    failures.push(`${relative(ROOT, file)}: imports Sentry directly — use src/telemetry/sentry.ts`);
  }
  if (/\bplausible\s*\(/.test(code)) {
    failures.push(`${relative(ROOT, file)}: calls plausible directly — use src/telemetry/analytics.ts`);
  }
}

// 3. Core/worker code (handles file data) must not touch the network.
for (const dir of DATA_DIRS) {
  for (const file of walk(dir)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const re of FORBIDDEN_NETWORK) {
      const m = code.match(re);
      if (m) {
        failures.push(`${relative(ROOT, file)}: network primitive ${re} ("${m[0]}") in data-handling code`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('✗ privacy-lint failed:\n');
  for (const f of failures) console.error('  - ' + f);
  console.error('\nSee CLAUDE.md — telemetry must never touch file/row/query data.');
  process.exit(1);
}

console.log('✓ privacy-lint passed');
