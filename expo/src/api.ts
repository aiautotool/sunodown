import type { KaraokeLine, Song } from './types';

export const API_BASE =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_BASE) ||
  'https://picai.online';

function url(path: string) {
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url(path), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function resolveSuno(input: string): Promise<Song> {
  const data = await request<any>('/api/resolve', {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
  return {
    id: data.id || data.songId || undefined,
    sourceToken: data.sourceToken || undefined,
    title: data.title || 'Suno track',
    creator: data.creator || data.display_name || data.author || undefined,
    handle: data.handle || undefined,
    duration: Number(data.duration || 0) || undefined,
    picture: data.picture || data.image || data.image_url || undefined,
    audio: url(data.audio || data.audio_url || data.song_url || ''),
    video: data.video ? url(data.video) : undefined,
    lyrics: data.lyrics || data.metadata?.prompt || undefined,
    style: data.style || data.metadata?.tags || undefined,
    tags: data.tags || data.metadata?.tags || undefined,
  };
}

export async function getCloudSubtitle(songId: string) {
  return request<any>(`/api/music/subtitle?id=${encodeURIComponent(songId)}`);
}

export async function regenerateSubtitle(song: Song): Promise<KaraokeLine[]> {
  const payload = {
    songId: song.id,
    audioUrl: song.audio,
    lyrics: song.lyrics || '',
    force: true,
    noCache: true,
  };
  const candidates = ['/api/karaoke/groq', '/api/karaoke/align'];
  let lastError: unknown;
  for (const endpoint of candidates) {
    try {
      const data = await request<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const lines = data?.timeline || data?.lines || data?.subtitle?.lines || [];
      if (Array.isArray(lines) && lines.length) return lines as KaraokeLine[];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Không tạo được subtitle');
}

export async function trackMusicEvent(songId: string, event: string) {
  try {
    await request('/api/music/event', {
      method: 'POST',
      body: JSON.stringify({ songId, event }),
    });
  } catch {}
}

export function musicAudioUrl(song: Song) {
  return song.id ? url(`/api/music/audio?id=${encodeURIComponent(song.id)}`) : song.audio;
}
