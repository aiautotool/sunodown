'use client';
/* oxlint-disable next/no-img-element */
import {useEffect,useRef,useState} from 'react';
import type {AddPexelsToTimeline} from './pexels-library';
import type {BackgroundConfig} from './background';
import {backgroundSearchQuery,rankBackgroundPhotos} from './pexels-suggestions';

type Props={onAddToTimeline:AddPexelsToTimeline;songKey:string;text:string;aspect:string;background:BackgroundConfig;disabled:boolean;onChange:(value:BackgroundConfig)=>void;onBrowse:()=>void};
type Photo={id:number;width:number;height:number;alt?:string;url:string;photographer?:{name:string};src?:{large2x?:string};download:string};
export function SuggestedBackground(props:Props){
 const [attempt,setAttempt]=useState(0),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const [credit,setCredit]=useState<{name:string;url:string;fingerprint:string}|null>(null);
 async function addSelected(){
  const url=props.background.imageUrl;
  if(!url)return;
  setBusy(true);
  try{
   const response=await fetch(url);
   if(!response.ok)throw new Error('Không đọc được ảnh đang chọn.');
   const blob=await response.blob();
   await props.onAddToTimeline(new File([blob],`${props.background.imageFingerprint||'Pexels'}.jpg`,{type:blob.type}),'photo');
   setStatus('Đã thêm ảnh vào timeline tại vị trí con trỏ (5 giây).');
  }catch{setStatus('Chưa thêm được ảnh vào timeline. Vui lòng thử lại.');}
  finally{setBusy(false);}
 }
 const current=useRef(props);
 useEffect(()=>{current.current=props;});
 const previous=useRef<number|null>(null);
 useEffect(()=>{
  const start=current.current;
  if(start.disabled||(!attempt&&start.background.mode!=='suno'))return;
  const controller=new AbortController();let disposed=false;
  const timer=setTimeout(async()=>{
   setBusy(true);setStatus('Đang tìm ảnh nền phù hợp với bài hát…');
   const timeout=setTimeout(()=>controller.abort(),30000);
   try{
    const query=backgroundSearchQuery(start.text);
    const params=new URLSearchParams({q:query,orientation:'portrait',per_page:'18'});
    const response=await fetch(`https://pexels.aiautotool.com/v1/photos?${params}`,{signal:controller.signal});
    if(!response.ok)throw new Error('Chưa tìm được nền. Bạn có thể thử lại hoặc mở kho ảnh.');
    const data=await response.json();
    const photos=rankBackgroundPhotos<Photo>((data.results||[]).filter((p:Photo)=>p.width>0&&p.height>0&&p.download),start.aspect);
    const photo=photos.find(p=>p.id!==previous.current)||photos[0];
    if(!photo)throw new Error('Chưa có ảnh phù hợp. Hãy mở kho ảnh để chọn theo ý bạn.');
    const media=await fetch(photo.src?.large2x||photo.download,{signal:controller.signal});
    if(!media.ok)throw new Error('Chưa tải được ảnh nền. Vui lòng thử lại.');
    const blob=await media.blob();
    if(!blob.size||!blob.type.startsWith('image/'))throw new Error('Ảnh nền không hợp lệ.');
    // A manual edit, song change, format change or render always takes precedence.
    if(disposed||controller.signal.aborted)return;
    if(current.current.background!==start.background||current.current.aspect!==start.aspect||current.current.disabled){setStatus('Giữ nền bạn đang chỉnh.');return;}
    const url=URL.createObjectURL(blob),fingerprint=`pexels-photo-${photo.id}`;
    previous.current=photo.id;
    current.current.onChange({...start.background,mode:'image',imageUrl:url,imageFingerprint:fingerprint,videoUrl:undefined,videoFingerprint:undefined,dim:20,positionX:50,positionY:50,zoom:100});
    setCredit({name:photo.photographer?.name||'Pexels',url:photo.url,fingerprint});
    setStatus('Đã chọn ảnh theo chủ đề bài hát và khung hình.');
   }catch(e){if(!disposed)setStatus(controller.signal.aborted?'Tìm nền quá lâu. Hãy thử lại.':e instanceof Error?e.message:'Không kết nối được Pexels.');}
   finally{clearTimeout(timeout);if(!disposed)setBusy(false);}
  },0);
  return()=>{disposed=true;clearTimeout(timer);controller.abort();};
 },[props.songKey,attempt]);
 return <section className="my-3 rounded-xl border border-sky-300/20 bg-sky-300/5 p-3" aria-label="Nền gợi ý Pexels">
  <div className="flex items-center gap-3">
   {props.background.imageUrl&&<img src={props.background.imageUrl} alt="Nền đang chọn" className="h-16 w-20 rounded-lg object-cover"/>}
   <div><b className="text-sm">Nền gợi ý · Pexels</b><p className="text-xs text-white/60" aria-live="polite">{status||'Tự tìm ảnh phong cảnh phù hợp cho video.'}</p>
   {credit&&props.background.imageFingerprint===credit.fingerprint&&<a href={credit.url} target="_blank" rel="noreferrer" className="text-xs text-sky-200 underline">Ảnh: {credit.name} · Pexels ↗</a>}</div>
  </div>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" disabled={props.disabled||busy} onClick={()=>setAttempt(n=>n+1)} className="rounded-lg bg-sky-300/15 px-3 py-2 text-xs disabled:opacity-50">{busy?'Đang chọn nền…':'Chọn ảnh khác'}</button>
   {props.background.mode==='image'&&props.background.imageUrl&&<button type="button" disabled={props.disabled||busy} onClick={()=>void addSelected()} className="rounded-lg bg-sky-300/15 px-3 py-2 text-xs disabled:opacity-50">＋ Thêm ảnh vào timeline</button>}
   <button type="button" disabled={props.disabled} onClick={props.onBrowse} className="rounded-lg bg-white/10 px-3 py-2 text-xs">Mở kho ảnh/video</button>
  </div>
 </section>;
}
