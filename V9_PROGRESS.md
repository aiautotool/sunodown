# SunoDown V9 Progress

## P0 — Long Video Loop / Multi-hour Render

- [x] Branch v9 created from latest v8
- [ ] Loop configuration UI: count / target duration / presets
- [ ] Renderer supports output duration longer than source song
- [ ] Audio packets repeat seamlessly across loops
- [ ] Karaoke/lyrics reset correctly on every song loop
- [ ] Background/effects remain continuous across the full output timeline
- [ ] Long render split into safe segments
- [ ] IndexedDB checkpoint/resume for interrupted long renders
- [ ] Final segment mux into one MP4
- [ ] Mobile-safe segment sizing/yielding
- [ ] Build verification passes
- [ ] Cloudflare deploy succeeds
- [ ] Manual regression: 1x output still behaves like v8

## Next roadmap
Only after the Long Video Loop feature is fully complete and verified, continue the previously proposed 30-feature V9 roadmap sequentially.

Build verification trigger: long-loop core.
