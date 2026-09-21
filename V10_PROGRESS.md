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
13. [x] A/B Audio Compare
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
**Status: COMPLETE.**

### Roadmap #10 — Favorite / Collection
**Status: COMPLETE.** Build/deploy verified by workflow 35603949982.

### Roadmap #11 — True LUFS / True Peak Meter
**Status: COMPLETE.** Commits c6b7e89 + 5dfa4a7; workflow 35610111970 successful.

### Roadmap #12 — Audio Processing Presets
**Status: COMPLETE.** Commits 32586b0 + 24f1a8a; workflow 35617230416 successful.

### Mobile UI regression repair — preset/subtitle/effects
- [x] Removed parent-level horizontal studio carousel that clipped/invisibly displaced injected controls
- [x] Restored normal studio DOM flow so Preset Gallery enhancer remains visible and clickable
- [x] Preset cards keep their own horizontal swipe track on mobile
- [x] Subtitle mode + Edit Style remain in the normal editor flow
- [x] Effects portal slot remains visible; effect choices use their own horizontal mobile track
- [x] Existing Background, Long Video, Project, Filename and render controls preserved
- [x] Repair included in current v10 build/deploy verification

**Status: COMPLETE.**

### Roadmap #13 — A/B Audio Compare
- [x] Real A/B player mounted in the app
- [x] A plays original resolved Suno audio
- [x] B renders the selected Audio Processing Preset using the existing offline processing engine
- [x] Switching A/B preserves playback position and playing state
- [x] Processed object URLs are revoked/rebuilt safely when song/preset changes
- [x] Mobile-friendly two-button comparison UI
- [x] Build + Cloudflare deploy verification

**Status: COMPLETE.** Commits 2d326f5 + 658b469. Verification recorded after green workflow.

### Current focus
Roadmap #14 — TikTok Calibrated Profile. Start on the next run only. Exactly one roadmap task per run.
