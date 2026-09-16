# Suno Grab v6 — Background Render

## Goal
Full video render must continue after the browser/web app is closed and notify the phone when the job finishes.

## Render modes

### Device render
- Existing v5 renderer remains unchanged.
- Best for 10 second previews and quick renders.
- Runs in browser and stops if the OS suspends the tab.

### Background render
- Client creates a render job on the server.
- API returns `jobId` immediately.
- Render is processed asynchronously outside the browser.
- Result is persisted in object storage.
- Phone receives Web Push when job completes or fails.

## Job states
`queued -> preparing -> rendering -> uploading -> completed`

Failure state: `failed`.

## API contract

### POST /api/render/jobs
Request:
```json
{
  "song": { "id": "...", "title": "...", "audio": "...", "image": "..." },
  "preset": "cinematic-cover",
  "aspect": "9:16",
  "wave": "bars",
  "motion": "medium",
  "lyrics": "off"
}
```
Response: `202 { "jobId": "...", "status": "queued" }`

### GET /api/render/jobs/:jobId
Returns status, progress, result URL and error when applicable.

### POST /api/push/subscribe
Stores a browser push subscription for the current installation.

### DELETE /api/push/subscribe
Removes the subscription.

## Cloudflare resources
- Queue: `suno-render-jobs`
- R2 bucket: `suno-render-results`
- D1 database: `suno-render-db`
- Rendering runtime: Cloudflare Container or external FFmpeg worker. Queue consumer dispatches the render request and persists progress/result.

## D1 tables

### render_jobs
- id TEXT PRIMARY KEY
- installation_id TEXT
- status TEXT
- progress INTEGER
- input_json TEXT
- result_key TEXT NULL
- error TEXT NULL
- created_at INTEGER
- updated_at INTEGER
- expires_at INTEGER

### push_subscriptions
- id TEXT PRIMARY KEY
- installation_id TEXT
- endpoint TEXT UNIQUE
- p256dh TEXT
- auth TEXT
- created_at INTEGER
- updated_at INTEGER

## Push flow
1. Web app registers `/sw.js`.
2. User explicitly enables render notifications.
3. Push subscription is stored by `/api/push/subscribe`.
4. Render completes.
5. Backend sends push notification.
6. Service worker displays `Video đã render xong`.
7. Tapping notification opens `/?renderJob=<jobId>`.

## iPhone UX
Show a short instruction when notification permission cannot yet be requested: add Suno Grab to the Home Screen, open it from the Home Screen, then enable render notifications.

## Safety / compatibility
- Do not modify the v5 browser audio/remux renderer while implementing server rendering.
- Background render is an additional mode, not a replacement.
- Do not claim background rendering is active until Queue, storage, database, renderer runtime and push credentials are actually provisioned.
