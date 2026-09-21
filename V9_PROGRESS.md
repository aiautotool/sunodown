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

**Status: COMPLETE.** Long Video Loop is closed; roadmap work proceeds sequentially.

## V9 roadmap

1. [x] Project / Draft — save and reopen complete editing state
2. [x] Autosave project
3. [x] Undo / Redo
4. [x] Batch Suno Links
5. [x] Batch Download
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

### Roadmap #1 — Project / Draft
- [x] Versioned local project store (`components/v9/project-store.ts`)
- [x] Project manager UI with Save / New / Open / Rename / Delete (`components/v9/project-panel.tsx`)
- [x] Wire ProjectPanel to editor state and restore URL, aspect, waveform, template, motion, lyrics mode, karaoke timing, background controls, preview position, preset and Long Video Loop on Open
- [x] Build verification + Cloudflare deploy: push workflow for `0c3f6a3` completed successfully (run 35543373677)

**Status: COMPLETE.**

### Roadmap #2 — Autosave project
- [x] Debounced autosave for active saved/opened projects (900 ms)
- [x] Autosave persists the complete serializable editor state through the same versioned project store
- [x] New unsaved work is not silently added to the project library; first explicit Save establishes the project identity
- [x] Prevent autosave feedback/render loops by tracking a stable serialized editor-state signature
- [x] Build verification + Cloudflare deploy succeeded for autosave tracking HEAD `c979d19` (run 35546069478)

**Status: COMPLETE.**

### Roadmap #3 — Undo / Redo
- [x] Bounded 50-state editor history for the complete serializable V9 editing state
- [x] Undo and redo restore editor state through the same project restore path
- [x] Undo / Redo controls in Project panel
- [x] Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y (outside text inputs)
- [x] Opening a project resets history so edits cannot leak between projects
- [x] Build verification + Cloudflare deploy succeeded for Undo / Redo tracking HEAD `e9224d` (run 35549442431)

**Status: COMPLETE.**

### Roadmap #4 — Batch Suno Links
- [x] Parse/paste multiple Suno links safely
- [x] Validate, normalize and de-duplicate links
- [x] Batch list UI with per-item status/removal
- [x] Integrate batch input with existing single-link workflow without breaking it
- [x] Build verification + Cloudflare deploy succeeded for `b85aeee` (run 35550361088)

**Status: COMPLETE.**

### Roadmap #5 — Batch Download
- [x] Per-item real audio download through existing `/api/resolve` + media proxy
- [x] Sequential “Download all” pipeline to avoid concurrent memory/network spikes on mobile
- [x] Per-item resolving/downloading/done/error status and retry
- [x] Safe numbered filenames derived from resolved song title
- [x] Build verification + Cloudflare deploy: latest v9 HEAD `bf883d5` passed run 35559655045 after Batch Download implementation, confirming the integrated branch builds and deploys successfully

**Status: COMPLETE.**

### Current focus
Roadmap #6 — Render Queue. Do not skip to #7 until #6 is implemented and verified.
