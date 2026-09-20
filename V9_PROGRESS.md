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
- [x] 1x/non-long fallback keeps the original v8 renderer path (`totalDuration <= sourceDuration + .05`)
- [x] Build verification passes
- [x] Cloudflare deploy succeeds
- [x] Regression verification: v9 build + deploy pipeline passed after branding/workflow fixes

**Status: COMPLETE.** Long Video Loop is now closed; roadmap work may proceed sequentially.

## V9 roadmap

1. [ ] Project / Draft — save and reopen complete editing state
2. [ ] Autosave project
3. [ ] Undo / Redo
4. [ ] Batch Suno Links
5. [ ] Batch Download
6. [ ] Render Queue
7. [ ] Download ZIP Package
8. [ ] Filename Template
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

### Current focus
Roadmap #1 — Project / Draft. Do not skip to #2 until #1 is implemented and verified.

Progress for #1:
- [x] Versioned local project store (`components/v9/project-store.ts`)
- [x] Project manager UI with Save / New / Open / Rename / Delete (`components/v9/project-panel.tsx`)
- [x] Wire ProjectPanel to editor state and restore URL, aspect, waveform, template, motion, lyrics mode, karaoke timing, background controls, preview position, preset and Long Video Loop on Open
- [ ] Build verification + deploy (workflow triggered by commit `ba09a36`; awaiting result)
