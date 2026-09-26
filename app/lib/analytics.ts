export type AnalyticsEventName =
  | 'session_started'
  | 'song_resolve_started'
  | 'song_resolve_succeeded'
  | 'song_resolve_failed'
  | 'quick_create_started'
  | 'karaoke_auto_sync_succeeded'
  | 'karaoke_auto_sync_fallback'
  | 'suggested_preset_selected'
  | 'production_recipe_applied'
  | 'customize_opened'
  | 'preset_applied'
  | 'preview_played'
  | 'manual_edit'
  | 'render_started'
  | 'render_stage'
  | 'render_retry'
  | 'render_audio_fallback'
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

const SESSION_KEY = 'sunodown-v16-analytics-session';
const QUEUE_KEY = 'sunodown-v16-analytics-queue';
const QUEUE_LIMIT = 120;
const FLUSH_SIZE = 12;

let queue: AnalyticsEvent[] = [];
let hydrated = false;
let flushing = false;
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

function persistQueue() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_LIMIT)));
  } catch {}
}

function hydrateQueue() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (Array.isArray(stored)) queue = stored.slice(-QUEUE_LIMIT);
  } catch {
    queue = [];
  }
}

async function deliver(events: AnalyticsEvent[]) {
  if (!events.length || typeof window === 'undefined') return true;
  try {
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function flushAnalytics() {
  if (typeof window === 'undefined' || flushing) return;
  hydrateQueue();
  if (!queue.length) return;
  flushing = true;
  try {
    const events = queue.slice(0, FLUSH_SIZE);
    const delivered = await deliver(events);
    if (delivered) {
      queue.splice(0, events.length);
      persistQueue();
      if (queue.length) window.setTimeout(() => void flushAnalytics(), 300);
    } else {
      persistQueue();
      window.setTimeout(() => void flushAnalytics(), 5000);
    }
  } finally {
    flushing = false;
  }
}

export function track(
  event: AnalyticsEventName,
  payload: AnalyticsPayload = {},
) {
  if (typeof window === 'undefined') return;
  hydrateQueue();
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
  persistQueue();
  if (queue.length >= FLUSH_SIZE) {
    void flushAnalytics();
    return;
  }
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flushAnalytics(), 1400);
}

export function initAnalytics() {
  if (typeof window === 'undefined') return () => {};
  hydrateQueue();
  void flushAnalytics();
  track('session_started', {
    device: /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? 'ios'
      : /Android/i.test(navigator.userAgent)
        ? 'android'
        : 'desktop',
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
  });
  const flush = () => void flushAnalytics();
  const online = () => void flushAnalytics();
  window.addEventListener('pagehide', flush);
  window.addEventListener('online', online);
  document.addEventListener('visibilitychange', flush);
  return () => {
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('online', online);
    document.removeEventListener('visibilitychange', flush);
    void flushAnalytics();
  };
}
