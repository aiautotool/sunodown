'use client';

import {useMemo,useState} from 'react';
import type {KaraokeLine} from '../lib/karaoke';

type TranslationLine=KaraokeLine&{translation?:string};

type Props={timeline:KaraokeLine[];onChange:(value:KaraokeLine[])=>void};

function fmt(seconds:number){const s=Math.max(0,seconds);return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}.${String(Math.round((s%1)*1000)).padStart(3,'0')}`}
function exportTranslationVtt(lines:TranslationLine[]){const cues=lines.filter(x=>x.translation?.trim()).map((x,i)=>`${i+1}\n00:${fmt(x.start)} --> 00:${fmt(x.end)}\n${x.translation!.trim()}`).join('\n\n');return `WEBVTT\n\n${cues}${cues?'\n':''}`}

export default function LyricsTranslationTrack({timeline,onChange}:Props){
 const lines=timeline as TranslationLine[];
 const [bulk,setBulk]=useState('');
 const translated=useMemo(()=>lines.filter(x=>x.translation?.trim()).length,[lines]);
 function update(index:number,text:string){onChange(lines.map((line,i)=>i===index?{...line,translation:text}:line))}
 function applyBulk(){const values=bulk.replace(/\r/g,'').split('\n');onChange(lines.map((line,i)=>({...line,translation:(values[i]??line.translation??'').trim()})))}
 function clear(){onChange(lines.map(line=>({...line,translation:''})))}
 function download(){const blob=new Blob([exportTranslationVtt(lines)],{type:'text/vtt;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lyrics-translation.vtt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
 return <section className="mt-4 rounded-xl border border-violet-300/15 bg-violet-300/[.04] p-3">
  <div className="flex items-start justify-between gap-3"><div><b className="text-xs">Lyrics Translation Track</b><p className="mt-1 text-[10px] text-white/40">Mỗi dòng dịch dùng chính Start/End của dòng karaoke gốc nên luôn giữ đúng timeline.</p></div><span className="rounded-lg bg-violet-300/10 px-2 py-1 text-[10px] text-violet-100">{translated}/{lines.length}</span></div>
  <textarea value={bulk} onChange={e=>setBulk(e.target.value)} placeholder="Dán bản dịch: mỗi dòng tương ứng một dòng lyric gốc…" className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-5 outline-none focus:border-violet-300/40"/>
  <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={applyBulk} disabled={!bulk.trim()||!lines.length} className="rounded-lg bg-violet-400/15 px-3 py-2 text-xs font-bold text-violet-100 disabled:opacity-30">Áp dụng theo dòng</button><button type="button" onClick={download} disabled={!translated} className="rounded-lg bg-white/5 px-3 py-2 text-xs disabled:opacity-30">↓ Translation VTT</button><button type="button" onClick={clear} disabled={!translated} className="ml-auto rounded-lg bg-white/5 px-3 py-2 text-xs text-white/45 disabled:opacity-30">Xóa track</button></div>
  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{lines.map((line,index)=><label key={`${index}-${line.start}`} className="block rounded-lg bg-black/20 p-2"><span className="flex gap-2 text-[10px] text-white/35"><b className="min-w-0 flex-1 truncate text-white/55">{line.text}</b><span className="font-mono">{line.start.toFixed(2)}–{line.end.toFixed(2)}</span></span><input value={line.translation||''} onChange={e=>update(index,e.target.value)} placeholder="Bản dịch dòng này…" className="mt-1.5 w-full rounded-lg border border-white/[.07] bg-black/25 px-2.5 py-2 text-xs outline-none focus:border-violet-300/35"/></label>)}</div>
 </section>
}
