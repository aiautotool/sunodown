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
};

export type RenderJob = {
  id: string;
  title: string;
  progress: number;
  status: 'queued' | 'rendering' | 'done' | 'error';
  createdAt: number;
};
