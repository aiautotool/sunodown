# SunoDown V10 Progress

## P0 — Long Video Loop / Multi-hour Render
- [x] Loop count / target duration / presets
- [x] Seamless repeated audio packets and karaoke timing per loop
- [x] Continuous background/effects timeline
- [x] Segmented rendering + IndexedDB checkpoint/resume + final mux
- [x] Mobile-safe segment sizing/yielding and original renderer fallback
- [x] Implementation re-inspected on v10

**Status: COMPLETE / REGRESSION CHECK PASS (code inspection).**

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

### Roadmap #9 — Local Library / History
- [x] Persist resolved/downloaded song history locally
- [x] Search/filter and reopen an item without re-entering the Suno URL
- [x] Mobile-safe metadata-only storage, 100-item cap, remove/clear controls
- [x] Render Queue exposes completion callback so successful queued renders can be persisted by the library integration
- [x] Enable v10 in Cloudflare build/deploy workflow with background-render bindings
- [x] Wire resolved + direct/queued render completion to the current song history record end-to-end
- [x] Build verification + Cloudflare deploy on v10

**Status: COMPLETE.**

### Roadmap #10 — Favorite / Collection
- [x] Favorite/unfavorite persisted songs
- [x] Filter library to favorites
- [x] Create/delete named collections with a mobile-safe 30-collection cap
- [x] Add/remove songs from collections and filter by collection
- [x] Preserve favorites/collections when song lifecycle metadata is updated
- [x] Real local persistence; no mock-only controls
- [x] Build/deploy verified by workflow 35603949982

**Status: COMPLETE.**

### Roadmap #11 — True LUFS / True Peak Meter
- [x] Analyze the resolved full audio locally in-browser
- [x] K-weighting filter and 400 ms / 100 ms overlap loudness blocks
- [x] BS.1770/EBU-style absolute -70 LUFS and relative -10 LU gating
- [x] Channel-weighted integrated loudness result in LUFS
- [x] 4x inter-sample True Peak scan reported as dBTP
- [x] Abort/restart analysis safely when the active song changes
- [x] Responsive V10 meter UI mounted in the real app
- [x] Build + Cloudflare deploy verified by workflow 35610111970

**Status: COMPLETE.** Commits c6b7e89 + 5dfa4a7; workflow 35610111970 completed successfully including Build, background-render resource provisioning, deploy with bindings, and deploy-success marker.

### Roadmap #12 — Audio Processing Presets
- [x] Six real presets: Original, Balanced, Warm, Punch, Vocal and Social
- [x] Persistent preset selection in localStorage
- [x] Web Audio offline processing engine with low/mid/high EQ, dynamics compression and output gain
- [x] WAV encoder for processed AudioBuffer output
- [x] Mobile-friendly horizontally scrollable preset UI mounted in the real app
- [x] Build + Cloudflare deploy verified by workflow 35617230416

**Status: COMPLETE.** Commits 32586b0 + 24f1a8a; workflow 35617230416 completed Build and Cloudflare deploy with background-render bindings successfully.

### Current focus
Roadmap #13 — A/B Audio Compare. Start on the next run only; #12 is complete and verified. Exactly one roadmap task per run.

### Mobile UI correction — 2026-09-21
- [x] Compact song header for phone screens
- [x] Studio settings reorganized as horizontal snap/swipe cards instead of one long vertical stack
- [x] Per-panel vertical scrolling capped to mobile viewport height
- [x] Render actions reorganized into a compact sticky mobile action surface
- [x] Touch targets/summary rows adjusted for mobile interaction
- [x] V10 branding corrected in core workspace
- [ ] Build/deploy verification for mobile correction

**Status: VERIFYING.** This is a mobile usability correction and does not advance roadmap #13.
