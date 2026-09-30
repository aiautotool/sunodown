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
  backgroundUri?: string;
  lyricsMode?: StudioLyricsMode;
  timeline?: KaraokeLine[];
  titleColor?: string;
  subtitleColor?: string;
  subtitleActiveColor?: string;
  quality?: 'balanced'|'high';
  mediaClips?: MediaClip[];
  visualVisible?: boolean;
  subtitleVisible?: boolean;
  effectsVisible?: boolean;
  effects?: string[];
  audioMuted?: boolean;
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
