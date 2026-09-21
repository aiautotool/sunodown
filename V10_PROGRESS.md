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

**Status: IMPLEMENTED.** Build/deploy verification is required for the commits completing this task before the run may stop.

### Current focus
Roadmap #10 — Favorite / Collection. Verify build/deploy green for the completion commit; fix and rerun if needed. Do not start #11 in this run.
