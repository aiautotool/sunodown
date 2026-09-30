import type { Song } from './types';
import { publicAudioUrl } from './api';
import type { ExportAsset } from './render-engine';

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
function clippedBuffer(ctx:AudioContext,input:AudioBuffer,duration:number){
  const frames=Math.max(1,Math.min(input.length,Math.floor(duration*input.sampleRate)));
  const out=ctx.createBuffer(input.numberOfChannels,frames,input.sampleRate);
  for(let channel=0;channel<input.numberOfChannels;channel++)out.copyToChannel(input.getChannelData(channel).subarray(0,frames),channel);
  return out;
}
export async function exportVisualizer(song:Song,presetId:string,durationSeconds?:number,onProgress?:(progress:number)=>void):Promise<ExportAsset>{
  const {Output,Mp4OutputFormat,BufferTarget,CanvasSource,AudioBufferSource,Quality}=await import('mediabunny');
  const blob=await sourceBlob(song);
  const bytes=await blob.arrayBuffer();
  const AudioCtx=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!AudioCtx)throw new Error('Trình duyệt không hỗ trợ Web Audio.');
  const audioContext=new AudioCtx();
  try{
    const decoded=await audioContext.decodeAudioData(bytes.slice(0));
    const duration=Math.max(.5,Math.min(durationSeconds||song.duration||decoded.duration,decoded.duration));
    const audio=clippedBuffer(audioContext,decoded,duration);
    const canvas=document.createElement('canvas');
    canvas.width=720;canvas.height=1280;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Không khởi tạo được canvas video.');
    const target=new BufferTarget();
    const output=new Output({format:new Mp4OutputFormat(),target});
    const videoSource=new CanvasSource(canvas,{codec:'avc',quality:new Quality({bitrate:4_000_000})});
    const audioSource=new AudioBufferSource({codec:'aac',quality:new Quality({bitrate:192_000})});
    output.addVideoTrack(videoSource,{frameRate:30});
    output.addAudioTrack(audioSource);
    await output.start();
    await audioSource.add(audio);
    audioSource.close();

    const samples=audio.getChannelData(0);
    const lyrics=(song.lyrics||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const fps=30,total=Math.ceil(duration*fps),bars=56;
    for(let frame=0;frame<total;frame++){
      const t=frame/fps;
      const gradient=ctx.createLinearGradient(0,0,720,1280);
      gradient.addColorStop(0,presetId==='neon'?'#171231':'#161124');
      gradient.addColorStop(.55,'#080c12');
      gradient.addColorStop(1,'#05070b');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,720,1280);
      ctx.fillStyle='rgba(139,108,255,.17)';ctx.beginPath();ctx.arc(550,310,310,0,Math.PI*2);ctx.fill();

      ctx.textAlign='center';ctx.fillStyle='#f5f7fb';ctx.font='700 38px system-ui,sans-serif';
      ctx.fillText(song.title||'SunoDown',360,150,620);
      ctx.fillStyle='#96a1b3';ctx.font='500 20px system-ui,sans-serif';ctx.fillText(song.creator||'Suno',360,188,600);
      const line=lyrics.length?lyrics[Math.min(lyrics.length-1,Math.floor(t/4)%lyrics.length)]:'';
      if(line){ctx.fillStyle='#fff';ctx.font='700 34px system-ui,sans-serif';ctx.fillText(line,360,830,620)}

      const center=360,baseY=1010,span=560,barW=5,gap=5;
      for(let i=0;i<bars;i++){
        const sampleTime=Math.min(duration-.001,t+(i/bars)*.22);
        const idx=Math.max(0,Math.min(samples.length-1,Math.floor(sampleTime*audio.sampleRate)));
        const amp=Math.min(1,Math.abs(samples[idx]||0)*5.5);
        const h=12+amp*150;
        const x=center-span/2+i*(barW+gap);
        ctx.fillStyle=i<bars*(t/duration)?'#d8c8ff':'#8b6cff';
        ctx.fillRect(x,baseY-h/2,barW,h);
      }
      ctx.fillStyle='#7e899a';ctx.font='500 16px system-ui,sans-serif';
      const mm=Math.floor(t/60),ss=Math.floor(t%60);ctx.fillText(String(mm)+':'+String(ss).padStart(2,'0'),360,1088);
      await videoSource.add(t,1/fps,{keyFrame:frame%60===0});
      if(frame%15===0)onProgress?.(Math.max(1,Math.min(99,Math.round(frame/total*100))));
    }
    videoSource.close();
    await output.finalize();
    if(!target.buffer)throw new Error('Không tạo được MP4.');
    onProgress?.(100);
    return asset(new Blob([target.buffer],{type:'video/mp4'}),safe(song.title)+(durationSeconds?'-30s':'')+'.mp4','video/mp4');
  }finally{await audioContext.close()}
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
  await conversion.execute();
  if(!target.buffer)throw new Error('Không tạo được '+format.toUpperCase()+'.');
  onProgress?.(100);
  const mime=format==='mp3'?'audio/mpeg':format==='wav'?'audio/wav':'audio/mp4';
  return asset(new Blob([target.buffer],{type:mime}),safe(song.title)+'.'+format,mime);
}
