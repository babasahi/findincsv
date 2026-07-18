import type { Strings } from './types';

export const en: Strings = {
  siteTitle: 'FindInCSV — Find names in CSV files',
  tagline: 'Find any name inside a large CSV — right in your browser, even when you are not sure how it is spelled.',
  metaDescription:
    'Free tool to search names inside large CSV files with smart Arabic-aware matching: diacritics ignored, alef/hamza forms unified, typo tolerance. Your file never leaves your device.',
  privacyNote: 'Your file never leaves your browser — all processing happens on your device.',

  dropHint: 'Drag and drop a CSV file here, or click to choose one',
  fileMeta: '{name} · {rows} rows · {cols} columns',
  loadAnother: 'Load another file',

  searchPlaceholder: 'Type a name to search… e.g. saleh dahi',
  searchLabel: 'Search',
  columnLabel: 'Search column',
  allColumns: 'All columns',
  columnHint: 'Pick the name column for faster, more precise results.',
  fuzzyLabel: 'Typo tolerance',

  parsing: 'Reading file…',
  indexing: 'Indexing…',
  statusAll: '{total} rows',
  statusMatches: '{total} matches',
  statusCapped: '{total} matches · showing first {shown}',
  noMatches: 'No matches. Try enabling typo tolerance or using fewer words.',
  errorParse: 'Could not read the file. Make sure it is a valid CSV.',

  navTool: 'Tool',
  navBlog: 'Blog',
  footerPrivacy: 'Privacy first: your file is never uploaded and your searches are never logged.',
};
