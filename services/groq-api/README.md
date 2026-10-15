# Groq subtitle API on VPS

Production: https://groq.aiautotool.com/api/karaoke/groq
VPS: 203.24.89.20, source: /opt/sunodown-groq

The browser uploads directly to this service, bypassing Cloudflare Workers.
Node 22 reuses the existing Groq route, lyric cleaner and alignment algorithm.
`build.mjs` strips TypeScript and adapts the NextResponse JSON helper; no Next.js
or framework server is needed. Rebuild the image whenever shared sources change.

## Configuration

Create `services/groq-api/.env` on the server (mode 600):

```
GROQ_API_KEY=your-server-key
```

From the repository root:

```
docker compose -f services/groq-api/compose.yml up -d --build
```

The container listens only on 127.0.0.1:8021 on the host. Nginx terminates TLS.
DNS A record: groq.aiautotool.com -> 203.24.89.20, DNS only.
The supplied Nginx config includes HTTPS and HTTP-to-HTTPS redirection.
The certificate is managed by certbot, with a deploy hook reloading Nginx
after renewal. For initial issuance, serve only the HTTP ACME location first,
then enable the HTTPS server after the certificate exists.

Only browser origin https://picai.online can POST. CORS is not authentication;
Nginx limits requests per IP and the service permits one concurrent request.
Uploads are limited to 24 MiB audio / 25 MiB multipart. Secrets stay server-side.

## Verification

```
node services/groq-api/build.mjs
node --test services/groq-api/server.test.mjs
curl https://groq.aiautotool.com/health
curl -H 'Origin: https://picai.online' -F audio=@sample.mp3 -F language=vi \
  https://groq.aiautotool.com/api/karaoke/groq
```

Health reports configuration availability, not an upstream inference check.
To inspect failures: `docker compose -f services/groq-api/compose.yml logs --tail 50`.

The app's audio proxy and page rendering still use Cloudflare Workers. This
migration removes only subtitle processing from the Worker CPU budget.
