import { describe, expect, it } from 'vitest';
import {
  buildIndex,
  fuzzyThresholdFor,
  makeIndexString,
  rowMatches,
  searchIndex,
  tokenMatchesIndex,
} from '../../src/core';

describe('fuzzyThresholdFor', () => {
  it('is 0 for tokens under 4 chars (exact only)', () => {
    expect(fuzzyThresholdFor(1)).toBe(0);
    expect(fuzzyThresholdFor(3)).toBe(0);
  });
  it('is 1 for 4–6 chars', () => {
    expect(fuzzyThresholdFor(4)).toBe(1);
    expect(fuzzyThresholdFor(6)).toBe(1);
  });
  it('is 2 for 7+ chars', () => {
    expect(fuzzyThresholdFor(7)).toBe(2);
    expect(fuzzyThresholdFor(12)).toBe(2);
  });
});

describe('tokenMatchesIndex — substring semantics', () => {
  it('matches loose substrings: john → applejohn', () => {
    expect(tokenMatchesIndex('applejohn smith', 'john', false)).toBe(true);
  });

  it('rejects a token that appears nowhere', () => {
    expect(tokenMatchesIndex('saleh mahfoud dahi', 'xavier', false)).toBe(false);
  });
});

describe('tokenMatchesIndex — fuzzy semantics', () => {
  it('soleh finds saleh with fuzzy on (k=1 at length 5)', () => {
    expect(tokenMatchesIndex('saleh mahfoud dahi', 'soleh', true)).toBe(true);
    expect(tokenMatchesIndex('saleh mahfoud dahi', 'soleh', false)).toBe(false);
  });

  it('dohi finds dahi (k=1 at length 4)', () => {
    expect(tokenMatchesIndex('saleh mahfoud dahi', 'dohi', true)).toBe(true);
  });

  it('short tokens stay exact even with fuzzy on', () => {
    expect(tokenMatchesIndex('ali hassan', 'alx', true)).toBe(false);
  });

  it('allows 2 edits on long tokens', () => {
    // mohammad vs muhammed: 2 substitutions, length 8 → k=2
    expect(tokenMatchesIndex('muhammed ali', 'mohammad', true)).toBe(true);
  });

  it('does not allow 2 edits on medium tokens', () => {
    expect(tokenMatchesIndex('saleh', 'silih', true)).toBe(false); // 2 edits, k=1
  });

  it('is fuzzy per whitespace-separated word, not across the whole string', () => {
    expect(tokenMatchesIndex('ab cd', 'abcd', true)).toBe(false); // k=1, no word within 1
  });
});

describe('tokenMatchesIndex — matchMode strictness', () => {
  it('loose (default) matches alem inside salem', () => {
    expect(tokenMatchesIndex('arafat salem', 'alem', false)).toBe(true);
  });

  it('whole mode rejects alem inside salem, but matches it as its own word', () => {
    expect(tokenMatchesIndex('arafat salem', 'alem', false, 'whole')).toBe(false);
    expect(tokenMatchesIndex('memah abdellahi el alem', 'alem', false, 'whole')).toBe(true);
  });

  it('whole mode rejects el inside elboukhary, but matches it as its own word', () => {
    expect(tokenMatchesIndex('mohamed elboukhary', 'el', false, 'whole')).toBe(false);
    expect(tokenMatchesIndex('el ghazwany mohamed', 'el', false, 'whole')).toBe(true);
  });

  it('prefix mode matches a word start (el → elboukhary) but not a word end (el → daniel)', () => {
    expect(tokenMatchesIndex('mohamed elboukhary', 'el', false, 'prefix')).toBe(true);
    expect(tokenMatchesIndex('daniel smith', 'el', false, 'prefix')).toBe(false);
  });

  it('whole mode is stricter than prefix mode for a partial word', () => {
    expect(tokenMatchesIndex('elboukhary family', 'el', false, 'whole')).toBe(false);
    expect(tokenMatchesIndex('elboukhary family', 'el', false, 'prefix')).toBe(true);
  });

  it('fuzzy fallback stays whole-word regardless of matchMode', () => {
    expect(tokenMatchesIndex('saleh mahfoud dahi', 'soleh', true, 'whole')).toBe(true);
    expect(tokenMatchesIndex('saleh mahfoud dahi', 'soleh', true, 'prefix')).toBe(true);
  });
});

describe('rowMatches — order-independent multi-token', () => {
  const index = makeIndexString(['Saleh Mahfoud Dahi'], 0);

  it('saleh dahi matches Saleh Mahfoud Dahi (middle name skipped)', () => {
    expect(rowMatches(index, ['saleh', 'dahi'], false)).toBe(true);
  });

  it('dahi saleh matches too (order-independent)', () => {
    expect(rowMatches(index, ['dahi', 'saleh'], false)).toBe(true);
  });

  it('every token must match', () => {
    expect(rowMatches(index, ['saleh', 'xavier'], false)).toBe(false);
  });

  it('fuzzy applies per token', () => {
    expect(rowMatches(index, ['soleh', 'dohi'], true)).toBe(true);
    expect(rowMatches(index, ['soleh', 'dohi'], false)).toBe(false);
  });
});

describe('Arabic end-to-end matching', () => {
  const rows = [
    ['مُحَمَّد بن عبدالله', '1970'],
    ['صالح محفوظ داهي', '1985'],
    ['فاطمة الزهراء', '1990'],
    ['علي حسن', '2000'],
  ];
  const index = buildIndex(rows, 'all');

  it('bare query matches fully vocalized data', () => {
    const r = searchIndex(index, 'محمد', { fuzzy: false, limit: 10 });
    expect(r.total).toBe(1);
    expect(r.indices).toEqual([0]);
  });

  it('vocalized query matches bare data', () => {
    const r = searchIndex(index, 'عَلِي', { fuzzy: false, limit: 10 });
    expect(r.indices).toContain(3);
  });

  it('order-independent Arabic first+last name search', () => {
    const r = searchIndex(index, 'داهي صالح', { fuzzy: false, limit: 10 });
    expect(r.indices).toEqual([1]);
  });

  it('alef-maqsura query variant matches (على → علي)', () => {
    const r = searchIndex(index, 'على', { fuzzy: false, limit: 10 });
    expect(r.indices).toContain(3);
  });

  it('ta-marbuta variant matches (فاطمه ↔ فاطمة)', () => {
    const r = searchIndex(index, 'فاطمه', { fuzzy: false, limit: 10 });
    expect(r.indices).toEqual([2]);
  });

  it('Arabic-Indic digits match Western digits in data', () => {
    const r = searchIndex(index, '١٩٨٥', { fuzzy: false, limit: 10 });
    expect(r.indices).toEqual([1]);
  });
});

describe('searchIndex — matchMode (regression: "El Alem" over-matching "Salem")', () => {
  const rows = [
    ['Memah Abdellahi El Alem'], // the genuine match
    ['Abdellahi Mohamed Salem Abdoullah'], // "salem" contains "alem"
    ['Mohamed Mohamed Salem Mohemed Elboukhary'], // "salem" and "elboukhary"
    ['Ely Cheikh Salem Salem'],
  ];
  const index = buildIndex(rows, 'all');

  it('loose mode (default) over-matches Salem rows too', () => {
    const r = searchIndex(index, 'el alem', { fuzzy: false, limit: 10 });
    expect(r.indices).toContain(0);
    expect(r.total).toBeGreaterThan(1);
  });

  it('whole-word mode matches only the genuine "El Alem" row', () => {
    const r = searchIndex(index, 'el alem', { fuzzy: false, limit: 10, matchMode: 'whole' });
    expect(r.indices).toEqual([0]);
    expect(r.total).toBe(1);
  });
});

describe('searchIndex — totals, caps, scope', () => {
  const rows: string[][] = [];
  for (let i = 0; i < 50; i++) rows.push([`name${i}`, 'common']);
  const all = buildIndex(rows, 'all');
  const col0 = buildIndex(rows, 0);

  it('caps returned indices but counts the true total', () => {
    const r = searchIndex(all, 'common', { fuzzy: false, limit: 10 });
    expect(r.total).toBe(50);
    expect(r.indices.length).toBe(10);
  });

  it('empty query matches all rows', () => {
    const r = searchIndex(all, '   ', { fuzzy: false, limit: 5 });
    expect(r.total).toBe(50);
    expect(r.indices).toEqual([0, 1, 2, 3, 4]);
  });

  it('single-column scope excludes other columns', () => {
    const r = searchIndex(col0, 'common', { fuzzy: false, limit: 10 });
    expect(r.total).toBe(0);
  });

  it('missing cells in a scoped column are treated as empty', () => {
    expect(makeIndexString(['only-one-cell'], 3)).toBe('');
  });
});
