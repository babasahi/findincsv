export type Locale = 'ar' | 'en';

/**
 * Every user-facing string in the app. Arabic copy is the primary copy and is
 * written as natural Modern Standard Arabic — refine wording here, never
 * inline in components. `{placeholders}` are filled by `format()`.
 */
export interface Strings {
  siteTitle: string;
  tagline: string;
  metaDescription: string;
  privacyNote: string;

  dropHint: string;
  fileMeta: string; // {name} {rows} {cols}
  loadAnother: string;

  searchPlaceholder: string;
  searchLabel: string;
  columnLabel: string;
  allColumns: string;
  columnHint: string;
  fuzzyLabel: string;
  wholeWordLabel: string;
  wholeWordHint: string;
  prefixLabel: string;
  prefixHint: string;

  parsing: string;
  indexing: string;
  statusAll: string; // {total}
  statusMatches: string; // {total}
  statusCapped: string; // {total} {shown}
  noMatches: string;
  errorParse: string;

  navTool: string;
  navBlog: string;
  footerPrivacy: string;
}
