# Scene Engine v25 — local foundation and FX slice

Branch: v25. Source snapshot prepared for the user-authorized push on 2026-10-01. This is an incremental implementation, not full Scene Engine V1 acceptance.

## Implemented

- Portable SceneDocument v4: canvas, layers, asset references, slots, wind data, masks, blend modes, animation tracks.
- Validation and JSON round-trip; rejection of invalid hierarchies, missing assets, unsupported versions, invalid numbers, unsafe animation paths, unordered keyframes.
- Legacy visual migration without removing preset v3 or its existing renderer.
- Deterministic millisecond evaluator: sibling ordering, group transforms/visibility/opacity, keyframes/easing, seeded frame state.
- Snapshot render-plan foundation. This is not a complete backend compiler.
- A shared Canvas FX adapter used by preview and MP4 export: time ranges, keyframes, seed, transforms, masks and blending.
- FX editor: eight initial effects, repeated instances, rename, hide, lock, reorder, duplicate, delete, per-layer controls, transforms, opacity keyframes and undo/redo.
- Autosave/reload of FX layers through the existing IndexedDB project store. Legacy project fields remain to support the current renderer.
- Save/update/duplicate/apply/export/import of FX scene data through the existing preset JSON flow. The preset envelope remains v3 with an optional validated SceneDocument v4; it is not yet the native preset v4 package.
- Each FX instance now has its own timeline row and timed clip. Select a clip to edit its properties in the right Inspector; drag clips or their edges to move/trim, and toggle visibility/lock per layer. The detached panel above preview was removed.
- Local MEDIA_TOKEN_SECRET is stored in ignored .dev.vars. The local server was restarted and /api/resolve verified to return 200 with media tokens.

## Dynamic timeline and template timing increment

- The editor now mounts SceneTimeline, a lane projection of SceneDocument, replacing the four fixed expanded categories in its main editing view.
- The desktop timeline spans the full workspace width below canvas and Inspector. Ruler and layer headers stick within a single horizontal/vertical scroll surface.
- Media clips refer to layer/asset IDs, have image thumbnail strips, and support move/trim/split/duplicate/delete, snap, and main-track ripple delete. Video source offsets reach preview and export.
- Karaoke cues are separate clips; moving/trim updates cue and word timing. Audio waveform comes from decoded PCM.
- Repeated FX share the scene evaluator and can be selected, split, duplicated, trimmed, hidden/locked, and undone in the scene timeline. Timeline history currently excludes Inspector changes.
- Legacy title/artist/visualizer/audio controls remain read-only on this timeline until their renderer migration; they are still edited with their original controls. Media visibility/lock is also not yet connected.
- Template core supports full, relative, anchors, and lyrics rules; default template capture excludes audio and lyrics. Existing presets remain style presets. Save/import preserves validated template timing; the editor currently applies style and resolved FX timing, not the entire saved scene.
- Archive packaging and imported blob asset restoration remain pending. Current preset transport is JSON and cannot claim portable media assets.

## Verified locally

- Production build succeeds.
- `npm test`: all 58 current regression tests pass, including scene FX with an empty legacy effect list and timed/keyframed FX.
- Scoped lint passes for scene core, FX panel, render-model adapter and Canvas scene adapter.
- Browser test at localhost:3001 using a generated three-second WAV: open audio, Customize, add smoke, duplicate, edit density/blend, autosave, render MP4, reload and recover both layers.
- Browser check of the new timeline: selecting rain opens Inspector; duplicate creates another lane; Undo removes that duplicate and retains the original five FX.
- Whole-repository TypeScript checking still fails on existing errors. Compared with HEAD using a temporary archive; no errors added in changed modules.

## Remaining before Scene Engine V1 acceptance

The current document is a migration bridge. Only FX rendering is driven by the new evaluator; background, template, text, waveform and karaoke still use the existing renderer/model. The document is not yet the sole editable source of truth.

- Full layer editor and selection shared between canvas and per-layer timeline; groups/components, media masks and editor history beyond FX.
- Asset ingestion/hash/deduplication and blob lifecycle. The asset schema exists, but the legacy media pipeline is not migrated yet.
- Native scene/preset v4 store, Smart Slot binding and component preset management.
- ZIP-compatible .sdpreset packaging with assets and archive safety limits.
- Karaoke evaluation in scene core and removal of ambient legacy FX timeline state.
- Registry-driven renderer capabilities, global wind controls and performance profiles.
- Web/Skia/server renderer adapters for all layer types.
- Pixel/frame parity comparison and the full Haunted Mirror acceptance scenario.

A successful short MP4 is a smoke test, not proof of full scene parity, mobile performance or long-video export stability. Do not mark the whole BRD complete or describe this snapshot as the finished Scene Engine V1.

## Workspace usability correction

Preview uses an aspect-preserving container fit instead of a capped, overflowing stage. The advanced desktop workspace is fixed below the app header; save/export stay in its top toolbar. Media suggestions collapse by default. Timeline auto-fits to viewport width, with a Fit button and multiplicative zoom. Browser observation confirmed complete landscape and portrait frames on the current local project; the full scene migration limitations above still apply.

Preview priority update: timeline defaults to 190px and has an adjustable height slider. Project/render status lives in the workspace toolbar; media suggestions moved to Inspector. Expanded-preview mode hides Inspector/timeline and restores them via Back to editor. Text tracks are compact; centered Play affordance is hidden while not hovered. Selecting an FX layer shows its properties separately from project tools. Local browser verified portrait fit, expanded mode, return to editor, and contextual FX Inspector; production build succeeds.

Simplified editor shell: four primary tool groups (Templates, Media, Text, Audio), advanced tools in disclosure, FX Inspector mounted only for a selected FX or Add Effects mode. Preset management and secondary exports have disclosure menus. Timeline edit actions appear for editable selections; snap/ripple move to an overflow menu, workspace sizing to a disclosure. Existing render and persistence pipelines remain unchanged by this shell revision.
