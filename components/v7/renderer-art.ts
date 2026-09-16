'use client';

import type {Song,VideoAspect,WaveStyle,VisualTemplate} from '../v4/types';
import type {SafeRenderOptions} from '../v4/renderer-safe';
import {generateVisualizerVideoSafe} from '../v4/renderer-safe';
import {cleanLyricsForVideo} from '../v4/lyrics-clean';

const TITLE_FONTS:Record<VisualTemplate,string>={
 'cover-motion':'Georgia, "Times New Roman", serif',
 'vinyl':'"Palatino Linotype", Palatino, Georgia, serif',
 'glass-card':'"Trebuchet MS", "Arial Narrow", sans-serif',
 'lyrics-focus':'Georgia, "Times New Roman", serif',
};

function normalize(v:string){return v.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g,' ').trim()}
function isTitleFragment(text:string,title:string){
 const t=normalize(text),full=normalize(title);
 if(!t||!full||t.length<2)return false;
 return full===t||full.includes(t)||t.split(' ').every(word=>full.includes(word));
}

/**
 * v7 render facade:
 * - keeps the proven v4 WebCodecs/mediabunny renderer untouched
 * - strips chord notation only from the render copy of lyrics
 * - gives song-title canvas text an artwork/display treatment per template
 */
export async function generateVisualizerVideoArt(
 song:Song,aspect:VideoAspect,wave:WaveStyle,template:VisualTemplate,options:SafeRenderOptions,
){
 const renderSong:Song={...song,lyrics:cleanLyricsForVideo(song.lyrics)};
 const proto=CanvasRenderingContext2D.prototype;
 const original=proto.fillText;
 const font=TITLE_FONTS[template];
 proto.fillText=function(text:string,x:number,y:number,maxWidth?:number){
  if(isTitleFragment(String(text),song.title||'')){
   const previous=this.font;
   const size=/([0-9.]+)px/.exec(previous)?.[1]||'42';
   this.font=`italic 700 ${size}px ${font}`;
   this.letterSpacing=template==='glass-card'?'.03em':'.015em';
   this.shadowBlur=Math.max(this.shadowBlur,22);
   try{return maxWidth===undefined?original.call(this,text,x,y):original.call(this,text,x,y,maxWidth)}finally{this.font=previous;this.letterSpacing='0px'}
  }
  return maxWidth===undefined?original.call(this,text,x,y):original.call(this,text,x,y,maxWidth);
 };
 try{return await generateVisualizerVideoSafe(renderSong,aspect,wave,template,options)}finally{proto.fillText=original}
}
