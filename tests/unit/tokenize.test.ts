import { describe, expect, it } from 'vitest';
import { normalizeArabic, tokenize } from '../../src/core';

describe('tokenize', () => {
  it('splits a normalized string on spaces', () => {
    expect(tokenize('saleh dahi')).toEqual(['saleh', 'dahi']);
  });

  it('returns [] for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('composes with normalizeArabic on messy input', () => {
    expect(tokenize(normalizeArabic('  صَالِح   داهي '))).toEqual(['صالح', 'داهي']);
  });

  it('ignores stray empty segments', () => {
    expect(tokenize('a  b')).toEqual(['a', 'b']);
  });
});
