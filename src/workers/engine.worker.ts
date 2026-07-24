/// <reference lib="webworker" />
/**
 * The engine worker owns ALL row data: it parses the CSV (off the main
 * thread), builds the per-scope normalized index in chunks, and runs
 * searches. Only headers, counts, and the capped result rows ever cross back
 * to the main thread — so a million-row file is never structurally cloned.
 *
 * PRIVACY: this worker performs no network requests of any kind. Row data,
 * queries, and filenames must never be posted anywhere except back to the
 * page that owns this worker.
 */
import Papa from 'papaparse';
import { highlightCell, makeIndexString, searchIndex, type SearchScope } from '../core';
import type { FromWorker, ToWorker } from './messages';

const post = (msg: FromWorker): void => {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
};

let headers: string[] = [];
let rows: string[][] = [];
let scope: SearchScope = 'all';
let index: string[] = [];
let indexReady = false;
/** Bumped whenever data/scope changes, so a stale chunked build aborts. */
let generation = 0;
/** The latest search asked for while the index was still building. */
let pendingSearch: Extract<ToWorker, { type: 'search' }> | null = null;

const CHUNK = 20_000;

async function rebuildIndex(): Promise<void> {
  const gen = ++generation;
  indexReady = false;
  post({ type: 'index-start' });
  const total = rows.length;
  const next = new Array<string>(total);
  for (let start = 0; start < total; start += CHUNK) {
    const end = Math.min(start + CHUNK, total);
    for (let i = start; i < end; i++) {
      next[i] = makeIndexString(rows[i] as string[], scope);
    }
    post({ type: 'index-progress', done: end, total });
    // Yield so queued messages (scope change, search) can interleave.
    await new Promise((r) => setTimeout(r, 0));
    if (gen !== generation) return; // superseded
  }
  index = next;
  indexReady = true;
  post({ type: 'index-done' });
  if (pendingSearch) {
    const s = pendingSearch;
    pendingSearch = null;
    runSearch(s);
  }
}

function runSearch(msg: Extract<ToWorker, { type: 'search' }>): void {
  const { id, query, fuzzy, matchMode, limit } = msg;
  const { total, indices, tokens } = searchIndex(index, query, { fuzzy, matchMode, limit });
  const cells = indices.map((rowIdx) =>
    (rows[rowIdx] as string[]).map((cell) => highlightCell(cell, tokens, fuzzy, matchMode)),
  );
  post({ type: 'result', id, total, rowIndices: indices, cells });
}

function loadFile(file: File): void {
  generation++;
  headers = [];
  rows = [];
  index = [];
  indexReady = false;
  let firstRow = true;
  // We parse header-less and treat row 0 as headers: arrays are several times
  // lighter than per-row objects at 1M rows, which is what keeps this in RAM.
  Papa.parse<string[]>(file, {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
    chunk: (results) => {
      for (const row of results.data) {
        if (firstRow) {
          headers = row.map((h) => String(h));
          firstRow = false;
        } else {
          rows.push(row);
        }
      }
    },
    complete: () => {
      post({ type: 'loaded', headers, rowCount: rows.length });
      void rebuildIndex();
    },
    error: (err) => {
      // PRIVACY: never include file contents in the message; err.message from
      // PapaParse describes the failure mode, not the data.
      post({ type: 'error', message: err.message });
    },
  });
}

self.addEventListener('message', (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'load':
      loadFile(msg.file);
      break;
    case 'scope':
      scope = msg.scope;
      void rebuildIndex();
      break;
    case 'search':
      if (!indexReady) {
        pendingSearch = msg;
      } else {
        runSearch(msg);
      }
      break;
  }
});
