# SunoDown multi-platform foundation

## Goal
Keep one product model across Web, iOS and Android without forcing all clients to use browser APIs.

## Architecture
- `packages/core`: serializable project, render-job, persistence and audio contracts. No DOM, IndexedDB, Web Audio or React dependency.
- Web adapters: IndexedDB, Web Audio and current browser renderer.
- Mobile adapters: SQLite/filesystem, native audio/media APIs and React Native UI.
- Heavy export: normalized `RenderJob` can be submitted to a server renderer.

## Rules for new features
1. Product state belongs in a serializable core model.
2. Browser/native APIs live behind adapters.
3. Preview and export derive from the same normalized configuration.
4. Asset payloads are referenced by URI/id in shared contracts; platform storage owns the bytes.
5. New UI must not embed persistence or render transport logic.

## Migration
The current v17 UI remains compatible. Existing IndexedDB project data stays readable while the web repository implements the shared persistence interface.

## Mobile target
React Native/Expo clients should consume `packages/core` and provide native adapters for storage, filesystem, media picker/share, notifications and render-job status.
