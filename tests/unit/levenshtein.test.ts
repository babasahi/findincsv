import { describe, expect, it } from 'vitest';
import { boundedLevenshtein } from '../../src/core';

describe('boundedLevenshtein', () => {
  it('computes classic distances within the bound', () => {
    expect(boundedLevenshtein('saleh', 'soleh', 2)).toBe(1);
    expect(boundedLevenshtein('dahi', 'dohi', 2)).toBe(1);
    expect(boundedLevenshtein('kitten', 'sitting', 3)).toBe(3);
    expect(boundedLevenshtein('abc', 'abc', 2)).toBe(0);
  });

  it('returns k+1 when the distance exceeds the bound', () => {
    expect(boundedLevenshtein('abc', 'xyz', 1)).toBe(2);
    expect(boundedLevenshtein('kitten', 'sitting', 2)).toBe(3);
  });

  it('short-circuits on length difference', () => {
    expect(boundedLevenshtein('a', 'abcdef', 1)).toBe(2);
    expect(boundedLevenshtein('abcdef', 'a', 2)).toBe(3);
  });

  it('handles empty strings', () => {
    expect(boundedLevenshtein('', '', 0)).toBe(0);
    expect(boundedLevenshtein('', 'ab', 2)).toBe(2);
    expect(boundedLevenshtein('ab', '', 1)).toBe(2);
  });

  it('works on Arabic strings', () => {
    expect(boundedLevenshtein('صالح', 'صولح', 1)).toBe(1);
    expect(boundedLevenshtein('محمد', 'محمود', 2)).toBe(1); // insert و
    expect(boundedLevenshtein('محمد', 'احمد', 2)).toBe(1); // substitute م→ا
  });

  it('supports slice offsets without allocating substrings', () => {
    const index = 'xx saleh yy';
    expect(boundedLevenshtein('soleh', index, 1, 3, 8)).toBe(1);
    expect(boundedLevenshtein('soleh', index, 1, 0, 2)).toBe(2); // vs "xx"
  });

  it('grows its buffers for long words', () => {
    const long = 'a'.repeat(200);
    expect(boundedLevenshtein(long, long, 2)).toBe(0);
    expect(boundedLevenshtein(long, long.slice(0, 199) + 'b', 2)).toBe(1);
  });
});
