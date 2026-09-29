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
      // Bypass stale asset misses cached before this domain used the asset binding.
      url.searchParams.set('__picai_assets', 'v23-1');
      return env.ASSETS.fetch(new Request(url, request));
    }
    return app.fetch(request, env, ctx);
  },
};
