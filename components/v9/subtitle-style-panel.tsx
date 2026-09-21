'use client';
export type SubtitleStyle={preset:'classic'|'karaoke'|'caption'|'minimal'|'neon'|'boxed';color:string;activeColor:string;background:string;backgroundOpacity:number;fontSize:number;bold:boolean;shadow:boolean;outline:boolean;radius:number};
export const DEFAULT_SUBTITLE_STYLE:SubtitleStyle={preset:'karaoke',color:'#ffffff',activeColor:'#f0abfc',background:'#080812',backgroundOpacity:68,fontSize:100,bold:true,shadow:true,outline:true,radius:28};
const PRESETS:Record<SubtitleStyle['preset'],Partial<SubtitleStyle>>={
 classic:{color:'#ffffff',activeColor:'#ffffff',background:'#000000',backgroundOpacity:0,bold:true,shadow:true,outline:true},
 karaoke:{color:'#ffffff',activeColor:'#f0abfc',background:'#080812',backgroundOpacity:68,bold:true,shadow:true,outline:true},
 caption:{color:'#ffffff',activeColor:'#ffffff',background:'#000000',backgroundOpacity:78,bold:true,shadow:false,outline:false,radius:10},
 minimal:{color:'#ffffff',activeColor:'#ffffff',background:'#000000',backgroundOpacity:0,bold:false,shadow:true,outline:false},
 neon:{color:'#ffffff',activeColor:'#22d3ee',background:'#07131c',backgroundOpacity:42,bold:true,shadow:true,outline:false,radius:30},
 boxed:{color:'#111827',activeColor:'#111827',background:'#ffffff',backgroundOpacity:92,bold:true,shadow:false,outline:false,radius:8}
};
export function SubtitleStylePanel({value,onChange}:{value:SubtitleStyle;onChange:(v:SubtitleStyle)=>void}){
 const set=(p:Partial<SubtitleStyle>)=>onChange({...value,...p});
 return <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-fuchsia-300">Subtitle Style</p><b className="text-sm">Kiểu chữ, màu và nền subtitle</b></div>
 <div className="mt-3 grid grid-cols-3 gap-2">{(Object.keys(PRESETS) as SubtitleStyle['preset'][]).map(p=><button key={p} type="button" onClick={()=>set({preset:p,...PRESETS[p]})} className={`rounded-xl border px-2 py-2 text-xs capitalize ${value.preset===p?'border-fuchsia-300 bg-fuchsia-300/10':'border-white/5 bg-white/[.03]'}`}>{p}</button>)}</div>
 <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><label className="rounded-xl bg-black/20 p-3">Màu chữ<input type="color" value={value.color} onChange={e=>set({color:e.target.value})} className="mt-2 h-9 w-full"/></label><label className="rounded-xl bg-black/20 p-3">Màu karaoke<input type="color" value={value.activeColor} onChange={e=>set({activeColor:e.target.value})} className="mt-2 h-9 w-full"/></label><label className="rounded-xl bg-black/20 p-3">Màu nền<input type="color" value={value.background} onChange={e=>set({background:e.target.value})} className="mt-2 h-9 w-full"/></label><label className="rounded-xl bg-black/20 p-3">Độ mờ nền <b>{value.backgroundOpacity}%</b><input type="range" min="0" max="100" value={value.backgroundOpacity} onChange={e=>set({backgroundOpacity:+e.target.value})} className="mt-3 w-full accent-fuchsia-300"/></label></div>
 <label className="mt-3 block text-xs">Cỡ chữ <b>{value.fontSize}%</b><input type="range" min="60" max="180" value={value.fontSize} onChange={e=>set({fontSize:+e.target.value})} className="mt-2 w-full accent-fuchsia-300"/></label>
 <div className="mt-3 flex flex-wrap gap-2">{([['bold','Đậm'],['shadow','Bóng'],['outline','Viền']] as const).map(([k,label])=><button key={k} type="button" onClick={()=>set({[k]:!value[k]})} className={`rounded-lg px-3 py-2 text-xs ${value[k]?'bg-fuchsia-300/15 text-fuchsia-100':'bg-white/5 text-white/45'}`}>{label}</button>)}</div></section>
}
