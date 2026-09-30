export type AppView = 'create' | 'music' | 'projects' | 'library' | 'jobs' | 'settings';

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

export type StudioMasterProfile = 'original' | 'clean' | 'tiktok-loud' | 'punchy' | 'max-loud';
export type StudioSpatialMode = 'wide' | 'immersive' | 'orbit';
export type StudioEqBand = {
  enabled: boolean;
  frequency: number;
  gain: number;
  q: number;
  type: 'lowshelf' | 'peaking' | 'highshelf';
};

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
  waveColor: string;
  waveColor2: string;
  waveThickness: number;
  waveOpacity: number;
  waveDensity: number;
  waveRotation: number;
  waveScale?: number;
  backgroundBlur?: number;
  backgroundDim?: number;
  backgroundOverlayOpacity?: number;
  titleScale: number;
  creatorScale: number;
  subtitleScale: number;
  titleX?: number;
  titleY?: number;
  creatorX?: number;
  creatorY?: number;
  subtitleX?: number;
  subtitleY?: number;
  waveX?: number;
  waveY?: number;
  effectSpeed: number;
  effectAngle: number;
  effectDensity: number;
  effectSize: number;
  eqBass: number;
  eqVocal: number;
  eqTreble: number;
  masteringProfile: StudioMasterProfile;
  masterTargetLufs: number;
  masterCeilingDb: number;
  masterThresholdDb: number;
  masterRatio: number;
  masterAttackMs: number;
  masterReleaseMs: number;
  masterDrive: number;
  masterEqBands: StudioEqBand[];
  spatialEnabled: boolean;
  spatialMode: StudioSpatialMode;
  spatialAmount: number;
  trimStart: number;
  trimEnd: number;
  audioPreset: string;
  quality: 'balanced' | 'high';
};

export type MediaClip = {
  id: string;
  type: 'image' | 'video';
  uri: string;
  name: string;
  start: number;
  end: number;
  isDefault?: boolean;
};

export type TimelineTrackName = 'audio' | 'visual' | 'subtitle' | 'effects';
export type TimelineTrackState = Record<TimelineTrackName,{hidden:boolean;muted:boolean;locked:boolean}>;

export type SavedVisualPreset = {
  id: string;
  name: string;
  createdAt: number;
  config: StudioVisualConfig;
};

export type StudioSnapshot = {
  schemaVersion: 1;
  config: StudioVisualConfig;
  timeline: KaraokeLine[];
  background?: string;
  clips?: MediaClip[];
  trackState?: TimelineTrackState;
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
