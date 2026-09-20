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
