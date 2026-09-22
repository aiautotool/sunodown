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
21. [x] Subtitle VTT Export
22. [x] Subtitle Styling Studio
23. [x] Duet / Singer Colors
24. [x] Lyrics Translation Track
25. [x] Beat/BPM Detection
26. [x] Beat-Synced Effects
27. [x] Scene Timeline
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
**Status: COMPLETE.** Commits b85faaa + 55e1c95 + 3fbda06. Workflow 35636774746 build/deploy successful.

### Roadmap #15 — Audio Trim Editor
**Status: COMPLETE.** Commits 9ff1b77 + d926b4c + 043a8f7. Workflow 35643166119 build/deploy successful.

### Roadmap #16 — Fade In / Fade Out
**Status: COMPLETE.** Commits 85cf1d3 + 3c63c28 + 542a62d + 356f348 + cfb1772. Workflow 35649439562 build/deploy successful.

### Roadmap #17 — Vocal / Instrumental Separation
**Status: COMPLETE.** Commits a62c990 + d69376e. Workflow 35655769369 build/deploy successful.

### Roadmap #18 — Waveform Lyrics Editor
**Status: COMPLETE.** Feature commits 2c12681 + d58cf36. Workflow 35666370543 build/deploy successful.

### Roadmap #19 — Word Tap Sync
**Status: COMPLETE.** Feature commit 830a1d7. Workflow 35670583104 build/deploy successful.

### Roadmap #20 — Auto Lyrics Confidence
**Status: COMPLETE.** Feature commits b1180ef + 2c78978 + 3cb8ace. Workflow 35674659906 build/deploy successful.

### Roadmap #21 — Subtitle VTT Export
**Status: COMPLETE.** Feature commits 65444d8 + 4c4496c + 1d99c49. Workflow 35675236745 build/deploy successful.

### Roadmap #22 — Subtitle Styling Studio
**Status: COMPLETE.** Feature commits bc17b70 + 36239e3. Workflow 35678402402 build/deploy successful.

### Roadmap #23 — Duet / Singer Colors
**Status: COMPLETE.** Feature commits d6e60bd + 26f6edf; JSX repair adebfd6. Workflow 35682200076 build/deploy successful.

### Roadmap #24 — Lyrics Translation Track
**Status: COMPLETE.** Feature commits 7cc32e9 + 8539c0c + 167537b. Workflow 35689847142 build/deploy successful.

### Roadmap #25 — Beat/BPM Detection
**Status: COMPLETE.** Feature commits aa5ea42 + 82c2476. Workflow 35693502669 build/deploy successful.

### Roadmap #26 — Beat-Synced Effects
**Status: COMPLETE.** Feature commits e4d5dab + 6578d1f + 769d795. Workflow 35698201168 build/deploy successful.

### Roadmap #27 — Scene Timeline
- [x] Editable ordered scene list with start/end time and scene labels
- [x] Compact proportional scene-strip visualization
- [x] Per-scene effect intensity and opacity automation
- [x] Scene configuration persisted locally and applied immediately to live preview
- [x] Export renderer consumes the same scene timeline
- [x] Absolute render time keeps scene boundaries continuous across long-video segments
- [x] Scene count capped and controls remain mobile-safe without extra audio/video decoding
- [x] Long Video / multi-hour render regression inspection remains green
- [x] Build and Cloudflare deployment verified by workflow 35703360103

**Status: COMPLETE.** Feature commits 9cc898f + df49d2f + 92b0dde. Workflow 35703360103 build/deploy successful.

### Current focus
Roadmap #28 — Text / Logo / Watermark Layer. Start on the next run only. Exactly one roadmap task per run.
