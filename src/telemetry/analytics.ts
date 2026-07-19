/**
 * Analytics wrapper — Mixpanel (free tier), loaded only when
 * PUBLIC_MIXPANEL_TOKEN is configured (see Base layout). Initialized with no
 * persistent identity: no cookies, no localStorage, no IP/geolocation
 * storage, no autocapture, no session replay, no automatic pageviews — only
 * the whitelisted track() calls below ever reach Mixpanel.
 *
 * HARD PRIVACY CONSTRAINT (CLAUDE.md): only the anonymous, content-free
 * events below may ever be recorded. No free-form strings can enter this
 * module's API: event names and prop values are closed unions, and the only
 * numeric input is bucketed before it leaves the function. Never add a
 * parameter that could carry file contents, names, or search text.
 */

export type SizeBucket = '<1k' | '1k-10k' | '10k-100k' | '100k-1m' | '>1m';

type EventSpec = {
  file_loaded: { bucket: SizeBucket };
  search_run: { fuzzy: 'on' | 'off' };
  fuzzy_toggled: { enabled: 'on' | 'off' };
  scope_changed: { scope: 'all' | 'single' };
  engine_error: Record<string, never>;
};

export type EventName = keyof EventSpec;

const ALLOWED: Record<EventName, readonly string[]> = {
  file_loaded: ['bucket'],
  search_run: ['fuzzy'],
  fuzzy_toggled: ['enabled'],
  scope_changed: ['scope'],
  engine_error: [],
};

/** Bucket a size so the exact figure never leaves the device. */
export function rowCountBucket(n: number): SizeBucket {
  if (n < 1_000) return '<1k';
  if (n < 10_000) return '1k-10k';
  if (n < 100_000) return '10k-100k';
  if (n <= 1_000_000) return '100k-1m';
  return '>1m';
}

type AnalyticsClient = { track: (event: string, props: Record<string, string>) => void };

/** Overridable for tests. */
export function getAnalyticsClient(): AnalyticsClient | undefined {
  return (globalThis as { __analyticsClient?: AnalyticsClient }).__analyticsClient;
}

/**
 * Record one whitelisted event. Unknown events or props are dropped, not
 * sent — the whitelist is the contract.
 */
export function track<E extends EventName>(event: E, props: EventSpec[E]): void {
  const allowed = ALLOWED[event] as readonly string[] | undefined;
  if (!allowed) return;
  const clean: Record<string, string> = {};
  for (const key of allowed) {
    const v = (props as Record<string, unknown>)[key];
    if (typeof v === 'string') clean[key] = v;
  }
  try {
    getAnalyticsClient()?.track(event, clean);
  } catch {
    // Analytics must never break the app.
  }
}

/**
 * Initialize Mixpanel if a project token is configured. Safe to call
 * unconditionally — without PUBLIC_MIXPANEL_TOKEN this is a no-op and no SDK
 * traffic (or even the SDK chunk) ever loads.
 */
export async function initAnalytics(): Promise<void> {
  const token = import.meta.env.PUBLIC_MIXPANEL_TOKEN as string | undefined;
  if (!token) return;
  const mixpanel = (await import('mixpanel-browser')).default;
  mixpanel.init(token, {
    autocapture: false,
    ip: false,
    disable_persistence: true,
    track_pageview: false,
    record_sessions_percent: 0,
  });
  (globalThis as { __analyticsClient?: AnalyticsClient }).__analyticsClient = {
    track: (event, props) => mixpanel.track(event, props),
  };
}
