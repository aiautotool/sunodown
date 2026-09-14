import { NextRequest, NextResponse } from 'next/server';

const API_URL = 'https://sunodownload.net/api/downloadsong';

function validSunoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'suno.com' || url.hostname.endsWith('.suno.com'));
  } catch { return false; }
}

function safeName(name: unknown) {
  const value = typeof name === 'string' ? name : 'suno-video';
  return value.replace(/[\\/:*?"<>|\r\n]/g, '-').slice(0, 120) || 'suno-video';
}

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    if (!validSunoUrl(input)) return NextResponse.json({ error: 'Liên kết Suno không hợp lệ.' }, { status: 400 });

    const metadataResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', origin: 'https://sunodownload.net', referer: 'https://sunodownload.net/' },
      body: JSON.stringify({ input }),
    });
    const metadata = await metadataResponse.json() as Record<string, unknown>;
    if (!metadataResponse.ok || metadata.success !== true || typeof metadata.video !== 'string') {
      return NextResponse.json({ error: 'Bài hát này chưa có video MP4.' }, { status: 502 });
    }

    const videoUrl = new URL(metadata.video);
    const allowedHost = videoUrl.protocol === 'https:' && (videoUrl.hostname === 'suno.ai' || videoUrl.hostname.endsWith('.suno.ai'));
    if (!allowedHost) return NextResponse.json({ error: 'Nguồn video không được hỗ trợ.' }, { status: 502 });

    const videoResponse = await fetch(videoUrl.toString());
    if (!videoResponse.ok || !videoResponse.body) return NextResponse.json({ error: 'Video hiện không khả dụng.' }, { status: 502 });

    const title = safeName(metadata.songtitle);
    const headers = new Headers({
      'content-type': 'video/mp4',
      'content-disposition': `attachment; filename="${encodeURIComponent(title)}.mp4"; filename*=UTF-8''${encodeURIComponent(title)}.mp4`,
      'cache-control': 'private, no-store',
    });
    const length = videoResponse.headers.get('content-length');
    if (length) headers.set('content-length', length);
    return new Response(videoResponse.body, { headers });
  } catch {
    return NextResponse.json({ error: 'Dịch vụ đang bận. Vui lòng thử lại sau.' }, { status: 500 });
  }
}
