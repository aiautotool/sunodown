import app from './index.js';

const emptyMusicState = () => ({
  version: 1,
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

const emptyDirectory = () => ({
  version: 1,
  publishers: {},
  profiles: {},
  updatedAt: Date.now(),
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
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
      const state =
        (await this.state.storage.get('music-state')) || emptyMusicState();
      return json({ state });
    }

    if (request.method === 'PATCH') {
      let patch;
      try {
        patch = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const current =
        (await this.state.storage.get('music-state')) || emptyMusicState();
      const next = {
        ...current,
        ...(patch && typeof patch === 'object' ? patch : {}),
        version: 1,
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
    if (url.pathname !== '/directory') {
      return json({ error: 'Not found' }, 404);
    }

    const current =
      (await this.state.storage.get('directory')) || emptyDirectory();

    if (request.method === 'GET') {
      const profiles = Object.values(current.profiles || {})
        .filter((profile) => profile && typeof profile === 'object')
        .sort(
          (a, b) =>
            Number(b.updatedAt || 0) - Number(a.updatedAt || 0),
        );

      const latestSongs = profiles
        .flatMap((profile) =>
          Array.isArray(profile.songs)
            ? profile.songs.map((song) => ({
                ...song,
                handle: profile.handle,
                creator:
                  song.creator || profile.displayName || profile.handle,
              }))
            : [],
        )
        .filter((song) => song?.id && song?.title)
        .sort((a, b) =>
          String(b.createdAt || b.discoveredAt || '').localeCompare(
            String(a.createdAt || a.discoveredAt || ''),
          ),
        )
        .slice(0, 120);

      return new Response(
        JSON.stringify({
          creators: profiles,
          latestSongs,
          creatorCount: profiles.length,
          songCount: profiles.reduce(
            (sum, profile) =>
              sum + (Array.isArray(profile.songs) ? profile.songs.length : 0),
            0,
          ),
          updatedAt: current.updatedAt || Date.now(),
        }),
        {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=60, stale-while-revalidate=300',
          },
        },
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
      const previousHandle =
        typeof publishers[accountId] === 'string'
          ? publishers[accountId]
          : null;

      const removePublisher = (handle) => {
        delete publishers[accountId];
        if (
          handle &&
          !Object.values(publishers).some((value) => value === handle)
        ) {
          delete profiles[handle];
        }
      };

      if (body.action === 'remove' || !body.profile) {
        removePublisher(previousHandle);
      } else {
        const profile = body.profile;
        const handle =
          typeof profile.handle === 'string'
            ? profile.handle.trim().replace(/^@/, '').slice(0, 120)
            : '';
        if (!handle) return json({ error: 'Missing handle' }, 400);

        if (previousHandle && previousHandle !== handle) {
          removePublisher(previousHandle);
        }

        publishers[accountId] = handle;
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

        profiles[handle] = {
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
          songCount: songs.length,
          publisherCount: Object.values(publishers).filter(
            (value) => value === handle,
          ).length,
          updatedAt: Date.now(),
        };
      }

      const next = {
        version: 1,
        publishers,
        profiles,
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
      url.searchParams.set('__picai_assets', 'v23-1');
      return env.ASSETS.fetch(new Request(url, request));
    }
    return app.fetch(request, env, ctx);
  },
};
