export type AnalyticsEventName =
  | 'session_started'
  | 'song_resolve_started'
  | 'song_resolve_succeeded'
  | 'song_resolve_failed'
  | 'preset_applied'
  | 'preview_played'
  | 'manual_edit'
  | 'render_started'
  | 'render_succeeded'
  | 'render_failed'
  | 'video_saved'
  | 'project_saved'
  | 'project_resumed'
  | 'preview_performance';

export type AnalyticsPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

type AnalyticsEvent = {
  version: 1;
  event: AnalyticsEventName;
  eventId: string;
  sessionId: string;
  occurredAt: string;
  path: string;
  payload: AnalyticsPayload;
};

const SESSION_KEY = 'sunodown-v14-analytics-session';
const QUEUE_LIMIT = 40;
const FLUSH_SIZE = 12;

let queue: AnalyticsEvent[] = [];
let flushTimer: number | undefined;

function randomId(prefix: string) {
  const cryptoId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${cryptoId}`;
}

function sessionId() {
  if (typeof window === 'undefined') return 'server';
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = randomId('s');
  sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

function safePath() {
  if (typeof location === 'undefined') return '/';
  return location.pathname.slice(0, 160);
}

function sanitizePayload(payload: AnalyticsPayload) {
  const clean: AnalyticsPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (typeof value === 'string') clean[key] = value.slice(0, 160);
    else clean[key] = value;
  }
  return clean;
}

async function deliver(events: AnalyticsEvent[]) {
  if (!events.length || typeof window === 'undefined') return;
  const body = JSON.stringify({ events });
  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      '/api/analytics',
      new Blob([body], { type: 'application/json' }),
    );
    if (sent) return;
  }
  await fetch('/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
    cache: 'no-store',
  }).catch(() => undefined);
}

export function flushAnalytics() {
  if (typeof window === 'undefined' || !queue.length) return;
  const events = queue.splice(0, FLUSH_SIZE);
  void deliver(events);
  if (queue.length) window.setTimeout(flushAnalytics, 250);
}

export function track(
  event: AnalyticsEventName,
  payload: AnalyticsPayload = {},
) {
  if (typeof window === 'undefined') return;
  queue.push({
    version: 1,
    event,
    eventId: randomId('e'),
    sessionId: sessionId(),
    occurredAt: new Date().toISOString(),
    path: safePath(),
    payload: sanitizePayload(payload),
  });
  if (queue.length > QUEUE_LIMIT) queue = queue.slice(-QUEUE_LIMIT);
  if (queue.length >= FLUSH_SIZE) {
    flushAnalytics();
    return;
  }
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flushAnalytics, 1400);
}

export function initAnalytics() {
  if (typeof window === 'undefined') return () => {};
  track('session_started', {
    device: /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? 'ios'
      : /Android/i.test(navigator.userAgent)
        ? 'android'
        : 'desktop',
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
  });
  const flush = () => flushAnalytics();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', flush);
  return () => {
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', flush);
    flushAnalytics();
  };
}
