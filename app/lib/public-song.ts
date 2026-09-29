const API = 'https://studio-api-prod.suno.com/api/clip';

export const PUBLIC_SONG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicSong = {
  id: string;
  title: string;
  creator: string;
  handle?: string | null;
  description?: string | null;
  picture?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  lyrics?: string | null;
  style?: string | null;
  tags?: string | null;
  duration?: number | null;
  createdAt?: string | null;
  isPublic: boolean;
};

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstString(...values: unknown[]) {
  return values.find(
    (value): value is string =>
      typeof value === 'string' && Boolean(value.trim()),
  )?.trim() || null;
}

function mediaSource(
  mediaUrls: Array<Record<string, unknown>>,
  format: 'mp3' | 'm4a',
) {
  const match = mediaUrls.find((media) => {
    if (typeof media.url !== 'string') return false;
    const type = String(media.content_type ?? '').toLowerCase();
    let pathname = '';
    try {
      pathname = new URL(media.url).pathname.toLowerCase();
    } catch {}
    return format === 'mp3'
      ? type.includes('mp3') ||
          type.includes('mpeg') ||
          pathname.endsWith('.mp3')
      : type.includes('m4a') || pathname.endsWith('.m4a');
  });
  return typeof match?.url === 'string' ? match.url : null;
}

export async function getPublicSong(
  id: string,
): Promise<PublicSong | null> {
  if (!PUBLIC_SONG_UUID_RE.test(id)) return null;

  try {
    const response = await fetch(`${API}/${encodeURIComponent(id)}`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'SunoDown/23 (+https://picai.online)',
      },
      next: { revalidate: 900 },
    });

    if (!response.ok) return null;

    const clip = (await response.json()) as Record<string, unknown>;
    const metadata =
      clip.metadata && typeof clip.metadata === 'object'
        ? (clip.metadata as Record<string, unknown>)
        : {};
    const mediaUrls = Array.isArray(clip.media_urls)
      ? (clip.media_urls as Array<Record<string, unknown>>)
      : [];

    return {
      id,
      title: firstString(clip.title) || 'Suno song',
      creator:
        firstString(clip.display_name, clip.handle) || 'Suno creator',
      handle: asString(clip.handle),
      description: firstString(clip.description, metadata.description),
      picture: firstString(clip.image_large_url, clip.image_url),
      audioUrl:
        mediaSource(mediaUrls, 'mp3') ||
        mediaSource(mediaUrls, 'm4a') ||
        asString(clip.audio_url),
      videoUrl: asString(clip.video_url),
      lyrics: firstString(
        metadata.prompt,
        metadata.lyrics,
        clip.lyrics,
        clip.prompt,
      ),
      style: firstString(metadata.tags, clip.display_tags),
      tags: firstString(metadata.tags, clip.display_tags),
      duration:
        typeof metadata.duration === 'number'
          ? metadata.duration
          : typeof clip.duration === 'number'
            ? clip.duration
            : null,
      createdAt: asString(clip.created_at),
      isPublic: clip.is_public === true,
    };
  } catch {
    return null;
  }
}

export function songSeoKeywords(song: PublicSong) {
  const dynamic = [song.title, song.creator];

  const styleKeywords = (song.tags || song.style || '')
    .split(/[,;/|]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);

  return Array.from(
    new Set(
      [
        ...dynamic,
        ...styleKeywords,
        `${song.title} lyrics`,
        `${song.title} Suno`,
        `${song.title} nghe nhạc`,
        'nghe nhạc Suno',
        'Suno music',
        'Suno music player',
        'Suno lyrics',
        'nhạc AI',
        'AI music',
        'SunoDown Music',
      ].filter(Boolean),
    ),
  ).slice(0, 20);
}

export function songDescription(song: PublicSong) {
  const by = song.creator ? ` của ${song.creator}` : '';
  const style = song.style ? ` · ${song.style.slice(0, 80)}` : '';
  return `Nghe “${song.title}”${by} trên SunoDown Music. Phát nhạc online, xem lời bài hát và mở trực tiếp trong Creator Studio${style}.`.slice(
    0,
    160,
  );
}
