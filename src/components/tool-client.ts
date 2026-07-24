/**
 * Client-side controller for the tool island. All heavy work (parsing,
 * indexing, searching, highlight computation) happens in the engine worker;
 * this file only wires DOM events and renders capped results.
 *
 * SECURITY: CSV values are untrusted. Rendering uses createElement /
 * textContent exclusively — never innerHTML with data.
 */
import type { HighlightedCell } from '../core';
import type { FromWorker, ToWorker } from '../workers/messages';
import { RENDER_CAP, SEARCH_DEBOUNCE_MS } from '../config';
import { format, numberFormat } from '../i18n';
import { track } from '../telemetry/analytics';

/** Runtime strings injected by Tool.astro for the active locale. */
interface RuntimeStrings {
  fileMeta: string;
  parsing: string;
  indexing: string;
  statusAll: string;
  statusMatches: string;
  statusCapped: string;
  noMatches: string;
  errorParse: string;
}

export function initTool(root: HTMLElement): void {
  const strings = JSON.parse(
    root.querySelector('script[data-strings]')?.textContent ?? '{}',
  ) as RuntimeStrings;

  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]')!;
  const fileInput = root.querySelector<HTMLInputElement>('[data-file-input]')!;
  const fileMeta = root.querySelector<HTMLElement>('[data-file-meta]')!;
  const fileMetaText = root.querySelector<HTMLElement>('[data-file-meta-text]')!;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  const searchBox = root.querySelector<HTMLInputElement>('[data-search]')!;
  const columnSelect = root.querySelector<HTMLSelectElement>('[data-column]')!;
  const fuzzyToggle = root.querySelector<HTMLInputElement>('[data-fuzzy]')!;
  const wholeWordToggle = root.querySelector<HTMLInputElement>('[data-whole-word]')!;
  const prefixToggle = root.querySelector<HTMLInputElement>('[data-prefix]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const tableWrap = root.querySelector<HTMLElement>('[data-table-wrap]')!;

  const worker = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), {
    type: 'module',
  });
  const send = (msg: ToWorker): void => worker.postMessage(msg);

  let headers: string[] = [];
  let rowCount = 0;
  let searchId = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // ---------- file loading ----------

  function loadFile(file: File): void {
    status.textContent = strings.parsing;
    tableWrap.replaceChildren();
    send({ type: 'load', file });
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) loadFile(f);
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) loadFile(f);
  });

  // ---------- controls ----------

  function requestSearch(): void {
    searchId++;
    const matchMode = wholeWordToggle.checked ? 'whole' : prefixToggle.checked ? 'prefix' : 'loose';
    send({
      type: 'search',
      id: searchId,
      query: searchBox.value,
      fuzzy: fuzzyToggle.checked,
      matchMode,
      limit: RENDER_CAP,
    });
  }

  function debouncedSearch(): void {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(requestSearch, SEARCH_DEBOUNCE_MS);
  }

  searchBox.addEventListener('input', debouncedSearch);
  fuzzyToggle.addEventListener('change', () => {
    track('fuzzy_toggled', { enabled: fuzzyToggle.checked ? 'on' : 'off' });
    requestSearch();
  });
  wholeWordToggle.addEventListener('change', () => {
    if (wholeWordToggle.checked) prefixToggle.checked = false;
    track('whole_word_toggled', { enabled: wholeWordToggle.checked ? 'on' : 'off' });
    requestSearch();
  });
  prefixToggle.addEventListener('change', () => {
    if (prefixToggle.checked) wholeWordToggle.checked = false;
    track('prefix_toggled', { enabled: prefixToggle.checked ? 'on' : 'off' });
    requestSearch();
  });
  columnSelect.addEventListener('change', () => {
    const v = columnSelect.value;
    track('scope_changed', { scope: v === 'all' ? 'all' : 'single' });
    send({ type: 'scope', scope: v === 'all' ? 'all' : Number(v) });
  });

  // ---------- rendering ----------

  function renderCell(td: HTMLTableCellElement, cell: HighlightedCell): void {
    const { display, ranges } = cell;
    td.dir = 'auto'; // RTL cells align right, LTR cells left, per content
    if (ranges.length === 0) {
      td.textContent = display;
      return;
    }
    let pos = 0;
    for (const r of ranges) {
      if (r.start > pos) td.append(display.slice(pos, r.start));
      const mark = document.createElement('mark');
      mark.textContent = display.slice(r.start, r.end);
      td.append(mark);
      pos = r.end;
    }
    if (pos < display.length) td.append(display.slice(pos));
  }

  function renderTable(cells: HighlightedCell[][]): void {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const h of headers) {
      const th = document.createElement('th');
      th.textContent = h;
      th.dir = 'auto';
      headRow.append(th);
    }
    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    for (const row of cells) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        renderCell(td, cell);
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
    tableWrap.replaceChildren(table);
  }

  // ---------- worker messages ----------

  worker.addEventListener('message', (event: MessageEvent<FromWorker>) => {
    const msg = event.data;
    switch (msg.type) {
      case 'loaded': {
        headers = msg.headers;
        rowCount = msg.rowCount;
        track('file_loaded', { rowCount, columnCount: headers.length });
        const f = fileInput.files?.[0];
        fileMetaText.textContent = format(strings.fileMeta, {
          name: f?.name ?? 'CSV',
          rows: numberFormat.format(rowCount),
          cols: headers.length,
        });
        fileMeta.hidden = false;
        controls.hidden = false;
        columnSelect.replaceChildren(
          ...[
            columnSelect.options[0] as HTMLOptionElement, // "All columns", server-rendered
            ...headers.map((h, i) => {
              const opt = document.createElement('option');
              opt.value = String(i);
              opt.textContent = h;
              return opt;
            }),
          ],
        );
        columnSelect.value = 'all';
        break;
      }
      case 'index-start':
        status.textContent = strings.indexing;
        break;
      case 'index-progress':
        status.textContent = `${strings.indexing} ${Math.round((msg.done / Math.max(msg.total, 1)) * 100)}%`;
        break;
      case 'index-done':
        requestSearch();
        break;
      case 'result': {
        if (msg.id !== searchId) return; // stale
        const isEmptyQuery = searchBox.value.trim().length === 0;
        if (!isEmptyQuery) {
          track('search_run', { fuzzy: fuzzyToggle.checked ? 'on' : 'off', resultCount: msg.total });
        }
        if (msg.total === 0) {
          status.textContent = strings.noMatches;
        } else if (msg.total > msg.rowIndices.length) {
          status.textContent = format(strings.statusCapped, {
            total: numberFormat.format(msg.total),
            shown: numberFormat.format(msg.rowIndices.length),
          });
        } else {
          status.textContent = format(isEmptyQuery ? strings.statusAll : strings.statusMatches, {
            total: numberFormat.format(msg.total),
          });
        }
        renderTable(msg.cells);
        break;
      }
      case 'error':
        track('engine_error', {});
        status.textContent = strings.errorParse;
        break;
    }
  });
}
