'use client';

import type {Song,VideoAspect,WaveStyle,VisualTemplate} from '../v4/types';
import type {ArtRenderOptions} from '../v7/renderer-art';
import {generateVisualizerVideoArt} from '../v7/renderer-art';
import {backgroundFingerprint} from '../v8/background';
import {checkpointKey,clearRender,loadCheckpoint,loadSegments,saveCheckpoint,saveSegment} from '../v6/local-resume';
import {muxStoredSegments} from '../v6/mux-segments';

export type LongVideoMode='count'|'target';
export type LongVideoConfig={
  enabled:boolean;
  mode:LongVideoMode;
  loopCount:number;
  targetMinutes:number;
  segmentSeconds:number;
};

export const DEFAULT_LONG_VIDEO_CONFIG:LongVideoConfig={
  enabled:false,
  mode:'count',
  loopCount:2,
  targetMinutes:60,
  segmentSeconds:180,
};

export function resolveLongDuration(songDuration:number,config:LongVideoConfig){
  if(!config.enabled||!Number.isFinite(songDuration)||songDuration<=0)return songDuration;
  if(config.mode==='target'){
    const requested=Math.max(songDuration,Math.round(Math.max(1,config.targetMinutes)*60));
    return requested;
  }
  return Math.max(songDuration,songDuration*Math.max(1,Math.floor(config.loopCount||1)));
}

function isMobile(){
  if(typeof navigator==='undefined')return false;
  const ua=navigator.userAgent||'';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)||(navigator.maxTouchPoints>1&&/Macintosh/i.test(ua));
}

export async function generateLongVisualizerVideo(
  song:Song,
  aspect:VideoAspect,
  wave:WaveStyle,
  template:VisualTemplate,
  options:ArtRenderOptions,
  config:LongVideoConfig,
){
  const sourceDuration=Number(song.duration||0);
  if(!sourceDuration)throw new Error('Không đọc được thời lượng bài hát.');
  const totalDuration=resolveLongDuration(sourceDuration,config);
  if(totalDuration<=sourceDuration+.05){
    return generateVisualizerVideoArt(song,aspect,wave,template,{...options,loopDuration:sourceDuration});
  }

  const mobile=isMobile();
  const requestedSegment=Math.max(30,Math.min(300,Math.round(config.segmentSeconds||180)));
  const segmentSeconds=mobile?Math.min(90,requestedSegment):requestedSegment;
  const bgKey=backgroundFingerprint(options.background||{mode:'suno',fit:'cover',blur:0,dim:0,overlayOpacity:0,loopVideo:true});
  const key=checkpointKey(
    song.id||song.title,
    aspect,
    wave,
    template,
    options.motion,
    options.lyrics,
    `${bgKey}|loop:${Math.round(totalDuration)}|seg:${segmentSeconds}`,
  );

  const previous=await loadCheckpoint(key);
  const existing=await loadSegments(key);
  const existingIndexes=new Set(existing.map(x=>x.index));
  const segmentCount=Math.ceil(totalDuration/segmentSeconds);
  const createdAt=previous?.createdAt||Date.now();

  for(let index=0;index<segmentCount;index++){
    if(existingIndexes.has(index))continue;
    const start=index*segmentSeconds;
    const duration=Math.min(segmentSeconds,totalDuration-start);
    const blob=await generateVisualizerVideoArt(song,aspect,wave,template,{
      ...options,
      loopDuration:totalDuration,
      startSeconds:start,
      previewSeconds:duration,
      onProgress:(value)=>{
        const completed=index/segmentCount;
        const current=(Math.max(0,Math.min(100,value))/100)/segmentCount;
        options.onProgress?.(Math.min(92,Math.round((completed+current)*92)));
      },
    });
    await saveSegment(key,index,start,duration,blob);
    await saveCheckpoint({
      version:1,
      key,
      songId:song.id||song.title,
      songTitle:song.title,
      aspect,
      wave,
      template,
      motion:options.motion,
      lyrics:options.lyrics,
      duration:totalDuration,
      segmentSeconds,
      completedSeconds:Math.min(totalDuration,start+duration),
      segmentCount,
      createdAt,
      updatedAt:Date.now(),
    });
    if(mobile)await new Promise<void>(resolve=>setTimeout(resolve,0));
  }

  const segments=await loadSegments(key);
  if(segments.length<segmentCount)throw new Error('Render chưa đủ segment để ghép video.');
  options.onProgress?.(93);
  const finalBlob=await muxStoredSegments(segments,value=>options.onProgress?.(93+Math.round(value*.07)));
  await clearRender(key);
  options.onProgress?.(100);
  return finalBlob;
}
