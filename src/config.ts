/**
 * Single source of truth for branding. Renaming the product later must only
 * require editing this file (plus i18n strings that embed the name).
 */
export const BRAND = {
  /** Latin brand name */
  name: 'FindInCSV',
  /** Arabic brand name */
  nameAr: 'فايند إن CSV',
  /** Canonical domain — placeholder until the real domain is registered (SETUP.md). */
  domain: 'findincsv.example',
} as const;

/** Maximum rows rendered in the results table; the true total is always shown. */
export const RENDER_CAP = 1000;

/** Search input debounce in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 200;
