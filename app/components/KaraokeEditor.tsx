'use client';

import {useEffect,useRef,useState} from 'react';
import type {KaraokeLine} from '../lib/karaoke';
import {setLineTiming} from '../lib/karaoke';

type Props={audioUrl:string;lyrics:string;duration:number;timeline:KaraokeLine[];onChange:(v:KaraokeLine[])=>void};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const sec=(v:number)=>Number.isFinite(v)?v.toFixed(2):'0.00';

export default function KaraokeEditor({audioUrl,duration,timeline,onChange}:Props){
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const dragRef=useRef<{index:number;edge:'start'|'end'}|null>(null);
  const [peaks,setPeaks]=useState<number[]>([]);
  const [time,setTime]=useState(0);
  const [selected,setSelected]=useState(0);

  useEffect(()=>{let cancelled=false;let context:AudioContext|null=null;(async()=>{try{const response=await fetch(audioUrl,{cache:'no-store'});if(!response.ok)return;const AudioCtx=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioCtx)return;context=new AudioCtx();const buffer=await context.decodeAudioData((await response.arrayBuffer()).slice(0));const data=buffer.getChannelData(0);const bins=Math.min(720,Math.max(180,Math.floor((window.innerWidth||360)*1.5)));const step=Math.max(1,Math.floor(data.length/bins));const next:number[]=[];for(let i=0;i<bins;i++){let max=0;const from=i*step,to=Math.min(data.length,from+step);for(let j=from;j<to;j++)max=Math.max(max,Math.abs(data[j]));next.push(max);if(i%120===0)await new Promise<void>(resolve=>setTimeout(resolve,0));}if(!cancelled)setPeaks(next);}catch{}finally{if(context)void context.close().catch(()=>{})}})();return()=>{cancelled=true;if(context)void context.close().catch(()=>{})}},[audioUrl]);

  useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const width=Math.max(280,canvas.clientWidth),height=150,dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#08111f';ctx.fillRect(0,0,width,height);const mid=height/2,bar=width/Math.max(1,peaks.length);ctx.strokeStyle='rgba(148,163,184,.42)';for(let i=0;i<peaks.length;i++){const h=Math.max(1,peaks[i]*height*.42);ctx.beginPath();ctx.moveTo(i*bar,mid-h);ctx.lineTo(i*bar,mid+h);ctx.stroke();}const total=Math.max(.01,duration);timeline.forEach((line,index)=>{const x=line.start/total*width,w=Math.max(2,(line.end-line.start)/total*width);ctx.fillStyle=index===selected?'rgba(217,70,239,.24)':'rgba(99,102,241,.12)';ctx.fillRect(x,0,w,height);ctx.strokeStyle=index===selected?'#f0abfc':'#818cf8';ctx.strokeRect(x+.5,.5,Math.max(1,w-1),height-1);if(index===selected){ctx.fillStyle='#f0abfc';ctx.fillRect(x-2,0,4,height);ctx.fillRect(x+w-2,0,4,height);}});ctx.fillStyle='#22d3ee';ctx.fillRect(clamp(time/total,0,1)*width-1,0,2,height)},[peaks,duration,time,timeline,selected]);

  function eventTime(clientX:number){const canvas=canvasRef.current;if(!canvas)return 0;const rect=canvas.getBoundingClientRect();return clamp((clientX-rect.left)/Math.max(1,rect.width),0,1)*duration}
  function seek(value:number){const next=clamp(value,0,duration);if(audioRef.current)audioRef.current.currentTime=next;setTime(next)}
  function pointerDown(event:React.PointerEvent<HTMLCanvasElement>){const t=eventTime(event.clientX),threshold=Math.max(.12,duration*.012);let hit=-1,edge:'start'|'end'='start',distance=Infinity;timeline.forEach((line,index)=>{const ds=Math.abs(t-line.start),de=Math.abs(t-line.end);if(ds<threshold&&ds<distance){hit=index;edge='start';distance=ds}if(de<threshold&&de<distance){hit=index;edge='end';distance=de}});if(hit>=0){dragRef.current={index:hit,edge};setSelected(hit);event.currentTarget.setPointerCapture(event.pointerId);return}const inside=timeline.findIndex(line=>t>=line.start&&t<=line.end);if(inside>=0)setSelected(inside);seek(t)}
  function pointerMove(event:React.PointerEvent<HTMLCanvasElement>){const drag=dragRef.current;if(!drag)return;const line=timeline[drag.index];if(!line)return;const t=eventTime(event.clientX);onChange(setLineTiming(timeline,drag.index,drag.edge==='start'?Math.min(t,line.end-.02):line.start,drag.edge==='end'?Math.max(t,line.start+.02):line.end))}
  function stopDrag(){dragRef.current=null}

  return <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
    <div className="flex items-start justify-between gap-3"><div><b>Waveform Lyrics Editor</b><p className="mt-1 text-xs text-white/45">Chạm waveform để seek. Kéo mép vùng lyric để chỉnh Start/End chính xác.</p></div><span className="shrink-0 rounded-lg bg-fuchsia-300/10 px-2 py-1 font-mono text-[10px] text-fuchsia-100">{sec(time)}s</span></div>
    <audio ref={audioRef} src={audioUrl} controls preload="metadata" onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onSeeked={e=>setTime(e.currentTarget.currentTime)} className="mt-4 h-10 w-full"/>
    <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} className="mt-4 h-[150px] w-full touch-none rounded-xl border border-white/10" aria-label="Waveform lyrics timing editor"/>
    <input type="range" min={0} max={duration||1} step="0.01" value={Math.min(time,duration||1)} onChange={e=>seek(Number(e.target.value))} className="mt-3 w-full"/>
    <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">{timeline.map((line,index)=><div key={`${index}-${line.text}`} className={`rounded-xl border p-3 ${selected===index?'border-fuchsia-300/40 bg-fuchsia-300/[.07]':'border-white/[.07] bg-white/[.025]'}`}><button onClick={()=>{setSelected(index);seek(line.start)}} className="w-full text-left"><span className="text-sm text-white/80">{line.text}</span><span className="float-right font-mono text-[10px] text-white/35">{sec(line.start)}–{sec(line.end)}</span></button>{selected===index&&<div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-white/40">Start<input type="number" min={0} max={line.end-.02} step="0.01" value={line.start} onChange={e=>onChange(setLineTiming(timeline,index,Number(e.target.value),line.end))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs"/></label><label className="text-[10px] text-white/40">End<input type="number" min={line.start+.02} max={duration} step="0.01" value={line.end} onChange={e=>onChange(setLineTiming(timeline,index,line.start,Number(e.target.value)))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs"/></label></div>}</div>)}</div>
  </div>
}
