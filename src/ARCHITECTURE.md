# v26 Source Architecture

v26 reorganizes SunoDown by responsibility while keeping Next/vinext route compatibility.

```
src/
  api/          # typed client-side API gateways
  assets/       # source-controlled non-public assets
  components/
    layout/     # app shell/navigation
    ui/         # generic reusable primitives
    creator/    # Create/preview/editor composition
    music/      # Music experience
    stems/      # Vocal/stem separation UI
  context/      # cross-feature React context
  data/         # static catalogs/configuration
  hooks/        # reusable React hooks
  pages/        # page-level feature compositions (routes remain app/)
  redux/        # reserved; use only if global reducer state is introduced
  services/
    audio/      # audio processing/mastering
    karaoke/    # subtitle/alignment
    media/      # media/download/resolve
    render/     # rendering/export
    stems/      # UVR/stem separation
  utils/        # pure shared utilities
```

## Boundaries

- `app/` is only the framework routing/server boundary: pages, route handlers, metadata and global CSS.
- `src/components/` owns UI; no direct database/remote-provider logic.
- `src/services/` owns domain logic and provider adapters.
- `src/api/` owns browser-to-server calls.
- `src/data/` owns static presets/catalogs.
- `src/hooks/` owns reusable React behavior.
- Existing version folders (`components/v3...v10`) are legacy compatibility code and are migrated feature-by-feature; new v26 code must not add another version folder.
- Imports should use `@/src/...` for v26 modules. Route files may temporarily import legacy modules until their feature is migrated.

This staged boundary avoids a big-bang path rewrite while making every new change land in the final structure.
