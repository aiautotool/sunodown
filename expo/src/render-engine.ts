import type { KaraokeLine, MediaClip, Song, StudioAspect, StudioLyricsMode } from './types';

export type ExportAsset = {
  uri: string;
  filename: string;
  mimeType: string;
  cleanup?: () => void;
};

export type VisualizerExportOptions = {
  presetId: string;
  durationSeconds?: number;
  startSeconds?: number;
  aspect?: StudioAspect;
  wave?: string;
  waveGlow?: number;
  waveHeight?: number;
  waveColor?: string;
  waveColor2?: string;
  waveThickness?: number;
  waveOpacity?: number;
  waveDensity?: number;
  waveRotation?: number;
  backgroundUri?: string;
  backgroundMode?: 'suno'|'preset'|'image'|'video';
  backgroundPreset?: string;
  lyricsMode?: StudioLyricsMode;
  timeline?: KaraokeLine[];
  titleColor?: string;
  creatorColor?: string;
  subtitleColor?: string;
  subtitleActiveColor?: string;
  titleScale?: number;
  creatorScale?: number;
  subtitleScale?: number;
  quality?: 'balanced'|'high';
  mediaClips?: MediaClip[];
  visualVisible?: boolean;
  subtitleVisible?: boolean;
  effectsVisible?: boolean;
  effects?: string[];
  effectSpeed?: number;
  effectAngle?: number;
  effectDensity?: number;
  effectSize?: number;
  audioMuted?: boolean;
  eqBass?: number;
  eqVocal?: number;
  eqTreble?: number;
  masteringProfile?: import('./types').StudioMasterProfile;
  masterTargetLufs?: number;
  masterCeilingDb?: number;
  masterThresholdDb?: number;
  masterRatio?: number;
  masterAttackMs?: number;
  masterReleaseMs?: number;
  masterDrive?: number;
  masterEqBands?: import('./types').StudioEqBand[];
  spatialEnabled?: boolean;
  spatialMode?: import('./types').StudioSpatialMode;
  spatialAmount?: number;
};

export async function exportVisualizer(
  _song:Song,
  _options:VisualizerExportOptions,
  _onProgress?:(progress:number)=>void,
):Promise<ExportAsset>{
  throw new Error('Platform render engine was not resolved.');
}

export async function exportAudio(
  _song:Song,
  _format:'m4a'|'mp3'|'wav',
  _onProgress?:(progress:number)=>void,
):Promise<ExportAsset>{
  throw new Error('Platform audio engine was not resolved.');
}
