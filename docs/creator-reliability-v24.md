# Creator reliability — v24

Implemented in the existing Creator Studio workflow:

- Debounced IndexedDB draft saving (900 ms), serialized writes, visibility flush,
  embedded local audio/cover/media, and restoration through the project URL.
  Autosave replaces the history entry rather than adding an entry per edit.
- SSR-safe library/project initialization so a saved draft does not produce a
  hydration mismatch on reload.
- Forced subtitle regeneration waits for a successful forced POST; it never polls
  an old artifact through GET while another generation holds the lock. Timeout,
  provider error, or switching songs cannot replace the old corrected timeline.
- Timeline seeking uses the exact pointer time. Locked tracks reject edge dragging,
  splitting, deleting, pasting, and timing nudges. Track changes join Undo/Redo;
  switching songs resets timeline history. Deleting the last media clip does not
  resurrect an implicit cover.
- Export reads the track visibility/mute state and the configured FPS/resolution.
  Empty synced subtitle tracks never activate the legacy estimated-lyrics fallback.
  Studio export ignores unrelated legacy audio trim state. Original audio is
  decoded for waveform analysis when no mastered WAV exists.
- Render has cancellation, an approximate encoding ETA, and cleanup on failure or
  cancellation. Subtitle fallback, regeneration, highlight and cancellation events
  are accepted by analytics ingestion.

Validation:

- 40 regression tests: karaoke, backgrounds, effects, forced regeneration.
- Production build passes.
- Browser QA uses a generated four-second WAV: local import, preset application,
  automatic draft save, reload/recovery, cancellation and successful retry.
  The exported video element reports 720 × 1280 and 4.010667 seconds.
- Whole-repository TypeScript/lint still has errors outside this implementation.

This does not establish sample-accurate transcription for every song or pixel
identity for every preview/export effect. ASR providers can still be inaccurate;
actual song fixtures and rendered-frame comparisons are required for those release
criteria. Server render resume, cross-device cloud projects, native platform QA,
beat snapping and global editor history are additional work from the broader brief.
