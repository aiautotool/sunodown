import { NextRequest, NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';

const ALLOWED = new Set([
  'session_started',
  'song_resolve_started',
  'song_resolve_succeeded',
  'song_resolve_failed',
  'quick_create_started',
  'suggested_preset_selected',
  'production_recipe_applied',
  'customize_opened',
  'preset_applied',
  'preview_played',
  'manual_edit',
  'render_started',
  'render_stage',
  'render_retry',
  'render_succeeded',
  'render_failed',
  'video_saved',
  'project_saved',
  'project_resumed',
  'preview_performance',
]);

type IncomingEvent = {
  version?: unknown;
  event?: unknown;
  eventId?: unknown;
  sessionId?: unknown;
  occurredAt?: unknown;
  path?: unknown;
  payload?: unknown;
};

type StoredEvent = {
  version: 1;
  event: string;
  eventId: string;
  sessionId: string;
  occurredAt: string;
  path: string;
  payload: Record<string, string | number | boolean | null>;
};

function normalize(event: IncomingEvent): StoredEvent | null {
  if (
    event.version !== 1 ||
    typeof event.event !== 'string' ||
    !ALLOWED.has(event.event) ||
    typeof event.eventId !== 'string' ||
    typeof event.sessionId !== 'string'
  ) return null;

  const payload =
    event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? Object.fromEntries(
          Object.entries(event.payload as Record<string, unknown>)
            .slice(0, 24)
            .filter(([, value]) =>
              ['string', 'number', 'boolean'].includes(typeof value) || value === null,
            )
            .map(([key, value]) => [
              key.slice(0, 60),
              typeof value === 'string' ? value.slice(0, 160) : value,
            ]),
        ) as Record<string, string | number | boolean | null>
      : {};

  return {
    version: 1,
    event: event.event,
    eventId: event.eventId.slice(0, 120),
    sessionId: event.sessionId.slice(0, 120),
    occurredAt:
      typeof event.occurredAt === 'string'
        ? event.occurredAt.slice(0, 40)
        : new Date().toISOString(),
    path: typeof event.path === 'string' ? event.path.slice(0, 160) : '/',
    payload,
  };
}

async function ensureAnalyticsSchema(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      event_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      path TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_occurred
      ON analytics_events(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_event_time
      ON analytics_events(event_name, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_session_time
      ON analytics_events(session_id, occurred_at);
  `);
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json() as { events?: IncomingEvent[] };
    const events = Array.isArray(raw.events)
      ? raw.events.slice(0, 30).map(normalize).filter((event): event is StoredEvent => Boolean(event))
      : [];

    if (events.length) {
      console.log(JSON.stringify({
        type: 'sunodown_analytics_batch',
        receivedAt: new Date().toISOString(),
        events,
      }));

      const db = (env as unknown as { RENDER_DB?: D1Database }).RENDER_DB;
      if (db) {
        await ensureAnalyticsSchema(db);
        const statements = events.map((event) => {
          const timestamp = Number.isFinite(Date.parse(event.occurredAt))
            ? Date.parse(event.occurredAt)
            : Date.now();
          return db.prepare(`
            INSERT OR IGNORE INTO analytics_events
              (event_id, session_id, event_name, occurred_at, path, payload_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            event.eventId,
            event.sessionId,
            event.event,
            timestamp,
            event.path,
            JSON.stringify(event.payload),
          );
        });
        if (statements.length) await db.batch(statements);
      }
    }

    return NextResponse.json({ accepted: events.length }, { status: 202 });
  } catch (error) {
    console.error('analytics ingest failed', error);
    return NextResponse.json({ accepted: 0 }, { status: 202 });
  }
}
