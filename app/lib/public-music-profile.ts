const PROFILE_API = 'https://studio-api.prod.suno.com/api/profiles';

export const PUBLIC_HANDLE_RE = /^[A-Za-z0-9_.-]{1,80}$/;

export type PublicProfileSong = {
  id: string;
  title: string;
  creator: string;
  handle: string;
  picture?: string | null;
  duration?: number | null;
  tags?: string | null;
  createdAt?: string | null;
  isPublic: boolean;
  playCount?: number | null;
};

export type PublicMusicProfile = {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  songs: PublicProfileSong[];
  total: number;
};

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeHandle(value: string) {
  return decodeURIComponent(value).trim().replace(/^@/, '');
}

function mapClip(
  clip: Record<string, unknown>,
  fallbackHandle: string,
): PublicProfileSong | null {
  const id = asString(clip.id);
  if (!id) return null;

  const metadata =
    clip.metadata && typeof clip.metadata === 'object'
      ? (clip.metadata as Record<string, unknown>)
      : {};

  const handle = asString(clip.handle) || fallbackHandle;
  const isPublic = clip.is_public !== false;
  if (!isPublic) return null;

  return {
    id,
    title: asString(clip.title) || 'Untitled',
    creator: asString(clip.display_name) || handle || 'Suno creator',
    handle,
    picture: asString(clip.image_large_url) || asString(clip.image_url),
    duration:
      asNumber(metadata.duration) ??
      asNumber(clip.duration),
    tags: asString(metadata.tags) || asString(clip.display_tags),
    createdAt: asString(clip.created_at),
    isPublic: true,
    playCount:
      asNumber(clip.play_count) ??
      asNumber(clip.num_plays) ??
      asNumber(clip.plays),
  };
}

export async function getPublicMusicProfile(
  rawHandle: string,
  maxPages = 20,
): Promise<PublicMusicProfile | null> {
  const handle = normalizeHandle(rawHandle);
  if (!PUBLIC_HANDLE_RE.test(handle)) return null;

  const seen = new Set<string>();
  const songs: PublicProfileSong[] = [];
  let firstPage: Record<string, unknown> | null = null;

  try {
    for (let page = 1; page <= Math.min(Math.max(maxPages, 1), 30); page += 1) {
      const url = new URL(`${PROFILE_API}/${encodeURIComponent(handle)}`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('playlists_sort_by', 'created_at');
      url.searchParams.set('clips_sort_by', 'created_at');

      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'SunoDown/23 (+https://picai.online)',
        },
        next: { revalidate: 900 },
      });

      if (response.status === 404) return null;
      if (!response.ok) {
        if (page === 1) return null;
        break;
      }

      const data = (await response.json()) as Record<string, unknown>;
      if (!firstPage) firstPage = data;

      const clips = Array.isArray(data.clips)
        ? (data.clips as Array<Record<string, unknown>>)
        : [];
      if (!clips.length) break;

      let added = 0;
      for (const clip of clips) {
        const song = mapClip(clip, handle);
        if (!song || seen.has(song.id)) continue;
        seen.add(song.id);
        songs.push(song);
        added += 1;
      }

      if (!added) break;
    }

    if (!firstPage) return null;

    songs.sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );

    return {
      handle,
      displayName:
        asString(firstPage.display_name) ||
        asString(firstPage.name) ||
        handle,
      avatarUrl:
        asString(firstPage.image_url) ||
        asString(firstPage.avatar_url),
      bio:
        asString(firstPage.description) ||
        asString(firstPage.bio),
      songs,
      total: songs.length,
    };
  } catch {
    return null;
  }
}

export function profileSeoKeywords(profile: PublicMusicProfile) {
  const styles = profile.songs
    .flatMap((song) => (song.tags || '').split(/[,;/|]+/))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);

  return Array.from(
    new Set([
      profile.displayName,
      `@${profile.handle}`,
      `${profile.displayName} Suno`,
      `${profile.displayName} songs`,
      `${profile.displayName} nhạc`,
      `nghe nhạc ${profile.displayName}`,
      `Suno @${profile.handle}`,
      ...styles,
      'nghe nhạc Suno',
      'Suno music',
      'nhạc AI',
      'AI music',
      'SunoDown Music',
    ]),
  ).slice(0, 24);
}
