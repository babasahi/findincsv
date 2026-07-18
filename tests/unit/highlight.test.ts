import { describe, expect, it } from 'vitest';
import { highlightCell } from '../../src/core';

function marked(cell: { display: string; ranges: { start: number; end: number }[] }): string[] {
  return cell.ranges.map((r) => cell.display.slice(r.start, r.end));
}

describe('highlightCell — exact substrings', () => {
  it('highlights john inside APPLEJOHN at the right offsets', () => {
    const h = highlightCell('APPLEJOHN', ['john'], false);
    expect(marked(h)).toEqual(['JOHN']);
    expect(h.ranges).toEqual([{ start: 5, end: 9 }]);
  });

  it('highlights every occurrence', () => {
    const h = highlightCell('john johnson', ['john'], false);
    expect(marked(h)).toEqual(['john', 'john']);
  });

  it('returns no ranges when nothing matches', () => {
    const h = highlightCell('saleh', ['xavier'], false);
    expect(h.ranges).toEqual([]);
  });
});

describe('highlightCell — Arabic with diacritics', () => {
  it('token محمد highlights the whole original مُحَمَّد including harakat', () => {
    const original = 'مُحَمَّد';
    const h = highlightCell(original, ['محمد'], false);
    expect(h.ranges.length).toBe(1);
    expect(marked(h)[0]).toBe(h.display); // whole decorated name covered
  });

  it('highlights the normalized-equal span inside a longer cell', () => {
    const h = highlightCell('السيد مُحَمَّد بن عبدالله', ['محمد'], false);
    expect(h.ranges.length).toBe(1);
    expect(marked(h)[0]).toBe('مُحَمَّد');
  });

  it('query أحمد highlights احمد spelling and vice versa', () => {
    const h1 = highlightCell('احمد شوقي', ['احمد'], false);
    expect(marked(h1)).toEqual(['احمد']);
    const h2 = highlightCell('أَحْمَد شوقي', ['احمد'], false);
    expect(marked(h2)).toEqual(['أَحْمَد']);
  });
});

describe('highlightCell — fuzzy word highlighting', () => {
  it('highlights the whole fuzzy-matched word (soleh → Saleh)', () => {
    const h = highlightCell('Saleh Mahfoud', ['soleh'], true);
    expect(marked(h)).toEqual(['Saleh']);
  });

  it('does no fuzzy highlighting when fuzzy is off', () => {
    const h = highlightCell('Saleh Mahfoud', ['soleh'], false);
    expect(h.ranges).toEqual([]);
  });

  it('does no fuzzy highlighting for short tokens (k=0)', () => {
    const h = highlightCell('ali hassan', ['alx'], true);
    expect(h.ranges).toEqual([]);
  });
});

describe('highlightCell — range merging', () => {
  it('merges overlapping token ranges', () => {
    const h = highlightCell('applejohn', ['apple', 'applejohn'], false);
    expect(h.ranges).toEqual([{ start: 0, end: 9 }]);
  });

  it('keeps disjoint ranges separate and sorted', () => {
    const h = highlightCell('saleh mahfoud dahi', ['dahi', 'saleh'], false);
    expect(h.ranges).toEqual([
      { start: 0, end: 5 },
      { start: 14, end: 18 },
    ]);
  });
});

describe('highlightCell — display string', () => {
  it('returns an NFC display string that renders like the original', () => {
    const decomposed = 'Sáleh'; // a + combining acute
    const h = highlightCell(decomposed, ['saleh'], false);
    expect(h.display).toBe('Sáleh');
    expect(marked(h)).toEqual([h.display]);
  });
});
