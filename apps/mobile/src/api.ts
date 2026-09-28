import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createProjectDocument } from '@core/project';
import { createRenderJob } from '@core/render-job';
import type { MobilePreset } from './presets';

export const API_BASE = 'https://suno.aiautotool.com';

export type Song = {
  id: string;
  title: string;
  picture: string | null;
  audio: string;
  sourceAudio: string;
  lyrics: string | null;
  style: string | null;
  tags: string | null;
  duration: number | null;
  creator: string | null;
};

export type RenderStatus = {
  id: string;
  status: string;
  progress: number;
  title: string;
  resultUrl: string | null;
  error: string | null;
};

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data as T;
}

export async function installationId() {
  const key = 'sunodown.installationId';
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;
  const created = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(key, created);
  return created;
}

export async function resolveSong(input: string) {
  const song = await json<Song>('/api/resolve', {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
  return {
    ...song,
    audio: song.audio.startsWith('http') ? song.audio : API_BASE + song.audio,
    sourceAudio: song.sourceAudio.startsWith('http') ? song.sourceAudio : API_BASE + song.sourceAudio,
    picture: song.picture ? (song.picture.startsWith('http') ? song.picture : API_BASE + song.picture) : null,
  };
}

export async function capabilities() {
  return json<{ aiMusicVideo: boolean; backgroundVisualizer: boolean }>('/api/render/capabilities');
}

export async function startRender(song: Song, preset: MobilePreset) {
  const installId = await installationId();
  const project = createProjectDocument({
    id: `project-${song.id}`,
    sourceUrl: song.sourceAudio,
    title: song.title,
    platform: Platform.OS === 'android' ? 'android' : 'ios',
    assets: [
      {
        id: 'audio-main',
        kind: 'audio',
        uri: song.audio,
        duration: song.duration || undefined,
      },
      ...(song.picture ? [{ id: 'cover', kind: 'image' as const, uri: song.picture }] : []),
    ],
    timeline: [],
    presetId: preset.id,
    config: { aspect: preset.aspect, styleHint: preset.styleHint },
  });

  const contract = createRenderJob({
    id: `render-${Date.now().toString(36)}`,
    projectId: project.id,
    target: 'server',
    quality: '720p',
    aspect: preset.aspect,
    project,
  });

  const lyrics = song.lyrics?.trim() || '';
  if (!lyrics) throw new Error('Bài này chưa có lyrics nên chưa thể tạo AI Music Video trên mobile.');

  return json<RenderStatus>('/api/render/jobs', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'ai_music_video',
      installationId: installId,
      title: song.title,
      aspect: preset.aspect,
      resolution: '720p',
      duration: song.duration || undefined,
      style: [song.style, preset.styleHint].filter(Boolean).join(', '),
      lyrics,
      presetId: preset.id,
      contract,
      song: {
        title: song.title,
        audio: song.audio,
        picture: song.picture,
        lyrics,
        style: song.style,
        tags: song.tags,
        duration: song.duration,
        creator: song.creator,
      },
    }),
  });
}

export async function getRender(id: string) {
  return json<RenderStatus>(`/api/render/jobs/${id}`);
}

export function absoluteResultUrl(value: string) {
  return value.startsWith('http') ? value : API_BASE + value;
}
