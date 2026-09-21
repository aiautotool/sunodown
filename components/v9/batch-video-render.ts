'use client';
import type {Song,VideoAspect,WaveStyle,VisualTemplate} from '../v4/types';
import type {ArtRenderOptions} from '../v7/renderer-art';
import {generateVisualizerVideoArt} from '../v7/renderer-art';
import {muxStoredSegments} from '../v6/mux-segments';
import type {StoredSegment} from '../v6/local-resume';

export async function resolveBatchSongs(urls:string[],onProgress?:(n:number)=>void){
 const songs:Song[]=[];
 for(let i=0;i<urls.length;i++){
  const r=await fetch('/api/resolve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:urls[i]})});
  const song=await r.json();if(!r.ok||!song?.audio)throw new Error(`Không đọc được link #${i+1}: ${song?.error||'Suno lỗi'}`);
  songs.push(song as Song);onProgress?.(Math.round((i+1)/urls.length*10));
 }
 return songs;
}
export async function generateBatchMergedVideo(songs:Song[],aspect:VideoAspect,wave:WaveStyle,template:VisualTemplate,options:ArtRenderOptions){
 if(songs.length<2)throw new Error('Cần ít nhất 2 bài để ghép video.');
 const segments:StoredSegment[]=[];
 for(let i=0;i<songs.length;i++){
  const song=songs[i],duration=Number(song.duration||0);if(!duration)throw new Error(`Không đọc được thời lượng bài #${i+1}.`);
  const lyrics=(song.lyrics||'').trim();
  const {buildEstimatedKaraokeTimeline}=await import('@/app/lib/karaoke');
  const timeline=options.lyrics==='off'||!lyrics?undefined:buildEstimatedKaraokeTimeline(lyrics,duration);
  const blob=await generateVisualizerVideoArt(song,aspect,wave,template,{...options,startSeconds:0,previewSeconds:undefined,loopDuration:duration,karaokeTimeline:timeline,onProgress:v=>options.onProgress?.(10+Math.round((i+Math.max(0,Math.min(100,v))/100)/songs.length*82))});
  segments.push({index:i,start:songs.slice(0,i).reduce((n,s)=>n+Number(s.duration||0),0),duration,blob} as StoredSegment);
 }
 options.onProgress?.(93);
 const merged=await muxStoredSegments(segments,v=>options.onProgress?.(93+Math.round(v*.07)));
 options.onProgress?.(100);return merged;
}
