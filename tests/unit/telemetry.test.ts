import { describe, expect, it } from 'vitest';
import { scrubEvent, scrubUrl } from '../../src/telemetry/sentry';
import { rowCountBucket, track } from '../../src/telemetry/analytics';

describe('scrubUrl', () => {
  it('keeps only origin and path', () => {
    expect(scrubUrl('https://findincsv.example/tool?q=Saleh+Dahi#row-5')).toBe(
      'https://findincsv.example/tool',
    );
  });

  it('replaces unparseable urls entirely', () => {
    expect(scrubUrl('not a url with Saleh inside')).toBe('[scrubbed]');
  });
});

describe('scrubEvent', () => {
  // A worst-case event where PII leaked into every slot Sentry offers.
  const dirty = () => ({
    message: 'failed while searching for Saleh Dahi',
    breadcrumbs: [{ message: 'user typed: saleh' }],
    user: { ip_address: '1.2.3.4', username: 'saleh' },
    extra: { lastQuery: 'saleh dahi', cellValue: 'صالح محفوظ داهي' },
    tags: { filename: 'employees.csv' },
    request: { url: 'https://findincsv.example/?q=saleh+dahi', headers: { c: 'x' } },
    contexts: {
      browser: { name: 'Chrome', version: '138' },
      os: { name: 'macOS' },
      state: { query: 'saleh' },
    },
    exception: {
      values: [
        {
          type: 'TypeError',
          value: "Cannot read 'صالح محفوظ' of undefined",
          stacktrace: { frames: [{ filename: 'app.js', lineno: 10 }] },
        },
      ],
    },
  });

  it('removes every content-bearing field', () => {
    const out = scrubEvent(dirty());
    const s = JSON.stringify(out);
    expect(s).not.toContain('Saleh');
    expect(s).not.toContain('saleh');
    expect(s).not.toContain('صالح');
    expect(s).not.toContain('employees.csv');
    expect(s).not.toContain('1.2.3.4');
    expect(out.message).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.tags).toBeUndefined();
  });

  it('keeps what debugging needs: type, stack, browser/os', () => {
    const out = scrubEvent(dirty());
    expect(out.exception?.values?.[0]?.type).toBe('TypeError');
    expect(out.exception?.values?.[0]?.stacktrace).toEqual({
      frames: [{ filename: 'app.js', lineno: 10 }],
    });
    expect(out.contexts?.browser).toEqual({ name: 'Chrome', version: '138' });
    expect(out.contexts?.os).toEqual({ name: 'macOS' });
    expect((out.contexts as Record<string, unknown>).state).toBeUndefined();
  });

  it('strips query strings from request urls', () => {
    const out = scrubEvent(dirty());
    expect(out.request).toEqual({ url: 'https://findincsv.example/' });
  });
});

describe('analytics', () => {
  it('buckets row counts so exact figures never leave', () => {
    expect(rowCountBucket(0)).toBe('<1k');
    expect(rowCountBucket(999)).toBe('<1k');
    expect(rowCountBucket(1_000)).toBe('1k-10k');
    expect(rowCountBucket(99_999)).toBe('10k-100k');
    expect(rowCountBucket(500_000)).toBe('100k-1m');
    expect(rowCountBucket(1_000_001)).toBe('>1m');
  });

  it('sends only whitelisted props, dropping anything extra', () => {
    const calls: unknown[] = [];
    (globalThis as { __analyticsClient?: unknown }).__analyticsClient = {
      track: (event: string, props: Record<string, string>) => calls.push([event, props]),
    };
    try {
      // Simulate a bug where extra data is smuggled into props.
      track('file_loaded', { bucket: '10k-100k', smuggled: 'saleh dahi' } as never);
      expect(calls).toEqual([['file_loaded', { bucket: '10k-100k' }]]);
    } finally {
      delete (globalThis as { __analyticsClient?: unknown }).__analyticsClient;
    }
  });

  it('ignores unknown events entirely', () => {
    const calls: unknown[] = [];
    (globalThis as { __analyticsClient?: unknown }).__analyticsClient = {
      track: (...args: unknown[]) => calls.push(args),
    };
    try {
      track('made_up_event' as never, {} as never);
      expect(calls).toEqual([]);
    } finally {
      delete (globalThis as { __analyticsClient?: unknown }).__analyticsClient;
    }
  });

  it('never throws even if the analytics client explodes', () => {
    (globalThis as { __analyticsClient?: unknown }).__analyticsClient = {
      track: () => {
        throw new Error('network down');
      },
    };
    try {
      expect(() => track('engine_error', {})).not.toThrow();
    } finally {
      delete (globalThis as { __analyticsClient?: unknown }).__analyticsClient;
    }
  });
});
