'use client';

import {useEffect,useRef,useState} from 'react';
import {BACKGROUND_PRESETS,DEFAULT_BACKGROUND_CONFIG,backgroundFingerprint,type BackgroundConfig,type BackgroundMode} from './background';

type Props={value:BackgroundConfig;onChange:(next:BackgroundConfig)=>void;onError:(message:string)=>void};

function fingerprint(file:File){return `${file.name}:${file.size}:${file.lastModified}`}
function fmtBytes(n:number){if(n<1024*1024)return `${Math.round(n/1024)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}
function fmtTime(n:number){if(!Number.isFinite(n))return '--';const s=Math.max(0,Math.round(n));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}

export function BackgroundPanel({value,onChange,onError}:Props){
 const imageInput=useRef<HTMLInputElement>(null),videoInput=useRef<HTMLInputElement>(null);
 const ownedImage=useRef<string|null>(null),ownedVideo=useRef<string|null>(null);
 const [imageName,setImageName]=useState(''),[videoName,setVideoName]=useState(''),[videoDuration,setVideoDuration]=useState<number|null>(null),[videoSize,setVideoSize]=useState(0),[warning,setWarning]=useState('');

 // Keep object URLs alive when this accordion panel closes; Creator Studio owns the active background lifecycle.

 useEffect(()=>{
  if(value.mode!=='video'||!value.videoUrl)return;
  let cancelled=false;
  const probe=document.createElement('video');
  probe.muted=true;probe.playsInline=true;probe.preload='metadata';probe.src=value.videoUrl;
  const done=()=>{if(!cancelled&&Number.isFinite(probe.duration)){setVideoDuration(probe.duration);if(!value.videoEnd||value.videoEnd>probe.duration)onChange({...value,videoEnd:probe.duration})}};
  probe.addEventListener('loadedmetadata',done,{once:true});probe.load();
  return()=>{cancelled=true;probe.removeEventListener('loadedmetadata',done);probe.removeAttribute('src');probe.load()};
 },[value.mode,value.videoUrl]);

 useEffect(()=>{
  const stored={...value,imageUrl:undefined,videoUrl:undefined,imageFingerprint:undefined,videoFingerprint:undefined,mode:value.mode==='image'||value.mode==='video'?'suno':value.mode};
  try{localStorage.setItem('suno-v8-background',JSON.stringify(stored))}catch{}
  document.documentElement.dataset.sunoBackground=backgroundFingerprint(value);
  document.documentElement.dataset.sunoBackgroundMode=value.mode;
  return()=>{delete document.documentElement.dataset.sunoBackground;delete document.documentElement.dataset.sunoBackgroundMode};
 },[value.mode,value.presetId,value.imageFingerprint,value.videoFingerprint,value.fit,value.blur,value.dim,value.overlayOpacity,value.loopVideo]);

 function chooseMode(mode:BackgroundMode){
  if(mode==='image'){imageInput.current?.click();return}
  if(mode==='video'){videoInput.current?.click();return}
  onChange({...value,mode,imageUrl:undefined,videoUrl:undefined,imageFingerprint:undefined,videoFingerprint:undefined,presetId:mode==='preset'?(value.presetId||BACKGROUND_PRESETS[0].id):undefined});
 }

 function clearOwned(kind:'image'|'video'){
  if(kind==='image'&&ownedImage.current){URL.revokeObjectURL(ownedImage.current);ownedImage.current=null}
  if(kind==='video'&&ownedVideo.current){URL.revokeObjectURL(ownedVideo.current);ownedVideo.current=null}
 }

 function remove(){
  clearOwned('image');clearOwned('video');setImageName('');setVideoName('');setVideoDuration(null);setWarning('');onChange({...DEFAULT_BACKGROUND_CONFIG});
 }

 async function selectImage(file?:File){
  if(!file)return;
  if(file.size>20*1024*1024){onError('File ảnh quá lớn. Vui lòng chọn ảnh dưới 20MB.');if(imageInput.current)imageInput.current.value='';return}
  clearOwned('image');const url=URL.createObjectURL(file);ownedImage.current=url;setImageName(`${file.name} · ${fmtBytes(file.size)}`);setWarning('');
  onChange({...value,mode:'image',imageUrl:url,videoUrl:undefined,imageFingerprint:fingerprint(file),videoFingerprint:undefined,positionX:value.positionX??50,positionY:value.positionY??50,zoom:value.zoom??100});
 }

 async function selectVideo(file?:File){
  if(!file)return;
  clearOwned('video');const url=URL.createObjectURL(file);ownedVideo.current=url;setVideoName(file.name);setVideoSize(file.size);setVideoDuration(null);
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  setWarning(file.size>(mobile?80:200)*1024*1024?'Video nền lớn, thiết bị sẽ render ở chế độ tiết kiệm bộ nhớ.':'');
  const probe=document.createElement('video');probe.muted=true;probe.playsInline=true;probe.preload='metadata';probe.src=url;
  try{
   await new Promise<void>((resolve,reject)=>{const done=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(new Error('Trình duyệt không đọc được video này.'))},cleanup=()=>{probe.removeEventListener('loadedmetadata',done);probe.removeEventListener('error',fail)};probe.addEventListener('loadedmetadata',done,{once:true});probe.addEventListener('error',fail,{once:true})});
   setVideoDuration(probe.duration);
   onChange({...value,mode:'video',videoUrl:url,imageUrl:undefined,videoFingerprint:fingerprint(file),imageFingerprint:undefined,loopVideo:true,videoStart:0,videoEnd:probe.duration,positionX:value.positionX??50,positionY:value.positionY??50,zoom:value.zoom??100});
  }catch(e){clearOwned('video');onError(e instanceof Error?e.message:'Video nền không hỗ trợ trên thiết bị này.')}
  finally{probe.removeAttribute('src');probe.load();if(videoInput.current)videoInput.current.value=''}
 }

 const modes:[BackgroundMode,string,string][]=[
  ['suno','Suno mặc định','Ảnh bìa gốc'],
  ['preset','Nền mẫu','8 nền nhẹ'],
  ['image','Upload ảnh','JPG/PNG/WebP'],
  ['video','Upload video','MP4/WebM/MOV'],
 ];

 return <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
  <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-sky-300">Bước 3 · Background</p><b className="text-sm">Nền video</b></div>{value.mode!=='suno'&&<button type="button" onClick={remove} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/60">Xóa nền</button>}</div>
  <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-2">
   {modes.map(([id,label,hint])=><button key={id} type="button" onClick={()=>chooseMode(id)} className={`shrink-0 rounded-xl border px-3 py-2.5 text-left ${value.mode===id?'border-sky-300/40 bg-sky-300/10':'border-white/10 bg-black/20'}`}><span className="block text-xs font-bold">{label}</span><span className="mt-0.5 block text-[10px] text-white/40">{hint}</span></button>)}
  </div>

  <div className="sd-bg-upload-actions">
    <button
      type="button"
      className="sd-bg-upload-btn"
      onClick={()=>imageInput.current?.click()}
    >
      <span>＋</span>
      <b>{value.mode==='image'&&value.imageUrl?'Thay ảnh khác':'Thay ảnh nền'}</b>
      <small>JPG · PNG · WebP</small>
    </button>
    <button
      type="button"
      className="sd-bg-upload-btn"
      onClick={()=>videoInput.current?.click()}
    >
      <span>▶</span>
      <b>{value.mode==='video'&&value.videoUrl?'Thay video khác':'Thay video nền'}</b>
      <small>MP4 · WebM · MOV</small>
    </button>
  </div>

  {value.mode==='preset'&&<div className="mt-3 flex gap-2 overflow-x-auto overscroll-x-contain pb-2">
   {BACKGROUND_PRESETS.map((p,i)=><button key={p.id} type="button" onClick={()=>onChange({...value,mode:'preset',presetId:p.id})} className={`shrink-0 w-28 overflow-hidden rounded-xl border text-left ${value.presetId===p.id?'border-fuchsia-300/50':'border-white/10'}`}>
    <span className={`block h-14 ${['bg-gradient-to-br from-violet-950 via-purple-700 to-slate-900','bg-gradient-to-br from-cyan-950 via-slate-900 to-fuchsia-900','bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950','bg-gradient-to-br from-fuchsia-100 via-blue-100 to-amber-100','bg-gradient-to-br from-zinc-950 via-zinc-800 to-slate-950','bg-gradient-to-br from-black via-purple-950 to-fuchsia-950','bg-gradient-to-br from-cyan-950 via-blue-950 to-indigo-900','bg-gradient-to-br from-purple-950 via-rose-900 to-fuchsia-950'][i]}`}/>
    <span className="block truncate px-2 py-2 text-[10px] font-semibold">{p.label}</span>
   </button>)}
  </div>}

  {value.mode==='image'&&value.imageUrl&&<div className="sd-bg-selected"><img src={value.imageUrl} alt="Preview ảnh nền"/><div className="sd-bg-selected-copy"><b>{imageName||'Ảnh nền đã chọn'}</b><small>Xử lý hoàn toàn trên thiết bị.</small></div><div className="sd-bg-selected-actions"><button type="button" onClick={()=>imageInput.current?.click()}>Thay ảnh</button><button type="button" onClick={remove}>Xóa</button></div></div>}
  {value.mode==='video'&&value.videoUrl&&<div className="sd-bg-selected"><video src={value.videoUrl} muted playsInline preload="metadata"/><div className="sd-bg-selected-copy"><b>{videoName||'Video nền'}</b><small>{fmtBytes(videoSize)} · {fmtTime(videoDuration||0)}</small></div><div className="sd-bg-selected-actions"><button type="button" onClick={()=>videoInput.current?.click()}>Thay video</button><button type="button" onClick={remove}>Xóa</button></div></div>}
  {warning&&<p className="mt-2 rounded-lg bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100">{warning}</p>}

  {value.mode!=='suno'&&<details className="mt-3 rounded-xl border border-white/[.07] bg-black/15">
   <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-white/70">Background settings</summary>
   <div className="grid gap-3 border-t border-white/[.06] p-3 sm:grid-cols-2">
    <div><span className="text-[10px] text-white/40">Fit</span><div className="mt-1 flex gap-1.5">{(['cover','contain'] as const).map(x=><button type="button" key={x} onClick={()=>onChange({...value,fit:x})} className={`rounded-lg px-2.5 py-1.5 text-[11px] ${value.fit===x?'bg-sky-300/15 text-sky-100':'bg-white/5 text-white/50'}`}>{x==='cover'?'Cover':'Contain'}</button>)}</div></div>
    {(value.mode==='image'||value.mode==='video')&&<>
     <label className="text-[10px] text-white/40">Vị trí ngang · {Math.round(value.positionX??50)}%<input type="range" min="0" max="100" value={value.positionX??50} onChange={e=>onChange({...value,positionX:Number(e.target.value)})} className="mt-1 block w-full accent-sky-300"/></label>
     <label className="text-[10px] text-white/40">Vị trí dọc · {Math.round(value.positionY??50)}%<input type="range" min="0" max="100" value={value.positionY??50} onChange={e=>onChange({...value,positionY:Number(e.target.value)})} className="mt-1 block w-full accent-sky-300"/></label>
     <label className="text-[10px] text-white/40">Zoom · {Math.round(value.zoom??100)}%<input type="range" min="50" max="250" value={value.zoom??100} onChange={e=>onChange({...value,zoom:Number(e.target.value)})} className="mt-1 block w-full accent-sky-300"/></label>
    </>}
    {value.mode==='video'&&videoDuration&&<>
     <label className="text-[10px] text-white/40">Video start · {fmtTime(value.videoStart||0)}<input type="range" min="0" max={Math.max(0,videoDuration-.1)} step=".1" value={Math.min(value.videoStart||0,Math.max(0,videoDuration-.1))} onChange={e=>{const start=Number(e.target.value);onChange({...value,videoStart:start,videoEnd:Math.max(start+.1,Math.min(value.videoEnd??videoDuration,videoDuration))})}} className="mt-1 block w-full accent-sky-300"/></label>
     <label className="text-[10px] text-white/40">Video end · {fmtTime(value.videoEnd??videoDuration)}<input type="range" min={Math.min(videoDuration,Math.max(.1,(value.videoStart||0)+.1))} max={videoDuration} step=".1" value={Math.min(value.videoEnd??videoDuration,videoDuration)} onChange={e=>onChange({...value,videoEnd:Number(e.target.value)})} className="mt-1 block w-full accent-sky-300"/></label>
    </>}
    <label className="text-[10px] text-white/40">Blur · {value.blur}<input type="range" min="0" max="20" value={value.blur} onChange={e=>onChange({...value,blur:Number(e.target.value)})} className="mt-1 block w-full accent-sky-300"/></label>
    <label className="text-[10px] text-white/40">Dim · {value.dim}%<input type="range" min="0" max="100" value={value.dim} onChange={e=>onChange({...value,dim:Number(e.target.value)})} className="mt-1 block w-full accent-sky-300"/></label>
    <label className="text-[10px] text-white/40">Overlay · {value.overlayOpacity}%<input type="range" min="0" max="80" value={value.overlayOpacity} onChange={e=>onChange({...value,overlayOpacity:Number(e.target.value)})} className="mt-1 block w-full accent-sky-300"/></label>
    {value.mode==='video'&&<label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={value.loopVideo} onChange={e=>onChange({...value,loopVideo:e.target.checked})}/> Loop background video</label>}
   </div>
  </details>}

  <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={e=>void selectImage(e.target.files?.[0])}/>
  <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={e=>void selectVideo(e.target.files?.[0])}/>
 </section>
}
