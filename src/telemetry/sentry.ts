/**
 * Sentry wrapper with aggressive scrubbing.
 *
 * HARD PRIVACY CONSTRAINT (CLAUDE.md): only error type, stack frames, timing,
 * browser/OS and app version may reach Sentry. Anything that could carry user
 * content — messages, breadcrumbs, URLs with params, user info, extras — is
 * stripped in `scrubEvent`. Assume every string is PII. If in doubt, send
 * less. The scrub functions are pure and unit-tested
 * (tests/unit/telemetry.test.ts).
 */
import * as Sentry from '@sentry/browser';

const SCRUBBED = '[scrubbed]';

type AnyEvent = {
  message?: unknown;
  breadcrumbs?: unknown;
  user?: unknown;
  extra?: unknown;
  tags?: unknown;
  request?: { url?: string; [k: string]: unknown };
  contexts?: Record<string, unknown>;
  exception?: {
    values?: {
      type?: string;
      value?: string;
      [k: string]: unknown;
    }[];
  };
  [k: string]: unknown;
};

/** Keep only the origin + path of a URL — never query strings or fragments. */
export function scrubUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return SCRUBBED;
  }
}

/**
 * Pure event scrubber applied as `beforeSend`. Whitelist approach: everything
 * not explicitly known-safe is deleted or replaced.
 */
export function scrubEvent<T extends AnyEvent>(event: T): T {
  delete event.message;
  delete event.breadcrumbs;
  delete event.user;
  delete event.extra;
  delete event.tags;

  if (event.request) {
    const url = typeof event.request.url === 'string' ? scrubUrl(event.request.url) : undefined;
    event.request = url ? { url } : {};
  }

  if (event.contexts) {
    const safe: Record<string, unknown> = {};
    for (const key of ['browser', 'os', 'device', 'app'] as const) {
      if (event.contexts[key]) safe[key] = event.contexts[key];
    }
    event.contexts = safe;
  }

  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      // Error messages can embed user content (e.g. a thrown string built
      // from CSV values). Type + stack are enough to debug; the message goes.
      // privacy-lint-allow-next-line — this line overwrites the message with a constant, it never reads or forwards it
      if (ex.value !== undefined) ex.value = SCRUBBED;
    }
  }

  return event;
}

/**
 * Initialize Sentry if a DSN is configured. Safe to call unconditionally —
 * without PUBLIC_SENTRY_DSN this is a no-op and no SDK traffic ever happens.
 */
export function initErrorMonitoring(): void {
  const dsn = import.meta.env.PUBLIC_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    release: import.meta.env.PUBLIC_APP_VERSION as string | undefined,
    sendDefaultPii: false,
    // No replay, no tracing network capture: errors only.
    integrations: [],
    beforeSend: (event) => scrubEvent(event as unknown as AnyEvent) as unknown as typeof event,
    beforeBreadcrumb: () => null, // breadcrumbs can carry console/DOM content
  });
}
