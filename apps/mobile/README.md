# SunoDown Mobile MVP

React Native / Expo SDK 57 client for the SunoDown shared platform.

Implemented vertical slice:
1. Paste Suno URL
2. Resolve/analyze via the existing backend
3. Select one of three mobile-first quick presets
4. Preview song + preset
5. Submit an AI Music Video render job
6. Poll render progress
7. Save the completed MP4 to the media library or share it with the native share sheet

The app imports the shared contracts from `packages/core` and includes a normalized `RenderJob` contract with each server render request.

## Local
```bash
cd apps/mobile
npm install
npx expo start
```

## Native validation
CI performs Expo export for iOS + Android and Android prebuild/Gradle debug APK generation. Store-signed App Store/Play Store binaries require signing credentials and are intentionally separate from source/CI validation.
