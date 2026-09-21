'use client';

import {useEffect,useState} from 'react';
import {Waves} from 'lucide-react';

export type AudioFadeConfig={fadeIn:number;fadeOut:number};
export const AUDIO_FADE_KEY='suno-v10-audio-fade';
export function readAudioFade():AudioFadeConfig{try{const v=JSON.parse(localStorage.getItem(AUDIO_FADE_KEY)||'null');return{fadeIn:Math.max(0,Math.min(30,Number(v?.fadeIn)||0)),fadeOut:Math.max(0,Math.min(30,Number(v?.fadeOut)||0))}}catch{return{fadeIn:0,fadeOut:0}}}
function fmt(v:number){return v<=0?'Off':`${v.toFixed(1)}s`}

export function AudioFadeEditor(){
 const [config,setConfig]=useState<AudioFadeConfig>({fadeIn:0,fadeOut:0});
 useEffect(()=>setConfig(readAudioFade()),[]);
 function update(key:keyof AudioFadeConfig,value:number){const next={...config,[key]:Math.max(0,Math.min(30,value))};setConfig(next);localStorage.setItem(AUDIO_FADE_KEY,JSON.stringify(next));window.dispatchEvent(new CustomEvent('suno-v10-audio-fade-change',{detail:next}))}
 return <section className="rounded-2xl border border-white/[.08] bg-[#0b1626] p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><Waves className="size-4"/></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-300">Fade In / Fade Out</p><b className="text-sm">Mượt đầu và cuối video</b></div></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-[11px] font-semibold text-white/60"><span className="flex justify-between"><span>Fade In</span><b className="text-cyan-200">{fmt(config.fadeIn)}</b></span><input aria-label="Fade in duration" type="range" min="0" max="15" step="0.1" value={config.fadeIn} onChange={e=>update('fadeIn',Number(e.target.value))} className="mt-2 w-full accent-cyan-300"/><span className="mt-1 block text-[9px] font-normal text-white/30">Tăng âm lượng từ im lặng ở đầu output.</span></label><label className="text-[11px] font-semibold text-white/60"><span className="flex justify-between"><span>Fade Out</span><b className="text-violet-200">{fmt(config.fadeOut)}</b></span><input aria-label="Fade out duration" type="range" min="0" max="15" step="0.1" value={config.fadeOut} onChange={e=>update('fadeOut',Number(e.target.value))} className="mt-2 w-full accent-violet-300"/><span className="mt-1 block text-[9px] font-normal text-white/30">Giảm âm lượng về im lặng ở cuối output.</span></label></div><p className="mt-3 rounded-lg bg-white/[.035] px-3 py-2 text-[10px] leading-4 text-white/35">Fade chỉ áp dụng ở đầu/cuối toàn bộ video. Các vòng lặp ở giữa vẫn nối liền, không tạo khoảng lặng.</p></section>
}
