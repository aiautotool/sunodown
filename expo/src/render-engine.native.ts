import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { execute, getMediaDuration, getMediaInformation, pickEncoder } from 'munim-ffmpeg';
import type { Song, StudioAspect } from './types';
import { publicAudioUrl } from './api';
import type { ExportAsset, VisualizerExportOptions } from './render-engine';

function safe(value:string){
  return (value||'sunodown').replace(/[\\/:*?"<>|\r\n]+/g,'-').replace(/\s+/g,' ').trim().slice(0,80)||'sunodown';
}
function aspectSize(aspect:StudioAspect='9:16'){
  const sizes:Record<StudioAspect,[number,number]>={'9:16':[720,1280],'16:9':[1280,720],'1:1':[1080,1080],'4:5':[864,1080],'4:3':[960,720]};
  return sizes[aspect];
}
async function localInput(uri:string,prefix:string,ext:string){
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const path=base+prefix+'-'+Date.now().toString(36)+ext;
  if(/^(file|content):/i.test(uri)){await FileSystem.copyAsync({from:uri,to:path});return path}
  if(/^https?:/i.test(uri)){return (await FileSystem.downloadAsync(uri,path)).uri}
  return uri;
}
async function inputFor(song:Song){
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const path=base+'sunodown-source-'+Date.now().toString(36)+'.m4a';
  if(/^(file|content):/i.test(song.audio)){await FileSystem.copyAsync({from:song.audio,to:path});return path}
  return (await FileSystem.downloadAsync(publicAudioUrl(song),path)).uri;
}
async function backgroundFor(uri?:string){
  if(!uri)return null;
  const isVideo=/\.(mp4|mov|m4v|webm)(?:\?|$)/i.test(uri);
  try{return {uri:await localInput(uri,'sunodown-bg',isVideo?'.mp4':'.jpg'),video:isVideo}}catch{return null}
}
function assertResult(result:{success:boolean;cancelled?:boolean;failStackTrace?:string|null;output?:string|null}){
  if(!result.success&&!result.cancelled)throw new Error(result.failStackTrace||result.output||'FFmpeg xử lý thất bại.');
}
export async function exportVisualizer(song:Song,options:VisualizerExportOptions,onProgress?:(progress:number)=>void):Promise<ExportAsset>{
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const input=await inputFor(song);
  const output=base+safe(song.title)+(options.durationSeconds===30?'-30s':'')+'-'+Date.now().toString(36)+'.mp4';
  const info=await getMediaInformation(input);
  const probed=getMediaDuration(info)||song.duration||options.durationSeconds||180;
  const start=Math.max(0,Math.min(options.startSeconds||0,Math.max(0,probed-1)));
  const duration=Math.max(1,Math.min(options.durationSeconds||probed-start,probed-start));
  const [width,height]=aspectSize(options.aspect);
  const encoder=await pickEncoder(['h264_videotoolbox','h264_mediacodec','libopenh264']);
  if(!encoder)throw new Error('Thiết bị không có H.264 encoder phù hợp.');
  const pix=Platform.OS==='android'&&encoder==='h264_mediacodec'?'nv12':'yuv420p';
  const bg=await backgroundFor(options.backgroundUri||song.picture);
  const spectrum=/spectrum|circle|ring|circular|neon/.test(options.wave||'');
  const waveH=Math.max(110,Math.round(height*Math.max(.08,Math.min(.25,(options.waveHeight||100)/650))));
  const waveW=Math.max(360,width-120);
  const viz=spectrum
    ? `showspectrum=s=${waveW}x${waveH}:mode=combined:color=intensity:slide=scroll:scale=log`
    : `showwaves=s=${waveW}x${waveH}:mode=cline:rate=30:colors=0xb9a7ff`;
  const y=Math.max(30,Math.round(height*.78-waveH/2));
  const args=['-y','-ss',String(start),'-i',input];
  let filter='';
  if(bg){
    if(bg.video)args.push('-stream_loop','-1','-i',bg.uri);else args.push('-loop','1','-i',bg.uri);
    filter=`[0:a]${viz},format=rgba[viz];[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba[bg];[bg]colorchannelmixer=aa=.72[bgdim];[bgdim][viz]overlay=(W-w)/2:${y}:shortest=1,format=${pix}[v]`;
  }else{
    filter=`[0:a]${viz},format=rgba[viz];color=c=0x080c12:s=${width}x${height}:r=30:d=${duration}[bg];[bg][viz]overlay=(W-w)/2:${y}:shortest=1,format=${pix}[v]`;
  }
  args.push('-filter_complex',filter,'-map','[v]','-map','0:a:0','-c:v',encoder,'-b:v',options.quality==='balanced'?'2800k':'4500k','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart',output);
  const result=await execute(args,undefined,(timeMs)=>{
    const pct=Math.max(1,Math.min(99,Math.round((timeMs/1000)/duration*100)));onProgress?.(pct);
  });
  assertResult(result);onProgress?.(100);
  return {uri:output,filename:safe(song.title)+(options.durationSeconds===30?'-30s':'')+'.mp4',mimeType:'video/mp4'};
}
export async function exportAudio(song:Song,format:'m4a'|'mp3'|'wav',onProgress?:(progress:number)=>void):Promise<ExportAsset>{
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const input=await inputFor(song),output=base+safe(song.title)+'-'+Date.now().toString(36)+'.'+format;
  const codec=format==='mp3'?['-c:a','libmp3lame','-b:a','320k']:format==='wav'?['-c:a','pcm_s16le','-ar','48000']:['-c:a','aac','-b:a','256k','-movflags','+faststart'];
  const info=await getMediaInformation(input),duration=Math.max(1,getMediaDuration(info)||song.duration||1);
  const result=await execute(['-y','-i',input,'-vn',...codec,output],undefined,(timeMs)=>onProgress?.(Math.max(1,Math.min(99,Math.round((timeMs/1000)/duration*100)))));
  assertResult(result);onProgress?.(100);
  return {uri:output,filename:safe(song.title)+'.'+format,mimeType:format==='mp3'?'audio/mpeg':format==='wav'?'audio/wav':'audio/mp4'};
}
