# SunoDown V10 Progress

## P0 — Long Video Loop / Multi-hour Render
- [x] Loop count / target duration / presets
- [x] Seamless repeated audio packets and karaoke timing per loop
- [x] Continuous background/effects timeline
- [x] Segmented rendering + IndexedDB checkpoint/resume + final mux
- [x] Mobile-safe segment sizing/yielding and original renderer fallback
- [x] Implementation re-inspected on v10

**Status: COMPLETE / REGRESSION CHECK PASS (code inspection, 2026-09-21).** Rechecked duration resolution, segment/checkpoint resume path, absolute segment start time for continuous effects/background, renderer loopDuration path for repeated audio/karaoke, and 90s mobile segment cap/yield. No regression found.

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
- [x] Real Audio-tab trim editor with start/end controls and waveform-style range visualization
- [x] In-range playback preview with automatic stop/reset at trim end
- [x] Persistent trim state for mobile/desktop
- [x] Trim is consumed by video render: video timeline, audio packet selection and karaoke timing use the selected source range
- [x] Trimmed range repeats when Long Video Loop extends output; continuous absolute background/effects timeline retained
- [x] Mobile renderer retains cooperative yielding; long-video segmented checkpoint/resume path unchanged
- [x] Build + Cloudflare deployment verified

**Status: COMPLETE.** Commits 9ff1b77 + d926b4c + 043a8f7. Workflow 35643166119 build/deploy successful.

### Roadmap #16 — Fade In / Fade Out
- [x] Real Audio-tab Fade In / Fade Out controls with persistent 0–15s durations
- [x] Fade is applied to exported video audio, not mock UI
- [x] Fade envelope uses absolute output time: only the beginning/end of the complete output fades
- [x] Long Video Loop remains seamless between repeated audio cycles; no per-loop fade or silence gap
- [x] Segmented multi-hour render applies fade correctly only to segments touching global start/end
- [x] Trim range is respected before loop/fade processing
- [x] Video/background/effects/karaoke timeline remains unchanged; fade remuxes audio after visual render
- [x] Mobile-safe long-video segment sizing/checkpoint-resume path remains unchanged
- [x] Build + Cloudflare deployment verified by workflow 35649439562

**Status: COMPLETE.** Commits 85cf1d3 + 3c63c28 + 542a62d + 356f348 + cfb1772. Workflow 35649439562 build/deploy successful.

### Roadmap #17 — Vocal / Instrumental Separation
- [x] Real Audio-tab stem separation, not mock UI
- [x] Local stereo center/side extraction produces separate Vocal and Instrumental WAV blobs
- [x] Per-stem playback preview and WAV download
- [x] Cooperative chunked processing yields to the browser for mobile responsiveness
- [x] Source audio stays on-device; no stem upload/server dependency
- [x] Long Video Loop / multi-hour renderer paths are untouched and regression-check remains green
- [x] Build + Cloudflare deployment verified by workflow 35655769369

**Status: COMPLETE.** Commits a62c990 + d69376e. Workflow 35655769369 build/deploy successful.

### Current focus
Roadmap #18 — Waveform Lyrics Editor. Start on the next run only. Exactly one roadmap task per run.

### Unified app redesign — approved mockup
- [x] Rebuilt shell as SunoDown v10 with shared navigation language on desktop/mobile
- [x] Desktop left navigation + compact top command bar
- [x] Responsive dashboard grid with editor workspace and tool rail
- [x] Mobile keeps the same visual system and feature hierarchy rather than a separate UI
- [x] Existing Presets, Subtitle, Effects, Background, Audio Processing, LUFS, A/B, Library and Render functionality preserved
- [x] Mobile preset/effect tracks remain independently swipeable
- [x] Build/deploy verification — workflow 35624996890

**Status: COMPLETE.** Unified redesign build/deploy succeeded.

### Mobile fidelity correction — supplied reference
- [x] Added reference-style compact mobile header with Menu / SunoDown v10 / Export
- [x] Added Song / Library / Queue segmented navigation under header
- [x] Added Video / Audio / Lyrics / BG editor navigation matching reference hierarchy
- [x] Restyled mobile feature cards to the same dark compact panel language
- [x] Preserved real Presets, Subtitle, Effects, Background, Long Video, LUFS, Audio Processing, A/B and render behavior
- [x] Desktop continues to use the same visual language responsively
- [x] Build/deploy verification — workflow 35625801491

**Status: COMPLETE.**

### Reference-accurate navigation refactor
- [x] Re-analyzed supplied three-screen mockup as stateful app navigation, not anchor links
- [x] Song / Library / Queue are real state tabs
- [x] Video / Audio / Lyrics / BG are real editor tabs with progressive disclosure
- [x] Project / Presets / Effects / More bottom tools are real state controls
- [x] Editor controls are tagged/scoped to their owning tab instead of one long settings page
- [x] Audio Processing + LUFS + A/B grouped under Audio workspace
- [x] Existing render, long-video, subtitle, background, preset and effects logic retained
- [x] Build/deploy verification — workflow 35626589087

**Status: COMPLETE.**
