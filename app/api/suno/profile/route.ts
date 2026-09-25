import { NextRequest, NextResponse } from 'next/server';

const API = 'https://studio-api.prod.suno.com/api/profiles';
const HANDLE_RE = /^[A-Za-z0-9_.-]{1,80}$/;

function normalizeHandle(value: unknown) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://suno.com/${raw.replace(/^@/, '')}`);
    const match = url.pathname.match(/^\/@?([^/?#]+)/);
    return decodeURIComponent(match?.[1] || '').replace(/^@/, '');
  } catch {
    return raw.replace(/^@/, '').replace(/^https?:\/\/[^/]+\/@?/, '').split(/[/?#]/)[0];
  }
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function mapClip(clip: Record<string, unknown>) {
  const metadata = clip.metadata && typeof clip.metadata === 'object'
    ? clip.metadata as Record<string, unknown>
    : {};
  const id = asString(clip.id);
  if (!id) return null;
  return {
    id,
    title: asString(clip.title) || 'Untitled',
    creator: asString(clip.display_name) || asString(clip.handle) || 'Suno',
    handle: asString(clip.handle),
    picture: asString(clip.image_large_url) || asString(clip.image_url),
    audioUrl: asString(clip.audio_url),
    videoUrl: asString(clip.video_url),
    duration: typeof metadata.duration === 'number'
      ? metadata.duration
      : typeof clip.duration === 'number'
        ? clip.duration
        : null,
    tags: asString(metadata.tags) || asString(clip.display_tags),
    createdAt: asString(clip.created_at),
    isPublic: typeof clip.is_public === 'boolean' ? clip.is_public : true,
    sunoUrl: `https://suno.com/song/${id}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { handle?: string; maxPages?: number };
    const handle = normalizeHandle(body.handle);
    if (!HANDLE_RE.test(handle)) {
      return NextResponse.json({ error: 'Username/profile Suno không hợp lệ.' }, { status: 400 });
    }

    const maxPages = Math.min(Math.max(Number(body.maxPages) || 20, 1), 50);
    const seen = new Set<string>();
    const songs: ReturnType<typeof mapClip>[] = [];
    let page = 1;
    let profile: Record<string, unknown> | null = null;
    let truncated = false;

    for (; page <= maxPages; page += 1) {
      const url = new URL(`${API}/${encodeURIComponent(handle)}`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('playlists_sort_by', 'created_at');
      url.searchParams.set('clips_sort_by', 'created_at');

      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'SunoDown/18 (+https://suno.aiautotool.com)',
        },
        cache: 'no-store',
      });

      if (response.status === 404) {
        return NextResponse.json({ error: 'Không tìm thấy profile Suno này.' }, { status: 404 });
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Suno đang giới hạn số lần quét. Hãy thử Sync lại sau.' },
          { status: 429 },
        );
      }
      if (!response.ok) {
        return NextResponse.json(
          { error: `Không đọc được profile Suno (HTTP ${response.status}).` },
          { status: 502 },
        );
      }

      const data = await response.json() as Record<string, unknown>;
      if (!profile) profile = data;
      const clips = Array.isArray(data.clips) ? data.clips as Array<Record<string, unknown>> : [];
      if (!clips.length) break;

      let addedThisPage = 0;
      for (const clip of clips) {
        const song = mapClip(clip);
        if (!song || seen.has(song.id)) continue;
        seen.add(song.id);
        songs.push(song);
        addedThisPage += 1;
      }

      if (!addedThisPage) break;
      await new Promise(resolve => setTimeout(resolve, 120));
    }

    if (page > maxPages) truncated = true;

    return NextResponse.json({
      handle,
      displayName:
        asString(profile?.display_name) ||
        asString(profile?.name) ||
        handle,
      avatarUrl:
        asString(profile?.image_url) ||
        asString(profile?.avatar_url) ||
        null,
      songs,
      total: songs.length,
      pagesScanned: Math.min(page, maxPages),
      truncated,
      syncedAt: new Date().toISOString(),
      storage: 'browser-local',
    });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : 'Không thể quét profile Suno.' },
      { status: 500 },
    );
  }
}
