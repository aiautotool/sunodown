# SunoDown V9 Progress

## P0 — Long Video Loop / Multi-hour Render
- [x] Loop count / target duration / presets
- [x] Seamless repeated audio packets and karaoke timing per loop
- [x] Continuous background/effects timeline
- [x] Segmented rendering + IndexedDB checkpoint/resume + final mux
- [x] Mobile-safe segment sizing/yielding and original renderer fallback
- [x] Build + Cloudflare deploy verified

**Status: COMPLETE.** Long Video Loop is closed; roadmap proceeds sequentially.

## V9 roadmap
1. [x] Project / Draft
2. [x] Autosave project
3. [x] Undo / Redo
4. [x] Batch Suno Links
5. [x] Batch Download
6. [x] Render Queue
7. [x] Download ZIP Package
8. [x] Filename Template
9. [ ] Local Library / History
10. [ ] Favorite / Collection
11. [ ] True LUFS / True Peak Meter
12. [ ] Audio Processing Presets
13. [ ] A/B Audio Compare
14. [ ] TikTok Calibrated Profile
15. [ ] Audio Trim Editor
16. [ ] Fade In / Fade Out
17. [ ] Vocal / Instrumental Separation
18. [ ] Waveform Lyrics Editor
19. [ ] Word Tap Sync
20. [ ] Auto Lyrics Confidence
21. [ ] Subtitle VTT Export
22. [ ] Subtitle Styling Studio
23. [ ] Duet / Singer Colors
24. [ ] Lyrics Translation Track
25. [ ] Beat/BPM Detection
26. [ ] Beat-Synced Effects
27. [ ] Scene Timeline
28. [ ] Text / Logo / Watermark Layer
29. [ ] Safe Zone TikTok/Reels/Shorts
30. [ ] Smart Render Quality

### Roadmap #1 — Project / Draft
**Status: COMPLETE.**

### Roadmap #2 — Autosave project
**Status: COMPLETE.**

### Roadmap #3 — Undo / Redo
**Status: COMPLETE.**

### Roadmap #4 — Batch Suno Links
**Status: COMPLETE.**

### Roadmap #5 — Batch Download
**Status: COMPLETE.**

### Roadmap #6 — Render Queue
- [x] Sequential mobile-safe queue; retry/remove/clear/download
- [x] Frozen full editor snapshot per job
- [x] Direct render locking + wake lock integration
- [x] Build + Cloudflare deploy succeeded for `c613dab` (run 35570834672)

**Status: COMPLETE.**

### Roadmap #7 — Download ZIP Package
- [x] Native streaming ZIP writer (`components/v9/zip-package.ts`) using ZIP data descriptors; audio is streamed into the archive chunk-by-chunk rather than buffered as one giant batch
- [x] Uses File System Access streaming writer when supported; browser Blob fallback retained for compatibility
- [x] Batch ZIP contains numbered/sanitized audio files and generated `.srt` subtitle files
- [x] Includes latest rendered MP4 in the package when a rendered Blob URL is available
- [x] CRC32, UTF-8 ZIP filenames, central directory and per-file streaming implemented without an extra ZIP dependency
- [x] Progress/error state exposed in Batch Suno UI; filename sanitization applied
- [x] Build + Cloudflare deploy succeeded for `008132a` (run 35575464239)

**Status: COMPLETE.**

### Roadmap #8 — Filename Template
- [x] Configurable filename tokens for audio/video/subtitle/package outputs
- [x] Preview + sanitization + persisted preference
- [x] Integrate with batch/ZIP/render downloads
- [x] Build verification + Cloudflare deploy succeeded for `b0d2187` (run 35579692997)

**Status: COMPLETE.**

### Roadmap #9 — Local Library / History
- [ ] Persist resolved/downloaded/rendered song history locally
- [ ] Search/filter and reopen an item without re-entering the Suno URL
- [ ] Mobile-safe storage limits and clear/remove controls
- [ ] Build verification + Cloudflare deploy

**Status: NEXT.** Do not start #10 until #9 is complete.

### Current focus
Roadmap #9 — Local Library / History. Implement and verify before starting #10.
