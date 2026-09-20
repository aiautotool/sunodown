# sunodown

Trình tải và phát nhạc Suno chạy trên Cloudflare Workers.

## Karaoke lyrics trong Gen Video

Khi bài Suno có lyrics, phần **Xem lời bài hát** có thêm Karaoke Timing Editor:

- Auto estimate timing.
- **Tap Sync** theo từng câu ngay khi nghe audio.
- Chỉnh start/end từng câu.
- Chỉnh start/end từng từ.
- Nudge toàn bài hoặc từng câu.
- Preview từ đang hát.
- Import/export timing JSON.
- Export ASS karaoke, Enhanced LRC và SRT.
- **Tạo video Karaoke** dùng chính timeline đã chỉnh.

### Auto Sync AI

Web app có endpoint proxy:

```
POST /api/karaoke/align
```

Để dùng Auto Sync AI, chạy service trong:

```
services/karaoke-align
```

Sau đó cấu hình:

```
KARAOKE_ALIGN_URL=https://your-align-service.example.com
```

Service thực hiện:

```
Suno audio
  -> Demucs tách vocal
  -> faster-whisper lấy rough word timestamps
  -> fuzzy monotonic alignment với lyrics gốc Suno
  -> nội suy từ bị ASR bỏ sót
  -> line + word timestamps
```

Lyrics gốc từ Suno luôn là nguồn text cuối cùng; ASR chỉ dùng để tìm thời gian, không thay thế lời bài hát.
