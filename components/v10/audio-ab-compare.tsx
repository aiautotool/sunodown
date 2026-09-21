'use client';

import {useEffect,useRef,useState} from 'react';
import {getAudioPreset,loadAudioPresetId,processAudioBlob,type AudioPresetId} from './audio-processing-presets';

type SongEventDetail={audio?:string;title?:string};

export function AudioABCompare(){
  const [audio,setAudio]=useState('');
  const [title,setTitle]=useState('');
  const [preset,setPreset]=useState<AudioPresetId>('original');
  const [processed,setProcessed]=useState('');
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [side,setSide]=useState<'A'|'B'>('A');
  const [error,setError]=useState('');
  const player=useRef<HTMLAudioElement>(null);
  const position=useRef(0);
  const playing=useRef(false);

  useEffect(()=>{
    setPreset(loadAudioPresetId());
    const onPreset=(e:Event)=>{const id=(e as CustomEvent<AudioPresetId>).detail;setPreset(id);setProcessed('');setSide('A')};
    const onSong=(e:Event)=>{const d=(e as CustomEvent<SongEventDetail>).detail||{};if(d.audio){setAudio(d.audio);setTitle(d.title||'Suno');setProcessed('');setSide('A')}};
    window.addEventListener('sunodown-v10-audio-preset',onPreset);
    window.addEventListener('sunodown-song-resolved',onSong);
    const find=()=>{const el=document.querySelector<HTMLAudioElement>('.mobile-song-head audio');if(el?.src&&el.src!==audio){setAudio(el.src);setTitle(el.closest('.mobile-song-head')?.querySelector('h2')?.textContent||'Suno')}};
    find();const observer=new MutationObserver(find);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
    return()=>{observer.disconnect();window.removeEventListener('sunodown-v10-audio-preset',onPreset);window.removeEventListener('sunodown-song-resolved',onSong)};
  },[]);

  useEffect(()=>()=>{if(processed)URL.revokeObjectURL(processed)},[processed]);

  async function prepare(){
    if(!audio||preset==='original')return;
    setBusy(true);setProgress(0);setError('');
    try{const response=await fetch(audio);if(!response.ok)throw new Error('Không tải được audio để so sánh.');const blob=await response.blob();const out=await processAudioBlob(blob,preset,setProgress);if(processed)URL.revokeObjectURL(processed);setProcessed(URL.createObjectURL(out));setProgress(100)}catch(e){setError(e instanceof Error?e.message:'Không xử lý được audio.')}finally{setBusy(false)}
  }

  async function switchSide(next:'A'|'B'){
    if(next==='B'&&!processed&&preset!=='original')await prepare();
    const p=player.current;if(p){position.current=p.currentTime;playing.current=!p.paused}setSide(next);
    requestAnimationFrame(()=>{const n=player.current;if(!n)return;n.currentTime=Math.min(position.current,Number.isFinite(n.duration)?Math.max(0,n.duration-.05):position.current);if(playing.current)void n.play().catch(()=>{})});
  }

  if(!audio)return null;
  const activeSrc=side==='B'&&processed?processed:audio;
  const presetLabel=getAudioPreset(preset).label;
  return <section className="rounded-2xl border border-cyan-300/10 bg-cyan-400/[.035] p-4">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-300">A/B Audio Compare</p><b className="text-sm">Nghe gốc và bản xử lý cùng vị trí</b><p className="mt-1 text-[11px] text-white/35">{title} · B = {presetLabel}</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/45">{side==='A'?'GỐC':'XỬ LÝ'}</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>switchSide('A')} className={`h-11 rounded-xl text-xs font-bold ${side==='A'?'bg-cyan-400/20 ring-1 ring-cyan-300/40':'bg-white/5'}`}>A · Original</button><button disabled={busy||preset==='original'} onClick={()=>switchSide('B')} className={`h-11 rounded-xl text-xs font-bold disabled:opacity-35 ${side==='B'?'bg-emerald-400/20 ring-1 ring-emerald-300/40':'bg-white/5'}`}>B · {busy?`Đang xử lý ${Math.round(progress)}%`:presetLabel}</button></div>
    {preset==='original'&&<p className="mt-2 text-[11px] text-amber-100/60">Chọn một Audio Processing Preset khác Original để bật B.</p>}
    {error&&<p className="mt-2 text-[11px] text-amber-200">{error}</p>}
    <audio ref={player} key={activeSrc} controls src={activeSrc} onTimeUpdate={e=>{position.current=e.currentTarget.currentTime}} className="mt-3 w-full"/>
  </section>;
}
