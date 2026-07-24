import type { HighlightedCell } from '../core';
import type { SearchScope } from '../core';
import type { MatchMode } from '../core';

/** Messages main thread → engine worker. */
export type ToWorker =
  | { type: 'load'; file: File }
  | { type: 'scope'; scope: SearchScope }
  | {
      type: 'search';
      id: number;
      query: string;
      fuzzy: boolean;
      matchMode: MatchMode;
      limit: number;
    };

/** Messages engine worker → main thread. */
export type FromWorker =
  | { type: 'loaded'; headers: string[]; rowCount: number }
  | { type: 'index-start' }
  | { type: 'index-progress'; done: number; total: number }
  | { type: 'index-done' }
  | {
      type: 'result';
      id: number;
      total: number;
      rowIndices: number[];
      /** Highlighted cells for the returned rows, [row][column]. */
      cells: HighlightedCell[][];
    }
  | { type: 'error'; message: string };
