export type AppView = 'create' | 'projects' | 'library' | 'jobs' | 'settings';

export type Song = {
  id?: string;
  sourceToken?: string;
  title: string;
  creator?: string;
  handle?: string;
  duration?: number;
  picture?: string;
  audio: string;
  video?: string;
  lyrics?: string;
  style?: string;
  tags?: string;
};

export type KaraokeWord = { word: string; start: number; end: number };
export type KaraokeLine = {
  text: string;
  start: number;
  end: number;
  words?: KaraokeWord[];
};

export type StudioAspect = '9:16' | '16:9' | '1:1' | '4:5' | '4:3';
export type StudioLyricsMode = 'off' | 'scroll' | 'focus';
export type StudioMotion = 'low' | 'medium' | 'high';

export type StudioVisualConfig = {
  presetId: string;
  template: string;
  wave: string;
  motion: StudioMotion;
  aspect: StudioAspect;
  lyrics: StudioLyricsMode;
  effects: string[];
  titleFont: string;
  titleColor: string;
  creatorColor: string;
  subtitleFont: string;
  subtitleColor: string;
  subtitleActiveColor: string;
  backgroundMode: 'suno' | 'preset' | 'image' | 'video';
  backgroundPreset: string;
  waveGlow: number;
  waveHeight: number;
  waveSmoothing: number;
  trimStart: number;
  trimEnd: number;
  audioPreset: string;
  quality: 'balanced' | 'high';
};

export type StudioSnapshot = {
  schemaVersion: 1;
  config: StudioVisualConfig;
  timeline: KaraokeLine[];
  background?: string;
};

export type StudioPreset = {
  id: string;
  name: string;
  subtitle: string;
  colors: [string, string];
  waveform: 'bars' | 'line' | 'circle' | 'spectrum';
  lyrics: 'karaoke' | 'classic' | 'off';
};

export type LocalLibraryItem = {
  id: string;
  url: string;
  title: string;
  creator?: string;
  picture?: string;
  duration?: number;
  updatedAt: number;
  favorite?: boolean;
};

export type Project = {
  id: string;
  title: string;
  sourceUrl: string;
  updatedAt: number;
  song?: Song;
  studio?: StudioSnapshot;
};

export type RenderJob = {
  id: string;
  title: string;
  progress: number;
  status: 'queued' | 'preparing' | 'rendering' | 'uploading' | 'completed' | 'failed' | 'done' | 'error';
  createdAt: number;
  resultUrl?: string;
  error?: string;
};
