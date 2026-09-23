'use client';

import {DEFAULT_LONG_VIDEO_CONFIG,resolveLongDuration,type LongVideoConfig} from './long-video-render';

type Props={songDuration:number;value:LongVideoConfig;onChange:(next:LongVideoConfig)=>void};

function fmt(seconds:number){
  const s=Math.max(0,Math.round(seconds)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return h>0 ? h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0') : m+':'+String(sec).padStart(2,'0');
}

export function LongVideoLoopPanel({songDuration,value,onChange}:Props){
  const total=resolveLongDuration(songDuration,value);
  const loops=Math.max(1,Math.ceil(total/Math.max(.01,songDuration)));
  return <section className="rounded-2xl border border-amber-300/10 bg-amber-300/[.035] p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-amber-300">Long Video Loop</p>
        <b className="text-sm">Lặp bài để tạo video dài</b>
        <p className="mt-1 text-[11px] text-white/35">Render theo segment và có checkpoint để giảm rủi ro mất tiến trình.</p>
      </div>
      <label className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs font-semibold">
        <input type="checkbox" checked={value.enabled} onChange={e=>onChange({...value,enabled:e.target.checked})}/>
        Bật
      </label>
    </div>

    {value.enabled&&<div className="mt-4 grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>onChange({...value,mode:'count'})} className={'rounded-lg px-3 py-2 text-xs font-semibold '+(value.mode==='count'?'bg-amber-300/15 text-amber-100':'bg-white/5 text-white/50')}>Theo số lần</button>
        <button type="button" onClick={()=>onChange({...value,mode:'target'})} className={'rounded-lg px-3 py-2 text-xs font-semibold '+(value.mode==='target'?'bg-amber-300/15 text-amber-100':'bg-white/5 text-white/50')}>Theo thời lượng</button>
        <button type="button" onClick={()=>onChange({...DEFAULT_LONG_VIDEO_CONFIG,enabled:false})} className="ml-auto rounded-lg bg-white/5 px-3 py-2 text-xs text-white/45">Reset</button>
      </div>

      {value.mode==='count'?<div>
        <div className="flex flex-wrap gap-2">
          {[2,5,10,20,30].map(count=><button key={count} type="button" onClick={()=>onChange({...value,loopCount:count})} className={'rounded-lg px-3 py-2 text-xs '+(value.loopCount===count?'bg-violet-400/20 text-violet-100':'bg-white/5')}>{count}×</button>)}
        </div>
        <label className="mt-3 block text-[11px] text-white/45">Số lần tùy chỉnh
          <input type="number" min="1" max="500" value={value.loopCount} onChange={e=>onChange({...value,loopCount:Math.max(1,Math.min(500,Number(e.target.value)||1))})} className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm"/>
        </label>
      </div>:<div>
        <div className="flex flex-wrap gap-2">
          {[30,60,120,180,360].map(minutes=><button key={minutes} type="button" onClick={()=>onChange({...value,targetMinutes:minutes})} className={'rounded-lg px-3 py-2 text-xs '+(value.targetMinutes===minutes?'bg-violet-400/20 text-violet-100':'bg-white/5')}>{minutes<60?minutes+' phút':(minutes/60)+' giờ'}</button>)}
        </div>
        <label className="mt-3 block text-[11px] text-white/45">Thời lượng tùy chỉnh (phút)
          <input type="number" min="1" max="1440" value={value.targetMinutes} onChange={e=>onChange({...value,targetMinutes:Math.max(1,Math.min(1440,Number(e.target.value)||1))})} className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm"/>
        </label>
      </div>}

      <details className="rounded-xl border border-white/[.06] bg-black/15">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-white/55">Cài đặt render dài</summary>
        <div className="border-t border-white/[.05] p-3">
          <label className="text-[11px] text-white/45">Độ dài segment: {value.segmentSeconds}s
            <input type="range" min="30" max="300" step="30" value={value.segmentSeconds} onChange={e=>onChange({...value,segmentSeconds:Number(e.target.value)})} className="mt-2 w-full accent-amber-300"/>
          </label>
          <p className="mt-2 text-[10px] leading-4 text-white/35">Trên mobile hệ thống tự giới hạn segment tối đa 90 giây để giảm RAM.</p>
        </div>
      </details>

      <div className="rounded-xl border border-amber-300/10 bg-black/20 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs"><span className="text-white/45">Video đầu ra</span><b className="text-amber-100">{fmt(total)}</b></div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-white/35"><span>Bài gốc {fmt(songDuration)}</span><span>≈ {loops} vòng</span></div>
      </div>
    </div>}
  </section>;
}
