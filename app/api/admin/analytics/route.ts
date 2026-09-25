import { NextRequest, NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { isAdminRequest } from '@/app/lib/admin-auth';

type RangeKey = '24h' | '7d' | '30d';

const RANGE_MS: Record<RangeKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

async function ensureSchema(db: D1Database) {
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

function pct(value: number, base: number) {
  return base > 0 ? Math.round((value / base) * 1000) / 10 : 0;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rangeParam = request.nextUrl.searchParams.get('range') as RangeKey | null;
  const range: RangeKey = rangeParam && rangeParam in RANGE_MS ? rangeParam : '24h';
  const from = Date.now() - RANGE_MS[range];

  const db = (env as unknown as { RENDER_DB?: D1Database }).RENDER_DB;
  if (!db) {
    return NextResponse.json({ error: 'analytics_database_unavailable' }, { status: 503 });
  }

  await ensureSchema(db);

  const funnelEvents = [
    'session_started',
    'song_resolve_succeeded',
    'preset_applied',
    'preview_played',
    'render_started',
    'render_succeeded',
    'video_saved',
  ];

  const placeholders = funnelEvents.map(() => '?').join(',');
  const funnelRows = await db.prepare(`
    SELECT event_name, COUNT(DISTINCT session_id) AS sessions
    FROM analytics_events
    WHERE occurred_at >= ? AND event_name IN (${placeholders})
    GROUP BY event_name
  `).bind(from, ...funnelEvents).all<{ event_name: string; sessions: number }>();

  const funnelMap = new Map(
    (funnelRows.results || []).map((row) => [row.event_name, Number(row.sessions || 0)]),
  );

  const funnel = funnelEvents.map((event, index) => {
    const sessions = funnelMap.get(event) || 0;
    const previous = index === 0 ? sessions : funnelMap.get(funnelEvents[index - 1]) || 0;
    return {
      event,
      sessions,
      stepConversion: index === 0 ? 100 : pct(sessions, previous),
      totalConversion: pct(sessions, funnelMap.get('session_started') || 0),
    };
  });

  const summary = await db.prepare(`
    SELECT
      COUNT(DISTINCT session_id) AS sessions,
      SUM(CASE WHEN event_name='render_succeeded' THEN 1 ELSE 0 END) AS renders_ok,
      SUM(CASE WHEN event_name='render_failed' THEN 1 ELSE 0 END) AS renders_failed,
      SUM(CASE WHEN event_name='video_saved' THEN 1 ELSE 0 END) AS saves,
      SUM(CASE WHEN event_name='project_resumed' THEN 1 ELSE 0 END) AS resumes,
      AVG(CASE WHEN event_name='render_succeeded'
        THEN CAST(json_extract(payload_json,'$.duration_ms') AS REAL) END) AS avg_render_ms
    FROM analytics_events
    WHERE occurred_at >= ?
  `).bind(from).first<{
    sessions: number;
    renders_ok: number;
    renders_failed: number;
    saves: number;
    resumes: number;
    avg_render_ms: number | null;
  }>();

  const topPresets = await db.prepare(`
    SELECT
      COALESCE(NULLIF(json_extract(payload_json,'$.preset_id'), ''), 'none') AS preset,
      COUNT(*) AS exports
    FROM analytics_events
    WHERE occurred_at >= ? AND event_name='render_succeeded'
    GROUP BY preset
    ORDER BY exports DESC
    LIMIT 8
  `).bind(from).all<{ preset: string; exports: number }>();

  const topScenes = await db.prepare(`
    SELECT
      COALESCE(NULLIF(json_extract(payload_json,'$.template'), ''), 'unknown') AS scene,
      COUNT(*) AS exports
    FROM analytics_events
    WHERE occurred_at >= ? AND event_name='render_succeeded'
    GROUP BY scene
    ORDER BY exports DESC
    LIMIT 8
  `).bind(from).all<{ scene: string; exports: number }>();

  const performance = await db.prepare(`
    SELECT
      COALESCE(json_extract(payload_json,'$.deviceClass'), 'unknown') AS device,
      AVG(CAST(json_extract(payload_json,'$.fps') AS REAL)) AS avg_fps,
      AVG(CAST(json_extract(payload_json,'$.droppedFrames') AS REAL)) AS avg_dropped,
      COUNT(*) AS samples
    FROM analytics_events
    WHERE occurred_at >= ? AND event_name='preview_performance'
    GROUP BY device
    ORDER BY samples DESC
  `).bind(from).all<{
    device: string;
    avg_fps: number;
    avg_dropped: number;
    samples: number;
  }>();

  const devices = await db.prepare(`
    SELECT
      COALESCE(json_extract(payload_json,'$.device'), 'unknown') AS device,
      COUNT(DISTINCT session_id) AS sessions
    FROM analytics_events
    WHERE occurred_at >= ? AND event_name='session_started'
    GROUP BY device
    ORDER BY sessions DESC
  `).bind(from).all<{ device: string; sessions: number }>();

  const failures = await db.prepare(`
    SELECT
      COALESCE(NULLIF(json_extract(payload_json,'$.reason'), ''), 'Unknown') AS reason,
      COUNT(*) AS count
    FROM analytics_events
    WHERE occurred_at >= ? AND event_name='render_failed'
    GROUP BY reason
    ORDER BY count DESC
    LIMIT 6
  `).bind(from).all<{ reason: string; count: number }>();

  const rendersOk = Number(summary?.renders_ok || 0);
  const rendersFailed = Number(summary?.renders_failed || 0);
  const totalRenders = rendersOk + rendersFailed;

  return NextResponse.json({
    range,
    generatedAt: new Date().toISOString(),
    summary: {
      sessions: Number(summary?.sessions || 0),
      rendersOk,
      rendersFailed,
      renderSuccessRate: pct(rendersOk, totalRenders),
      saves: Number(summary?.saves || 0),
      resumes: Number(summary?.resumes || 0),
      avgRenderMs: Math.round(Number(summary?.avg_render_ms || 0)),
    },
    funnel,
    topPresets: topPresets.results || [],
    topScenes: topScenes.results || [],
    performance: (performance.results || []).map((row) => ({
      device: row.device,
      avgFps: Math.round(Number(row.avg_fps || 0) * 10) / 10,
      avgDropped: Math.round(Number(row.avg_dropped || 0) * 10) / 10,
      samples: Number(row.samples || 0),
    })),
    devices: devices.results || [],
    failures: failures.results || [],
  }, {
    headers: {
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
