'use client';
import { useEffect, useState } from 'react';
import type { KaraokeLine } from './karaoke';

export const SETTINGS_KEY = 'sunodown-studio-settings-v1';
const EVENT = 'sunodown-settings-change';
export const DEFAULT_SETTINGS = {
  aspect: '9:16', resolution: '720', fps: 30, background: 'suno', wave: 'mirror-glow',
  audio: 'original', spatial: false, exportQuality: 'auto', keepAwake: true,
  subtitleLanguage: 'vi', subtitleRetry: true, subtitleOffset: 0,
  snap: true, snapInterval: 0.25, autoScroll: false, zoom: 1,
  confirmDelete: true, showWaveform: true,
  previewQuality: 'balanced', previewFps: 30, waveformDetail: 'balanced',
  autoPreview: false,
} as const;
export type StudioSettings = {
  aspect: '9:16'|'16:9'|'1:1'|'4:5'|'4:3'; resolution: '720'|'1080'|'2160'; fps: 24|30|60;
  background: 'suno'|'purple-gradient'|'dark-film'|'dreamy-blue'; wave: 'mirror-glow'|'rounded-spectrum'|'circular-pulse'|'bars';
  audio: 'original'|'clean'|'tiktok-loud'|'punchy'|'max-loud'; spatial: boolean;
  exportQuality: 'auto'|'data-saver'|'balanced'|'high'; keepAwake: boolean;
  subtitleLanguage: 'vi'|'en'; subtitleRetry: boolean; subtitleOffset: number;
  snap: boolean; snapInterval: number; autoScroll: boolean; zoom: number;
  confirmDelete: boolean; showWaveform: boolean;
  previewQuality: 'low'|'balanced'|'high'; previewFps: 15|24|30|60; waveformDetail: 'low'|'balanced'|'high'; autoPreview: boolean;
};
const choices: Partial<Record<keyof StudioSettings, readonly unknown[]>> = {
  aspect: ['9:16','16:9','1:1','4:5','4:3'], resolution: ['720','1080','2160'], fps: [24,30,60],
  background: ['suno','purple-gradient','dark-film','dreamy-blue'], wave: ['mirror-glow','rounded-spectrum','circular-pulse','bars'],
  audio: ['original','clean','tiktok-loud','punchy','max-loud'], exportQuality: ['auto','data-saver','balanced','high'],
  subtitleLanguage: ['vi','en'], previewQuality: ['low','balanced','high'], previewFps: [15,24,30,60], waveformDetail: ['low','balanced','high'],
};
export function normalizeSettings(value: unknown): StudioSettings {
  const result: StudioSettings = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== 'object') return result;
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(result) as (keyof StudioSettings)[]) {
    const v = source[key];
    if (choices[key]?.includes(v) || (typeof result[key] === 'boolean' && typeof v === 'boolean')) {
      Object.assign(result, { [key]: v });
    }
  }
  for (const [key, min, max] of [['subtitleOffset',-5000,5000],['snapInterval',0.01,5],['zoom',0.5,5]] as const) {
    const v = source[key];
    if (typeof v === 'number' && Number.isFinite(v)) result[key] = Math.max(min,Math.min(max,v));
  }
  return result;
}
export function readSettings(): StudioSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try { return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(value: StudioSettings) {
  const normalized = normalizeSettings(value);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(EVENT));
}
export function useStudioSettings() {
  const [settings, setSettings] = useState<StudioSettings>({ ...DEFAULT_SETTINGS });
  useEffect(() => {
    const update = () => setSettings(readSettings());
    update(); window.addEventListener(EVENT, update); window.addEventListener('storage', update);
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return settings;
}
// Apply defaults once to newly generated cues, never repeatedly to edited projects.
export function applySubtitleOffset(lines: KaraokeLine[], duration: number, offsetMs: number): KaraokeLine[] {
  const shift = offsetMs / 1000;
  return lines.map(line => ({ ...line, start: Math.max(0,line.start+shift), end: Math.min(duration,line.end+shift),
    words: line.words.map(word => ({ ...word, start: Math.max(0,word.start+shift), end: Math.min(duration,word.end+shift) })).filter(word => word.end > word.start),
  })).filter(line => line.end > line.start);
}
