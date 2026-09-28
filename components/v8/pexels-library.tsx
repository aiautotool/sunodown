'use client';

// Remote thumbnails use the provider's already resized images.
/* oxlint-disable next/no-img-element */
import {useEffect, useRef, useState} from 'react';

type Media = {
 id:number; type:'photo'|'video'; thumbnail:string; download:string; url:string; alt?:string; duration?:number;
 src?:{large2x?:string}; photographer?:{name:string}; creator?:{name:string};
 files?:{file_type:string; width:number; height:number; link:string}[];
};

// Prefer an MP4 up to Full HD, avoiding unnecessary 4K downloads on mobile.
function mediaUrl(item:Media){
 if(item.type==='photo')return item.src?.large2x||item.download;
 const files=(item.files||[]).filter(f=>f.file_type==='video/mp4'&&f.link&&f.width>0&&f.height>0).sort((a,b)=>b.width*b.height-a.width*a.height);
 return files.find(f=>Math.max(f.width,f.height)<=1920)?.link||files.at(-1)?.link||item.download;
}

export type AddPexelsToTimeline=(file:File,kind:'photo'|'video',duration?:number)=>Promise<void>;

export function PexelsLibrary({onSelect,onAddToTimeline}:{onAddToTimeline:AddPexelsToTimeline;onSelect:(file:File,kind:'photo'|'video')=>Promise<void>}){
 const [query,setQuery]=useState('nature'),[kind,setKind]=useState('photos'),[orientation,setOrientation]=useState('portrait');
 const [page,setPage]=useState(1),[items,setItems]=useState<Media[]>([]),[more,setMore]=useState(false);
 const [notice,setNotice]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[selecting,setSelecting]=useState<number|null>(null);
 const download=useRef<AbortController|null>(null);
 useEffect(()=>()=>download.current?.abort(),[]);
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);setError('');setMore(false);
   if(page===1)setItems([]);
   const timeout=setTimeout(()=>controller.abort(),20000);
   try{
    if(!query.trim())return;
    const params=new URLSearchParams({q:query.trim(),page:String(page),per_page:'12',...(orientation?{orientation}:{})});
    const response=await fetch(`https://pexels.aiautotool.com/v1/${kind}?${params}`,{signal:controller.signal});
    if(!response.ok)throw new Error('Không tải được thư viện Pexels. Vui lòng thử lại.');
    const data=await response.json();
    if(data.success===false||!Array.isArray(data.results))throw new Error('Pexels trả về dữ liệu không hợp lệ.');
    if(controller.signal.aborted)return;
    setItems(previous=>page===1?data.results:[...previous,...data.results.filter((item:Media)=>!previous.some(old=>old.id===item.id))]);
    setMore(Boolean(data.next_page)&&data.results.length>0);
   }catch(e){if(disposed)return;if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Không kết nối được Pexels.');else setError('Pexels phản hồi quá lâu. Vui lòng thử lại.');}
   finally{clearTimeout(timeout);if(!disposed)setLoading(false);}
  },350);
  let disposed=false;
  return()=>{disposed=true;clearTimeout(timer);controller.abort();};
 },[query,kind,orientation,page,retry]);

 async function choose(item:Media,target:'background'|'timeline'='background'){
  const controller=new AbortController();download.current=controller;setSelecting(item.id);setError('');setNotice('');
  const timeout=setTimeout(()=>controller.abort(),120000);
  try{
   const response=await fetch(mediaUrl(item),{signal:controller.signal});
   if(!response.ok)throw new Error('Không tải được media này. Hãy chọn nền khác hoặc thử lại.');
   const blob=await response.blob();
   if(controller.signal.aborted)return;
   if(!blob.size)throw new Error('Media tải về bị trống.');
   await (target==='timeline'?onAddToTimeline:onSelect)(new File([blob],`Pexels-${item.id}.${item.type==='photo'?'jpg':'mp4'}`,{type:blob.type||(item.type==='photo'?'image/jpeg':'video/mp4')}),item.type,item.duration);
   setNotice(target==='timeline'?'Đã thêm vào timeline tại vị trí con trỏ.':'Đã chọn nền.');
  }catch(e){if(download.current===controller)setError(controller.signal.aborted?'Đã dừng tải media.':e instanceof Error?e.message:'Không tải được media.');}
  finally{clearTimeout(timeout);if(download.current===controller){download.current=null;setSelecting(null);}}
 }
 const control='rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white';
 return <details open className="mt-3 rounded-xl border border-white/10 bg-black/20">
  <summary className="cursor-pointer px-3 py-3 text-sm font-semibold">Kho ảnh & video Pexels</summary>
  <div className="space-y-3 p-3 pt-0">
   <div className="flex flex-wrap gap-2">
    <input aria-label="Tìm nền Pexels" placeholder="Tìm nền: ocean, rain, night city…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} className={`${control} min-w-0 flex-1`}/>
    <select aria-label="Loại media" value={kind} onChange={e=>{setKind(e.target.value);setPage(1)}} className={control}><option value="photos">Ảnh</option><option value="videos">Video</option></select>
    <select aria-label="Khung hình" value={orientation} onChange={e=>{setOrientation(e.target.value);setPage(1)}} className={control}><option value="">Mọi khung hình</option><option value="portrait">Dọc</option><option value="landscape">Ngang</option><option value="square">Vuông</option></select>
   </div>
   <div className="flex flex-wrap gap-2">{['nature','ocean','rain','night city','abstract','Vietnam'].map(word=><button key={word} type="button" className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/70" onClick={()=>{setQuery(word);setPage(1)}}>{word}</button>)}</div>
   <p className="text-[10px] text-white/50">Nguồn: <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline">Pexels</a> · Chọn một nền để tải về và sử dụng.</p>
   {notice&&<output className="block text-xs text-sky-200">{notice}</output>}
   {error&&<p role="alert" className="text-xs text-amber-200">{error} <button type="button" onClick={()=>setRetry(x=>x+1)} className="underline">Thử lại tìm kiếm</button></p>}
   {selecting!==null&&<output className="block text-xs text-sky-200">Đang tải nền… <button type="button" className="underline" onClick={()=>download.current?.abort()}>Hủy</button></output>}
   <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3" aria-busy={loading}>
    {items.map(item=><div key={`${item.type}-${item.id}`} className="overflow-hidden rounded-lg border border-white/10">
     <button type="button" disabled={selecting!==null} onClick={()=>void choose(item)} aria-label={`Dùng ${item.type==='photo'?'ảnh':'video'} ${item.alt||item.id} làm nền`} className="relative block w-full disabled:opacity-50">
      <img src={item.thumbnail} alt={item.alt||'Video Pexels'} loading="lazy" className="aspect-video w-full object-cover"/>
      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px]">{item.type==='video'?`▶ ${item.duration||0}s`:'Dùng ảnh'}</span>
     </button>
     <button type="button" disabled={selecting!==null} onClick={()=>void choose(item,'timeline')} className="w-full bg-sky-300/15 px-2 py-2 text-[11px] font-semibold disabled:opacity-50">＋ Thêm vào timeline</button>
     <a href={item.url} target="_blank" rel="noreferrer" className="block truncate px-2 py-1.5 text-[10px] text-white/60 hover:underline">{item.photographer?.name||item.creator?.name||'Pexels'} · Pexels ↗</a>
    </div>)}
   </div>
   {loading&&<output className="block text-xs text-white/60">Đang tìm nền…</output>}
   {!loading&&!error&&items.length===0&&<p className="text-xs text-white/60">{query.trim()?'Không có kết quả. Thử từ khóa khác.':'Nhập từ khóa để tìm nền.'}</p>}
   {more&&!loading&&<button type="button" onClick={()=>setPage(p=>p+1)} className={control}>Tải thêm</button>}
  </div>
 </details>;
}
