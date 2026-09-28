import app from './index.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if ((request.method === 'GET' || request.method === 'HEAD') &&
        (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/assets-next/') ||
         /\.(?:png|jpg|jpeg|webp|svg|ico|woff2|css|js|webmanifest)$/.test(url.pathname))) {
      // Bypass stale asset misses cached before this domain used the asset binding.
      url.searchParams.set('__picai_assets', 'v23-1');
      return env.ASSETS.fetch(new Request(url, request));
    }
    return app.fetch(request, env, ctx);
  },
};
