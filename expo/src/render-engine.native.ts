import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { execute, getMediaDuration, getMediaInformation, pickEncoder } from 'munim-ffmpeg';
import type { Song } from './types';
import { publicAudioUrl } from './api';
import type { ExportAsset } from './render-engine';

function safe(value:string){
  return (value||'sunodown').replace(/[\\/:*?"<>|\r\n]+/g,'-').replace(/\s+/g,' ').trim().slice(0,80)||'sunodown';
}
async function inputFor(song:Song){
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const path=base+'sunodown-source-'+Date.now().toString(36)+'.m4a';
  if(/^(file|content):/i.test(song.audio)){
    await FileSystem.copyAsync({from:song.audio,to:path});
    return path;
  }
  const result=await FileSystem.downloadAsync(publicAudioUrl(song),path);
  return result.uri;
}
function assertResult(result:{success:boolean;cancelled?:boolean;failStackTrace?:string|null;output?:string|null}){
  if(!result.success&&!result.cancelled)throw new Error(result.failStackTrace||result.output||'FFmpeg xử lý thất bại.');
}
export async function exportVisualizer(song:Song,presetId:string,durationSeconds?:number,onProgress?:(progress:number)=>void):Promise<ExportAsset>{
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const input=await inputFor(song);
  const output=base+safe(song.title)+(durationSeconds?'-30s':'')+'-'+Date.now().toString(36)+'.mp4';
  const info=await getMediaInformation(input);
  const probed=getMediaDuration(info)||song.duration||durationSeconds||180;
  const duration=Math.max(1,Math.min(durationSeconds||probed,probed));
  const encoder=await pickEncoder(['h264_videotoolbox','h264_mediacodec','libopenh264']);
  if(!encoder)throw new Error('Thiết bị không có H.264 encoder phù hợp.');
  const pix=Platform.OS==='android'&&encoder==='h264_mediacodec'?'nv12':'yuv420p';
  const spectrum=presetId.toLowerCase().includes('visualizer')||presetId.toLowerCase().includes('neon');
  const viz=spectrum
    ? 'showspectrum=s=600x240:mode=combined:color=intensity:slide=scroll:scale=log'
    : 'showwaves=s=600x240:mode=cline:rate=30:colors=0xb9a7ff';
  const filter='[0:a]'+viz+',format=rgba[viz];color=c=0x080c12:s=720x1280:r=30:d='+duration+'[bg];[bg][viz]overlay=60:900:shortest=1,format='+pix+'[v]';
  const args=['-y','-i',input,'-filter_complex',filter,'-map','[v]','-map','0:a:0','-c:v',encoder,'-b:v','4500k','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart',output];
  const result=await execute(args,undefined,(timeMs)=>{
    const pct=Math.max(1,Math.min(99,Math.round((timeMs/1000)/duration*100)));
    onProgress?.(pct);
  });
  assertResult(result);
  onProgress?.(100);
  return {uri:output,filename:safe(song.title)+(durationSeconds?'-30s':'')+'.mp4',mimeType:'video/mp4'};
}
export async function exportAudio(song:Song,format:'m4a'|'mp3'|'wav',onProgress?:(progress:number)=>void):Promise<ExportAsset>{
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const input=await inputFor(song);
  const output=base+safe(song.title)+'-'+Date.now().toString(36)+'.'+format;
  const codec=format==='mp3'?['-c:a','libmp3lame','-b:a','320k']:format==='wav'?['-c:a','pcm_s16le','-ar','48000']:['-c:a','aac','-b:a','256k','-movflags','+faststart'];
  const info=await getMediaInformation(input);
  const duration=Math.max(1,getMediaDuration(info)||song.duration||1);
  const result=await execute(['-y','-i',input,'-vn',...codec,output],undefined,(timeMs)=>onProgress?.(Math.max(1,Math.min(99,Math.round((timeMs/1000)/duration*100)))));
  assertResult(result);
  onProgress?.(100);
  return {uri:output,filename:safe(song.title)+'.'+format,mimeType:format==='mp3'?'audio/mpeg':format==='wav'?'audio/wav':'audio/mp4'};
}
