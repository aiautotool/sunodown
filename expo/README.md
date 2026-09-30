# SunoDown V24 React Native / Expo

Đây là ứng dụng universal độc lập của nhánh `v24react`.

## Mục tiêu

- Một codebase React Native + Expo cho Android, iOS và Web.
- Giữ visual language của SunoDown v24: dark creator studio, violet accent, sidebar desktop, bottom navigation mobile, live preview, inspector, timeline, library và global player.
- Frontend và backend của v24react chạy độc lập tại `sunoapp.aiautotool.com`.
- Không gọi hoặc phụ thuộc vào backend `picai.online`.
- Web gọi API same-origin qua `/api/*`.
- Android/iOS mặc định gọi `https://sunoapp.aiautotool.com`.
- Audio playback dùng `expo-audio`, hỗ trợ background playback và lock-screen controls.
- State local dùng AsyncStorage.
- Subtitle cloud, Groq, music state, render jobs và storage cloud thuộc stack v24react riêng.

## Hạ tầng riêng

```
sunoapp.aiautotool.com
        |
        v
sunodown-v24react Worker
  ├─ Expo Web assets
  ├─ /api/resolve
  ├─ /api/music/*
  ├─ /api/karaoke/*
  ├─ Durable Object: MUSIC_USERS
  ├─ Durable Object: MUSIC_DIRECTORY
  ├─ Durable Object: SUBTITLE_STORE
  ├─ D1: sunoapp-v24react-db
  ├─ R2: sunoapp-v24react-render-results
  └─ Queue: sunoapp-v24react-render-jobs
```

Renderer container cũng có cấu hình Worker riêng `sunodown-v24react-renderer`. Nếu tài khoản/token Cloudflare chưa có quyền Containers, renderer được giữ disabled và **không fallback sang renderer dùng chung**.

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

Native API mặc định:

```bash
EXPO_PUBLIC_API_BASE=https://sunoapp.aiautotool.com
```

Trên Web, không cần đặt biến này vì client dùng same-origin.

## Build

```bash
cd expo
npx eas-cli login
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile production
npx expo export --platform web
```

## Deploy Web + API

Workflow chính:

```
.github/workflows/deploy-v24react.yml
```

Pipeline build backend v24react, build Expo Web, ghép Expo làm frontend của Worker riêng, provision D1/R2/Queue riêng rồi deploy lên `sunoapp.aiautotool.com`.
