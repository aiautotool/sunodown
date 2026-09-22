# SunoDown AI Music Video renderer

External renderer for `ai_music_video` jobs. It turns lyrics into a bounded storyboard, generates coherent 5-second Vibes clips, repeats the visual sequence to cover the song, and muxes the original audio into an MP4 with FFmpeg.

## Run

```bash
export VIBES_META_SESSION='cookie from vibes.ai'
export RENDER_SERVICE_TOKEN='long-random-secret'
docker compose up --build
```

Point the Cloudflare Worker secret `RENDER_SERVICE_URL` to `https://renderer.example.com/render` and set the same `RENDER_SERVICE_TOKEN` on both services.

For a local end-to-end test without consuming Vibes generations, set `MOCK_VIBES=true`. Mock mode creates deterministic color clips with FFmpeg while exercising download, scene planning, concatenation, audio muxing and MP4 output.

## Cloudflare Container

`worker.ts` and `wrangler.jsonc` expose the renderer through a three-instance Cloudflare Container pool. Configure `VIBES_META_SESSION` and `RENDER_SERVICE_TOKEN` as Worker secrets; neither value belongs in source control.
