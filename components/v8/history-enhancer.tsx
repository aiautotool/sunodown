'use client';
import {useEffect,useState} from 'react';
import {Clock3,ExternalLink,Trash2} from 'lucide-react';

type HistoryItem={id:string;url:string;title:string;createdAt:number};
const KEY='suno-tools-v8-history';

function readHistory():HistoryItem[]{
  if(typeof window==='undefined') return [];
  try{return JSON.parse(localStorage.getItem(KEY)||'[]') as HistoryItem[]}catch{return []}
}
function writeHistory(items:HistoryItem[]){
  localStorage.setItem(KEY,JSON.stringify(items.slice(0,50)));
  window.dispatchEvent(new Event('suno-history-change'));
}
function isSunoLink(value:string){
  try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='suno.com'||u.hostname.endsWith('.suno.com'))}catch{return false}
}
function ago(ts:number){
  const d=Date.now()-ts;
  if(d<60000)return 'Vừa xong';
  if(d<3600000)return `${Math.floor(d/60000)} phút trước`;
  if(d<86400000)return `${Math.floor(d/3600000)} giờ trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

export function V8HistoryEnhancer(){
  const[items,setItems]=useState<HistoryItem[]>([]);
  useEffect(()=>{
    const refresh=()=>setItems(readHistory());
    const capture=(event:Event)=>{
      const target=event.target;
      if(!(target instanceof HTMLInputElement))return;
      const url=target.value.trim();
      if(!isSunoLink(url))return;
      const next={id:`link:${url}`,url,title:'Link Suno',createdAt:Date.now()};
      writeHistory([next,...readHistory().filter(x=>x.id!==next.id)]);
    };
    refresh();
    window.addEventListener('suno-history-change',refresh);
    document.addEventListener('change',capture,true);
    return()=>{window.removeEventListener('suno-history-change',refresh);document.removeEventListener('change',capture,true)};
  },[]);
  const remove=(id:string)=>writeHistory(readHistory().filter(x=>x.id!==id));
  return <section id="library-history" className="mt-5 rounded-2xl border border-white/10 bg-[#081421] p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">Thư viện</p><h2 className="mt-1 font-bold">Lịch sử link đã làm</h2><p className="mt-1 text-xs text-white/40">Lưu trên thiết bị này, tối đa 50 mục.</p></div>
      {items.length>0 ? <button onClick={()=>writeHistory([])} className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50">Xóa tất cả</button> : null}
    </div>
    {items.length===0 ? <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-white/40"><Clock3 className="mx-auto mb-2 size-5"/>Chưa có lịch sử.</div> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{items.map(item=><div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"><ExternalLink className="size-4 shrink-0 text-cyan-300"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.title}</p><p className="mt-1 text-[10px] text-white/35">{ago(item.createdAt)}</p><a href={item.url} className="mt-1 inline-block text-[10px] font-bold text-cyan-300">Mở lại</a></div><button onClick={()=>remove(item.id)} aria-label="Xóa" className="p-2 text-white/30"><Trash2 className="size-3.5"/></button></div>)}</div>}
  </section>;
}
