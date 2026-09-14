import { NextRequest, NextResponse } from 'next/server';
import { createMediaToken } from '../../lib/media-token';
const API_URL = 'https://sunodownload.net/api/downloadsong';
function validSunoUrl(value: unknown): value is string { if (typeof value !== 'string' || value.length > 500) return false; try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'suno.com' || url.hostname.endsWith('.suno.com')); } catch { return false; } }
export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    if (!validSunoUrl(input)) return NextResponse.json({ error: 'Vui lòng nhập một liên kết Suno hợp lệ.' }, { status: 400 });
    const upstream = await fetch(API_URL, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', origin: 'https://sunodownload.net', referer: 'https://sunodownload.net/' }, body: JSON.stringify({ input }) });
    const data = await upstream.json() as Record<string, unknown>;
    if (!upstream.ok || data.success !== true || typeof data.audio !== 'string') return NextResponse.json({ error: 'Không tìm thấy bài hát. Hãy kiểm tra lại liên kết.' }, { status: 502 });
    const clipId = [data.video, data.audio].find((value): value is string => typeof value === 'string')?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
    let videoSource = typeof data.video === 'string' ? data.video : clipId ? `https://cdn1.suno.ai/${clipId}.mp4` : null;
    if (videoSource && typeof data.video !== 'string') {
      const videoCheck = await fetch(videoSource, { method: 'HEAD' });
      if (!videoCheck.ok) videoSource = null;
    }
    const playableSource = videoSource ?? data.audio;
    let clip: Record<string, unknown> | null = null;
    if (clipId) {
      const clipResponse = await fetch(`https://studio-api-prod.suno.com/api/clip/${clipId}`, { headers: { accept: 'application/json' } });
      if (clipResponse.ok) clip = await clipResponse.json() as Record<string, unknown>;
    }
    const metadata = clip?.metadata && typeof clip.metadata === 'object' ? clip.metadata as Record<string, unknown> : null;
    const rawPicture = typeof clip?.image_large_url === 'string' ? clip.image_large_url : typeof data.picture === 'string' ? data.picture : null;
    const picture = rawPicture?.replace('https://cdn2.suno.ai/', 'https://cdn1.suno.ai/') ?? null;
    const [audioToken, sourceAudioToken, videoToken, pictureToken] = await Promise.all([
      createMediaToken(playableSource, 'audio'),
      createMediaToken(data.audio, 'audio'),
      videoSource ? createMediaToken(videoSource, 'audio') : null,
      picture ? createMediaToken(picture, 'image') : null,
    ]);
    return NextResponse.json({
      id: clipId,
      embedUrl: clipId ? `https://suno.com/embed/${clipId}` : null,
      title: typeof clip?.title === 'string' ? clip.title : typeof data.songtitle === 'string' ? data.songtitle : 'Suno audio',
      picture: pictureToken ? `/api/image?token=${encodeURIComponent(pictureToken)}` : null,
      audio: `/api/audio?token=${encodeURIComponent(audioToken)}`,
      sourceAudio: `/api/audio?token=${encodeURIComponent(sourceAudioToken)}`,
      video: videoToken ? `/api/audio?token=${encodeURIComponent(videoToken)}` : null,
      description: typeof data.description === 'string' ? data.description : null,
      lyrics: typeof metadata?.prompt === 'string' ? metadata.prompt : null,
      style: typeof metadata?.tags === 'string' ? metadata.tags : typeof clip?.display_tags === 'string' ? clip.display_tags : null,
      tags: typeof metadata?.tags === 'string' ? metadata.tags : typeof clip?.display_tags === 'string' ? clip.display_tags : null,
      duration: typeof metadata?.duration === 'number' ? metadata.duration : null,
      creator: typeof clip?.display_name === 'string' ? clip.display_name : null,
      handle: typeof clip?.handle === 'string' ? clip.handle : null,
      createdAt: typeof clip?.created_at === 'string' ? clip.created_at : null,
      isPublic: typeof clip?.is_public === 'boolean' ? clip.is_public : null,
    });
  } catch { return NextResponse.json({ error: 'Dịch vụ đang bận. Vui lòng thử lại sau.' }, { status: 500 }); }
}
