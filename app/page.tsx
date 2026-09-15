'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Clapperboard, Link2, LoaderCircle, Music2, ShieldCheck, Sparkles, Waves } from 'lucide-react';

type Song = { id:string|null; title:string; picture:string|null; audio:string; sourceAudio:string; video:string|null; description:string|null; lyrics:string|null; style:string|null; tags:string|null; duration:number|null; creator:string|null };
type VideoAspect = '16:9'|'9:16'|'1:1'|'4:5'|'4:3';
type WaveStyle = 'bars'|'mirror'|'line'|'dots'|'pulse';

const VIDEO_SIZES: Record<VideoAspect,{width:number;height:number}> = {
  '16:9':{width:1280,height:720}, '9:16':{width:720,height:1280}, '1:1':{width:1080,height:1080}, '4:5':{width:864,height:1080}, '4:3':{width:960,height:720}
};
const WAVE_STYLES:{id:WaveStyle;label:string;hint:string}[] = [
  {id:'bars',label:'Bars',hint:'Thanh dọc'},{id:'mirror',label:'Mirror',hint:'Đối xứng'},{id:'line',label:'Line',hint:'Đường sóng'},{id:'dots',label:'Dots',hint:'Chấm nhịp'},{id:'pulse',label:'Pulse',hint:'Nhịp sáng'}
];

function saveBlob(blob:Blob, filename:string){ const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),1000); }

function drawCover(ctx:CanvasRenderingContext2D, bmp:ImageBitmap, w:number, h:number){
  ctx.fillStyle='#05050a'; ctx.fillRect(0,0,w,h);
  const cover=Math.max(w/bmp.width,h/bmp.height), cw=bmp.width*cover, ch=bmp.height*cover;
  ctx.globalAlpha=.35; ctx.filter='blur(30px)'; ctx.drawImage(bmp,(w-cw)/2,(h-ch)/2,cw,ch); ctx.filter='none'; ctx.globalAlpha=1;
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,0,w,h);
  const scale=Math.min(w/bmp.width,h/bmp.height), iw=bmp.width*scale, ih=bmp.height*scale;
  ctx.drawImage(bmp,(w-iw)/2,(h-ih)/2,iw,ih);
}

function wrapTitle(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,maxLines=2){
  const words=text.trim().split(/\s+/).filter(Boolean), lines:string[]=[]; let line='';
  for(const word of words){ const next=line?`${line} ${word}`:word; if(!line||ctx.measureText(next).width<=maxWidth) line=next; else { lines.push(line); line=word; if(lines.length===maxLines-1) break; } }
  if(line&&lines.length<maxLines) lines.push(line);
  if(lines.length===maxLines){ let last=lines[maxLines-1]; while(ctx.measureText(last).width>maxWidth&&last.length>1) last=last.slice(0,-1); if(last!==lines[maxLines-1]) lines[maxLines-1]=last.replace(/[\s,.!?-]+$/,'')+'…'; }
  return lines;
}

function drawTitle(ctx:CanvasRenderingContext2D,title:string,creator:string|null,w:number,h:number){
  ctx.save();
  const font=Math.max(24,Math.min(48,Math.round(w*.035))), maxW=w*.78, bottomPad=Math.max(170,h*.21);
  ctx.font=`700 ${font}px system-ui, -apple-system, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  const lines=wrapTitle(ctx,title||'Suno Track',maxW,2), lineH=font*1.18, creatorH=creator?Math.max(18,font*.52):0;
  const boxH=Math.max(78,lines.length*lineH+creatorH+34), x=w*.1, y=h-bottomPad-boxH;
  ctx.fillStyle='rgba(5,5,12,.60)'; ctx.beginPath(); ctx.roundRect(x,y,w*.8,boxH,20); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(x,y,w*.8,boxH,20); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.97)'; ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=16;
  const center=y+boxH/2-(creator?creatorH*.35:0), start=center-((lines.length-1)*lineH)/2;
  lines.forEach((l,i)=>ctx.fillText(l,w/2,start+i*lineH));
  if(creator){ ctx.shadowBlur=8; ctx.font=`500 ${Math.max(16,Math.round(font*.48))}px system-ui, -apple-system, sans-serif`; ctx.fillStyle='rgba(255,255,255,.68)'; ctx.fillText(creator,w/2,y+boxH-18); }
  ctx.restore();
}

function amplitudeAt(samples:Float32Array|null, rate:number,time:number,offset:number){
  if(!samples) return Math.max(.08,.22+.14*Math.sin((time+offset)*5.5));
  const c=Math.max(0,Math.min(samples.length-1,Math.floor((time+offset)*rate))), r=Math.max(64,Math.floor(rate*.012));
  const from=Math.max(0,c-r), to=Math.min(samples.length,c+r), stride=Math.max(1,Math.floor((to-from)/28)); let sum=0,n=0;
  for(let i=from;i<to;i+=stride){sum+=Math.abs(samples[i]);n++;} return n?Math.min(1,(sum/n)*5.2):.08;
}
function waveGradient(ctx:CanvasRenderingContext2D,top:number,bottom:number){ const g=ctx.createLinearGradient(0,top,0,bottom); g.addColorStop(0,'rgba(103,232,249,.98)'); g.addColorStop(.5,'rgba(167,139,250,.98)'); g.addColorStop(1,'rgba(232,121,249,.9)'); return g; }
function drawWaveform(ctx:CanvasRenderingContext2D,samples:Float32Array|null,rate:number,time:number,w:number,h:number,style:WaveStyle){
  const ph=Math.max(120,Math.round(h*.15)), top=h-ph, shade=ctx.createLinearGradient(0,top,0,h); shade.addColorStop(0,'rgba(8,8,18,0)'); shade.addColorStop(.22,'rgba(8,8,18,.58)'); shade.addColorStop(1,'rgba(8,8,18,.95)'); ctx.fillStyle=shade; ctx.fillRect(0,top,w,ph);
  const points=Math.max(42,Math.min(96,Math.round(w/14))), usable=w*.84, start=(w-usable)/2, cy=h-ph*.42, maxAmp=ph*.55;
  const vals=Array.from({length:points},(_,i)=>{const off=((i/Math.max(1,points-1))-.5)*.72, a=amplitudeAt(samples,rate,time,off); return Math.max(.06,a*(.84+.16*Math.sin(time*6+i*.31)));});
  ctx.save(); ctx.shadowColor='rgba(167,139,250,.55)'; ctx.shadowBlur=Math.max(8,w*.008); ctx.strokeStyle=waveGradient(ctx,cy-maxAmp,cy+maxAmp); ctx.fillStyle=waveGradient(ctx,cy-maxAmp,cy+maxAmp); ctx.lineWidth=Math.max(3,w*.003); ctx.lineCap='round'; ctx.lineJoin='round';
  if(style==='bars'||style==='mirror'){ const gap=Math.max(3,Math.round(w*.004)), bw=Math.max(3,(usable-gap*(points-1))/points); vals.forEach((a,i)=>{const hh=Math.max(6,maxAmp*a),x=start+i*(bw+gap),y=style==='mirror'?cy-hh:cy-hh/2,bh=style==='mirror'?hh*2:hh; ctx.beginPath();ctx.roundRect(x,y,bw,bh,bw/2);ctx.fill();}); }
  else if(style==='line'){ ctx.beginPath(); vals.forEach((a,i)=>{const x=start+(i/(points-1))*usable,y=cy-(a-.18)*maxAmp*1.25;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke(); }
  else if(style==='dots'){ const r=Math.max(3,w*.004); vals.forEach((a,i)=>{const x=start+(i/(points-1))*usable,y=cy-(a-.22)*maxAmp;ctx.globalAlpha=.5+a*.5;ctx.beginPath();ctx.arc(x,y,r*(.8+a*1.1),0,Math.PI*2);ctx.fill();}); }
  else { for(let i=0;i<34;i++){const a=vals[Math.floor((i/34)*vals.length)]??.1,x=start+(i/33)*usable,p=.65+.35*Math.sin(time*9-i*.45),hh=Math.max(8,a*maxAmp*(.7+p*.8));ctx.globalAlpha=.45+p*.55;ctx.beginPath();ctx.roundRect(x,cy-hh/2,Math.max(5,w*.006),hh,w*.004);ctx.fill();} }
  ctx.restore();
}

async function generateVideo(song:Song, aspect:VideoAspect, waveStyle:WaveStyle){
  if(!song.picture||!song.audio) throw new Error('Không đủ ảnh hoặc audio để tự tạo video.');
  const [ir,ar]=await Promise.all([fetch(song.picture,{cache:'no-store'}),fetch(song.audio,{cache:'no-store'})]);
  if(!ir.ok||!ar.ok) throw new Error('Không thể tải ảnh hoặc audio để tạo video.');
  if(!('VideoEncoder' in window)) throw new Error('Trình duyệt này chưa hỗ trợ tạo video MP4. Hãy dùng Chrome hoặc Edge mới nhất.');
  const {ALL_FORMATS,BlobSource,BufferTarget,CanvasSource,EncodedAudioPacketSource,EncodedPacketSink,Input,Mp4OutputFormat,Output}=await import('mediabunny');
  const audioBlob=await ar.blob(), input=new Input({source:new BlobSource(audioBlob),formats:ALL_FORMATS}), audioTrack=await input.getPrimaryAudioTrack();
  if(!audioTrack) throw new Error('File nguồn không có track audio hợp lệ.');
  const codec=await audioTrack.getCodec(), decoderConfig=await audioTrack.getDecoderConfig(), duration=await input.computeDuration();
  if(!codec||!decoderConfig||!Number.isFinite(duration)||duration<=0) throw new Error('Không đọc được thông tin audio để tạo video.');
  let samples:Float32Array|null=null, rate=48000; try{const ac=new AudioContext(),d=await ac.decodeAudioData(await audioBlob.arrayBuffer());samples=d.getChannelData(0);rate=d.sampleRate;await ac.close();}catch{}
  const size=VIDEO_SIZES[aspect];
  if(!size) throw new Error('Tỉ lệ video không hợp lệ.');
  const canvas=document.createElement('canvas'); canvas.width=size.width; canvas.height=size.height;
  const ctx=canvas.getContext('2d',{alpha:false}); if(!ctx) throw new Error('Trình duyệt không tạo được khung hình video.');
  const bmp=await createImageBitmap(await ir.blob());
  const target=new BufferTarget(), output=new Output({format:new Mp4OutputFormat(),target}), bitrate=size.width*size.height>=1_000_000?2_200_000:1_500_000;
  const videoSource=new CanvasSource(canvas,{codec:'avc',bitrate}), audioSource=new EncodedAudioPacketSource(codec); output.addVideoTrack(videoSource); output.addAudioTrack(audioSource,{decoderConfig}); await output.start();
  try{
    const fps=12, fd=1/fps, frames=Math.ceil(duration*fps);
    for(let frame=0;frame<frames;frame++){ const t=frame*fd; drawCover(ctx,bmp,size.width,size.height); drawTitle(ctx,song.title,song.creator,size.width,size.height); drawWaveform(ctx,samples,rate,t,size.width,size.height,waveStyle); await videoSource.add(t,Math.min(fd,duration-t),{keyFrame:frame%(fps*2)===0}); }
    bmp.close(); const sink=new EncodedPacketSink(audioTrack), meta={decoderConfig}; for await(const p of sink.packets()) await audioSource.add(p,meta); await output.finalize();
  }catch(e){bmp.close();output.cancel();throw e;}
  if(!target.buffer) throw new Error('Không thể xuất file video MP4.'); return new Blob([target.buffer],{type:'video/mp4'});
}

async function convertMedia(source:Blob,format:'mp3'|'wav'){
  const {Input,ALL_FORMATS,BlobSource,Output,BufferTarget,Mp3OutputFormat,WavOutputFormat,Conversion,canEncodeAudio}=await import('mediabunny');
  if(format==='mp3'&&!(await canEncodeAudio('mp3'))){const {registerMp3Encoder}=await import('@mediabunny/mp3-encoder');registerMp3Encoder();}
  const input=new Input({source:new BlobSource(source),formats:ALL_FORMATS}),target=new BufferTarget(),output=new Output({format:format==='mp3'?new Mp3OutputFormat():new WavOutputFormat(),target});
  const conversion=await Conversion.init({input,output,video:{discard:true},audio:format==='mp3'?{bitrate:192000,numberOfChannels:2,sampleRate:48000,forceTranscode:true}:{numberOfChannels:2,sampleRate:48000,sampleFormat:'s16',forceTranscode:true},copy:false,showWarnings:false});
  if(!conversion.isValid) throw new Error(`Trình duyệt không hỗ trợ tạo file ${format.toUpperCase()}.`); await conversion.execute(); if(!target.buffer) throw new Error(`Không thể tạo file ${format.toUpperCase()}.`); return new Blob([target.buffer],{type:format==='mp3'?'audio/mpeg':'audio/wav'});
}

export default function Home(){
  const [url,setUrl]=useState(''),[song,setSong]=useState<Song|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[downloading,setDownloading]=useState(false),[videoAction,setVideoAction]=useState<'original'|'generated'|null>(null),[videoAspect,setVideoAspect]=useState<VideoAspect>('16:9'),[waveStyle,setWaveStyle]=useState<WaveStyle>('bars'),[converting,setConverting]=useState<'mp3'|'wav'|null>(null),[copied,setCopied]=useState<'lyrics'|'style'|null>(null); const lastResolvedUrl=useRef('');
  useEffect(()=>{const c=url.trim(),ok=/^https:\/\/(?:[^/]+\.)?suno\.com\//i.test(c);if(!c){setSong(null);setError('');setLoading(false);lastResolvedUrl.current='';return}if(c===lastResolvedUrl.current)return;setSong(null);setError('');if(!ok){setLoading(false);return}const ctl=new AbortController(),timer=setTimeout(async()=>{setLoading(true);try{const r=await fetch('/api/resolve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:c}),signal:ctl.signal}),d=await r.json();if(!r.ok)throw new Error(d.error||'Không thể đọc bài hát này.');lastResolvedUrl.current=c;setSong(d)}catch(e){if(!ctl.signal.aborted)setError(e instanceof Error?e.message:'Đã có lỗi xảy ra.')}finally{if(!ctl.signal.aborted)setLoading(false)}},450);return()=>{clearTimeout(timer);ctl.abort()}},[url]);
  async function downloadSong(){if(!song)return;setDownloading(true);setError('');try{const r=await fetch(song.audio,{cache:'no-store'});if(!r.ok)throw new Error('Không thể tải file âm thanh.');saveBlob(await r.blob(),`${song.title||'suno-audio'}.m4a`)}catch(e){setError(e instanceof Error?e.message:'Đã có lỗi xảy ra.')}finally{setDownloading(false)}}
  async function copyText(v:string,k:'lyrics'|'style'){await navigator.clipboard.writeText(v);setCopied(k);setTimeout(()=>setCopied(null),1800)}
  async function downloadOriginalVideo(){if(!song)return;setVideoAction('original');setError('');try{if(!song.video)throw new Error('Bài hát này chưa có video gốc.');const r=await fetch(song.video,{cache:'no-store'});if(!r.ok)throw new Error('Không thể tải video gốc.');saveBlob(await r.blob(),`${song.title||'suno-video'}-original.mp4`)}catch(e){setError(e instanceof Error?e.message:'Đã có lỗi xảy ra.')}finally{setVideoAction(null)}}
  async function downloadGeneratedVideo(){if(!song)return;setVideoAction('generated');setError('');try{const aspect=videoAspect,style=waveStyle,size=VIDEO_SIZES[aspect];saveBlob(await generateVideo(song,aspect,style),`${song.title||'suno-video'}-${size.width}x${size.height}-${style}.mp4`)}catch(e){setError(e instanceof Error?e.message:'Không thể tạo video MP4.')}finally{setVideoAction(null)}}
  async function downloadConverted(f:'mp3'|'wav'){if(!song)return;setConverting(f);setError('');try{const r=await fetch(song.audio,{cache:'no-store'});if(!r.ok)throw new Error('Không thể tải nguồn âm thanh để chuyển đổi.');saveBlob(await convertMedia(await r.blob(),f),`${song.title||'suno-audio'}.${f}`)}catch(e){setError(e instanceof Error?e.message:`Không thể tạo file ${f.toUpperCase()}.`)}finally{setConverting(null)}}
  const preview=VIDEO_SIZES[videoAspect];
  return <main className="min-h-screen overflow-hidden bg-[#080812] text-white"><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(139,92,246,.24),transparent_31%),radial-gradient(circle_at_82%_20%,rgba(34,211,238,.16),transparent_27%)]"/><nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400"><Music2 className="size-5"/></span><div><p className="font-bold">Suno Grab <span className="text-violet-300">v2</span></p><p className="text-[10px] uppercase tracking-[.22em] text-white/45">Media downloader</p></div></div><span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 sm:flex"><ShieldCheck className="size-3.5 text-emerald-400"/> Không cần đăng nhập</span></nav><section className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-20 pt-14 text-center sm:px-8"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3.5 py-1.5 text-xs text-violet-200"><Sparkles className="size-3.5"/> Nhanh, miễn phí và dễ dùng</div><h1 className="max-w-3xl text-4xl font-bold sm:text-6xl">Mang bản nhạc Suno của bạn <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">về máy.</span></h1><p className="mt-5 text-white/55">Tải audio, video gốc hoặc tạo video theo đúng tỉ lệ bạn cần.</p><div className="mt-10 w-full rounded-[28px] border border-white/10 bg-white/[.055] p-2.5"><label className="relative block"><Link2 className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/35"/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Dán link https://suno.com/s/..." className="h-14 w-full rounded-[19px] border border-white/10 bg-black/25 pl-12 pr-32 text-[15px] outline-none"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/45">{loading?'Đang lấy...':'Tự động'}</span></label></div><div className="mt-5 w-full">{error&&<p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}{song&&<article className="rounded-[26px] border border-white/10 bg-white/[.06] p-5 text-left"><div className="flex flex-col items-center gap-5 sm:flex-row">{song.picture?<img src={song.picture} alt="Ảnh bìa" className="size-28 rounded-2xl object-cover sm:size-32"/>:<div className="grid size-28 place-items-center rounded-2xl bg-white/10"><Music2/></div>}<div className="min-w-0 flex-1 text-center sm:text-left"><p className="text-xs font-semibold uppercase text-emerald-300"><CheckCircle2 className="mr-1 inline size-3.5"/>Đã tìm thấy</p><h2 className="truncate text-xl font-bold">{song.title}</h2><p className="mt-2 text-sm text-white/45">{song.creator||song.description}</p><audio controls preload="metadata" src={song.audio} className="mt-4 h-10 w-full"/></div><div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-1"><button onClick={()=>downloadConverted('mp3')} className="h-11 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 text-sm font-bold">Tải MP3</button><button onClick={()=>downloadConverted('wav')} className="h-11 rounded-xl border border-violet-300/20 bg-violet-300/10 px-4 text-sm font-bold">Tải WAV</button><button onClick={downloadSong} className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold">Tải M4A</button><button onClick={downloadOriginalVideo} className="h-11 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-bold">Tải video gốc</button></div></div><div className="mt-5 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[.055] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-100"><Waves className="size-4"/> Tạo video + sóng nhạc + title</div><p className="mt-1 text-xs text-white/45">Kích thước output hiện tại: <b>{preview.width}×{preview.height}</b>. Title được ghi trực tiếp vào từng frame video.</p><div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]"><div className="flex items-center justify-center rounded-xl bg-black/25 p-3"><div className="relative overflow-hidden rounded-lg border border-white/10 bg-black" style={{aspectRatio:`${preview.width}/${preview.height}`,width:preview.width>=preview.height?'100%':'42%',maxHeight:220}}>{song.picture&&<img src={song.picture} className="absolute inset-0 h-full w-full object-cover opacity-70" alt="preview"/>}<div className="absolute inset-x-2 bottom-12 rounded-md bg-black/55 px-2 py-1 text-center text-[10px] font-bold">{song.title}</div><div className="absolute inset-x-2 bottom-3 h-5 rounded bg-gradient-to-r from-cyan-400/70 via-violet-400/70 to-fuchsia-400/70"/></div></div><div><p className="text-[11px] font-bold uppercase text-white/40">Tỉ lệ video</p><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(VIDEO_SIZES) as VideoAspect[]).map(a=><button key={a} onClick={()=>setVideoAspect(a)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${videoAspect===a?'border-fuchsia-300/50 bg-fuchsia-300/20':'border-white/10 bg-black/20 text-white/55'}`}>{a}<span className="ml-1 text-[9px] opacity-50">{VIDEO_SIZES[a].width}×{VIDEO_SIZES[a].height}</span></button>)}</div><p className="mt-4 text-[11px] font-bold uppercase text-white/40">Kiểu sóng nhạc</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{WAVE_STYLES.map(x=><button key={x.id} onClick={()=>setWaveStyle(x.id)} className={`rounded-xl border px-3 py-2 text-left ${waveStyle===x.id?'border-cyan-300/50 bg-cyan-300/15':'border-white/10 bg-black/20 text-white/55'}`}><span className="block text-xs font-bold">{x.label}</span><span className="text-[10px] opacity-60">{x.hint}</span></button>)}</div></div></div><button onClick={downloadGeneratedVideo} disabled={videoAction!==null} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 font-bold disabled:opacity-60">{videoAction==='generated'?<LoaderCircle className="size-4 animate-spin"/>:<Clapperboard className="size-4"/>}{videoAction==='generated'?`Đang tạo ${preview.width}×${preview.height}...`:`Tạo & tải ${videoAspect} · ${waveStyle}`}</button></div>{song.video&&<details className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-semibold">Xem video Suno</summary><video controls preload="metadata" poster={song.picture||undefined} src={song.video} className="mt-4 aspect-video w-full rounded-2xl bg-black object-contain"/></details>}{song.style&&<div className="mt-5 border-t border-white/10 pt-4"><div className="flex justify-between"><h3 className="text-sm font-semibold">Style</h3><button onClick={()=>copyText(song.style!,'style')} className="text-xs">{copied==='style'?'Đã sao chép':'Sao chép style'}</button></div><p className="mt-2 whitespace-pre-wrap text-sm text-white/65">{song.style}</p></div>}{song.lyrics&&<details className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-semibold">Xem lời bài hát</summary><pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm text-white/65">{song.lyrics}</pre></details>}</article>}</div></section></main>
}
