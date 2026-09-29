import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';

type DurableBinding = {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
};

const EVENTS = new Set(['start', '30s', 'half', 'complete', 'like']);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const namespace = (env as unknown as { MUSIC_DIRECTORY?: DurableBinding })
    .MUSIC_DIRECTORY;

  if (!namespace) {
    return NextResponse.json(
      { error: 'music_directory_unavailable' },
      { status: 503 },
    );
  }

  let body: { songId?: string; event?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const songId = String(body.songId || '');
  const event = String(body.event || '');

  if (!UUID_RE.test(songId) || !EVENTS.has(event)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }

  const stub = namespace.get(namespace.idFromName('global'));
  const response = await stub.fetch('https://music.internal/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ songId, event }),
  });

  const data = await response.json();
  return NextResponse.json(data, {
    status: response.status,
    headers: { 'cache-control': 'no-store' },
  });
}
