import { NextRequest, NextResponse } from 'next/server';
import { createMediaToken } from '../../lib/media-token';

function validSunoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'suno.com' || url.hostname.endsWith('.suno.com')); }
  catch { return false; }
}

function clipIdFromPage(html: string) {
  return html.match(/<link[^>]+rel="canonical"[^>]+href="https:\/\/suno\.com\/song\/([0-9a-f-]{36})"/i)?.[1]
    ?? html.match(/suno\.com\\?\/song\\?\/([0-9a-f-]{36})/i)?.[1]
    ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    if (!validSunoUrl(input)) return NextResponse.json({ error: 'Vui lòng nhập một liên kết Suno hợp lệ.' }, { status: 400 });
    const pageResponse = await fetch(input, { headers: { accept: 'text/html' }, redirect: 'follow' });
    if (!pageResponse.ok) return NextResponse.json({ error: 'Không thể đọc trang bài hát Suno.' }, { status: 502 });
    const clipId = clipIdFromPage(await pageResponse.text());
    if (!clipId) return NextResponse.json({ error: 'Không tìm thấy mã bài hát trong metadata Suno.' }, { status: 502 });
    const clipResponse = await fetch(`https://studio-api-prod.suno.com/api/clip/${clipId}`, { headers: { accept: 'application/json' } });
    if (!clipResponse.ok) return NextResponse.json({ error: 'Không lấy được metadata bài hát từ Suno.' }, { status: 502 });
    const clip = await clipResponse.json() as Record<string, unknown>;
    const metadata = clip.metadata && typeof clip.metadata === 'object' ? clip.metadata as Record<string, unknown> : null;
    const mediaUrls = Array.isArray(clip.media_urls) ? clip.media_urls as Array<Record<string, unknown>> : [];
    const audioSource = mediaUrls.find(media => typeof media.url === 'string' && String(media.content_type).startsWith('m4a'))?.url
      ?? mediaUrls.find(media => typeof media.url === 'string' && String(media.content_type).startsWith('mp3'))?.url
      ?? clip.audio_url;
    if (typeof audioSource !== 'string' || audioSource.includes('/api/forbidden')) return NextResponse.json({ error: 'Suno chưa cung cấp nguồn âm thanh cho bài này.' }, { status: 502 });
    const videoSource = typeof clip.video_url === 'string' && clip.video_url.startsWith('https://') ? clip.video_url : null;
    const picture = typeof clip.image_large_url === 'string' ? clip.image_large_url : typeof clip.image_url === 'string' ? clip.image_url : null;
    const [audioToken, videoToken, pictureToken] = await Promise.all([
      createMediaToken(audioSource, 'audio'), videoSource ? createMediaToken(videoSource, 'audio') : null, picture ? createMediaToken(picture, 'image') : null,
    ]);
    const audio = `/api/audio?token=${encodeURIComponent(audioToken)}`;
    return NextResponse.json({
      id: clipId, title: typeof clip.title === 'string' ? clip.title : 'Suno audio',
      picture: pictureToken ? `/api/image?token=${encodeURIComponent(pictureToken)}` : null,
      audio, sourceAudio: audio, video: videoToken ? `/api/audio?token=${encodeURIComponent(videoToken)}` : null,
      description: null, lyrics: typeof metadata?.prompt === 'string' ? metadata.prompt : null,
      style: typeof metadata?.tags === 'string' ? metadata.tags : typeof clip.display_tags === 'string' ? clip.display_tags : null,
      tags: typeof metadata?.tags === 'string' ? metadata.tags : typeof clip.display_tags === 'string' ? clip.display_tags : null,
      duration: typeof metadata?.duration === 'number' ? metadata.duration : null,
      creator: typeof clip.display_name === 'string' ? clip.display_name : null,
      handle: typeof clip.handle === 'string' ? clip.handle : null, createdAt: typeof clip.created_at === 'string' ? clip.created_at : null,
      isPublic: typeof clip.is_public === 'boolean' ? clip.is_public : null,
    });
  } catch { return NextResponse.json({ error: 'Dịch vụ đang bận. Vui lòng thử lại sau.' }, { status: 500 }); }
}
