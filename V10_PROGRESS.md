# SunoDown V10 Progress

## P0 — Long Video Loop / Multi-hour Render
- [x] Loop count / target duration / presets
- [x] Seamless repeated audio packets and karaoke timing per loop
- [x] Continuous background/effects timeline
- [x] Segmented rendering + IndexedDB checkpoint/resume + final mux
- [x] Mobile-safe segment sizing/yielding and original renderer fallback
- [x] Implementation re-inspected on v10

**Status: COMPLETE / REGRESSION CHECK PASS (code inspection, 2026-09-22).** Rechecked duration resolution, segment/checkpoint resume path, absolute segment start time for continuous effects/background, renderer loopDuration path for repeated audio/karaoke, and 90s mobile segment cap/yield. No regression found.

## V10 roadmap
1. [x] Project / Draft
2. [x] Autosave project
3. [x] Undo / Redo
4. [x] Batch Suno Links
5. [x] Batch Download
6. [x] Render Queue
7. [x] Download ZIP Package
8. [x] Filename Template
9. [x] Local Library / History
10. [x] Favorite / Collection
11. [x] True LUFS / True Peak Meter
12. [x] Audio Processing Presets
13. [x] A/B Audio Compare
14. [x] TikTok Calibrated Profile
15. [x] Audio Trim Editor
16. [x] Fade In / Fade Out
17. [x] Vocal / Instrumental Separation
18. [x] Waveform Lyrics Editor
19. [x] Word Tap Sync
20. [x] Auto Lyrics Confidence
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

### Roadmap #9 — Local Library / History
**Status: COMPLETE.**

### Roadmap #10 — Favorite / Collection
**Status: COMPLETE.** Build/deploy verified by workflow 35603949982.

### Roadmap #11 — True LUFS / True Peak Meter
**Status: COMPLETE.** Commits c6b7e89 + 5dfa4a7; workflow 35610111970 successful.

### Roadmap #12 — Audio Processing Presets
**Status: COMPLETE.** Commits 32586b0 + 24f1a8a; workflow 35617230416 successful.

### Roadmap #13 — A/B Audio Compare
**Status: COMPLETE.** Commits 2d326f5 + 658b469. Verification recorded after green workflow.

### Roadmap #14 — TikTok Calibrated Profile
**Status: COMPLETE.** Commits b85faaa + 55e1c95 + 3fbda06. Workflow 35636774746 build/deploy job successful.

### Roadmap #15 — Audio Trim Editor
**Status: COMPLETE.** Commits 9ff1b77 + d926b4c + 043a8f7. Workflow 35643166119 build/deploy successful.

### Roadmap #16 — Fade In / Fade Out
**Status: COMPLETE.** Commits 85cf1d3 + 3c63c28 + 542a62d + 356f348 + cfb1772. Workflow 35649439562 build/deploy successful.

### Roadmap #17 — Vocal / Instrumental Separation
**Status: COMPLETE.** Commits a62c990 + d69376e. Workflow 35655769369 build/deploy successful.

### Roadmap #18 — Waveform Lyrics Editor
- [x] Real decoded-audio waveform, not a mock visualization
- [x] Lyrics timing regions overlaid on waveform
- [x] Click/tap waveform to seek audio and select lyric regions
- [x] Drag line Start/End edges with pointer/touch input
- [x] Numeric Start/End fine tuning updates the same karaoke timeline consumed by renderer
- [x] Mobile-safe peak extraction yields periodically to the event loop and caps waveform bins/DPR
- [x] Long Video Loop / multi-hour renderer code paths remain untouched; P0 regression inspection remains green
- [x] vinext build + Cloudflare deployment verified by workflow 35666370543

**Status: COMPLETE.** Feature commits 2c12681 + d58cf36. Workflow 35666370543 build/deploy successful.

### Roadmap #19 — Word Tap Sync
- [x] Select a lyric line and start tap-sync playback near its first word
- [x] One large mobile-friendly TAP control advances word-by-word
- [x] Each tap writes real per-word start/end timing into the karaoke timeline consumed by renderer
- [x] Previous word end is closed at the next tap; final word/line receives a safe tail
- [x] Current target word is visibly highlighted and sync can be stopped without corrupting existing timing
- [x] No Long Video / multi-hour render code modified; P0 regression inspection remains green
- [x] Build and Cloudflare deployment verified by workflow 35670583104

**Status: COMPLETE.** Feature commit 830a1d7. Workflow 35670583104 build/deploy successful.

### Roadmap #20 — Auto Lyrics Confidence
- [x] Decode real song audio locally and extract capped waveform peaks
- [x] Score each timed word using acoustic onset, local energy, duration plausibility, and timing continuity
- [x] Aggregate word confidence into line and whole-song confidence
- [x] Highlight low-confidence words with reason tooltips and one-tap seek back into Waveform Lyrics Editor
- [x] Mobile-safe analysis caps bins and yields periodically to the event loop
- [x] No Long Video / multi-hour render code modified; P0 regression inspection remains green
- [x] Build and Cloudflare deployment verified by workflow 35674659906

**Status: COMPLETE.** Feature commits b1180ef + 2c78978 + 3cb8ace. Workflow 35674659906 build/deploy successful.

### Current focus
Roadmap #21 — Subtitle VTT Export. Start on the next run only. Exactly one roadmap task per run.
