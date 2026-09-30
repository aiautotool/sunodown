import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { execute, getMediaDuration, getMediaInformation, pickEncoder } from 'munim-ffmpeg';
import type { Song, StudioAspect } from './types';
import { publicAudioUrl } from './api';
import type { ExportAsset, VisualizerExportOptions } from './render-engine';
import { backgroundPresetColors } from './background-presets';

function safe(value:string){
  return (value||'sunodown').replace(/[\\/:*?"<>|\r\n]+/g,'-').replace(/\s+/g,' ').trim().slice(0,80)||'sunodown';
}
function ffColor(value:string|undefined,fallback:string){
  const raw=(value||fallback).replace('#','');
  return /^([0-9a-f]{6})$/i.test(raw)?'0x'+raw:'0x'+fallback.replace('#','');
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
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}
function audioChain(options:VisualizerExportOptions){
  const filters:string[]=[];
  const pushEq=(frequency:number,q:number,gain:number)=>{
    if(Math.abs(gain)<.01)return;
    filters.push(`equalizer=f=${Math.round(clamp(frequency,20,20000))}:t=q:w=${clamp(q,.3,8).toFixed(2)}:g=${clamp(gain,-12,12).toFixed(2)}`);
  };
  pushEq(120,1,options.eqBass??0);
  pushEq(2500,.9,options.eqVocal??0);
  pushEq(8000,1,options.eqTreble??0);
  for(const band of options.masterEqBands||[]){
    if(!band.enabled)continue;
    pushEq(band.frequency,band.q,band.gain);
  }

  const profile=options.masteringProfile||'original';
  if(profile!=='original'){
    const thresholdDb=clamp(options.masterThresholdDb??-18,-30,-6);
    const threshold=Math.pow(10,thresholdDb/20);
    const ratio=clamp(options.masterRatio??2,1,20);
    const attack=clamp(options.masterAttackMs??10,.01,2000);
    const release=clamp(options.masterReleaseMs??120,.01,9000);
    filters.push(`acompressor=threshold=${threshold.toFixed(6)}:ratio=${ratio.toFixed(2)}:attack=${attack.toFixed(2)}:release=${release.toFixed(2)}:makeup=1:knee=2.82843:link=maximum:detection=rms`);

    const drive=clamp(options.masterDrive??0,0,.4);
    if(drive>.001){
      const softThreshold=clamp(1-drive*.7,.68,1);
      filters.push(`asoftclip=type=tanh:threshold=${softThreshold.toFixed(3)}:output=.98:oversample=2`);
    }
  }

  if(options.spatialEnabled){
    const amount=clamp((options.spatialAmount??65)/100,.2,1);
    if(options.spatialMode==='orbit'){
      filters.push(`apulsator=mode=sine:amount=${(.25+amount*.7).toFixed(3)}:offset_l=0:offset_r=.5:timing=hz:hz=.08`);
    }else{
      const multiplier=options.spatialMode==='immersive'?1+amount*.9:1+amount*.5;
      filters.push(`extrastereo=m=${multiplier.toFixed(3)}:c=1`);
    }
  }

  if(profile!=='original'){
    const target=clamp(options.masterTargetLufs??-14,-70,-5);
    const ceiling=clamp(options.masterCeilingDb??-1,-9,0);
    filters.push(`loudnorm=I=${target.toFixed(1)}:TP=${ceiling.toFixed(1)}:LRA=11,aresample=48000`);
  }
  return filters.length?filters.join(','):'anull';
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
  const backgroundSource=options.backgroundMode==='suno'?song.picture:options.backgroundMode==='preset'?undefined:(options.backgroundUri||song.picture);
  const bg=options.visualVisible===false?null:await backgroundFor(backgroundSource);
  const activeClips=options.visualVisible===false?[]:(options.mediaClips||[]).filter(clip=>clip.end>start&&clip.start<start+duration);
  const clipInputs:Array<{index:number;uri:string;video:boolean;start:number;end:number}>=[];
  const args=['-y','-ss',String(start),'-i',input];
  let inputIndex=1;
  if(bg){
    if(bg.video)args.push('-stream_loop','-1','-i',bg.uri);else args.push('-loop','1','-i',bg.uri);
    inputIndex+=1;
  }
  for(const clip of activeClips){
    try{
      const media=await backgroundFor(clip.uri);if(!media)continue;
      const index=inputIndex++;
      if(media.video)args.push('-stream_loop','-1','-i',media.uri);else args.push('-loop','1','-i',media.uri);
      clipInputs.push({index,uri:media.uri,video:media.video,start:Math.max(0,clip.start-start),end:Math.min(duration,clip.end-start)});
    }catch{}
  }

  const processedAudio=audioChain(options);
  const spectrum=/spectrum|circle|ring|circular|neon/.test(options.wave||'');
  const waveH=Math.max(110,Math.round(height*Math.max(.08,Math.min(.25,(options.waveHeight||100)/650))));
  const density=Math.max(.35,Math.min(1.6,(options.waveDensity??72)/72));
  const waveW=Math.max(360,Math.round((width-120)*density));
  const c1=ffColor(options.waveColor,'#d946ef'),c2=ffColor(options.waveColor2,'#60a5fa');
  const opacity=Math.max(.1,Math.min(1,(options.waveOpacity??92)/100));
  const viz=spectrum
    ? `showspectrum=s=${waveW}x${waveH}:mode=combined:color=intensity:slide=scroll:scale=log,format=rgba,colorchannelmixer=aa=${opacity}`
    : `showwaves=s=${waveW}x${waveH}:mode=cline:rate=30:colors=${c1}|${c2},format=rgba,colorchannelmixer=aa=${opacity}`;
  const waveX=Math.max(0,Math.min(width-waveW,Math.round(width*((options.waveX??50)/100)-waveW/2)));
  const y=Math.max(0,Math.min(height-waveH,Math.round(height*((options.waveY??82)/100)-waveH/2)));
  const filters:string[]=[];

  let audioLabel='';
  if(options.visualVisible!==false&&!options.audioMuted){
    filters.push(`[0:a]${processedAudio},asplit=2[aout][aviz]`);
    filters.push(`[aviz]${viz}[viz]`);
    audioLabel='aout';
  }else if(options.visualVisible!==false){
    filters.push(`[0:a]${processedAudio}[aviz]`);
    filters.push(`[aviz]${viz}[viz]`);
  }else if(!options.audioMuted){
    filters.push(`[0:a]${processedAudio}[aout]`);
    audioLabel='aout';
  }

  if(options.visualVisible===false){
    filters.push(`color=c=0x080c12:s=${width}x${height}:r=30:d=${duration}[base0]`);
  }else if(bg){
    filters.push(`[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba,colorchannelmixer=aa=.72[base0]`);
  }else{
    const preset=backgroundPresetColors(options.backgroundPreset||'dark-film');
    const baseColor=options.backgroundMode==='preset'?ffColor(preset[0],'#080c12'):'0x080c12';
    filters.push(`color=c=${baseColor}:s=${width}x${height}:r=30:d=${duration}[base0]`);
  }
  let baseLabel='base0';
  clipInputs.forEach((clip,index)=>{
    const clipLabel='clip'+index,nextBase='base'+(index+1);
    filters.push(`[${clip.index}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba,setpts=PTS-STARTPTS+${clip.start}/TB[${clipLabel}]`);
    filters.push(`[${baseLabel}][${clipLabel}]overlay=0:0:enable='between(t,${clip.start},${clip.end})'[${nextBase}]`);
    baseLabel=nextBase;
  });

  let compositeLabel=baseLabel;
  if(options.visualVisible!==false){
    filters.push(`[${baseLabel}][viz]overlay=${waveX}:${y}:shortest=1[composite]`);
    compositeLabel='composite';
  }
  const enabledEffects=options.effectsVisible===false?[]:(options.effects||[]);
  const videoFilters:string[]=[];
  if(enabledEffects.includes('vignette'))videoFilters.push('vignette=PI/5');
  if(enabledEffects.includes('film'))videoFilters.push(`noise=alls=${Math.max(2,Math.round(5*(options.effectDensity??1)))}:allf=t`);
  if(enabledEffects.includes('lightleak'))videoFilters.push('eq=saturation=1.08:contrast=1.03');
  if(videoFilters.length)filters.push(`[${compositeLabel}]${videoFilters.join(',')},format=${pix}[v]`);
  else filters.push(`[${compositeLabel}]format=${pix}[v]`);

  args.push('-filter_complex',filters.join(';'),'-map','[v]');
  if(!options.audioMuted&&audioLabel)args.push('-map','['+audioLabel+']','-c:a','aac','-b:a','192k');
  else args.push('-an');
  args.push('-c:v',encoder,'-b:v',options.quality==='balanced'?'2800k':'4500k','-t',String(duration),'-movflags','+faststart',output);
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
