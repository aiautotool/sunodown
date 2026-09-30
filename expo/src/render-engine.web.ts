import type { Song, StudioAspect } from './types';
import { publicAudioUrl } from './api';
import type { ExportAsset, VisualizerExportOptions } from './render-engine';

function safe(value:string){
  return (value||'sunodown').replace(/[\\/:*?"<>|\r\n]+/g,'-').replace(/\s+/g,' ').trim().slice(0,80)||'sunodown';
}
async function sourceBlob(song:Song){
  const response=await fetch(publicAudioUrl(song),{cache:'no-store'});
  if(!response.ok)throw new Error('Không tải được audio để xử lý.');
  return response.blob();
}
function asset(blob:Blob,filename:string,mimeType:string):ExportAsset{
  const uri=URL.createObjectURL(blob);
  return {uri,filename,mimeType,cleanup:()=>URL.revokeObjectURL(uri)};
}
function aspectSize(aspect:StudioAspect='9:16',quality:'balanced'|'high'='high'){
  const full:Record<StudioAspect,[number,number]>={
    '9:16':[720,1280],'16:9':[1280,720],'1:1':[1080,1080],'4:5':[864,1080],'4:3':[960,720],
  };
  const [w,h]=full[aspect];
  if(quality==='high')return [w,h] as const;
  return [Math.max(540,Math.round(w*.75)),Math.max(540,Math.round(h*.75))] as const;
}
function clippedBuffer(ctx:AudioContext,input:AudioBuffer,start:number,duration:number){
  const startFrame=Math.max(0,Math.min(input.length-1,Math.floor(start*input.sampleRate)));
  const frames=Math.max(1,Math.min(input.length-startFrame,Math.floor(duration*input.sampleRate)));
  const out=ctx.createBuffer(input.numberOfChannels,frames,input.sampleRate);
  for(let channel=0;channel<input.numberOfChannels;channel++){
    out.copyToChannel(input.getChannelData(channel).subarray(startFrame,startFrame+frames),channel);
  }
  return out;
}
async function loadBackground(uri?:string){
  if(!uri)return null;
  try{
    const response=await fetch(uri,{cache:'no-store'});
    if(!response.ok)return null;
    return await createImageBitmap(await response.blob());
  }catch{return null}
}
async function loadClipImages(clips:VisualizerExportOptions['mediaClips']){
  const map=new Map<string,ImageBitmap>();
  for(const clip of clips||[]){
    if(clip.type!=='image'||!clip.uri)continue;
    const image=await loadBackground(clip.uri);
    if(image)map.set(clip.id,image);
  }
  return map;
}
function frameImage(options:VisualizerExportOptions,images:Map<string,ImageBitmap>,absoluteTime:number,fallback:ImageBitmap|null){
  if(options.visualVisible===false)return null;
  const active=[...(options.mediaClips||[])].reverse().find(clip=>clip.type==='image'&&absoluteTime>=clip.start&&absoluteTime<clip.end);
  return active?images.get(active.id)||fallback:fallback;
}
function drawEffects(ctx:CanvasRenderingContext2D,w:number,h:number,effects:string[],frame:number){
  if(effects.includes('vignette')){
    const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.18,w/2,h/2,Math.max(w,h)*.72);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.42)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }
  if(effects.includes('lightleak')){
    const g=ctx.createLinearGradient(0,0,w,h*.55);g.addColorStop(0,'rgba(255,80,170,.13)');g.addColorStop(.45,'rgba(255,180,90,.05)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }
  if(effects.includes('film')){
    ctx.fillStyle='rgba(255,255,255,.025)';for(let y=(frame%5);y<h;y+=6)ctx.fillRect(0,y,w,1);
  }
  if(effects.includes('dust')||effects.includes('sparkles')||effects.includes('stars')){
    const count=effects.includes('stars')?18:effects.includes('sparkles')?10:7;
    ctx.fillStyle=effects.includes('dust')?'rgba(255,230,190,.16)':'rgba(255,255,255,.42)';
    for(let i=0;i<count;i++){const x=((i*137+frame*7)%997)/997*w,y=((i*251+frame*3)%991)/991*h,r=1+((i+frame)%3);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
  }
}
function cover(ctx:CanvasRenderingContext2D,image:ImageBitmap,w:number,h:number){
  const scale=Math.max(w/image.width,h/image.height),iw=image.width*scale,ih=image.height*scale;
  ctx.drawImage(image,(w-iw)/2,(h-ih)/2,iw,ih);
}
function ampAt(samples:Float32Array,rate:number,t:number){
  const center=Math.max(0,Math.min(samples.length-1,Math.floor(t*rate)));
  const radius=Math.max(64,Math.floor(rate*.012));
  let peak=0,sum=0,count=0;
  for(let i=Math.max(0,center-radius);i<Math.min(samples.length,center+radius);i+=Math.max(1,Math.floor(radius/24))){
    const v=Math.abs(samples[i]||0);peak=Math.max(peak,v);sum+=v*v;count++;
  }
  return Math.min(1,Math.max(.04,Math.sqrt(sum/Math.max(1,count))*4.8+peak*.5));
}
function drawWave(ctx:CanvasRenderingContext2D,w:number,h:number,wave:string,samples:Float32Array,rate:number,t:number,progress:number,color:string,glow:number,heightPct:number){
  const centerX=w/2,baseY=h*.79,maxH=h*Math.max(.05,Math.min(.25,heightPct/650));
  ctx.save();
  ctx.shadowColor=color;ctx.shadowBlur=Math.max(0,glow*.22);
  const circular=/circle|ring|circular|orbit/.test(wave);
  const ribbon=/ribbon/.test(wave);
  const spectrum=/spectrum|bars|mirror/.test(wave);
  if(circular){
    const bars=82,radius=Math.min(w,h)*.17;
    ctx.translate(centerX,h*.60);
    for(let i=0;i<bars;i++){
      const a=i/bars*Math.PI*2,amp=ampAt(samples,rate,t+i/bars*.16),len=9+amp*maxH*.55;
      ctx.strokeStyle=i/bars<progress?color:'rgba(174,157,255,.42)';ctx.lineWidth=Math.max(2,w/420);
      ctx.beginPath();ctx.moveTo(Math.cos(a)*radius,Math.sin(a)*radius);ctx.lineTo(Math.cos(a)*(radius+len),Math.sin(a)*(radius+len));ctx.stroke();
    }
  }else if(ribbon){
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(3,w/250);ctx.beginPath();
    const points=86;
    for(let i=0;i<points;i++){
      const x=w*.12+(w*.76)*(i/(points-1)),a=ampAt(samples,rate,t+i/points*.24);
      const y=baseY+Math.sin(i*.42+t*5.2)*maxH*.22*a;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.globalAlpha=.35;ctx.translate(0,12);ctx.stroke();ctx.globalAlpha=1;
  }else{
    const bars=spectrum?58:72,barW=Math.max(2,w*.006),span=w*.78,gap=(span-bars*barW)/Math.max(1,bars-1);
    for(let i=0;i<bars;i++){
      const a=ampAt(samples,rate,t+i/bars*.24),bh=10+a*maxH,x=centerX-span/2+i*(barW+gap);
      ctx.fillStyle=i/bars<progress?color:'rgba(174,157,255,.38)';
      const y=baseY-bh/2;ctx.fillRect(x,y,barW,bh);
      if(/mirror/.test(wave)){ctx.globalAlpha=.28;ctx.fillRect(x,baseY+bh/2+4,barW,bh*.45);ctx.globalAlpha=1}
    }
  }
  ctx.restore();
}
function activeLyric(options:VisualizerExportOptions,song:Song,absoluteTime:number,localTime:number){
  const cue=options.timeline?.find(line=>absoluteTime>=line.start&&absoluteTime<line.end);
  if(cue)return cue.text;
  const lines=(song.lyrics||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  return lines.length?lines[Math.min(lines.length-1,Math.floor(localTime/4)%lines.length)]:'';
}

export async function exportVisualizer(song:Song,options:VisualizerExportOptions,onProgress?:(progress:number)=>void):Promise<ExportAsset>{
  const {Output,Mp4OutputFormat,BufferTarget,CanvasSource,AudioBufferSource,Quality}=await import('mediabunny');
  const blob=await sourceBlob(song);
  const bytes=await blob.arrayBuffer();
  const AudioCtx=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!AudioCtx)throw new Error('Trình duyệt không hỗ trợ Web Audio.');
  const audioContext=new AudioCtx();
  const background=options.visualVisible===false?null:await loadBackground(options.backgroundUri||song.picture);
  const clipImages=options.visualVisible===false?new Map<string,ImageBitmap>():await loadClipImages(options.mediaClips);
  try{
    const decoded=await audioContext.decodeAudioData(bytes.slice(0));
    const start=Math.max(0,Math.min(options.startSeconds||0,Math.max(0,decoded.duration-.1)));
    const maxDuration=Math.max(.1,decoded.duration-start);
    const duration=Math.max(.5,Math.min(options.durationSeconds||song.duration||maxDuration,maxDuration));
    const audio=clippedBuffer(audioContext,decoded,start,duration);
    const [width,height]=aspectSize(options.aspect,options.quality);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Không khởi tạo được canvas video.');
    const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat(),target});
    const bitrate=options.quality==='balanced'?2_800_000:4_600_000;
    const videoSource=new CanvasSource(canvas,{codec:'avc',quality:new Quality({bitrate})});
    const audioSource=options.audioMuted?null:new AudioBufferSource({codec:'aac',quality:new Quality({bitrate:192_000})});
    output.addVideoTrack(videoSource,{frameRate:30});if(audioSource)output.addAudioTrack(audioSource);
    await output.start();if(audioSource){await audioSource.add(audio);audioSource.close()}

    const samples=audio.getChannelData(0),fps=30,total=Math.ceil(duration*fps),wave=options.wave||'mirror-glow';
    const titleColor=options.titleColor||'#f5f7fb',subColor=options.subtitleActiveColor||options.subtitleColor||'#ffffff';
    for(let frame=0;frame<total;frame++){
      const t=frame/fps,absoluteTime=start+t;
      const currentBackground=frameImage(options,clipImages,absoluteTime,background);
      if(currentBackground){cover(ctx,currentBackground,width,height);ctx.fillStyle='rgba(4,7,12,.48)';ctx.fillRect(0,0,width,height)}
      else{
        const gradient=ctx.createLinearGradient(0,0,width,height);
        gradient.addColorStop(0,options.presetId.includes('neon')?'#171231':'#161124');gradient.addColorStop(.55,'#080c12');gradient.addColorStop(1,'#05070b');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      }
      const glow=ctx.createRadialGradient(width*.76,height*.24,0,width*.76,height*.24,Math.max(width,height)*.42);
      glow.addColorStop(0,'rgba(139,108,255,.20)');glow.addColorStop(1,'rgba(139,108,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);

      ctx.textAlign='center';ctx.fillStyle=titleColor;ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=18;
      ctx.font=`700 ${Math.round(Math.min(width,height)*.055)}px system-ui,sans-serif`;ctx.fillText(song.title||'SunoDown',width/2,height*.12,width*.86);
      ctx.fillStyle='#c5cede';ctx.font=`500 ${Math.round(Math.min(width,height)*.027)}px system-ui,sans-serif`;ctx.fillText(song.creator||'Suno',width/2,height*.16,width*.8);

      if(options.subtitleVisible!==false&&options.lyricsMode!=='off'){
        const line=activeLyric(options,song,absoluteTime,t);
        if(line){ctx.fillStyle=subColor;ctx.font=`700 ${Math.round(Math.min(width,height)*.044)}px system-ui,sans-serif`;ctx.fillText(line,width/2,height*.66,width*.84)}
      }
      if(options.visualVisible!==false)drawWave(ctx,width,height,wave,samples,audio.sampleRate,t,t/duration,options.subtitleActiveColor||'#b17cff',options.waveGlow??80,options.waveHeight??100);
      if(options.effectsVisible!==false)drawEffects(ctx,width,height,options.effects||[],frame);
      ctx.shadowBlur=0;ctx.fillStyle='#a0aaba';ctx.font=`500 ${Math.round(Math.min(width,height)*.021)}px system-ui,sans-serif`;
      const mm=Math.floor(t/60),ss=Math.floor(t%60);ctx.fillText(String(mm)+':'+String(ss).padStart(2,'0'),width/2,height*.90);
      await videoSource.add(t,1/fps,{keyFrame:frame%60===0});
      if(frame%15===0)onProgress?.(Math.max(1,Math.min(99,Math.round(frame/total*100))));
    }
    videoSource.close();await output.finalize();if(!target.buffer)throw new Error('Không tạo được MP4.');
    onProgress?.(100);
    return asset(new Blob([target.buffer],{type:'video/mp4'}),safe(song.title)+(options.durationSeconds===30?'-30s':'')+'.mp4','video/mp4');
  }finally{background?.close();for(const image of clipImages.values())image.close();await audioContext.close()}
}

export async function exportAudio(song:Song,format:'m4a'|'mp3'|'wav',onProgress?:(progress:number)=>void):Promise<ExportAsset>{
  const {Input,ALL_FORMATS,BlobSource,Output,BufferTarget,Mp3OutputFormat,WavOutputFormat,Mp4OutputFormat,Conversion,canEncodeAudio}=await import('mediabunny');
  if(format==='mp3'&&!(await canEncodeAudio('mp3'))){const {registerMp3Encoder}=await import('@mediabunny/mp3-encoder');registerMp3Encoder()}
  if(format==='m4a'&&!(await canEncodeAudio('aac')))throw new Error('AAC encoder unavailable');
  const source=await sourceBlob(song),target=new BufferTarget();
  const input=new Input({source:new BlobSource(source),formats:ALL_FORMATS});
  const output=new Output({format:format==='mp3'?new Mp3OutputFormat():format==='wav'?new WavOutputFormat():new Mp4OutputFormat(),target});
  const conversion=await Conversion.init({input,output,video:{discard:true},audio:format==='mp3'?{bitrate:320_000,numberOfChannels:2,sampleRate:48_000,forceTranscode:true}:format==='wav'?{numberOfChannels:2,sampleRate:48_000,sampleFormat:'s16',forceTranscode:true}:{codec:'aac',bitrate:256_000,numberOfChannels:2,sampleRate:48_000,forceTranscode:true},copy:false,showWarnings:false});
  if(!conversion.isValid)throw new Error('Không hỗ trợ '+format.toUpperCase()+' trên trình duyệt này.');
  conversion.onProgress=(p)=>onProgress?.(Math.max(1,Math.min(99,Math.round(p*100))));
  await conversion.execute();if(!target.buffer)throw new Error('Không tạo được '+format.toUpperCase()+'.');onProgress?.(100);
  const mime=format==='mp3'?'audio/mpeg':format==='wav'?'audio/wav':'audio/mp4';
  return asset(new Blob([target.buffer],{type:mime}),safe(song.title)+'.'+format,mime);
}
