'use client';

import {useEffect,useRef,useState} from 'react';
import {Download,LoaderCircle,Play,RotateCcw,Trash2} from 'lucide-react';

export type RenderQueueSnapshot={title:string;run:()=>Promise<Blob>;filename:string};
type Status='pending'|'rendering'|'done'|'error';
type Job={id:string;title:string;filename:string;status:Status;progress:number;error?:string;blob?:Blob;run:()=>Promise<Blob>};

function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}

export function RenderQueue({enqueue,onBusyChange}:{enqueue:RenderQueueSnapshot|null;onBusyChange?:(busy:boolean)=>void}){
 const [jobs,setJobs]=useState<Job[]>([]),running=useRef(false),seen=useRef<RenderQueueSnapshot|null>(null);
 useEffect(()=>{if(!enqueue||seen.current===enqueue)return;seen.current=enqueue;setJobs(list=>[...list,{...enqueue,id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,status:'pending',progress:0}])},[enqueue]);
 useEffect(()=>{if(running.current||!jobs.some(j=>j.status==='pending'))return;const job=jobs.find(j=>j.status==='pending');if(!job)return;running.current=true;onBusyChange?.(true);setJobs(list=>list.map(j=>j.id===job.id?{...j,status:'rendering',progress:5}:j));(async()=>{try{const blob=await job.run();setJobs(list=>list.map(j=>j.id===job.id?{...j,status:'done',progress:100,blob}:j))}catch(e){setJobs(list=>list.map(j=>j.id===job.id?{...j,status:'error',progress:0,error:e instanceof Error?e.message:'Render lỗi'}:j))}finally{running.current=false;onBusyChange?.(false)}})()},[jobs,onBusyChange]);
 const retry=(id:string)=>setJobs(list=>list.map(j=>j.id===id?{...j,status:'pending',progress:0,error:undefined}:j));
 const remove=(id:string)=>setJobs(list=>list.filter(j=>j.id!==id));
 const clearDone=()=>setJobs(list=>list.filter(j=>j.status!=='done'));
 if(!jobs.length)return null;
 return <section className="mt-4 rounded-2xl border border-violet-300/15 bg-black/20 p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-300">Render Queue</p><b className="text-sm">{jobs.filter(j=>j.status==='pending').length} đang chờ · {jobs.filter(j=>j.status==='done').length} hoàn tất</b></div>{jobs.some(j=>j.status==='done')&&<button onClick={clearDone} className="rounded-lg bg-white/5 px-3 py-2 text-[11px] text-white/55">Dọn đã xong</button>}</div><div className="grid gap-2">{jobs.map((j,i)=><div key={j.id} className="rounded-xl border border-white/[.06] bg-white/[.03] p-3"><div className="flex items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/5 text-[11px] font-bold">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{j.title}</p><p className="mt-0.5 text-[10px] text-white/35">{j.status==='pending'?'Đang chờ':j.status==='rendering'?'Đang render…':j.status==='done'?'Hoàn tất':j.error||'Lỗi'}</p></div>{j.status==='rendering'&&<LoaderCircle className="size-4 animate-spin text-violet-300"/>}{j.status==='done'&&j.blob&&<button onClick={()=>download(j.blob!,j.filename)} className="rounded-lg bg-emerald-300/10 p-2 text-emerald-200" title="Tải video"><Download className="size-4"/></button>}{j.status==='error'&&<button onClick={()=>retry(j.id)} className="rounded-lg bg-amber-300/10 p-2 text-amber-200" title="Thử lại"><RotateCcw className="size-4"/></button>}{j.status!=='rendering'&&<button onClick={()=>remove(j.id)} className="rounded-lg bg-white/5 p-2 text-white/40" title="Xóa"><Trash2 className="size-4"/></button>}</div>{j.status==='rendering'&&<div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/3 animate-pulse rounded-full bg-violet-400"/></div>}</div>)}</div></section>
}
