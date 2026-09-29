import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { readUserSession } from '@/app/lib/user-auth';

type MusicUserState = {
  version: 1;
  library: unknown | null;
  playlists: unknown[];
  liked: string[];
  stats: Record<string, unknown>;
  player: {
    queueIds: string[];
    queueIndex: number;
    repeatMode: 'off' | 'all' | 'one';
    shuffleOn: boolean;
    currentTime: number;
    currentSongId: string | null;
  };
  updatedAt: number;
};

type DurableBinding = {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
};

function binding() {
  return (env as unknown as { MUSIC_USERS?: DurableBinding }).MUSIC_USERS;
}

function directoryBinding() {
  return (env as unknown as { MUSIC_DIRECTORY?: DurableBinding }).MUSIC_DIRECTORY;
}

async function publishLibraryToDirectory(
  accountId: string,
  library: unknown | null,
) {
  const namespace = directoryBinding();
  if (!namespace) return false;

  try {
    const stub = namespace.get(namespace.idFromName('global'));
    const response = await stub.fetch('https://music.internal/directory', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        library
          ? { accountId, profile: library }
          : { accountId, action: 'remove' },
      ),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function userStub(request: NextRequest) {
  const user = await readUserSession(request);
  if (!user) return { user: null, stub: null };
  const namespace = binding();
  if (!namespace) return { user, stub: null };
  return {
    user,
    stub: namespace.get(namespace.idFromName(user.sub)),
  };
}

function sanitizeLibrary(value: unknown) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const songs = Array.isArray(raw.songs) ? raw.songs.slice(0, 5000) : [];
  const cleanSongs = songs
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const song = item as Record<string, unknown>;
      const id = typeof song.id === 'string' ? song.id.slice(0, 120) : '';
      const title =
        typeof song.title === 'string' ? song.title.slice(0, 240) : '';
      if (!id || !title) return null;

      const stringOrNull = (key: string, max = 1000) =>
        typeof song[key] === 'string' ? String(song[key]).slice(0, max) : null;

      return {
        id,
        title,
        creator: stringOrNull('creator', 200),
        handle: stringOrNull('handle', 120),
        picture: stringOrNull('picture', 2000),
        audioUrl: stringOrNull('audioUrl', 2000),
        videoUrl: stringOrNull('videoUrl', 2000),
        duration:
          typeof song.duration === 'number' && Number.isFinite(song.duration)
            ? Math.max(0, Math.min(song.duration, 60 * 60 * 6))
            : null,
        tags: stringOrNull('tags', 1200),
        createdAt: stringOrNull('createdAt', 80),
        isPublic: song.isPublic !== false,
        sunoUrl: stringOrNull('sunoUrl', 2000) || `https://suno.com/song/${id}`,
        discoveredAt: stringOrNull('discoveredAt', 80),
      };
    })
    .filter(Boolean);

  return {
    handle: typeof raw.handle === 'string' ? raw.handle.slice(0, 120) : '',
    displayName:
      typeof raw.displayName === 'string' ? raw.displayName.slice(0, 200) : '',
    avatarUrl:
      typeof raw.avatarUrl === 'string' ? raw.avatarUrl.slice(0, 2000) : null,
    syncedAt:
      typeof raw.syncedAt === 'string'
        ? raw.syncedAt.slice(0, 80)
        : new Date().toISOString(),
    songs: cleanSongs,
  };
}

function sanitizePlaylists(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id.slice(0, 120) : '';
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) : '';
    if (!id || !name) return [];
    return [{
      id,
      name,
      description:
        typeof raw.description === 'string'
          ? raw.description.slice(0, 500)
          : '',
      songIds: Array.isArray(raw.songIds)
        ? raw.songIds.filter((id): id is string => typeof id === 'string').slice(0, 5000)
        : [],
      createdAt:
        typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
          ? raw.createdAt
          : Date.now(),
      updatedAt: Date.now(),
    }];
  });
}

function sanitizeLiked(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.slice(0, 120)),
    ),
  ).slice(0, 5000);
}

function sanitizeStats(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 5000);
  return Object.fromEntries(
    entries.flatMap(([id, raw]) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
      const stat = raw as Record<string, unknown>;
      const num = (key: string, max: number) => {
        const v = Number(stat[key] || 0);
        return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
      };
      return [[
        id.slice(0, 120),
        {
          playCount: num('playCount', 1_000_000),
          completedCount: num('completedCount', 1_000_000),
          overHalfCount: num('overHalfCount', 1_000_000),
          totalListeningSeconds: num('totalListeningSeconds', 60 * 60 * 24 * 365 * 50),
          lastPlayedAt: num('lastPlayedAt', 9_999_999_999_999),
          lastPosition: num('lastPosition', 60 * 60 * 6),
        },
      ]];
    }),
  );
}

function sanitizePlayer(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const repeatMode =
    raw.repeatMode === 'all' || raw.repeatMode === 'one' ? raw.repeatMode : 'off';
  return {
    queueIds: Array.isArray(raw.queueIds)
      ? raw.queueIds.filter((id): id is string => typeof id === 'string').slice(0, 5000)
      : [],
    queueIndex:
      typeof raw.queueIndex === 'number' && Number.isFinite(raw.queueIndex)
        ? Math.max(-1, Math.min(4999, Math.trunc(raw.queueIndex)))
        : -1,
    repeatMode,
    shuffleOn: Boolean(raw.shuffleOn),
    currentTime:
      typeof raw.currentTime === 'number' && Number.isFinite(raw.currentTime)
        ? Math.max(0, Math.min(raw.currentTime, 60 * 60 * 6))
        : 0,
    currentSongId:
      typeof raw.currentSongId === 'string'
        ? raw.currentSongId.slice(0, 120)
        : null,
  };
}

export async function GET(request: NextRequest) {
  const { user, stub } = await userStub(request);
  if (!user) {
    return NextResponse.json(
      { error: 'authentication_required' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }
  if (!stub) {
    return NextResponse.json(
      { error: 'music_storage_unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  const response = await stub.fetch('https://music.internal/state');
  const payload = await response.json() as { state?: MusicUserState };

  if (payload.state?.library) {
    await publishLibraryToDirectory(user.sub, payload.state.library);
  }

  return NextResponse.json(
    { user, state: payload.state },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function PATCH(request: NextRequest) {
  const { user, stub } = await userStub(request);
  if (!user) {
    return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  }
  if (!stub) {
    return NextResponse.json({ error: 'music_storage_unavailable' }, { status: 503 });
  }

  const raw = await request.json() as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ('library' in raw) patch.library = sanitizeLibrary(raw.library);
  if ('playlists' in raw) patch.playlists = sanitizePlaylists(raw.playlists);
  if ('liked' in raw) patch.liked = sanitizeLiked(raw.liked);
  if ('stats' in raw) patch.stats = sanitizeStats(raw.stats);
  if ('player' in raw) {
    const player = sanitizePlayer(raw.player);
    if (player) patch.player = player;
  }

  const response = await stub.fetch('https://music.internal/state', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const payload = await response.json() as { state?: MusicUserState };

  let published: boolean | undefined;
  if ('library' in patch) {
    published = await publishLibraryToDirectory(
      user.sub,
      patch.library ?? null,
    );
  }

  return NextResponse.json(
    { user, state: payload.state, published },
    { headers: { 'cache-control': 'no-store' } },
  );
}
