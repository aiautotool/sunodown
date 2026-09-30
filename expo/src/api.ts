import { Platform } from 'react-native';
import type { KaraokeLine, Song } from './types';

export const API_BASE =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_BASE) ||
  (Platform.OS === 'web' ? '' : 'https://sunoapp.aiautotool.com');

function absoluteUrl(path: string) {
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(absoluteUrl(path), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function raw(path: string, init?: RequestInit) {
  return fetch(absoluteUrl(path), init);
}

export async function resolveSuno(input: string): Promise<Song> {
  const data = await request<any>('/api/resolve', {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
  return {
    ...data,
    id: data.id || data.songId || undefined,
    sourceToken: data.sourceToken || undefined,
    title: data.title || 'Suno song',
    creator: data.creator || 'Suno',
    handle: data.handle || undefined,
    duration: Number(data.duration || 0) || undefined,
    picture: data.picture || '',
    audio: absoluteUrl(data.audio || data.audio_url || ''),
    video: data.video ? absoluteUrl(data.video) : undefined,
    lyrics: typeof data.lyrics === 'string' ? data.lyrics : '',
    style: typeof data.style === 'string' ? data.style : '',
    tags: typeof data.tags === 'string' ? data.tags : '',
  };
}

export async function getCloudSubtitle(songId: string) {
  const endpoint = `/api/music/subtitle?songId=${encodeURIComponent(songId)}&language=vi`;
  const response = await raw(endpoint, {
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  });
  if (response.status === 404) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
}

export async function regenerateSubtitle(song: Song): Promise<KaraokeLine[]> {
  if (!song.id) throw new Error('Bài hát chưa có songId.');

  let response = await raw('/api/music/subtitle/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
    body: JSON.stringify({
      songId: song.id,
      language: 'vi',
      force: true,
    }),
  });

  if (response.status === 202) {
    const endpoint =
      `/api/music/subtitle?songId=${encodeURIComponent(song.id)}&language=vi&refresh=${Date.now()}`;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      response = await raw(endpoint, {
        headers: {
          'cache-control': 'no-cache',
          pragma: 'no-cache',
        },
      });
      if (response.ok) break;
      if (response.status !== 404) break;
    }
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Subtitle HTTP ${response.status}`);
  }

  const lines = payload?.subtitle?.lines;
  if (!Array.isArray(lines) || !lines.length) {
    throw new Error('Server trả về subtitle rỗng.');
  }
  return lines as KaraokeLine[];
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
  return song.id
    ? absoluteUrl(`/api/music/audio?id=${encodeURIComponent(song.id)}`)
    : song.audio;
}
