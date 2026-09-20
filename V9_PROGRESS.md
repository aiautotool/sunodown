# SunoDown V9 Progress

## P0 — Long Video Loop / Multi-hour Render

- [x] Branch v9 created from latest v8
- [x] Loop configuration UI: count / target duration / presets
- [x] Renderer supports output duration longer than source song
- [x] Audio packets repeat across loops
- [x] Karaoke/lyrics reset correctly on every song loop
- [x] Background/effects remain continuous across the full output timeline
- [x] Long render split into safe segments
- [x] IndexedDB checkpoint/resume for interrupted long renders
- [x] Final segment mux into one MP4
- [x] Mobile-safe segment sizing/yielding
- [x] Build verification passes
- [x] Cloudflare deploy succeeds
- [ ] Manual regression: 1x output still behaves like v8

## Next roadmap
Only after the Long Video Loop feature is fully complete and verified, continue the previously proposed 30-feature V9 roadmap sequentially.
