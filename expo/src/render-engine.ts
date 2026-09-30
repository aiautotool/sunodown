import type { Song } from './types';

export type ExportAsset = {
  uri: string;
  filename: string;
  mimeType: string;
  cleanup?: () => void;
};

export async function exportVisualizer(
  _song:Song,
  _presetId:string,
  _durationSeconds?:number,
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
