import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const alignUrl = process.env.KARAOKE_ALIGN_URL;
  if (!alignUrl) {
    return NextResponse.json(
      { error: 'Chưa cấu hình KARAOKE_ALIGN_URL cho dịch vụ forced-alignment.' },
      { status: 503 },
    );
  }

  try {
    const incoming = await request.formData();
    const audio = incoming.get('audio');
    const lyrics = incoming.get('lyrics');
    const language = incoming.get('language');

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Thiếu audio.' }, { status: 400 });
    }

    if (audio.size > 80 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio vượt quá giới hạn 80MB.' }, { status: 413 });
    }

    const form = new FormData();
    form.set('audio', audio, audio.name || 'song.audio');
    const hasLyrics = typeof lyrics === 'string' && Boolean(lyrics.trim());
    if (hasLyrics) form.set('lyrics', lyrics);
    form.set('language', typeof language === 'string' && language ? language : 'vi');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    try {
      const targetPath = hasLyrics ? '/align' : '/transcribe';
      const headers: Record<string, string> = {};
      if (process.env.KARAOKE_ALIGN_TOKEN) {
        headers.authorization = `Bearer ${process.env.KARAOKE_ALIGN_TOKEN}`;
      }
      const response = await fetch(new URL(targetPath, alignUrl).toString(), {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      });
      const body = await response.text();
      if (!response.ok) {
        let message = 'Dịch vụ căn lời không xử lý được bài hát.';
        try { message = JSON.parse(body)?.detail || JSON.parse(body)?.error || message; } catch {}
        return NextResponse.json({ error: message }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
      }
      return new NextResponse(body, {
        status: 200,
        headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Dịch vụ căn lời xử lý quá lâu.'
      : 'Không kết nối được dịch vụ căn lời.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
