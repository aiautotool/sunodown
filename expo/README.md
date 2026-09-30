# SunoDown V24 React Native / Expo

Đây là client universal mới của nhánh `v24react`.

## Mục tiêu

- Một codebase React Native + Expo cho Android, iOS và Web.
- Giữ visual language của SunoDown v24: dark creator studio, violet accent, sidebar desktop, bottom navigation mobile, live preview, inspector, timeline, library và global player.
- Giữ backend Cloudflare/API của v24 thay vì chép các route server vào app mobile.
- Audio playback dùng `expo-audio`, hỗ trợ background playback và lock-screen controls.
- State local dùng AsyncStorage.
- Subtitle mới gọi lại backend với `force: true` + `noCache: true`.

## Chạy local

```bash
cd expo
npm install
npx expo install --fix
npm run web
# hoặc
npm run android
npm run ios
```

API mặc định là `https://picai.online`. Có thể đổi:

```bash
EXPO_PUBLIC_API_BASE=https://your-api.example npm run web
```

## Build

```bash
cd expo
npx eas-cli login
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile production
npx expo export --platform web
```

## Kiến trúc migration

```
v24 Cloudflare backend
  /api/resolve
  /api/music/*
  /api/karaoke/*
  render/mastering services
        |
        v
expo/
  App.tsx
  src/api.ts
  src/EmptyCreate.tsx
  src/StudioScreen.tsx
  src/LibraryScreen.tsx
  src/MusicPlayer.tsx
  src/SecondaryScreens.tsx
```

Web v24 cũ vẫn còn ở root để backend không bị gián đoạn trong thời gian chuyển đổi. Khi Expo Web đạt parity hoàn toàn, bước cuối mới chuyển production web entry sang Expo output.
