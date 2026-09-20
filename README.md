# sunodown

Trình tải và phát nhạc Suno chạy trên Cloudflare Workers.

## Karaoke lyrics trong Gen Video

Khi bài Suno có lyrics, phần **Xem lời bài hát** có Karaoke Timing Editor:

- **Auto Sync trên máy**: không cần Python, GPU server, API key hay cấu hình.
- WebGPU được ưu tiên; nếu máy/browser không có WebGPU thì tự fallback sang WASM.
- Whisper chạy trong Web Worker để không khóa giao diện.
- Audio được decode và resample 16 kHz mono ngay trong browser.
- Word timestamps được fuzzy/monotonic-align lại với **lyrics gốc Suno**. ASR không được phép thay lời.
- Dùng chunk 29 giây để tránh lỗi timestamp từng được ghi nhận với chunk 30 giây.
- Tap Sync theo từng câu là fallback thủ công.
- Chỉnh start/end từng câu và từng từ.
- Nudge toàn bài hoặc từng câu.
- Preview từ đang hát.
- Import/export timing JSON.
- Export ASS karaoke, Enhanced LRC và SRT.
- **Tạo video Karaoke** dùng chính timeline đã chỉnh.

### Luồng mặc định — không cần setup

```
Dán link Suno
  -> lấy audio + lyrics
  -> bấm Auto Sync trên máy
  -> tải Whisper model vào browser (lần đầu)
  -> WebGPU/WASM xử lý audio
  -> word timestamps thô
  -> fuzzy alignment với lyrics gốc Suno
  -> editor/preview
  -> Gen Video karaoke
```

Transformers.js được tải on-demand từ jsDelivr khi người dùng bấm Auto Sync, vì vậy project không cần thêm dependency vào `package-lock.json`.

### Service alignment tùy chọn

Thư mục `services/karaoke-align` vẫn được giữ cho trường hợp sau này muốn chạy server GPU. Đây **không phải** yêu cầu để chức năng Auto Sync mặc định hoạt động.

Endpoint `POST /api/karaoke/align` cũng chỉ là fallback server tùy chọn.
