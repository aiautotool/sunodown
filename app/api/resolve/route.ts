import { NextRequest, NextResponse } from 'next/server';
const API_URL = 'https://sunodownload.net/api/downloadsong';
function validSunoUrl(value: unknown): value is string { if (typeof value !== 'string' || value.length > 500) return false; try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'suno.com' || url.hostname.endsWith('.suno.com')); } catch { return false; } }
export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    if (!validSunoUrl(input)) return NextResponse.json({ error: 'Vui lòng nhập một liên kết Suno hợp lệ.' }, { status: 400 });
    const upstream = await fetch(API_URL, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', origin: 'https://sunodownload.net', referer: 'https://sunodownload.net/' }, body: JSON.stringify({ input }) });
    const data = await upstream.json() as Record<string, unknown>;
    if (!upstream.ok || data.success !== true || typeof data.audio !== 'string') return NextResponse.json({ error: 'Không tìm thấy bài hát. Hãy kiểm tra lại liên kết.' }, { status: 502 });
    const playableSource = typeof data.video === 'string' ? data.video : data.audio;
    return NextResponse.json({ title: typeof data.songtitle === 'string' ? data.songtitle : 'Suno audio', picture: typeof data.picture === 'string' ? data.picture : null, audio: `/api/audio?source=${encodeURIComponent(playableSource)}`, description: typeof data.description === 'string' ? data.description : null });
  } catch { return NextResponse.json({ error: 'Dịch vụ đang bận. Vui lòng thử lại sau.' }, { status: 500 }); }
}
