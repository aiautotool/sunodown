'use client';

import {useMemo,useState} from 'react';
import {Check,Clipboard,ExternalLink,ListPlus,Trash2,X} from 'lucide-react';

export type BatchSunoItem={id:string;url:string};

function normalizeSunoUrl(raw:string){
  try{
    const u=new URL(raw.trim().replace(/[),.;]+$/,''));
    const host=u.hostname.toLowerCase();
    if(u.protocol!=='https:'||!(host==='suno.com'||host.endsWith('.suno.com')))return null;
    u.hostname='suno.com';u.hash='';u.search='';
    u.pathname=u.pathname.replace(/\/+$/,'');
    if(!u.pathname||u.pathname==='/')return null;
    return u.toString().replace(/\/$/,'');
  }catch{return null}
}
export function parseBatchSunoLinks(input:string){
  const tokens=input.match(/https:\/\/[^\s<>"']+/gi)||[];
  const seen=new Set<string>();const items:BatchSunoItem[]=[];let invalid=0,duplicates=0;
  for(const token of tokens){const url=normalizeSunoUrl(token);if(!url){invalid++;continue}if(seen.has(url)){duplicates++;continue}seen.add(url);items.push({id:url,url})}
  return {items,invalid,duplicates};
}

export function BatchSunoLinks({currentUrl,onSelect}:{currentUrl:string;onSelect:(url:string)=>void}){
  const [open,setOpen]=useState(false),[text,setText]=useState(''),[items,setItems]=useState<BatchSunoItem[]>([]);
  const parsed=useMemo(()=>parseBatchSunoLinks(text),[text]);
  function add(){if(!parsed.items.length)return;setItems(prev=>{const map=new Map(prev.map(x=>[x.url,x]));for(const item of parsed.items)map.set(item.url,item);return [...map.values()]});setText('')}
  async function paste(){try{const value=await navigator.clipboard.readText();setText(value);setOpen(true)}catch{}}
  if(!open)return <div className="mt-3 flex justify-end"><button type="button" onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[.06] px-3 py-2 text-xs font-bold text-cyan-100"><ListPlus className="size-4"/>Nhiều link</button></div>;
  return <section className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.035] p-4">
    <div className="flex items-center justify-between"><div><p className="text-sm font-bold">Batch Suno Links</p><p className="text-[11px] text-white/40">Dán nhiều link, mỗi link có thể nằm ở dòng bất kỳ.</p></div><button type="button" onClick={()=>setOpen(false)} className="rounded-lg p-2 text-white/40 hover:bg-white/5"><X className="size-4"/></button></div>
    <div className="mt-3 relative"><textarea value={text} onChange={e=>setText(e.target.value)} rows={4} placeholder={"https://suno.com/s/...\nhttps://suno.com/song/..."} className="w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 pr-12 text-xs outline-none focus:border-cyan-300/30"/><button type="button" onClick={paste} title="Dán từ clipboard" className="absolute right-2 top-2 rounded-lg bg-white/[.07] p-2 text-white/55"><Clipboard className="size-4"/></button></div>
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]"><span className="rounded-full bg-emerald-300/10 px-2 py-1 text-emerald-200">{parsed.items.length} hợp lệ</span>{parsed.duplicates>0&&<span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-100">{parsed.duplicates} trùng</span>}{parsed.invalid>0&&<span className="rounded-full bg-rose-300/10 px-2 py-1 text-rose-100">{parsed.invalid} không hợp lệ</span>}<button type="button" disabled={!parsed.items.length} onClick={add} className="ml-auto rounded-lg bg-cyan-400/15 px-3 py-1.5 font-bold text-cyan-100 disabled:opacity-30">Thêm vào danh sách</button></div>
    {items.length>0&&<div className="mt-4 space-y-2">{items.map((item,index)=>{const active=item.url===currentUrl.trim();return <div key={item.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${active?'border-emerald-300/25 bg-emerald-300/[.07]':'border-white/[.06] bg-black/15'}`}><span className="w-6 text-center text-[10px] text-white/30">{index+1}</span><button type="button" onClick={()=>onSelect(item.url)} className="min-w-0 flex-1 text-left"><span className="block truncate text-xs text-white/70">{item.url}</span><span className={`text-[10px] ${active?'text-emerald-200':'text-white/30'}`}>{active?<><Check className="mr-1 inline size-3"/>Đang mở</>:'Sẵn sàng'}</span></button><a href={item.url} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-white/35 hover:bg-white/5"><ExternalLink className="size-3.5"/></a><button type="button" onClick={()=>setItems(v=>v.filter(x=>x.id!==item.id))} className="rounded-lg p-2 text-white/35 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="size-3.5"/></button></div>})}<button type="button" onClick={()=>setItems([])} className="text-[10px] text-white/35 hover:text-white/60">Xóa toàn bộ danh sách</button></div>}
  </section>
}
