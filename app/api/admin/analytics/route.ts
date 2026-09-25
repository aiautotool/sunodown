import { NextRequest, NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { isAdminRequest } from '@/app/lib/admin-auth';

type RangeKey = '24h' | '7d' | '30d';
type Row = {
  event_name: string;
  session_id: string;
  payload_json: string;
};

const RANGE_MS: Record<RangeKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const FUNNEL = [
  'session_started',
  'song_resolve_succeeded',
  'preset_applied',
  'preview_played',
  'render_started',
  'render_succeeded',
  'video_saved',
] as const;

function pct(value: number, base: number) {
  return base > 0 ? Math.round((value / base) * 1000) / 10 : 0;
}

function payload(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function ensureSchema(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      event_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      path TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
  `).run();
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_analytics_occurred ON analytics_events(occurred_at)',
  ).run();
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_analytics_event_time ON analytics_events(event_name, occurred_at)',
  ).run();
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401, headers: { 'cache-control': 'no-store' } },
      );
    }

    const rangeParam = new URL(request.url).searchParams.get('range') as RangeKey | null;
    const range: RangeKey = rangeParam && rangeParam in RANGE_MS ? rangeParam : '24h';
    const from = Date.now() - RANGE_MS[range];

    const db = (env as unknown as { RENDER_DB?: D1Database }).RENDER_DB;
    if (!db) {
      return NextResponse.json(
        { error: 'analytics_database_unavailable' },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      );
    }

    await ensureSchema(db);
    const result = await db.prepare(`
      SELECT event_name, session_id, payload_json
      FROM analytics_events
      WHERE occurred_at >= ?
      ORDER BY occurred_at DESC
      LIMIT 50000
    `).bind(from).all<Row>();

    const rows = result.results || [];
    const funnelSessions = new Map<string, Set<string>>();
    for (const name of FUNNEL) funnelSessions.set(name, new Set());

    const allSessions = new Set<string>();
    const presetExports = new Map<string, number>();
    const sceneExports = new Map<string, number>();
    const deviceSessions = new Map<string, Set<string>>();
    const perf = new Map<string, { fps: number; dropped: number; samples: number }>();
    const failures = new Map<string, number>();

    let rendersOk = 0;
    let rendersFailed = 0;
    let saves = 0;
    let resumes = 0;
    let renderDurationTotal = 0;
    let renderDurationSamples = 0;

    for (const row of rows) {
      allSessions.add(row.session_id);
      funnelSessions.get(row.event_name)?.add(row.session_id);
      const data = payload(row.payload_json);

      if (row.event_name === 'session_started') {
        const device = typeof data.device === 'string' ? data.device : 'unknown';
        if (!deviceSessions.has(device)) deviceSessions.set(device, new Set());
        deviceSessions.get(device)!.add(row.session_id);
      }

      if (row.event_name === 'render_succeeded') {
        rendersOk += 1;
        const duration = Number(data.duration_ms);
        if (Number.isFinite(duration) && duration >= 0) {
          renderDurationTotal += duration;
          renderDurationSamples += 1;
        }
        const preset =
          typeof data.preset_id === 'string' && data.preset_id ? data.preset_id : 'none';
        const scene =
          typeof data.template === 'string' && data.template ? data.template : 'unknown';
        presetExports.set(preset, (presetExports.get(preset) || 0) + 1);
        sceneExports.set(scene, (sceneExports.get(scene) || 0) + 1);
      }

      if (row.event_name === 'render_failed') {
        rendersFailed += 1;
        const reason =
          typeof data.reason === 'string' && data.reason ? data.reason.slice(0, 120) : 'Unknown';
        failures.set(reason, (failures.get(reason) || 0) + 1);
      }

      if (row.event_name === 'video_saved') saves += 1;
      if (row.event_name === 'project_resumed') resumes += 1;

      if (row.event_name === 'preview_performance') {
        const device =
          typeof data.deviceClass === 'string' ? data.deviceClass : 'unknown';
        const fps = Number(data.fps);
        const dropped = Number(data.droppedFrames);
        const current = perf.get(device) || { fps: 0, dropped: 0, samples: 0 };
        if (Number.isFinite(fps)) current.fps += fps;
        if (Number.isFinite(dropped)) current.dropped += dropped;
        current.samples += 1;
        perf.set(device, current);
      }
    }

    const totalSessions = funnelSessions.get('session_started')?.size || 0;
    const funnel = FUNNEL.map((event, index) => {
      const sessions = funnelSessions.get(event)?.size || 0;
      const previous =
        index === 0 ? sessions : funnelSessions.get(FUNNEL[index - 1])?.size || 0;
      return {
        event,
        sessions,
        stepConversion: index === 0 ? 100 : pct(sessions, previous),
        totalConversion: pct(sessions, totalSessions),
      };
    });

    const top = (map: Map<string, number>, key: 'preset' | 'scene') =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, exports]) => ({ [key]: name, exports }));

    const totalRenders = rendersOk + rendersFailed;

    return NextResponse.json(
      {
        range,
        generatedAt: new Date().toISOString(),
        truncated: rows.length >= 50000,
        summary: {
          sessions: totalSessions || allSessions.size,
          rendersOk,
          rendersFailed,
          renderSuccessRate: pct(rendersOk, totalRenders),
          saves,
          resumes,
          avgRenderMs: renderDurationSamples
            ? Math.round(renderDurationTotal / renderDurationSamples)
            : 0,
        },
        funnel,
        topPresets: top(presetExports, 'preset'),
        topScenes: top(sceneExports, 'scene'),
        performance: [...perf.entries()].map(([device, item]) => ({
          device,
          avgFps: item.samples ? Math.round((item.fps / item.samples) * 10) / 10 : 0,
          avgDropped: item.samples
            ? Math.round((item.dropped / item.samples) * 10) / 10
            : 0,
          samples: item.samples,
        })),
        devices: [...deviceSessions.entries()]
          .map(([device, sessions]) => ({ device, sessions: sessions.size }))
          .sort((a, b) => b.sessions - a.sessions),
        failures: [...failures.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([reason, count]) => ({ reason, count })),
      },
      {
        headers: {
          'cache-control': 'no-store, no-cache, must-revalidate',
          pragma: 'no-cache',
          'x-robots-tag': 'noindex, nofollow',
        },
      },
    );
  } catch (error) {
    console.error('admin analytics report failed', error);
    return NextResponse.json(
      {
        error: 'analytics_report_failed',
        detail: error instanceof Error ? error.message.slice(0, 160) : 'unknown_error',
      },
      {
        status: 500,
        headers: { 'cache-control': 'no-store' },
      },
    );
  }
}
