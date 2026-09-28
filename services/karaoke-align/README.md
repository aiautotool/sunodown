# Karaoke forced-alignment service

GPU service used by `sunodown` to align Suno audio with the original lyrics.

## Run with Docker + NVIDIA GPU

```bash
docker build -t suno-karaoke-align .
docker run --gpus all -p 8000:8000 suno-karaoke-align
```

Then configure the web app:

```bash
KARAOKE_ALIGN_URL=http://your-align-host:8000
```

The web app sends the fetched Suno audio and original lyrics to `POST /align`.

Pipeline:
1. Demucs `htdemucs` separates vocals (falls back to original audio if separation fails).
2. faster-whisper creates rough word timestamps.
3. Dynamic-programming fuzzy alignment maps Suno's original lyrics onto those timestamps.
4. Missing ASR words are interpolated between reliable neighbors.
5. The API returns line- and word-level timing. The browser editor can correct any low-confidence sections.

For CPU-only mode set:
```bash
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

To skip Demucs:
```bash
DISABLE_DEMUCS=1
```

## VPS 203.24.89.20 (1 GB RAM)

Deployment directory: `/opt/sunodown-karaoke-align`.
Public endpoint: `POST http://203.24.89.20/api/karaoke/align`.
Health: `GET http://203.24.89.20/health`.

This profile uses multilingual Whisper `tiny`, CPU/int8, no Demucs, one
inference at a time. It fits a small VPS better than `medium`; Vietnamese singing
accuracy is lower than the original Cloudflare Whisper large-v3-turbo backend.
The existing website backend is not switched by this deployment.

```bash
# On the server, in /opt/sunodown-karaoke-align:
# .env must contain KARAOKE_ALIGN_TOKEN=<random-secret>
docker compose -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.vps.yml logs --tail=100
```

`nginx.vps.conf` is installed as `/etc/nginx/conf.d/sunodown-karaoke-align.conf`.
It routes requests for the server IP to the loopback-only container on port 8011.
The public proxy exposes only the compatible endpoint and health check.

```bash
# Set KARAOKE_ALIGN_TOKEN to the value in the server's .env file.
curl --fail-with-body --max-time 600 \
  'http://203.24.89.20/api/karaoke/align' \
  -H "Authorization: Bearer $KARAOKE_ALIGN_TOKEN" \
  -F 'audio=@karaoke-7.wav' \
  -F 'duration=24' \
  -F 'language=vi'
```

Use the actual audio file with `-F`; do not copy a browser's binary `--data-raw`
body or manually specify its multipart boundary. Browser cookies are unnecessary.
For HTTPS clients, configure a domain and TLS before calling this HTTP endpoint
from a webpage. HTTP does not encrypt the token or audio in transit.

Inputs: `audio` required (up to 28 MiB); `language` defaults to `vi`; optional
positive finite `duration` (accepted for compatibility; ASR determines timestamps);
optional `lyrics` enables alignment to supplied lyrics. Without lyrics, output
contains `lines`, `words`, `meta`; times are seconds relative to the uploaded clip.
Each line includes `text`, `start`, `end`, `confidence`, and `words`.

Errors: 401 missing/wrong token; 400 empty audio/invalid duration; 413 oversized
upload; 422 no recognized voice or invalid input; 429 another inference is active.
The proxy allows 600 seconds for CPU inference. Keep chunks around 24 seconds.

Contract tests (no model download):

```bash
python -m pip install fastapi==0.116.1 python-multipart==0.0.20 httpx
python -m unittest discover -s services/karaoke-align -p test_api.py
```
