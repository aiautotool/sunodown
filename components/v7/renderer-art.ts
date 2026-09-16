'use client';

import type {Song,VideoAspect,WaveStyle,VisualTemplate} from '../v4/types';
import type {SafeRenderOptions} from '../v4/renderer-safe';
import {generateVisualizerVideoSafe} from '../v4/renderer-safe';
import {cleanLyricsForVideo} from '../v4/lyrics-clean';

export type TitleFont='preset'|'cinematic'|'editorial'|'retro'|'modern'|'impact';
export type TitlePosition='auto'|'top'|'center'|'bottom';
export type TitleStyle={font?:TitleFont;size?:number;position?:TitlePosition;color?:string};
export type ArtRenderOptions=SafeRenderOptions&{titleStyle?:TitleStyle};

const TITLE_FONTS:Record<Exclude<TitleFont,'preset'>,string>={
 cinematic:'Georgia, "Times New Roman", serif',
 editorial:'"Palatino Linotype", Palatino, Georgia, serif',
 retro:'"Courier New", Georgia, serif',
 modern:'"Trebuchet MS", Arial, sans-serif',
 impact:'Impact, "Arial Black", sans-serif',
};
const TEMPLATE_FONT:Record<VisualTemplate,Exclude<TitleFont,'preset'>>={
 'cover-motion':'cinematic','vinyl':'editorial','glass-card':'modern','lyrics-focus':'cinematic',
};

function normalize(v:string){return v.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g,' ').trim()}
function isTitleFragment(text:string,title:string){const t=normalize(text),full=normalize(title);if(!t||!full||t.length<2)return false;return full===t||full.includes(t)||t.split(' ').every(word=>full.includes(word))}
function titleY(position:TitlePosition|undefined,template:VisualTemplate,height:number,current:number){
 if(!position||position==='auto')return current;
 if(position==='top')return height*.12;
 if(position==='center')return height*.48;
 return height*.76;
}

/** v7 facade: clean render-only lyrics + configurable artwork title typography. */
export async function generateVisualizerVideoArt(song:Song,aspect:VideoAspect,wave:WaveStyle,template:VisualTemplate,options:ArtRenderOptions){
 const renderSong:Song={...song,lyrics:cleanLyricsForVideo(song.lyrics)};
 const proto=CanvasRenderingContext2D.prototype,original=proto.fillText;
 const style=options.titleStyle||{},fontKey=style.font&&style.font!=='preset'?style.font:TEMPLATE_FONT[template],font=TITLE_FONTS[fontKey];
 const scale=Math.max(.65,Math.min(1.65,(style.size||100)/100)),color=/^#[0-9a-f]{6}$/i.test(style.color||'')?style.color:undefined;
 const height=aspect==='9:16'?1280:aspect==='1:1'?1080:aspect==='4:5'?1080:720;
 proto.fillText=function(text:string,x:number,y:number,maxWidth?:number){
  if(isTitleFragment(String(text),song.title||'')){
   const previousFont=this.font,previousFill=this.fillStyle,previousBlur=this.shadowBlur,previousSpacing=this.letterSpacing;
   const match=/([0-9.]+)px/.exec(previousFont),size=(Number(match?.[1]||42)*scale).toFixed(1);
   const italic=fontKey==='cinematic'||fontKey==='editorial'?'italic ':'';
   this.font=`${italic}${fontKey==='impact'?900:700} ${size}px ${font}`;
   this.letterSpacing=fontKey==='modern'?'.035em':fontKey==='impact'?'.025em':'.012em';
   this.shadowBlur=Math.max(this.shadowBlur,fontKey==='modern'?26:20);
   if(color)this.fillStyle=color;
   const yy=titleY(style.position,template,height,y);
   try{return maxWidth===undefined?original.call(this,text,x,yy):original.call(this,text,x,yy,maxWidth)}finally{this.font=previousFont;this.fillStyle=previousFill;this.shadowBlur=previousBlur;this.letterSpacing=previousSpacing}
  }
  return maxWidth===undefined?original.call(this,text,x,y):original.call(this,text,x,y,maxWidth);
 };
 try{return await generateVisualizerVideoSafe(renderSong,aspect,wave,template,options)}finally{proto.fillText=original}
}
