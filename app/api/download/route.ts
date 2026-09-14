import { NextRequest, NextResponse } from 'next/server';
const API_URL = 'https://sunodownload.net/api/downloadsong';
function validSunoUrl(value: unknown): value is string { if (typeof value !== 'string' || value.length > 500) return false; try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'suno.com' || url.hostname.endsWith('.suno.com')); } catch { return false; } }
function safeName(name: unknown) { const value = typeof name === 'string' ? name : 'suno-audio'; return value.replace(/[\\/:*?"<>|\r\n]/g, '-').slice(0, 120) || 'suno-audio'; }
export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    if (!validSunoUrl(input)) return NextResponse.json({ error: 'Liên kết Suno không hợp lệ.' }, { status: 400 });
    const metadataResponse = await fetch(API_URL, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', origin: 'https://sunodownload.net', referer: 'https://sunodownload.net/' }, body: JSON.stringify({ input }) });
    const metadata = await metadataResponse.json() as Record<string, unknown>;
    if (!metadataResponse.ok || metadata.success !== true || typeof metadata.audio !== 'string') return NextResponse.json({ error: 'Không thể lấy file âm thanh.' }, { status: 502 });
    const audioUrl = new URL(metadata.audio);
    const allowedAudioHost = audioUrl.protocol === 'https:' && (audioUrl.hostname.endsWith('.cloudfront.net') || audioUrl.hostname === 'suno.ai' || audioUrl.hostname.endsWith('.suno.ai'));
    if (!allowedAudioHost) return NextResponse.json({ error: 'Nguồn âm thanh không được hỗ trợ.' }, { status: 502 });
    const audioResponse = await fetch(audioUrl.toString());
    if (!audioResponse.ok || !audioResponse.body) return NextResponse.json({ error: 'File âm thanh hiện không khả dụng.' }, { status: 502 });
    const extension = audioUrl.pathname.toLowerCase().endsWith('.mp3') ? 'mp3' : 'm4a';
    const title = safeName(metadata.songtitle);
    return new Response(audioResponse.body, { headers: { 'content-type': audioResponse.headers.get('content-type') || 'audio/mp4', 'content-disposition': `attachment; filename="${encodeURIComponent(title)}.${extension}"; filename*=UTF-8''${encodeURIComponent(title)}.${extension}`, 'cache-control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Dịch vụ đang bận. Vui lòng thử lại sau.' }, { status: 500 }); }
}
