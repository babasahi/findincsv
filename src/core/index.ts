/**
 * The pure search engine. No DOM access anywhere in this directory — it runs
 * in Web Workers, in Node (tests, perf script), and nowhere touches the
 * network. See CLAUDE.md: changes to normalization REQUIRE tests.
 */
export {
  normalizeArabic,
  normalizeWithMap,
  DEFAULT_NORMALIZE_OPTIONS,
  type NormalizeOptions,
  type NormalizedText,
} from './normalize.ts';
export { tokenize } from './tokenize.ts';
export { boundedLevenshtein } from './levenshtein.ts';
export { fuzzyThresholdFor, tokenMatchesIndex, rowMatches, type MatchMode } from './match.ts';
export { makeIndexString, buildIndex, type SearchScope } from './indexer.ts';
export { searchIndex, type SearchOptions, type SearchResult } from './search.ts';
export { highlightCell, type HighlightRange, type HighlightedCell } from './highlight.ts';
