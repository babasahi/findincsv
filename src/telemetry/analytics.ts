/**
 * Analytics wrapper — Mixpanel (free tier), loaded only when
 * PUBLIC_MIXPANEL_TOKEN is configured (see Base layout). Full product
 * analytics: autocapture, pageviews, cookie-based persistent IDs (retention,
 * funnels), IP-based geolocation, exact counts — anything useful for running
 * the business.
 *
 * HARD PRIVACY CONSTRAINT (CLAUDE.md, still non-negotiable): the CSV's cell
 * values, filenames, and the literal text of a search query must NEVER
 * reach this module or Mixpanel. Named events below carry only counts/enums.
 * Session replay stays OFF (see initAnalytics) — the results table renders
 * actual file content on screen, so a recording would leak it even though
 * no structured event does.
 */

type EventSpec = {
  file_loaded: { rowCount: number; columnCount: number };
  search_run: { fuzzy: 'on' | 'off'; resultCount: number };
  fuzzy_toggled: { enabled: 'on' | 'off' };
  whole_word_toggled: { enabled: 'on' | 'off' };
  prefix_toggled: { enabled: 'on' | 'off' };
  scope_changed: { scope: 'all' | 'single' };
  engine_error: Record<string, never>;
};

export type EventName = keyof EventSpec;

const ALLOWED: Record<EventName, readonly string[]> = {
  file_loaded: ['rowCount', 'columnCount'],
  search_run: ['fuzzy', 'resultCount'],
  fuzzy_toggled: ['enabled'],
  whole_word_toggled: ['enabled'],
  prefix_toggled: ['enabled'],
  scope_changed: ['scope'],
  engine_error: [],
};

type PropValue = string | number;
type AnalyticsClient = { track: (event: string, props: Record<string, PropValue>) => void };

/** Overridable for tests. */
export function getAnalyticsClient(): AnalyticsClient | undefined {
  return (globalThis as { __analyticsClient?: AnalyticsClient }).__analyticsClient;
}

/**
 * Record one named event. Unknown events or props are dropped, not sent —
 * the whitelist exists to catch typos/garbage events, not to restrict what
 * business data is worth tracking.
 */
export function track<E extends EventName>(event: E, props: EventSpec[E]): void {
  const allowed = ALLOWED[event] as readonly string[] | undefined;
  if (!allowed) return;
  const clean: Record<string, PropValue> = {};
  for (const key of allowed) {
    const v = (props as Record<string, unknown>)[key];
    if (typeof v === 'string' || typeof v === 'number') clean[key] = v;
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
    autocapture: true,
    track_pageview: true,
    // Stays off regardless of analytics policy — see module doc comment.
    record_sessions_percent: 0,
  });
  mixpanel.register({ locale: document.documentElement.lang });
  (globalThis as { __analyticsClient?: AnalyticsClient }).__analyticsClient = {
    track: (event, props) => mixpanel.track(event, props),
  };
}
