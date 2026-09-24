'use client';

import { useEffect, useState } from 'react';
import { Download, Headphones, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import { StudioBadge, StudioButton, StudioControlRow, StudioPanel, StudioSegmented, StudioSlider, StudioStatus, StudioToggle } from '@/components/studio-ui';
import { MASTER_PROFILES, masterAudio, render5DAudio, type MasterMetrics, type MasterProfileId, type Spatial5DMode } from '@/app/lib/audio-processing';

const MODE_INFO:Record<Spatial5DMode,{label:string;desc:string}> = {
 wide:{label:'Rộng',desc:'Mở rộng sân khấu stereo nhưng giữ vị trí nhạc cụ ổn định.'},
 immersive:{label:'Bao quanh',desc:'Không gian sâu và rộng hơn. Phù hợp nghe tai nghe, ballad và ambient.'},
 orbit:{label:'Qua tai',desc:'Âm thanh tự chạy rõ từ tai trái sang tai phải rồi quay lại. Bass dưới 140 Hz vẫn giữ ở giữa.'},
};

async function loadAudioBlob(audio:string){
 const candidates=[audio];
 // Old projects may still contain a direct Suno CDN URL. Route it through our same-origin audio proxy.
 if(/^https:\/\//i.test(audio)) candidates.unshift(`/api/audio?source=${encodeURIComponent(audio)}`);
 let lastStatus=0;
 for(const url of candidates){try{const r=await fetch(url,{cache:'no-store'});lastStatus=r.status;if(r.ok){const blob=await r.blob();if(blob.size>0)return blob;}}catch{}}
 throw new Error(`Không tải được audio nguồn${lastStatus?` (HTTP ${lastStatus})`:''}.`);
}

export function MasteringPanel({audio,binary,title}:{audio:string;binary?:Blob|null;title:string}){
 const [profile,setProfile]=useState<MasterProfileId>('tiktok-loud'),[spatial,setSpatial]=useState(false),[spatialMode,setSpatialMode]=useState<Spatial5DMode>('immersive'),[spatialAmount,setSpatialAmount]=useState(65),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[metrics,setMetrics]=useState<MasterMetrics|null>(null),[mastered,setMastered]=useState<string|null>(null),[blob,setBlob]=useState<Blob|null>(null),[error,setError]=useState('');
 useEffect(()=>()=>{if(mastered)URL.revokeObjectURL(mastered)},[mastered]);
 const livePreview=(enabled=spatial,mode=spatialMode,amount=spatialAmount)=>window.dispatchEvent(new CustomEvent('suno-spatial-change',{detail:{enabled,mode,amount}}));
 const previewProfile=(next:MasterProfileId)=>window.dispatchEvent(new CustomEvent('suno-master-preview',{detail:{profile:next}}));
 const changeSpatial=(v:boolean)=>{setSpatial(v);livePreview(v,spatialMode,spatialAmount)};
 const changeMode=(v:Spatial5DMode)=>{setSpatialMode(v);livePreview(spatial,v,spatialAmount)};
 const changeDepth=(v:number)=>{setSpatialAmount(v);livePreview(spatial,spatialMode,v)};
 const run=async()=>{setBusy(true);setError('');setProgress(binary?'Đang đọc binary audio…':'Đang tải audio nguồn…');try{const source=binary&&binary.size?binary:await loadAudioBlob(audio);setProgress('Đang giải mã & phân tích…');let result=await masterAudio(source,profile);let output=result.blob;if(spatial){setProgress('Đang tạo không gian 5D…');output=await render5DAudio(output,spatialAmount/100,spatialMode);}if(mastered)URL.revokeObjectURL(mastered);setBlob(output);setMastered(URL.createObjectURL(output));setMetrics(result.metrics);setProgress('')}catch(e){setError(e instanceof Error?e.message:'Mastering thất bại.')}finally{setBusy(false)}};
 const download=()=>{if(!blob)return;const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=(title||'suno').replace(/[\\/:*?"<>|]+/g,'-')+'-'+profile+(spatial?'-5d':'')+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
 return <section className="sd-master">
  <div className="sd-master-head"><div><span><Sparkles/> MASTERING</span><b>Tối ưu âm thanh</b><small>Chọn chất âm rồi nghe thử ngay. Phân tích ưu tiên binary audio đã tải sẵn, không phụ thuộc URL nguồn.</small></div>{metrics&&<em className={'risk-'+metrics.risk.toLowerCase().replace(/ /g,'-')}><ShieldCheck/>{metrics.risk}</em>}</div>
  <StudioSegmented value={profile} options={MASTER_PROFILES.map(x=>({value:x.id,label:x.label}))} onChange={v=>{setProfile(v);setMetrics(null);previewProfile(v)}}/>
  <p className="sd-master-desc">{MASTER_PROFILES.find(p=>p.id===profile)?.description}</p><StudioStatus tone="success">Chất âm được áp dụng trực tiếp lên bài đang phát · đổi chế độ để A/B ngay</StudioStatus>
  <StudioPanel className="sd-5d">
    <StudioToggle checked={spatial} onChange={changeSpatial} label="Âm thanh 5D" description={spatial?'Đang bật · thay đổi sẽ nghe ngay':'Đang tắt · stereo gốc'}/>
    {spatial&&<div className="sd-5d-controls">
      <p className="sd-5d-help"><b>Muốn nghe tiếng chạy qua 2 tai?</b> Chọn <strong>Qua tai</strong>. Rộng/Bao quanh chủ yếu mở không gian, không cố tình chạy trái → phải.</p>
      <StudioSegmented value={spatialMode} options={(Object.keys(MODE_INFO) as Spatial5DMode[]).map(x=>({value:x,label:MODE_INFO[x].label}))} onChange={changeMode}/>
      <p className="sd-5d-mode-desc">{MODE_INFO[spatialMode].desc}</p>
      <StudioControlRow label={spatialMode==='orbit'?'Mức chuyển động':'Độ rộng'} value={spatialAmount+'%'} hint={spatialMode==='orbit'?'70–90%: tiếng chạy qua hai tai rõ hơn. Nên dùng tai nghe.':'40–60% tự nhiên · 60–80% rộng rõ.'}><StudioSlider label="Mức hiệu ứng 5D" min={20} max={100} value={spatialAmount} onChange={changeDepth}/></StudioControlRow>
      <StudioStatus tone="success">Tác dụng ngay trên nhạc đang phát · không cần render</StudioStatus>
    </div>}
  </StudioPanel>
  <StudioButton tone="accent" className="sd-master-run" disabled={busy} onClick={()=>void run()}>{busy?<><i/> {progress}</>:<><Headphones/> Phân tích & Master để xuất file</>}</StudioButton>
  {error&&<p className="sd-master-error">{error}</p>}
  {metrics&&<><div className="sd-master-meter"><div><small>ĐẦU VÀO</small><b>{metrics.beforeLufs.toFixed(1)}</b><span>est. LUFS</span></div><strong>→</strong><div><small>MỤC TIÊU</small><b>{metrics.safeTargetLufs.toFixed(1)}</b><span>LUFS</span></div><strong>→</strong><div><small>ĐẦU RA</small><b>{metrics.afterLufs.toFixed(1)}</b><span>est. LUFS</span></div></div>
   <div className="sd-master-stats"><span>Peak {metrics.afterPeak.toFixed(1)} dBFS</span><span>Crest {metrics.crestDb.toFixed(1)} dB</span><span>Gain {metrics.gainDb>0?'+':''}{metrics.gainDb.toFixed(1)} dB</span>{metrics.safeTargetLufs<metrics.requestedLufs&&<b>Auto Guard: {metrics.requestedLufs} → {metrics.safeTargetLufs} LUFS</b>}</div>
   <div className="sd-master-ab"><div><small>A · Bản gốc</small><audio controls preload="none" src={audio}/></div><div><small>B · Đã xử lý</small><audio controls preload="metadata" src={mastered||undefined}/></div></div>
   <StudioButton className="sd-master-download" onClick={download}><Download/> Tải WAV đã xử lý</StudioButton></>}
 </section>
}
