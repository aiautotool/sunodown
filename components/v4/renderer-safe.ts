'use client';

import type { LyricsMode, MotionIntensity, Song, VideoAspect, VisualTemplate, WaveStyle } from './types';
import { VIDEO_SIZES } from './types';
import { cleanLyricsForVideo } from './lyrics-clean';
import {convertProcessedAudio,renderTikTokLikeAudio} from '@/app/lib/audio-processing';
import {drawKaraokeOverlay,type KaraokeLine} from '@/app/lib/karaoke';
import {DEFAULT_BACKGROUND_CONFIG,applyBackgroundFinish,drawMediaBackground,drawPresetBackground,seekVideoFrame,type BackgroundConfig} from '@/components/v8/background';

const MOTION_GAIN: Record<MotionIntensity,number> = { low:.45, medium:1, high:1.75 };
type Palette=[[number,number,number],[number,number,number],[number,number,number]];
export type SafeRenderOptions={motion:MotionIntensity;lyrics:LyricsMode;karaokeTimeline?:KaraokeLine[];background?:BackgroundConfig;startSeconds?:number;previewSeconds?:number;onProgress?:(value:number)=>void};

function clamp(v:number,min=0,max=255){return Math.max(min,Math.min(max,v))}
function rgb(c:[number,number,number],a=1){return `rgba(${c[0]},${c[1]},${c[2]},${a})`}
function coverFit(ctx:CanvasRenderingContext2D,bmp:ImageBitmap,w:number,h:number,scaleExtra=1,dx=0,dy=0){const s=Math.min(w/bmp.width,h/bmp.height)*scaleExtra,iw=bmp.width*s,ih=bmp.height*s;ctx.drawImage(bmp,(w-iw)/2+dx,(h-ih)/2+dy,iw,ih)}
function coverFill(ctx:CanvasRenderingContext2D,bmp:ImageBitmap,w:number,h:number,alpha=.34,blur=30,scaleExtra=1,dx=0,dy=0){const s=Math.max(w/bmp.width,h/bmp.height)*scaleExtra,iw=bmp.width*s,ih=bmp.height*s;ctx.save();ctx.globalAlpha=alpha;ctx.filter=`blur(${blur}px)`;ctx.drawImage(bmp,(w-iw)/2+dx,(h-ih)/2+dy,iw,ih);ctx.restore()}
function wrap(ctx:CanvasRenderingContext2D,text:string,maxW:number,maxLines=2){const words=text.trim().split(/\s+/).filter(Boolean),lines:string[]=[];let line='';for(const word of words){const n=line?`${line} ${word}`:word;if(!line||ctx.measureText(n).width<=maxW)line=n;else{lines.push(line);line=word;if(lines.length===maxLines-1)break}}if(line&&lines.length<maxLines)lines.push(line);return lines}
function amplitude(samples:Float32Array|null,rate:number,t:number,off=0){if(!samples)return Math.max(.08,.2+.15*Math.sin((t+off)*5));const c=Math.max(0,Math.min(samples.length-1,Math.floor((t+off)*rate))),r=Math.max(64,Math.floor(rate*.012)),from=Math.max(0,c-r),to=Math.min(samples.length,c+r),stride=Math.max(1,Math.floor((to-from)/24));let sum=0,n=0;for(let i=from;i<to;i+=stride){sum+=Math.abs(samples[i]);n++}return n?Math.min(1,(sum/n)*5.2):.08}
function extractPalette(bmp:ImageBitmap):Palette{const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d',{willReadFrequently:true});if(!x)return [[103,232,249],[167,139,250],[232,121,249]];x.drawImage(bmp,0,0,32,32);const d=x.getImageData(0,0,32,32).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=16){const lum=(d[i]+d[i+1]+d[i+2])/3;if(lum<25||lum>235)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++}if(!n)return [[103,232,249],[167,139,250],[232,121,249]];const base:[number,number,number]=[r/n,g/n,b/n].map(v=>Math.round(v)) as [number,number,number];return [base,[clamp(base[0]+55),clamp(base[1]+40),clamp(base[2]+65)],[clamp(base[2]+35),clamp(base[0]+20),clamp(base[1]+45)]] as Palette}

function titleTypography(template:VisualTemplate,fs:number){
 if(template==='vinyl')return {font:`italic 700 ${Math.round(fs*1.05)}px Georgia, 'Times New Roman', serif`,spacing:1.4,stroke:1.1};
 if(template==='glass-card')return {font:`800 ${Math.round(fs*.98)}px 'Trebuchet MS', Arial, sans-serif`,spacing:2.2,stroke:.8};
 if(template==='lyrics-focus')return {font:`italic 700 ${Math.round(fs*1.02)}px Georgia, 'Times New Roman', serif`,spacing:.7,stroke:.7};
 return {font:`700 ${Math.round(fs*1.08)}px Georgia, 'Times New Roman', serif`,spacing:1,stroke:1};
}
function drawLetterSpaced(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,spacing:number,align:'center'|'left'){
 if(spacing<=0){ctx.fillText(text,x,y);return}
 const chars=Array.from(text),widths=chars.map(c=>ctx.measureText(c).width),total=widths.reduce((a,b)=>a+b,0)+spacing*Math.max(0,chars.length-1);let cx=align==='center'?x-total/2:x;const old=ctx.textAlign;ctx.textAlign='left';chars.forEach((c,i)=>{ctx.fillText(c,cx,y);cx+=widths[i]+spacing});ctx.textAlign=old;
}
function drawMeta(ctx:CanvasRenderingContext2D,song:Song,w:number,y:number,align:'center'|'left'='center',max=.76,template:VisualTemplate='cover-motion',p?:Palette){
 ctx.save();const fs=Math.max(26,Math.min(54,Math.round(w*.039))),art=titleTypography(template,fs);ctx.font=art.font;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle='rgba(255,255,255,.98)';ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=art.stroke;ctx.shadowColor=template==='glass-card'&&p?rgb(p[1],.6):'rgba(0,0,0,.7)';ctx.shadowBlur=template==='glass-card'?24:18;const lines=wrap(ctx,song.title||'Suno Track',w*max,2),lh=fs*1.22,x=align==='center'?w/2:w*.1;
 lines.forEach((l,i)=>{ctx.strokeText(l,x,y+i*lh);drawLetterSpaced(ctx,l,x,y+i*lh,art.spacing,align)});
 if(song.creator){ctx.shadowBlur=7;ctx.font=`600 ${Math.max(15,Math.round(fs*.4))}px system-ui,-apple-system,'Segoe UI',sans-serif`;ctx.fillStyle='rgba(255,255,255,.7)';ctx.textAlign=align;ctx.fillText(song.creator.toUpperCase(),x,y+lines.length*lh+Math.max(10,fs*.16))}ctx.restore();
}
function lyricLines(song:Song){return cleanLyricsForVideo(song.lyrics).split(/\n+/).map(x=>x.trim()).filter(Boolean)}
function drawLyrics(ctx:CanvasRenderingContext2D,song:Song,w:number,h:number,absoluteT:number,fullDuration:number,mode:LyricsMode){if(mode==='off'||!song.lyrics)return;const lines=lyricLines(song);if(!lines.length)return;const idx=Math.min(lines.length-1,Math.floor((absoluteT/Math.max(1,fullDuration))*lines.length));ctx.save();const fs=Math.max(22,Math.min(44,Math.round(w*.031)));ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${fs}px system-ui,-apple-system,sans-serif`;ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=16;if(mode==='focus'){const current=lines[idx],y=h*.58,boxW=w*.82;ctx.fillStyle='rgba(5,5,16,.48)';ctx.beginPath();ctx.roundRect(w*.09,y-fs*1.4,boxW,fs*2.8,18);ctx.fill();ctx.fillStyle='rgba(255,255,255,.96)';wrap(ctx,current,boxW*.9,2).forEach((l,i,a)=>ctx.fillText(l,w/2,y+(i-(a.length-1)/2)*fs*1.16))}else{const rows=[lines[Math.max(0,idx-1)],lines[idx],lines[Math.min(lines.length-1,idx+1)]],ys=[h*.48,h*.57,h*.66];rows.forEach((l,i)=>{ctx.globalAlpha=i===1?1:.35;ctx.fillStyle='white';ctx.fillText(l,w/2,ys[i],w*.78)})}ctx.restore()}
function waveGradient(ctx:CanvasRenderingContext2D,w:number,p:Palette){const g=ctx.createLinearGradient(w*.08,0,w*.92,0);g.addColorStop(0,rgb(p[0]));g.addColorStop(.5,rgb(p[1]));g.addColorStop(1,rgb(p[2]));return g}
function drawWave(ctx:CanvasRenderingContext2D,samples:Float32Array|null,rate:number,t:number,w:number,h:number,style:WaveStyle,p:Palette){const ph=Math.max(110,Math.round(h*.14)),top=h-ph,bg=ctx.createLinearGradient(0,top,0,h);bg.addColorStop(0,'rgba(6,7,18,0)');bg.addColorStop(.3,'rgba(6,7,18,.55)');bg.addColorStop(1,'rgba(6,7,18,.95)');ctx.fillStyle=bg;ctx.fillRect(0,top,w,ph);const n=Math.max(42,Math.min(92,Math.round(w/14))),usable=w*.84,start=w*.08,cy=h-ph*.42,max=ph*.52,vals=Array.from({length:n},(_,i)=>Math.max(.05,amplitude(samples,rate,t,((i/(n-1))-.5)*.7))),grad=waveGradient(ctx,w,p);ctx.save();ctx.fillStyle=grad;ctx.strokeStyle=grad;ctx.shadowColor=rgb(p[1],.55);ctx.shadowBlur=12;ctx.lineCap='round';ctx.lineJoin='round';if(style==='line'){ctx.lineWidth=Math.max(3,w*.003);ctx.beginPath();vals.forEach((a,i)=>{const x=start+i/(n-1)*usable,y=cy-(a-.15)*max*(.9+.1*Math.sin(t*7+i*.2));i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}else if(style==='dots'){vals.forEach((a,i)=>{const x=start+i/(n-1)*usable,y=cy-(a-.15)*max,r=Math.max(2.5,w*.003)*(1+a);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()})}else{const gap=Math.max(3,w*.004),bw=Math.max(3,(usable-gap*(n-1))/n);vals.forEach((a,i)=>{const x=start+i*(bw+gap),pulse=.82+.18*Math.sin(t*7+i*.3),hh=Math.max(6,max*a*pulse*(style==='pulse'?1.25:1));if(style==='mirror'){ctx.beginPath();ctx.roundRect(x,cy-hh,bw,hh*2,bw/2);ctx.fill()}else{ctx.globalAlpha=style==='pulse'?.65+.35*pulse:1;ctx.beginPath();ctx.roundRect(x,cy-hh/2,bw,hh,bw/2);ctx.fill()}})}ctx.restore()}
function drawProTemplate(ctx:CanvasRenderingContext2D,bmp:ImageBitmap,song:Song,w:number,h:number,t:number,level:number,template:VisualTemplate,p:Palette,preserveBackground=false){
 const portrait=h>w, margin=w*.075;
 const image=(x:number,y:number,size:number,round=0)=>{
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,size,size,round);ctx.clip();
  const scale=Math.max(size/bmp.width,size/bmp.height);
  ctx.drawImage(bmp,x+(size-bmp.width*scale)/2,y+(size-bmp.height*scale)/2,bmp.width*scale,bmp.height*scale);ctx.restore();
 };
 const text=(value:string,x:number,y:number,size:number,color:string)=>{ctx.font=`600 ${size}px system-ui,sans-serif`;ctx.fillStyle=color;ctx.textAlign='left';ctx.fillText(value,x,y,w-margin*2)};
 if(template==='editorial'){
  if(!preserveBackground){ctx.fillStyle='#101714';ctx.fillRect(0,0,w,h);}
  const side=portrait?w*.85:Math.min(h*.64,w*.43),x=portrait?margin:w*.51,y=h*.13;
  ctx.fillStyle='#d4dfba';ctx.fillRect(x-8,y-8,side+16,side+16);image(x,y,side);
  text('TUYỂN TẬP ÂM NHẠC',margin,h*.075,w*.017,'#d4dfba');
  const titleX=margin,titleY=portrait?y+side+h*.06:h*.29,titleW=portrait?w*.85:w*.38;
  ctx.fillStyle='#f1eee4';ctx.font=`italic 700 ${w*(portrait?.066:.047)}px Georgia,serif`;ctx.textAlign='left';
  wrap(ctx,song.title,titleW,3).forEach((line,i)=>ctx.fillText(line,titleX,titleY+i*w*.064));
  text(song.creator||'Suno',margin,portrait?h*.79:h*.67,w*.021,'#a8b6a8');
  ctx.strokeStyle='#697a60';ctx.beginPath();ctx.moveTo(margin,h*.82);ctx.lineTo(w-margin,h*.82);ctx.stroke();return;
 }
 if(template==='spotlight'){
  if(!preserveBackground){ctx.fillStyle='#070912';ctx.fillRect(0,0,w,h);}
  const glow=ctx.createRadialGradient(w*.5,h*.35,0,w*.5,h*.35,w*.65);
  glow.addColorStop(0,rgb(p[1],.32+level*.2));glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w/2,h*.39);ctx.rotate(Math.sin(t*.2)*.07);
  const size=Math.min(w*.63,h*.48);ctx.shadowColor=rgb(p[1],.65);ctx.shadowBlur=45;
  ctx.strokeStyle=rgb(p[1],.5);ctx.lineWidth=2;ctx.strokeRect(-size*.56,-size*.56,size*1.12,size*1.12);
  image(-size/2,-size/2,size,12);ctx.restore();
  drawMeta(ctx,song,w,h*.72,'center',.83,'glass-card',p);return;
 }
 if(!preserveBackground){ctx.fillStyle='#11100e';ctx.fillRect(0,0,w,h);}
 const cx=portrait?w/2:w*.32,cy=portrait?h*.34:h*.42,r=Math.min(w,h)*.29;
 ctx.save();ctx.translate(cx,cy);ctx.rotate(t*.16);
 const metal=ctx.createLinearGradient(-r,-r,r,r);metal.addColorStop(0,'#bfa373');metal.addColorStop(.5,'#332b20');metal.addColorStop(1,'#e6d8ba');
 ctx.fillStyle=metal;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
 for(let i=0;i<18;i++){ctx.strokeStyle='rgba(0,0,0,.24)';ctx.beginPath();ctx.arc(0,0,r*(.4+i*.033),0,Math.PI*2);ctx.stroke();}
 ctx.save();ctx.beginPath();ctx.arc(0,0,r*.37,0,Math.PI*2);ctx.clip();image(-r*.37,-r*.37,r*.74);ctx.restore();
 ctx.fillStyle='#11100e';ctx.beginPath();ctx.arc(0,0,r*.045,0,Math.PI*2);ctx.fill();ctx.restore();
 const tx=portrait?margin:w*.64,ty=portrait?h*.68:h*.33;
 text('PHIÊN BẢN ĐĨA NHẠC',tx,ty-w*.04,w*.014,'#bfa373');
 ctx.fillStyle='#eee4d3';ctx.font=`700 ${w*.04}px Georgia,serif`;ctx.textAlign='left';
 wrap(ctx,song.title,portrait?w*.85:w*.29,3).forEach((line,i)=>ctx.fillText(line,tx,ty+i*w*.052));
 text(song.creator||'Suno',tx,portrait?h*.8:h*.65,w*.018,'#a99574');
}

function drawTemplate(ctx:CanvasRenderingContext2D,bmp:ImageBitmap,song:Song,w:number,h:number,t:number,level:number,template:VisualTemplate,motion:MotionIntensity,p:Palette,preserveBackground=false){if(['editorial','spotlight','gold-record'].includes(template)){drawProTemplate(ctx,bmp,song,w,h,t*MOTION_GAIN[motion],level,template,p,preserveBackground);return}const gain=MOTION_GAIN[motion];if(!preserveBackground){ctx.fillStyle='#080812';ctx.fillRect(0,0,w,h);}if(template==='vinyl'){if(!preserveBackground)coverFill(ctx,bmp,w,h,.34,42,1.08+level*.03*gain);const portrait=h>w,cx=portrait?w/2:w*.36,cy=portrait?h*.39:h*.46,r=Math.min(w,h)*(portrait?.28:.29)*(1+level*.015*gain);ctx.save();ctx.translate(cx,cy);ctx.rotate(t*(.24+.16*gain));ctx.shadowColor=rgb(p[1],.35+.25*level);ctx.shadowBlur=22+level*26;ctx.fillStyle='#111116';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.save();ctx.beginPath();ctx.arc(0,0,r*.58,0,Math.PI*2);ctx.clip();const s=Math.max((r*1.16)/bmp.width,(r*1.16)/bmp.height),iw=bmp.width*s,ih=bmp.height*s;ctx.drawImage(bmp,-iw/2,-ih/2,iw,ih);ctx.restore();ctx.fillStyle='#0b0b10';ctx.beginPath();ctx.arc(0,0,r*.08,0,Math.PI*2);ctx.fill();ctx.restore();drawMeta(ctx,song,w,portrait?h*.72:h*.26,portrait?'center':'left',portrait?.8:.48,template,p);return}if(template==='glass-card'){if(!preserveBackground)coverFill(ctx,bmp,w,h,.52,46,1.12+level*.035*gain,Math.sin(t*.2)*w*.025*gain,Math.cos(t*.17)*h*.018*gain);const portrait=h>w,cw=w*(portrait?.78:.72),ch=h*(portrait?.54:.62),x=(w-cw)/2,y=h*(portrait?.17:.13);ctx.beginPath();ctx.roundRect(x,y,cw,ch,Math.max(22,w*.025));ctx.fillStyle='rgba(12,12,28,.52)';ctx.fill();ctx.strokeStyle=rgb(p[1],.42);ctx.stroke();ctx.save();ctx.beginPath();ctx.roundRect(x+cw*.08,y+ch*.08,cw*.84,ch*(portrait?.56:.7),Math.max(16,w*.018));ctx.clip();const aw=cw*.84,ah=ch*(portrait?.56:.7),s=Math.min(aw/bmp.width,ah/bmp.height),iw=bmp.width*s,ih=bmp.height*s;ctx.drawImage(bmp,x+cw*.08+(aw-iw)/2,y+ch*.08+(ah-ih)/2,iw,ih);ctx.restore();drawMeta(ctx,song,w,y+ch*(portrait?.72:.83),'center',.62,template,p);return}if(template==='lyrics-focus'){if(!preserveBackground)coverFill(ctx,bmp,w,h,.32,48,1.1+level*.03*gain);const r=Math.min(w,h)*(.11+level*.018*gain);ctx.save();ctx.beginPath();ctx.arc(w/2,h*.27,r,0,Math.PI*2);ctx.clip();coverFit(ctx,bmp,r*2,r*2,1);ctx.restore();drawMeta(ctx,song,w,h*.41,'center',.72,template,p);return}const zoom=1.06+.025*Math.sin(t*.45)*gain+level*.025*gain,dx=Math.sin(t*.22)*w*.018*gain,dy=Math.cos(t*.18)*h*.014*gain;if(!preserveBackground)coverFill(ctx,bmp,w,h,.5,34,zoom,dx,dy);ctx.fillStyle='rgba(3,4,12,.25)';ctx.fillRect(0,0,w,h);coverFit(ctx,bmp,w*.82,h*.72,1+.02*Math.sin(t*.5)*gain+level*.01*gain,dx*.25,dy*.25);drawMeta(ctx,song,w,h*.67,'center',.72,template,p)}

export function createLiveFramePainter(bitmap: ImageBitmap) {
 const palette = extractPalette(bitmap);
 return (ctx: CanvasRenderingContext2D, song: Song, w: number, h: number, time: number, template: VisualTemplate, wave: WaveStyle, motion: MotionIntensity, lyrics: LyricsMode, preserveBackground=false) => {
  drawTemplate(ctx, bitmap, song, w, h, time, amplitude(null, 0, time), template, motion, palette,preserveBackground);
  drawLyrics(ctx, song, w, h, time, song.duration || 1, lyrics);
  drawWave(ctx, null, 0, time, w, h, wave, palette);
 };
}

function isMobileRenderDevice(){
  if(typeof navigator==='undefined')return false;
  const ua=navigator.userAgent||'';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)||(navigator.maxTouchPoints>1&&/Macintosh/i.test(ua));
}

async function yieldToBrowser(){
  await new Promise<void>(resolve=>setTimeout(resolve,0));
}

async function loadBackgroundVideo(url:string){
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.src=url;
 await new Promise<void>((resolve,reject)=>{const done=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(new Error('Trình duyệt không đọc được video này.'))},cleanup=()=>{video.removeEventListener('loadedmetadata',done);video.removeEventListener('error',fail)};video.addEventListener('loadedmetadata',done,{once:true});video.addEventListener('error',fail,{once:true});video.load()});
 return video;
}

export async function generateVisualizerVideoSafe(song:Song,aspect:VideoAspect,waveStyle:WaveStyle,template:VisualTemplate,options:SafeRenderOptions){
 if(!song.picture||!song.audio)throw new Error('Không đủ ảnh hoặc âm thanh để tạo video.');
 options.onProgress?.(1);
 const[ir,ar]=await Promise.all([fetch(song.picture,{cache:'no-store'}),fetch(song.audio,{cache:'no-store'})]);if(!ir.ok||!ar.ok)throw new Error('Không thể tải ảnh hoặc âm thanh.');
 options.onProgress?.(4);
 if(!('VideoEncoder'in window))throw new Error('Trình duyệt chưa hỗ trợ tạo video MP4.');
 const{ALL_FORMATS,BlobSource,BufferTarget,CanvasSource,EncodedAudioPacketSource,EncodedPacketSink,EncodedPacket,Input,Mp4OutputFormat,Output}=await import('mediabunny');
 const originalAudio=await ar.blob(),mobile=isMobileRenderDevice();
 let processedWav:Blob|null=null,audioBlob:Blob=originalAudio;
 if(!mobile){
   options.onProgress?.(6);
   processedWav=await renderTikTokLikeAudio(originalAudio);
   options.onProgress?.(8);
   try{audioBlob=await convertProcessedAudio(processedWav,'m4a')}catch{audioBlob=await convertProcessedAudio(processedWav,'mp3')}
 }else{
   options.onProgress?.(8);
   await yieldToBrowser();
 }
 const input=new Input({source:new BlobSource(audioBlob),formats:ALL_FORMATS}),track=await input.getPrimaryAudioTrack();if(!track)throw new Error('Không có luồng âm thanh hợp lệ.');
 const codec=await track.getCodec(),decoderConfig=await track.getDecoderConfig(),fullDuration=await input.computeDuration();if(!codec||!decoderConfig||!Number.isFinite(fullDuration)||fullDuration<=0)throw new Error('Không đọc được âm thanh.');
 const start=Math.max(0,Math.min(options.startSeconds||0,Math.max(0,fullDuration-.05))),duration=options.previewSeconds?Math.min(options.previewSeconds,fullDuration-start):fullDuration,end=start+duration;
 let samples:Float32Array|null=null,rate=48000;if(!mobile&&processedWav){try{const ac=new AudioContext(),d=await ac.decodeAudioData(await processedWav.arrayBuffer());samples=d.getChannelData(0);rate=d.sampleRate;await ac.close()}catch{samples=null}}else{samples=null}
 const{width,height}=VIDEO_SIZES[aspect],canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Không tạo được khung hình.');
 const bmp=await createImageBitmap(await ir.blob()),palette=extractPalette(bmp),background=options.background||DEFAULT_BACKGROUND_CONFIG;let backgroundBitmap:ImageBitmap|null=null,backgroundVideo:HTMLVideoElement|null=null;
 if(background.mode==='image'&&background.imageUrl){const r=await fetch(background.imageUrl);if(!r.ok)throw new Error('Không tải được ảnh nền.');backgroundBitmap=await createImageBitmap(await r.blob())}
 if(background.mode==='video'&&background.videoUrl){try{backgroundVideo=await loadBackgroundVideo(background.videoUrl)}catch(e){throw e instanceof Error?e:new Error('Video nền không hỗ trợ trên thiết bị này.')}}
 const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat(),target}),bitrate=width*height>=1_000_000?2_700_000:1_900_000,videoSource=new CanvasSource(canvas,{codec:'avc',bitrate}),audioSource=new EncodedAudioPacketSource(codec);output.addVideoTrack(videoSource);output.addAudioTrack(audioSource,{decoderConfig});await output.start();
 try{const fps=mobile&&background.mode==='video'?10:15,fd=1/fps,frames=Math.ceil(duration*fps);for(let i=0;i<frames;i++){const localT=i*fd,absoluteT=start+localT,level=amplitude(samples,rate,absoluteT),customBackground=background.mode!=='suno';if(background.mode==='preset'){drawPresetBackground(ctx,background.presetId,width,height,absoluteT);applyBackgroundFinish(ctx,width,height,background)}else if(background.mode==='image'&&backgroundBitmap){drawMediaBackground(ctx,backgroundBitmap,backgroundBitmap.width,backgroundBitmap.height,width,height,background);applyBackgroundFinish(ctx,width,height,background)}else if(background.mode==='video'&&backgroundVideo){await seekVideoFrame(backgroundVideo,absoluteT,background.loopVideo);drawMediaBackground(ctx,backgroundVideo,backgroundVideo.videoWidth,backgroundVideo.videoHeight,width,height,background);applyBackgroundFinish(ctx,width,height,background)}drawTemplate(ctx,bmp,song,width,height,absoluteT,level,template,options.motion,palette,customBackground);if(options.lyrics!=='off'&&options.karaokeTimeline?.length){drawKaraokeOverlay(ctx,options.karaokeTimeline,absoluteT,width,height)}else{drawLyrics(ctx,song,width,height,absoluteT,fullDuration,options.lyrics)}drawWave(ctx,samples,rate,absoluteT,width,height,waveStyle,palette);await videoSource.add(localT,Math.min(fd,duration-localT),{keyFrame:i%(fps*2)===0});if(mobile&&i%8===0)await yieldToBrowser();if(i%3===0||i===frames-1)options.onProgress?.(Math.min(90,10+Math.round(((i+1)/frames)*80)))}
 bmp.close();backgroundBitmap?.close();if(backgroundVideo){backgroundVideo.removeAttribute('src');backgroundVideo.load()}const sink=new EncodedPacketSink(track),meta={decoderConfig};let added=0;for await(const p of sink.packets()){if(p.timestamp+p.duration<=start)continue;if(p.timestamp>=end)break;const packet=start>0?new EncodedPacket(p.data,p.type,Math.max(0,p.timestamp-start),p.duration):p;await audioSource.add(packet,meta);added++;if(added%10===0)options.onProgress?.(94)}options.onProgress?.(97);await output.finalize();options.onProgress?.(100)}catch(e){bmp.close();output.cancel();throw e}
 if(!target.buffer)throw new Error('Không xuất được MP4.');return new Blob([target.buffer],{type:'video/mp4'})
}
