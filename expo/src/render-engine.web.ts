import type { Song, StudioAspect } from './types';
import { publicAudioUrl } from './api';
import type { ExportAsset, VisualizerExportOptions } from './render-engine';
import { backgroundPresetColors } from './background-presets';

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
function audioStats(buffer:AudioBuffer){
  let peak=0,sum=0,count=0;
  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const data=buffer.getChannelData(channel);
    for(let i=0;i<data.length;i+=8){
      const v=data[i]||0;peak=Math.max(peak,Math.abs(v));sum+=v*v;count++;
    }
  }
  return {peak,rms:Math.sqrt(sum/Math.max(1,count))};
}

async function normalizeAudio(input:AudioBuffer,targetDb=-14,ceilingDb=-1){
  const {peak,rms}=audioStats(input);
  if(rms<1e-7)return input;
  const target=Math.pow(10,targetDb/20),ceiling=Math.pow(10,ceilingDb/20);
  const byRms=target/rms,byPeak=peak>0?ceiling/peak:byRms;
  const gain=Math.max(.25,Math.min(4,byRms,byPeak));
  if(Math.abs(gain-1)<.01)return input;
  const offline=new OfflineAudioContext(input.numberOfChannels,input.length,input.sampleRate);
  const source=offline.createBufferSource();source.buffer=input;
  const node=offline.createGain();node.gain.value=gain;
  source.connect(node);node.connect(offline.destination);source.start();
  return offline.startRendering();
}

async function applyAudioProcessing(input:AudioBuffer,options:VisualizerExportOptions){
  const quick:[number,number,number]=[options.eqBass??0,options.eqVocal??0,options.eqTreble??0];
  const bands=(options.masterEqBands||[]).filter(b=>b.enabled&&Math.abs(b.gain)>.01);
  const profile=options.masteringProfile||'original';
  const drive=Math.max(0,Math.min(.4,options.masterDrive??0));
  const spatial=Boolean(options.spatialEnabled);
  const needs=quick.some(v=>Math.abs(v)>.01)||bands.length>0||profile!=='original'||drive>.001||spatial;
  if(!needs)return input;

  const channels=spatial?Math.max(2,input.numberOfChannels):input.numberOfChannels;
  const offline=new OfflineAudioContext(channels,input.length,input.sampleRate);
  const source=offline.createBufferSource();source.buffer=input;
  let node:AudioNode=source;

  const connectFilter=(type:BiquadFilterType,frequency:number,gain:number,q:number)=>{
    const filter=offline.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.gain.value=gain;filter.Q.value=q;
    node.connect(filter);node=filter;
  };
  connectFilter('lowshelf',120,quick[0],.7);
  connectFilter('peaking',2500,quick[1],.9);
  connectFilter('highshelf',8000,quick[2],.7);
  for(const band of bands)connectFilter(band.type,Math.max(20,Math.min(20000,band.frequency)),band.gain,Math.max(.3,Math.min(8,band.q)));

  if(profile!=='original'){
    const compressor=offline.createDynamicsCompressor();
    compressor.threshold.value=Math.max(-30,Math.min(-6,options.masterThresholdDb??-18));
    compressor.ratio.value=Math.max(1,Math.min(20,options.masterRatio??2));
    compressor.attack.value=Math.max(.001,Math.min(.08,(options.masterAttackMs??10)/1000));
    compressor.release.value=Math.max(.04,Math.min(.5,(options.masterReleaseMs??120)/1000));
    node.connect(compressor);node=compressor;
  }

  if(drive>.001){
    const shaper=offline.createWaveShaper(),curve=new Float32Array(2048),amount=1+drive*18;
    for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*amount)/Math.tanh(amount)}
    shaper.curve=curve;shaper.oversample='2x';node.connect(shaper);node=shaper;
  }

  if(spatial){
    const amount=Math.max(.2,Math.min(1,(options.spatialAmount??65)/100));
    const mode=options.spatialMode||'immersive';
    if(mode==='orbit'){
      const panner=offline.createStereoPanner(),osc=offline.createOscillator(),depth=offline.createGain();
      osc.type='sine';osc.frequency.value=.085;depth.gain.value=Math.min(1,amount);
      osc.connect(depth);depth.connect(panner.pan);node.connect(panner);node=panner;osc.start(0);osc.stop(input.duration);
    }else{
      const splitter=offline.createChannelSplitter(2),merger=offline.createChannelMerger(2);
      const leftGain=offline.createGain(),rightGain=offline.createGain(),leftCross=offline.createGain(),rightCross=offline.createGain();
      const leftDelay=offline.createDelay(.05),rightDelay=offline.createDelay(.05);
      const delay=mode==='immersive'?.018:.008,cross=mode==='immersive'?.22:.10;
      leftGain.gain.value=1;rightGain.gain.value=1;leftCross.gain.value=cross*amount;rightCross.gain.value=cross*amount;
      leftDelay.delayTime.value=delay;rightDelay.delayTime.value=delay;
      node.connect(splitter);
      splitter.connect(leftGain,0);leftGain.connect(merger,0,0);
      splitter.connect(rightGain,input.numberOfChannels>1?1:0);rightGain.connect(merger,0,1);
      splitter.connect(leftDelay,0);leftDelay.connect(leftCross);leftCross.connect(merger,0,1);
      splitter.connect(rightDelay,input.numberOfChannels>1?1:0);rightDelay.connect(rightCross);rightCross.connect(merger,0,0);
      node=merger;
    }
  }

  node.connect(offline.destination);source.start();
  let rendered=await offline.startRendering();
  if(profile!=='original')rendered=await normalizeAudio(rendered,options.masterTargetLufs??-14,options.masterCeilingDb??-1);
  return rendered;
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
function drawEffects(ctx:CanvasRenderingContext2D,w:number,h:number,effects:string[],frame:number,speed=1,angle=0,density=1,size=1){
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
    const count=Math.max(1,Math.round((effects.includes('stars')?18:effects.includes('sparkles')?10:7)*density));
    ctx.fillStyle=effects.includes('dust')?'rgba(255,230,190,.16)':'rgba(255,255,255,.42)';
    const drift=Math.tan(angle*Math.PI/180)*.18;
    for(let i=0;i<count;i++){const f=frame*speed,x=((((i*137+f*7)%997)/997)+drift*((i*251+f*3)%991)/991)%1*w,y=((i*251+f*3)%991)/991*h,r=(1+((i+Math.floor(f))%3))*size;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
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
function drawWave(ctx:CanvasRenderingContext2D,w:number,h:number,wave:string,samples:Float32Array,rate:number,t:number,progress:number,color:string,color2:string,glow:number,heightPct:number,thickness=46,opacity=92,density=72,rotation=0,xPct=50,yPct=82){
  const centerX=w*Math.max(.04,Math.min(.96,xPct/100)),baseY=h*Math.max(.04,Math.min(.96,yPct/100)),maxH=h*Math.max(.05,Math.min(.25,heightPct/650));
  ctx.save();
  ctx.globalAlpha=Math.max(.1,Math.min(1,opacity/100));
  ctx.translate(centerX,baseY);ctx.rotate(rotation*Math.PI/180);ctx.translate(-centerX,-baseY);
  ctx.shadowColor=color;ctx.shadowBlur=Math.max(0,glow*.22);
  const circular=/circle|ring|circular|orbit/.test(wave);
  const ribbon=/ribbon/.test(wave);
  const spectrum=/spectrum|bars|mirror/.test(wave);
  if(circular){
    const bars=Math.max(24,Math.round(82*(density/72))),radius=Math.min(w,h)*.17;
    ctx.translate(centerX,baseY);
    for(let i=0;i<bars;i++){
      const a=i/bars*Math.PI*2,amp=ampAt(samples,rate,t+i/bars*.16),len=9+amp*maxH*.55;
      ctx.strokeStyle=i/bars<progress?(i%2?color2:color):'rgba(174,157,255,.42)';ctx.lineWidth=Math.max(1,(w/420)*(thickness/46));
      ctx.beginPath();ctx.moveTo(Math.cos(a)*radius,Math.sin(a)*radius);ctx.lineTo(Math.cos(a)*(radius+len),Math.sin(a)*(radius+len));ctx.stroke();
    }
  }else if(ribbon){
    const gradient=ctx.createLinearGradient(w*.12,0,w*.88,0);gradient.addColorStop(0,color);gradient.addColorStop(1,color2);ctx.strokeStyle=gradient;ctx.lineWidth=Math.max(2,(w/250)*(thickness/46));ctx.beginPath();
    const points=Math.max(32,Math.round(86*(density/72)));
    for(let i=0;i<points;i++){
      const x=w*.12+(w*.76)*(i/(points-1)),a=ampAt(samples,rate,t+i/points*.24);
      const y=baseY+Math.sin(i*.42+t*5.2)*maxH*.22*a;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.globalAlpha=.35;ctx.translate(0,12);ctx.stroke();ctx.globalAlpha=1;
  }else{
    const bars=Math.max(20,Math.round((spectrum?58:72)*(density/72))),barW=Math.max(1,w*.006*(thickness/46)),span=w*.78,gap=Math.max(1,(span-bars*barW)/Math.max(1,bars-1));
    for(let i=0;i<bars;i++){
      const a=ampAt(samples,rate,t+i/bars*.24),bh=10+a*maxH,x=centerX-span/2+i*(barW+gap);
      ctx.fillStyle=i/bars<progress?(i%2?color2:color):'rgba(174,157,255,.38)';
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
  const backgroundSource=options.backgroundMode==='suno'?song.picture:options.backgroundMode==='preset'?undefined:(options.backgroundUri||song.picture);
  const background=options.visualVisible===false?null:await loadBackground(backgroundSource);
  const clipImages=options.visualVisible===false?new Map<string,ImageBitmap>():await loadClipImages(options.mediaClips);
  try{
    const decoded=await audioContext.decodeAudioData(bytes.slice(0));
    const start=Math.max(0,Math.min(options.startSeconds||0,Math.max(0,decoded.duration-.1)));
    const maxDuration=Math.max(.1,decoded.duration-start);
    const duration=Math.max(.5,Math.min(options.durationSeconds||song.duration||maxDuration,maxDuration));
    const clipped=clippedBuffer(audioContext,decoded,start,duration);
    const audio=await applyAudioProcessing(clipped,options);
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
    const titleColor=options.titleColor||'#f5f7fb',creatorColor=options.creatorColor||'#c5cede',subColor=options.subtitleActiveColor||options.subtitleColor||'#ffffff';
    for(let frame=0;frame<total;frame++){
      const t=frame/fps,absoluteTime=start+t;
      const currentBackground=frameImage(options,clipImages,absoluteTime,background);
      if(currentBackground){cover(ctx,currentBackground,width,height);ctx.fillStyle='rgba(4,7,12,.48)';ctx.fillRect(0,0,width,height)}
      else{
        const gradient=ctx.createLinearGradient(0,0,width,height);
        const preset=options.backgroundMode==='preset'?backgroundPresetColors(options.backgroundPreset||'dark-film'):null;
        gradient.addColorStop(0,preset?.[0]||(options.presetId.includes('neon')?'#171231':'#161124'));
        gradient.addColorStop(.55,preset?.[1]||'#080c12');
        gradient.addColorStop(1,preset?.[2]||'#05070b');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      }
      const glow=ctx.createRadialGradient(width*.76,height*.24,0,width*.76,height*.24,Math.max(width,height)*.42);
      glow.addColorStop(0,'rgba(139,108,255,.20)');glow.addColorStop(1,'rgba(139,108,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);

      const titleX=width*Math.max(.04,Math.min(.96,(options.titleX??50)/100)),titleY=height*Math.max(.04,Math.min(.96,(options.titleY??67)/100));
      const creatorX=width*Math.max(.04,Math.min(.96,(options.creatorX??50)/100)),creatorY=height*Math.max(.04,Math.min(.96,(options.creatorY??75)/100));
      const subtitleX=width*Math.max(.04,Math.min(.96,(options.subtitleX??50)/100)),subtitleY=height*Math.max(.04,Math.min(.96,(options.subtitleY??70)/100));
      ctx.textAlign='center';ctx.fillStyle=titleColor;ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=18;
      ctx.font=`700 ${Math.round(Math.min(width,height)*.055*((options.titleScale??100)/100))}px system-ui,sans-serif`;ctx.fillText(song.title||'SunoDown',titleX,titleY,width*.86);
      ctx.fillStyle=creatorColor;ctx.font=`500 ${Math.round(Math.min(width,height)*.027*((options.creatorScale??100)/100))}px system-ui,sans-serif`;ctx.fillText(song.creator||'Suno',creatorX,creatorY,width*.8);

      if(options.subtitleVisible!==false&&options.lyricsMode!=='off'){
        const line=activeLyric(options,song,absoluteTime,t);
        if(line){ctx.fillStyle=subColor;ctx.font=`700 ${Math.round(Math.min(width,height)*.044*((options.subtitleScale??100)/100))}px system-ui,sans-serif`;ctx.fillText(line,subtitleX,subtitleY,width*.84)}
      }
      if(options.visualVisible!==false)drawWave(ctx,width,height,wave,samples,audio.sampleRate,t,t/duration,options.waveColor||'#d946ef',options.waveColor2||'#60a5fa',options.waveGlow??80,options.waveHeight??100,options.waveThickness??46,options.waveOpacity??92,options.waveDensity??72,options.waveRotation??0,options.waveX??50,options.waveY??82);
      if(options.effectsVisible!==false)drawEffects(ctx,width,height,options.effects||[],frame,options.effectSpeed??1,options.effectAngle??0,options.effectDensity??1,options.effectSize??1);
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
