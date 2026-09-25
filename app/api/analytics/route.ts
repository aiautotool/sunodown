import { NextRequest, NextResponse } from 'next/server';

const ALLOWED = new Set([
  'session_started',
  'song_resolve_started',
  'song_resolve_succeeded',
  'song_resolve_failed',
  'preset_applied',
  'preview_played',
  'manual_edit',
  'render_started',
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

function normalize(event: IncomingEvent) {
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
        )
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

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json() as { events?: IncomingEvent[] };
    const events = Array.isArray(raw.events)
      ? raw.events.slice(0, 30).map(normalize).filter(Boolean)
      : [];

    if (events.length) {
      // Cloudflare observability is enabled in this deployment. Structured
      // logs give us production funnel/performance data without collecting
      // raw song URLs, titles, lyrics or media.
      console.log(JSON.stringify({
        type: 'sunodown_analytics_batch',
        receivedAt: new Date().toISOString(),
        events,
      }));
    }

    return NextResponse.json({ accepted: events.length }, { status: 202 });
  } catch {
    return NextResponse.json({ accepted: 0 }, { status: 202 });
  }
}
