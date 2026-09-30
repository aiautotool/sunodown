import app from './index.js';

const emptyMusicState = () => ({
  version: 2,
  libraries: [],
  library: null,
  playlists: [],
  liked: [],
  stats: {},
  player: {
    queueIds: [],
    queueIndex: -1,
    repeatMode: 'off',
    shuffleOn: false,
    currentTime: 0,
    currentSongId: null,
  },
  updatedAt: Date.now(),
});

function normalizeMusicState(value) {
  const base = emptyMusicState();
  if (!value || typeof value !== 'object') return base;
  const libraries = Array.isArray(value.libraries)
    ? value.libraries
    : value.library
      ? [value.library]
      : [];
  return {
    ...base,
    ...value,
    version: 2,
    libraries,
    library:
      value.library ||
      (libraries.length === 1 ? libraries[0] : libraries.length ? {
        handle: '__all__',
        displayName: `${libraries.length} tài khoản Suno`,
        avatarUrl: null,
        syncedAt: libraries
          .map((item) => item?.syncedAt || '')
          .sort()
          .reverse()[0] || new Date().toISOString(),
        songs: Array.from(
          new Map(
            libraries
              .flatMap((item) => Array.isArray(item?.songs) ? item.songs : [])
              .filter((song) => song?.id)
              .map((song) => [song.id, song]),
          ).values(),
        ),
      } : null),
  };
}

const emptyDirectory = () => ({
  version: 2,
  publishers: {},
  profiles: {},
  stats: {},
  updatedAt: Date.now(),
});

function json(data, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
    },
  });
}

function utcDay(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function eventWeight(type) {
  if (type === '30s') return 2;
  if (type === 'half') return 3;
  if (type === 'complete') return 5;
  if (type === 'like') return 4;
  return 1;
}

function scoreBucket(bucket = {}) {
  return (
    Number(bucket.start || 0) +
    Number(bucket['30s'] || 0) * 2 +
    Number(bucket.half || 0) * 3 +
    Number(bucket.complete || 0) * 5 +
    Number(bucket.like || 0) * 4
  );
}

function scoreEntry(entry = {}) {
  return scoreBucket(entry.all || {});
}

function scoreRecent(entry = {}, days = 7) {
  const daily = entry.daily || {};
  const keys = Object.keys(daily)
    .sort()
    .reverse()
    .slice(0, days);
  return keys.reduce((sum, key) => sum + scoreBucket(daily[key]), 0);
}

function countPlays(entry = {}) {
  return Number(entry?.all?.start || 0);
}

function pruneDaily(daily = {}) {
  const keep = Object.keys(daily).sort().reverse().slice(0, 31);
  return Object.fromEntries(keep.map((key) => [key, daily[key]]));
}

function decorateSong(song, stats = {}) {
  const entry = stats[song.id] || {};
  return {
    ...song,
    playCount: countPlays(entry),
    score: scoreEntry(entry),
    trendingScore: scoreRecent(entry, 7),
  };
}

export class MusicUserStore {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/state') return json({ error: 'Not found' }, 404);

    if (request.method === 'GET') {
      const stored = await this.state.storage.get('music-state');
      const state = normalizeMusicState(stored);
      if (!stored || stored.version !== 2 || !Array.isArray(stored.libraries)) {
        await this.state.storage.put('music-state', state);
      }
      return json({ state });
    }

    if (request.method === 'PATCH') {
      let patch;
      try {
        patch = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const current = normalizeMusicState(
        await this.state.storage.get('music-state'),
      );
      const next = {
        ...current,
        ...(patch && typeof patch === 'object' ? patch : {}),
        version: 2,
        updatedAt: Date.now(),
      };

      if (patch?.player && typeof patch.player === 'object') {
        next.player = {
          ...current.player,
          ...patch.player,
        };
      }

      await this.state.storage.put('music-state', next);
      return json({ state: next });
    }

    if (request.method === 'DELETE') {
      await this.state.storage.delete('music-state');
      return json({ state: emptyMusicState() });
    }

    return json({ error: 'Method not allowed' }, 405);
  }
}

export class PublicMusicDirectory {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const current =
      (await this.state.storage.get('directory')) || emptyDirectory();

    if (url.pathname === '/event' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const songId =
        typeof body?.songId === 'string' ? body.songId.slice(0, 120) : '';
      const type =
        typeof body?.event === 'string' ? body.event.slice(0, 20) : '';
      const allowed = new Set(['start', '30s', 'half', 'complete', 'like']);
      if (!songId || !allowed.has(type)) {
        return json({ error: 'Invalid event' }, 400);
      }

      const songExists = Object.values(current.profiles || {}).some(
        (profile) =>
          Array.isArray(profile?.songs) &&
          profile.songs.some((song) => song?.id === songId),
      );
      if (!songExists) return json({ error: 'Unknown song' }, 404);

      const stats = { ...(current.stats || {}) };
      const previous = stats[songId] || {
        all: {},
        daily: {},
        lastPlayedAt: 0,
      };
      const all = { ...(previous.all || {}) };
      all[type] = Number(all[type] || 0) + 1;

      const day = utcDay();
      const daily = { ...(previous.daily || {}) };
      const dayBucket = { ...(daily[day] || {}) };
      dayBucket[type] = Number(dayBucket[type] || 0) + 1;
      daily[day] = dayBucket;

      stats[songId] = {
        all,
        daily: pruneDaily(daily),
        lastPlayedAt: Date.now(),
        score: scoreBucket(all),
      };

      const next = {
        ...current,
        version: 2,
        stats,
      };
      await this.state.storage.put('directory', next);

      return json({
        ok: true,
        score: scoreEntry(stats[songId]),
        weight: eventWeight(type),
      });
    }

    if (url.pathname !== '/directory') {
      return json({ error: 'Not found' }, 404);
    }

    if (request.method === 'GET') {
      const profiles = Object.values(current.profiles || {})
        .filter((profile) => profile && typeof profile === 'object')
        .sort(
          (a, b) =>
            Number(b.updatedAt || 0) - Number(a.updatedAt || 0),
        );

      const allSongs = profiles
        .flatMap((profile) =>
          Array.isArray(profile.songs)
            ? profile.songs.map((song) =>
                decorateSong(
                  {
                    ...song,
                    handle: profile.handle,
                    creator:
                      song.creator || profile.displayName || profile.handle,
                  },
                  current.stats || {},
                ),
              )
            : [],
        )
        .filter((song) => song?.id && song?.title);

      const latestSongs = [...allSongs]
        .sort((a, b) =>
          String(b.createdAt || b.discoveredAt || '').localeCompare(
            String(a.createdAt || a.discoveredAt || ''),
          ),
        )
        .slice(0, 120);

      const trendingSongs = [...allSongs]
        .sort((a, b) => {
          const scoreDelta =
            Number(b.trendingScore || 0) - Number(a.trendingScore || 0);
          if (scoreDelta) return scoreDelta;
          return String(b.createdAt || '').localeCompare(
            String(a.createdAt || ''),
          );
        })
        .slice(0, 40);

      const topSongs = [...allSongs]
        .sort((a, b) => {
          const scoreDelta = Number(b.score || 0) - Number(a.score || 0);
          if (scoreDelta) return scoreDelta;
          return Number(b.playCount || 0) - Number(a.playCount || 0);
        })
        .slice(0, 20);

      const featuredSong =
        trendingSongs.find((song) => Number(song.trendingScore || 0) > 0) ||
        latestSongs[0] ||
        null;

      return json(
        {
          creators: profiles,
          latestSongs,
          trendingSongs,
          topSongs,
          featuredSong,
          creatorCount: profiles.length,
          songCount: allSongs.length,
          updatedAt: current.updatedAt || Date.now(),
        },
        200,
        'public, max-age=30, stale-while-revalidate=120',
      );
    }

    if (request.method === 'PATCH') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const accountId =
        typeof body?.accountId === 'string' ? body.accountId.slice(0, 240) : '';
      if (!accountId) return json({ error: 'Missing accountId' }, 400);

      const publishers = { ...(current.publishers || {}) };
      const profiles = { ...(current.profiles || {}) };
      const toHandles = (value) =>
        Array.isArray(value)
          ? value.filter((item) => typeof item === 'string')
          : typeof value === 'string'
            ? [value]
            : [];
      const allPublisherHandles = () =>
        Object.values(publishers).flatMap(toHandles);
      const previousHandles = toHandles(publishers[accountId]);

      const incomingProfiles =
        body.action === 'remove'
          ? []
          : Array.isArray(body.profiles)
            ? body.profiles
            : body.profile
              ? [body.profile]
              : [];

      const cleanProfiles = incomingProfiles
        .filter((profile) => profile && typeof profile === 'object')
        .slice(0, 50)
        .map((profile) => {
          const handle =
            typeof profile.handle === 'string'
              ? profile.handle.trim().replace(/^@/, '').slice(0, 120)
              : '';
          if (!handle) return null;

          const songs = Array.isArray(profile.songs)
            ? profile.songs
                .filter((song) => song && song.isPublic !== false)
                .slice(0, 5000)
                .map((song) => ({
                  id: String(song.id || '').slice(0, 120),
                  title: String(song.title || 'Untitled').slice(0, 240),
                  creator:
                    typeof song.creator === 'string'
                      ? song.creator.slice(0, 200)
                      : null,
                  picture:
                    typeof song.picture === 'string'
                      ? song.picture.slice(0, 2000)
                      : null,
                  duration:
                    Number.isFinite(song.duration) ? Number(song.duration) : null,
                  tags:
                    typeof song.tags === 'string'
                      ? song.tags.slice(0, 1200)
                      : null,
                  createdAt:
                    typeof song.createdAt === 'string'
                      ? song.createdAt.slice(0, 80)
                      : null,
                  discoveredAt:
                    typeof song.discoveredAt === 'string'
                      ? song.discoveredAt.slice(0, 80)
                      : null,
                  isPublic: true,
                }))
                .filter((song) => song.id)
            : [];

          return {
            handle,
            displayName:
              typeof profile.displayName === 'string' && profile.displayName.trim()
                ? profile.displayName.slice(0, 200)
                : handle,
            avatarUrl:
              typeof profile.avatarUrl === 'string'
                ? profile.avatarUrl.slice(0, 2000)
                : null,
            syncedAt:
              typeof profile.syncedAt === 'string'
                ? profile.syncedAt.slice(0, 80)
                : new Date().toISOString(),
            songs,
          };
        })
        .filter(Boolean);

      const nextHandles = cleanProfiles.map((profile) => profile.handle);
      if (nextHandles.length) publishers[accountId] = nextHandles;
      else delete publishers[accountId];

      for (const oldHandle of previousHandles) {
        if (
          !nextHandles.includes(oldHandle) &&
          !allPublisherHandles().includes(oldHandle)
        ) {
          delete profiles[oldHandle];
        }
      }

      for (const profile of cleanProfiles) {
        profiles[profile.handle] = {
          ...profile,
          songCount: profile.songs.length,
          publisherCount: Object.values(publishers)
            .map(toHandles)
            .filter((handles) => handles.includes(profile.handle)).length,
          updatedAt: Date.now(),
        };
      }

      const next = {
        ...current,
        version: 2,
        publishers,
        profiles,
        stats: current.stats || {},
        updatedAt: Date.now(),
      };

      await this.state.storage.put('directory', next);
      return json({
        ok: true,
        creatorCount: Object.keys(profiles).length,
      });
    }

    return json({ error: 'Method not allowed' }, 405);
  }
}

function subtitleLanguage(value) {
  const normalized = String(value || 'vi').trim().toLowerCase();
  return /^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(normalized)
    ? normalized
    : 'vi';
}

export class SubtitleStore {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const language = subtitleLanguage(url.searchParams.get('language'));
    const artifactKey = `artifact:${language}`;
    const claimKey = `claim:${language}`;

    if (url.pathname === '/artifact') {
      if (request.method === 'GET') {
        const subtitle = await this.state.storage.get(artifactKey);
        if (!subtitle) return json({ status: 'missing' }, 404);
        return json({ status: 'ready', subtitle });
      }

      if (request.method === 'PUT') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Invalid JSON' }, 400);
        }
        const subtitle = body?.subtitle;
        if (
          !subtitle ||
          typeof subtitle !== 'object' ||
          !Array.isArray(subtitle.lines) ||
          typeof subtitle.songId !== 'string'
        ) {
          return json({ error: 'Invalid subtitle artifact' }, 400);
        }
        await this.state.storage.put(artifactKey, subtitle);
        await this.state.storage.delete(claimKey);
        return json({ status: 'ready', subtitle });
      }

      if (request.method === 'DELETE') {
        await this.state.storage.delete(artifactKey);
        return json({ status: 'deleted' });
      }

      return json({ error: 'Method not allowed' }, 405);
    }

    if (url.pathname === '/claim') {
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Invalid JSON' }, 400);
        }
        const fingerprint =
          typeof body?.fingerprint === 'string'
            ? body.fingerprint.slice(0, 256)
            : '';
        if (!fingerprint) {
          return json({ error: 'Missing fingerprint' }, 400);
        }

        const now = Date.now();
        const current = await this.state.storage.get(claimKey);
        const fresh =
          current &&
          typeof current.startedAt === 'number' &&
          now - current.startedAt < 3 * 60 * 1000;

        if (fresh) {
          return json(
            {
              status: 'generating',
              startedAt: current.startedAt,
              fingerprint: current.fingerprint || null,
            },
            409,
          );
        }

        const claim = { fingerprint, startedAt: now };
        await this.state.storage.put(claimKey, claim);
        return json({ status: 'claimed', startedAt: now });
      }

      if (request.method === 'DELETE') {
        await this.state.storage.delete(claimKey);
        return json({ status: 'released' });
      }

      return json({ error: 'Method not allowed' }, 405);
    }

    return json({ error: 'Not found' }, 404);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      (url.pathname.startsWith('/_next/') ||
        url.pathname.startsWith('/assets-next/') ||
        /\.(?:png|jpg|jpeg|webp|svg|ico|woff2|css|js|webmanifest)$/.test(
          url.pathname,
        ))
    ) {
      url.searchParams.set('__picai_assets', 'v23-2');
      return env.ASSETS.fetch(new Request(url, request));
    }

    if (
      url.pathname === '/api/music/subtitle' &&
      request.method === 'GET' &&
      env.SUBTITLE_STORE
    ) {
      const songId = String(url.searchParams.get('songId') || '');
      const language = subtitleLanguage(url.searchParams.get('language'));
      const validSongId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          songId,
        );
      if (!validSongId) {
        return json({ error: 'invalid_song_id' }, 400);
      }

      try {
        const id = env.SUBTITLE_STORE.idFromName(songId);
        const stub = env.SUBTITLE_STORE.get(id);
        const target = new URL('https://subtitle.internal/artifact');
        target.searchParams.set('language', language);
        const response = await stub.fetch(target);
        if (response.status === 404) {
          return json({ status: 'missing', songId, language }, 404);
        }
        if (!response.ok) {
          return json({ error: 'subtitle_store_failed' }, 502);
        }
        const payload = await response.json();
        return json(
          {
            status: 'ready',
            cached: true,
            subtitle: payload?.subtitle || null,
          },
          200,
          'no-store',
        );
      } catch (error) {
        console.error('subtitle store read failed', error);
        return json({ error: 'subtitle_store_failed' }, 502);
      }
    }

    // Vinext route modules do not consistently expose secret bindings.
    // Keep public health deterministic at the outer Worker layer and inject
    // the Groq secret into the internal request body only for the two routes
    // that need it. Browser-supplied internal fields are always overwritten.
    if (url.pathname === '/api/karaoke/groq') {
      const groqKey =
        typeof env.GROQ_API_KEY === 'string' ? env.GROQ_API_KEY : '';

      if (request.method === 'GET') {
        return json({
          available: Boolean(groqKey),
          source: groqKey ? 'worker-binding' : 'none',
          engine: 'groq-whisper-large-v3-turbo',
          wordTimestamps: true,
          maxMobileUploadBytes: 24 * 1024 * 1024,
        });
      }

      if (request.method === 'POST') {
        try {
          const incoming = await request.formData();
          incoming.set('__server_groq_key', groqKey);
          const headers = new Headers(request.headers);
          headers.delete('content-type');
          headers.delete('content-length');
          request = new Request(request.url, {
            method: 'POST',
            headers,
            body: incoming,
          });
        } catch {
          return json(
            {
              error: 'Multipart form-data không hợp lệ.',
              code: 'INVALID_MULTIPART',
            },
            400,
          );
        }
      }
    }

    if (
      url.pathname === '/api/music/subtitle/generate' &&
      request.method === 'POST'
    ) {
      try {
        const input = await request.json();
        const payload =
          input && typeof input === 'object' ? { ...input } : {};
        payload.__serverGroqKey =
          typeof env.GROQ_API_KEY === 'string' ? env.GROQ_API_KEY : '';
        const headers = new Headers(request.headers);
        headers.set('content-type', 'application/json');
        headers.delete('content-length');
        request = new Request(request.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }
    }

    globalThis.__SUNODOWN_GROQ_API_KEY =
      typeof env.GROQ_API_KEY === 'string' ? env.GROQ_API_KEY : '';
    globalThis.__SUNODOWN_SUBTITLE_STORE = env.SUBTITLE_STORE || undefined;

    return app.fetch(request, env, ctx);
  },
};
