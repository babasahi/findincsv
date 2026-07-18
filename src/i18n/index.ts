import { ar } from './ar';
import { en } from './en';
import type { Locale, Strings } from './types';

export type { Locale, Strings };

const all: Record<Locale, Strings> = { ar, en };

export function getStrings(locale: Locale): Strings {
  return all[locale];
}

/** Fill `{placeholders}` in a string. */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in params ? String(params[key]) : m,
  );
}

/** Numbers shown with Western digits and grouping, per product spec. */
export const numberFormat = new Intl.NumberFormat('en-US');
