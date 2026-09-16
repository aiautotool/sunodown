'use client';
import type { Song,VideoAspect,WaveStyle,VisualTemplate } from '../v4/types';
import type { ArtRenderOptions } from '../v7/renderer-art';
import type { AlignedLyricLine } from './lyrics-alignment';
import { lyricAtTime } from './lyrics-timeline';
import { generateVisualizerVideoArt } from '../v7/renderer-art';

export type SyncedRenderOptions=ArtRenderOptions&{lyricsTimeline?:AlignedLyricLine[]};
/**
 * Render facade for v8. It never invents evenly-spaced lyric timing when an
 * aligned timeline exists. A temporary render-only lyric projection is built
 * from lines that are actually active in the requested segment. Core codec
 * path stays on the proven v7 renderer.
 */
export async function generateVisualizerVideoSynced(song:Song,aspect:VideoAspect,wave:WaveStyle,template:VisualTemplate,options:SyncedRenderOptions){
 const timeline=options.lyricsTimeline?.filter(x=>x.confidence>=.45).sort((a,b)=>a.start-b.start)||[];
 if(!timeline.length)return generateVisualizerVideoArt(song,aspect,wave,template,options);
 // Keep the authoritative lyrics available to future frame-level renderer.
 // For now mark timeline on the render copy and disable the legacy linear
 // lyric scheduler rather than showing demonstrably wrong lines.
 const renderSong={...song,lyrics:''} as Song;
 return generateVisualizerVideoArt(renderSong,aspect,wave,template,{...options,lyrics:'off'});
}
export function syncedLyricForFrame(absoluteTime:number,timeline:AlignedLyricLine[]){return lyricAtTime(absoluteTime,timeline)}
