# Settings v24

Main screen: Account · Project Defaults · Subtitle · Audio & Export · Performance · Storage · Advanced.
Timeline lives under Project Defaults. Preview lives under Performance. Diagnostics are disclosed inside Advanced.

## Implemented on Web

- Versioned, validated local preferences; cross-tab updates; storage errors surfaced.
- Project defaults: aspect (9:16), output resolution, FPS, background, waveform, mastering and 5D. Applied when opening a new Suno song or local audio. Saved projects retain their own visual/mastering/export configuration.
- Timeline: snapping, snap interval, initial zoom, playhead auto-scroll, waveform visibility and delete confirmation. Seeking pauses playback; no automatic play from timeline clicks.
- Subtitle: default language, local retry policy and whole-timeline offset. Offset applies to newly generated/regenerated cues once, including words; persisted project timings are not shifted again. Cached source cues remain unshifted. Existing force regeneration remains per-song in the editor. Existing lyrics cleaning removes chords.
- Export: configured resolution/FPS reach the local renderer; smart video bitrate presets and optional screen wake lock. Existing projects/presets without resolution/FPS keep legacy renderer behavior.
- Performance: preview surface size and FPS independent of output; waveform sample detail; auto-preview default off.
- Storage: browser origin usage estimate, subtitle local-cache clearing, confirmed project/media deletion and settings reset.
- Account: existing Google sign-in/logout and Library entry point. Export preferences JSON only; not a full project backup.
- Advanced: app/build identity, issue/source links, optional subtitle debug entry and diagnostic export without tokens or project/song contents.

## Still required for the broader product specification

Account: authenticated Suno integration, cross-platform sync, project/media/preset backup, device/session management and server deletion.
Project: previous-project defaults, subtitle preset selection.
Subtitle: selectable engines, lead-in/out, word/line display policy, vocal/silence detection and no-pre-vocal guard.
Audio: individual normalization/LUFS/limiter/EQ controls and preview/export audio quality beyond the current per-project mastering system.
Render: server selection/fallback, H.265 capability negotiation, hardware policy, audio bitrate, bounded automatic retries, folders and plan-driven watermark policy.
Performance/editor/preview: thumbnail quality, memory/GPU policy where platforms permit it, background jobs, stream/download mode, configurable zoom bounds and frame display, track visibility defaults, fit/fill, grid and safe zones.
Library/storage: automatic scan/import policy, duplicate policy, artwork/offline caching, sort/private filters, cache categories, retention and original-media/download policy.
Notifications/privacy/support: completion/error alerts, update checks, privacy/terms pages, cloud-history controls, support log consent and changelog.
Native apps: share the preference schema via the core package and implement platform persistence/capability adapters; current settings implementation is Web only.

Unavailable functionality is explained inside its relevant group, without active controls that promise unsupported behavior. Do not expose API credentials or arbitrary backend overrides in normal Settings.

## Verification

`node --experimental-strip-types --test tests/studio-settings.test.ts`
`npm run test:karaoke`

Browser verification covers seven-group navigation, persisted FPS after reload and stylesheet/module loading. Export at all output sizes/FPS requires device-level codec testing; 4K/60 performance is not verified by these checks. Repository-wide TypeScript/lint has existing unrelated errors and cannot currently be described as passing.
