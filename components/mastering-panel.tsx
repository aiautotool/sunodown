'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Headphones, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import { MASTER_PROFILES, masterAudio, render5DAudio, type MasterMetrics, type MasterProfileId, type Spatial5DMode } from '@/app/lib/audio-processing';

const MODE_INFO:Record<Spatial5DMode,{label:string;desc:string}> = {
 wide:{label:'Rộng',desc:'Mở rộng sân khấu stereo nhưng giữ vị trí nhạc cụ ổn định.'},
 immersive:{label:'Bao quanh',desc:'Không gian sâu và rộng hơn. Phù hợp nghe tai nghe, ballad và ambient.'},
 orbit:{label:'Chuyển động',desc:'Âm trường chuyển động trái/phải nhẹ theo thời gian. Hiệu ứng rõ nhất.'},
};

export function MasteringPanel({audio,title}:{audio:string;title:string}){
 const [profile,setProfile]=useState<MasterProfileId>('tiktok-loud'),[spatial,setSpatial]=useState(false),[spatialMode,setSpatialMode]=useState<Spatial5DMode>('immersive'),[spatialAmount,setSpatialAmount]=useState(65),[busy,setBusy]=useState(false),[previewBusy,setPreviewBusy]=useState(false),[progress,setProgress]=useState(''),[metrics,setMetrics]=useState<MasterMetrics|null>(null),[mastered,setMastered]=useState<string|null>(null),[blob,setBlob]=useState<Blob|null>(null),[error,setError]=useState('');
 const previewAudio=useRef<HTMLAudioElement|null>(null),previewUrl=useRef<string|null>(null),previewTimer=useRef<ReturnType<typeof setTimeout>|null>(null),requestId=useRef(0);
 useEffect(()=>()=>{if(mastered)URL.revokeObjectURL(mastered);if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);if(previewTimer.current)clearTimeout(previewTimer.current);previewAudio.current?.pause()},[mastered]);
 const livePreview=async(nextSpatial=spatial,nextMode=spatialMode,nextAmount=spatialAmount)=>{
  const id=++requestId.current;if(previewTimer.current)clearTimeout(previewTimer.current);setPreviewBusy(true);setError('');
  previewTimer.current=setTimeout(async()=>{try{
   const r=await fetch(audio,{cache:'no-store'});if(!r.ok)throw Error('Không tải được audio nguồn.');
   const source=await r.blob(),output=nextSpatial?await render5DAudio(source,nextAmount/100,nextMode):source;if(id!==requestId.current)return;
   const old=previewAudio.current?.currentTime||0,wasPlaying=!!previewAudio.current&&!previewAudio.current.paused;
   previewAudio.current?.pause();if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current=URL.createObjectURL(output);
   const player=new Audio(previewUrl.current);previewAudio.current=player;player.currentTime=Math.min(old,Math.max(0,(player.duration||old)-.1));if(wasPlaying||nextSpatial)await player.play().catch(()=>{});
  }catch(e){if(id===requestId.current)setError(e instanceof Error?e.message:'Không thể nghe thử.')}finally{if(id===requestId.current)setPreviewBusy(false)}},180);
 };
 const changeSpatial=(v:boolean)=>{setSpatial(v);void livePreview(v,spatialMode,spatialAmount)};
 const changeMode=(v:Spatial5DMode)=>{setSpatialMode(v);void livePreview(spatial,v,spatialAmount)};
 const changeDepth=(v:number)=>{setSpatialAmount(v);void livePreview(spatial,spatialMode,v)};
 const run=async()=>{setBusy(true);setError('');setProgress('Đang phân tích nguồn…');try{const r=await fetch(audio,{cache:'no-store'});if(!r.ok)throw Error('Không tải được audio nguồn.');setProgress('EQ · dynamics · soft clip · Auto Guard…');let result=await masterAudio(await r.blob(),profile);let output=result.blob;if(spatial){setProgress('Đang tạo không gian 5D…');output=await render5DAudio(output,spatialAmount/100,spatialMode);}if(mastered)URL.revokeObjectURL(mastered);setBlob(output);setMastered(URL.createObjectURL(output));setMetrics(result.metrics);setProgress('')}catch(e){setError(e instanceof Error?e.message:'Mastering thất bại.')}finally{setBusy(false)}};
 const download=()=>{if(!blob)return;const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=(title||'suno').replace(/[\\/:*?"<>|]+/g,'-')+'-'+profile+(spatial?'-5d':'')+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
 return <section className="sd-master">
  <div className="sd-master-head"><div><span><Sparkles/> MASTERING</span><b>Tối ưu âm thanh</b><small>Chọn chất âm rồi nghe thử ngay. Chỉ cần render khi muốn xuất file cuối.</small></div>{metrics&&<em className={'risk-'+metrics.risk.toLowerCase().replace(/ /g,'-')}><ShieldCheck/>{metrics.risk}</em>}</div>
  <div className="sd-master-presets">{MASTER_PROFILES.map(p=><button key={p.id} className={profile===p.id?'active':''} onClick={()=>{setProfile(p.id);setMetrics(null);}}><b>{p.label}</b><span>{p.targetLufs} LUFS</span></button>)}</div>
  <p className="sd-master-desc">{MASTER_PROFILES.find(p=>p.id===profile)?.description}</p>
  <div className="sd-5d">
    <button className={spatial?'active':''} onClick={()=>changeSpatial(!spatial)}><Waves/><span><b>Âm thanh 5D</b><small>{spatial?'Đang bật · thay đổi sẽ nghe ngay':'Đang tắt · âm thanh stereo gốc'}</small></span><i/></button>
    {spatial&&<div className="sd-5d-controls">
      <p className="sd-5d-help"><b>5D là gì?</b> Tạo cảm giác âm thanh rộng và bao quanh hơn bằng xử lý stereo. Không tạo thêm loa/kênh âm thanh thật.</p>
      <div>{(['wide','immersive','orbit'] as Spatial5DMode[]).map(x=><button key={x} className={spatialMode===x?'active':''} onClick={()=>changeMode(x)}>{MODE_INFO[x].label}</button>)}</div>
      <p className="sd-5d-mode-desc">{MODE_INFO[spatialMode].desc}</p>
      <label><span>Độ rộng</span><input type="range" min="20" max="100" value={spatialAmount} onChange={e=>changeDepth(+e.target.value)}/><strong>{spatialAmount}%</strong></label>
      <small>Gợi ý: 40–60% tự nhiên · 60–80% rộng rõ · trên 80% hiệu ứng mạnh. Nên nghe bằng tai nghe.</small>
      <div className={'sd-live-audio '+(previewBusy?'working':'')}><i/><span>{previewBusy?'Đang cập nhật nghe thử…':'Nghe thử trực tiếp · thay đổi có tác dụng ngay'}</span></div>
    </div>}
  </div>
  <button className="sd-master-run" disabled={busy} onClick={()=>void run()}>{busy?<><i/> {progress}</>:<><Headphones/> Phân tích & Master để xuất file</>}</button>
  {error&&<p className="sd-master-error">{error}</p>}
  {metrics&&<><div className="sd-master-meter"><div><small>ĐẦU VÀO</small><b>{metrics.beforeLufs.toFixed(1)}</b><span>est. LUFS</span></div><strong>→</strong><div><small>MỤC TIÊU</small><b>{metrics.safeTargetLufs.toFixed(1)}</b><span>LUFS</span></div><strong>→</strong><div><small>ĐẦU RA</small><b>{metrics.afterLufs.toFixed(1)}</b><span>est. LUFS</span></div></div>
   <div className="sd-master-stats"><span>Peak {metrics.afterPeak.toFixed(1)} dBFS</span><span>Crest {metrics.crestDb.toFixed(1)} dB</span><span>Gain {metrics.gainDb>0?'+':''}{metrics.gainDb.toFixed(1)} dB</span>{metrics.safeTargetLufs<metrics.requestedLufs&&<b>Auto Guard: {metrics.requestedLufs} → {metrics.safeTargetLufs} LUFS</b>}</div>
   <div className="sd-master-ab"><div><small>A · Bản gốc</small><audio controls preload="none" src={audio}/></div><div><small>B · Đã xử lý</small><audio controls preload="metadata" src={mastered||undefined}/></div></div>
   <button className="sd-master-download" onClick={download}><Download/> Tải WAV đã xử lý</button></>}
 </section>
}
