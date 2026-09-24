'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Headphones, ShieldCheck, SlidersHorizontal, Sparkles, Waves } from 'lucide-react';
import { StudioBadge, StudioButton, StudioControlRow, StudioPanel, StudioSegmented, StudioSlider, StudioStatus, StudioToggle } from '@/components/studio-ui';
import { MASTER_PROFILES, masterAudio, render5DAudio, type AdvancedMasterSettings, type EqBand, type MasterMetrics, type MasterProfileId, type Spatial5DMode } from '@/app/lib/audio-processing';

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
 const [profile,setProfile]=useState<MasterProfileId>('tiktok-loud'),[audioSection,setAudioSection]=useState<'master'|'eq'|'5d'>('master'),[advancedOpen,setAdvancedOpen]=useState(false),[custom,setCustom]=useState<AdvancedMasterSettings|null>(null),[spatial,setSpatial]=useState(false),[spatialMode,setSpatialMode]=useState<Spatial5DMode>('immersive'),[spatialAmount,setSpatialAmount]=useState(65),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[metrics,setMetrics]=useState<MasterMetrics|null>(null),[mastered,setMastered]=useState<string|null>(null),[blob,setBlob]=useState<Blob|null>(null),[error,setError]=useState('');
 useEffect(()=>()=>{if(mastered)URL.revokeObjectURL(mastered)},[mastered]);
 const livePreview=(enabled=spatial,mode=spatialMode,amount=spatialAmount)=>window.dispatchEvent(new CustomEvent('suno-spatial-change',{detail:{enabled,mode,amount}}));
 const previewProfile=(next:MasterProfileId)=>window.dispatchEvent(new CustomEvent('suno-master-preview',{detail:{profile:next}}));
 const changeSpatial=(v:boolean)=>{setSpatial(v);livePreview(v,spatialMode,spatialAmount)};
 const changeMode=(v:Spatial5DMode)=>{setSpatialMode(v);livePreview(spatial,v,spatialAmount)};
 const changeDepth=(v:number)=>{setSpatialAmount(v);livePreview(spatial,spatialMode,v)};
 const defaultBands=():EqBand[]=>[
  {enabled:true,frequency:60,gain:0,q:.7,type:'lowshelf'},{enabled:true,frequency:120,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:250,gain:0,q:1,type:'peaking'},{enabled:true,frequency:500,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:1000,gain:0,q:1,type:'peaking'},{enabled:true,frequency:2500,gain:0,q:1,type:'peaking'},
  {enabled:true,frequency:6000,gain:0,q:1,type:'peaking'},{enabled:true,frequency:12000,gain:0,q:.7,type:'highshelf'}];
 const defaults=():AdvancedMasterSettings=>{const p=MASTER_PROFILES.find(x=>x.id===profile)||MASTER_PROFILES[0];return{targetLufs:p.targetLufs,ceilingDb:p.ceilingDb,thresholdDb:profile==='clean'?-15:-19,ratio:p.ratio,attackMs:profile==='punchy'?18:9,releaseMs:120,drive:p.drive,eqBands:defaultBands()}};
 const settings=custom||defaults(),change=(patch:Partial<AdvancedMasterSettings>)=>setCustom({...settings,...patch}),changeBand=(index:number,patch:Partial<EqBand>)=>setCustom({...settings,eqBands:settings.eqBands.map((b,i)=>i===index?{...b,...patch}:b)}),resetAdvanced=()=>setCustom(null);
 const eqPath=useMemo(()=>settings.eqBands.map((b,i)=>{const x=8+(Math.log10(b.frequency/20)/Math.log10(20000/20))*84,y=50-(b.enabled?b.gain:0)*(3.2);return (i?'L':'M')+x.toFixed(1)+' '+Math.max(8,Math.min(92,y)).toFixed(1)}).join(' '),[settings.eqBands]);
 const run=async()=>{setBusy(true);setError('');setProgress(binary?'Đang đọc binary audio…':'Đang tải audio nguồn…');try{const source=binary&&binary.size?binary:await loadAudioBlob(audio);setProgress('Đang giải mã & phân tích…');let result=await masterAudio(source,profile,custom||undefined);let output=result.blob;if(spatial){setProgress('Đang tạo không gian 5D…');output=await render5DAudio(output,spatialAmount/100,spatialMode);}if(mastered)URL.revokeObjectURL(mastered);setBlob(output);setMastered(URL.createObjectURL(output));setMetrics(result.metrics);setProgress('')}catch(e){setError(e instanceof Error?e.message:'Mastering thất bại.')}finally{setBusy(false)}};
 const download=()=>{if(!blob)return;const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=(title||'suno').replace(/[\\/:*?"<>|]+/g,'-')+'-'+profile+(spatial?'-5d':'')+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
 return <section className="sd-master">
  <div className="sd-master-head"><div><span><Sparkles/> MASTERING</span><b>Tối ưu âm thanh</b><small>Chọn chất âm rồi nghe thử ngay. Phân tích ưu tiên binary audio đã tải sẵn, không phụ thuộc URL nguồn.</small></div>{metrics&&<em className={'risk-'+metrics.risk.toLowerCase().replace(/ /g,'-')}><ShieldCheck/>{metrics.risk}</em>}</div>
  <div className="sd-audio-subnav"><button className={audioSection==='master'?'active':''} onClick={()=>setAudioSection('master')}>Mastering</button><button className={audioSection==='eq'?'active':''} onClick={()=>setAudioSection('eq')}>EQ</button><button className={audioSection==='5d'?'active':''} onClick={()=>setAudioSection('5d')}>5D</button></div>
  {audioSection==='master'&&<><StudioSegmented value={profile} options={MASTER_PROFILES.map(x=>({value:x.id,label:x.label}))} onChange={v=>{setProfile(v);setMetrics(null);previewProfile(v)}}/>
  <p className="sd-master-desc">{MASTER_PROFILES.find(p=>p.id===profile)?.description}</p><StudioStatus tone="success">Chất âm được áp dụng trực tiếp lên bài đang phát · đổi chế độ để A/B ngay</StudioStatus>
  <StudioPanel className="sd-master-advanced">
    <button type="button" className="sd-advanced-toggle" onClick={()=>setAdvancedOpen(v=>!v)}><span><SlidersHorizontal/> Tinh chỉnh nâng cao</span><small>{custom?'Custom':'Theo preset'} · {advancedOpen?'Thu gọn':'Mở'}</small></button>
    {advancedOpen&&<div className="sd-advanced-body">
      <StudioStatus tone="success">Không thay đổi mặc định. Chỉ dùng Custom sau khi bạn chỉnh một thông số.</StudioStatus>
      <div className="sd-advanced-grid">
       <StudioControlRow label="Target loudness" value={settings.targetLufs.toFixed(1)+' LUFS'}><StudioSlider label="Target LUFS" min={-18} max={-6} step={0.5} value={settings.targetLufs} onChange={v=>change({targetLufs:v})}/></StudioControlRow>
       <StudioControlRow label="Peak ceiling" value={settings.ceilingDb.toFixed(1)+' dB'}><StudioSlider label="Ceiling" min={-3} max={-0.5} step={0.1} value={settings.ceilingDb} onChange={v=>change({ceilingDb:v})}/></StudioControlRow>
       <StudioControlRow label="Compressor threshold" value={settings.thresholdDb+' dB'}><StudioSlider label="Threshold" min={-30} max={-6} step={1} value={settings.thresholdDb} onChange={v=>change({thresholdDb:v})}/></StudioControlRow>
       <StudioControlRow label="Compressor ratio" value={settings.ratio.toFixed(1)+':1'}><StudioSlider label="Ratio" min={1} max={6} step={0.1} value={settings.ratio} onChange={v=>change({ratio:v})}/></StudioControlRow>
       <StudioControlRow label="Attack" value={settings.attackMs+' ms'}><StudioSlider label="Attack" min={1} max={80} step={1} value={settings.attackMs} onChange={v=>change({attackMs:v})}/></StudioControlRow>
       <StudioControlRow label="Release" value={settings.releaseMs+' ms'}><StudioSlider label="Release" min={40} max={500} step={5} value={settings.releaseMs} onChange={v=>change({releaseMs:v})}/></StudioControlRow>
       <StudioControlRow label="Drive" value={Math.round(settings.drive*100)+'%'}><StudioSlider label="Drive" min={0} max={0.4} step={0.01} value={settings.drive} onChange={v=>change({drive:v})}/></StudioControlRow>
      </div>

      <StudioButton onClick={resetAdvanced} disabled={!custom}>Reset về preset {MASTER_PROFILES.find(x=>x.id===profile)?.label}</StudioButton>
    </div>}
  </StudioPanel></>}
  {audioSection==='eq'&&<StudioPanel className="sd-eq-workspace"><div className="sd-section-kicker">ADVANCED EQ</div>      <div className="sd-channel-eq"><div className="sd-eq-title"><div><b>8-Band Parametric EQ</b><small>Precision EQ · ±12 dB · Frequency / Gain / Q</small></div><StudioBadge>STEREO EQ</StudioBadge></div>
       <div className="sd-eq-curve" aria-label="Đường cong EQ"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".22"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>{[20,35,50,65,80].map(y=><line key={'y'+y} x1="0" y1={y} x2="100" y2={y}/>) }{[12,28,44,60,76,92].map(x=><line key={'x'+x} x1={x} y1="0" x2={x} y2="100"/>)}<path d={eqPath+' L92 50 L8 50 Z'} className="sd-eq-fill"/><path d={eqPath} className="sd-eq-line"/></svg>{settings.eqBands.map((b,i)=>{const left=8+(Math.log10(b.frequency/20)/Math.log10(1000))*84,top=50-(b.enabled?b.gain:0)*3.2;return <button key={i} type="button" className={'sd-eq-node '+(!b.enabled?'off':'')} style={{left:Math.max(4,Math.min(96,left))+'%',top:Math.max(8,Math.min(92,top))+'%'}} onClick={()=>changeBand(i,{enabled:!b.enabled})}>{i+1}</button>})}<span className="sd-eq-zero">0 dB</span></div>
       <div className="sd-eq-bands">{settings.eqBands.map((b,i)=><div className={'sd-eq-band '+(!b.enabled?'is-off':'')} key={i}><div className="sd-eq-band-head"><button type="button" onClick={()=>changeBand(i,{enabled:!b.enabled})}>{b.enabled?'ON':'OFF'}</button><b>Band {i+1}</b><em>{b.frequency>=1000?(b.frequency/1000).toFixed(b.frequency%1000?1:0)+'k':Math.round(b.frequency)} Hz</em></div><StudioControlRow label="Gain" value={(b.gain>0?'+':'')+b.gain.toFixed(1)+' dB'}><StudioSlider label={'Band '+(i+1)+' gain'} min={-12} max={12} step={.5} value={b.gain} onChange={v=>changeBand(i,{gain:v})}/></StudioControlRow><StudioControlRow label="Frequency" value={Math.round(b.frequency)+' Hz'}><StudioSlider label={'Band '+(i+1)+' frequency'} min={20} max={20000} step={10} value={b.frequency} onChange={v=>changeBand(i,{frequency:v})}/></StudioControlRow><StudioControlRow label="Q" value={b.q.toFixed(2)}><StudioSlider label={'Band '+(i+1)+' Q'} min={.3} max={8} step={.1} value={b.q} onChange={v=>changeBand(i,{q:v})}/></StudioControlRow></div>)}</div>
      </div><StudioButton onClick={resetAdvanced} disabled={!custom}>Reset EQ về preset</StudioButton></StudioPanel>}
  {audioSection==='5d'&&<StudioPanel className="sd-5d">
    <StudioToggle checked={spatial} onChange={changeSpatial} label="Âm thanh 5D" description={spatial?'Đang bật · thay đổi sẽ nghe ngay':'Đang tắt · stereo gốc'}/>
    {spatial&&<div className="sd-5d-controls">
      <p className="sd-5d-help"><b>Muốn nghe tiếng chạy qua 2 tai?</b> Chọn <strong>Qua tai</strong>. Rộng/Bao quanh chủ yếu mở không gian, không cố tình chạy trái → phải.</p>
      <StudioSegmented value={spatialMode} options={(Object.keys(MODE_INFO) as Spatial5DMode[]).map(x=>({value:x,label:MODE_INFO[x].label}))} onChange={changeMode}/>
      <p className="sd-5d-mode-desc">{MODE_INFO[spatialMode].desc}</p>
      <StudioControlRow label={spatialMode==='orbit'?'Mức chuyển động':'Độ rộng'} value={spatialAmount+'%'} hint={spatialMode==='orbit'?'70–90%: tiếng chạy qua hai tai rõ hơn. Nên dùng tai nghe.':'40–60% tự nhiên · 60–80% rộng rõ.'}><StudioSlider label="Mức hiệu ứng 5D" min={20} max={100} value={spatialAmount} onChange={changeDepth}/></StudioControlRow>
      <StudioStatus tone="success">Tác dụng ngay trên nhạc đang phát · không cần render</StudioStatus>
    </div>}
  </StudioPanel>}
  <StudioButton tone="accent" className="sd-master-run" disabled={busy} onClick={()=>void run()}>{busy?<><i/> {progress}</>:<><Headphones/> Phân tích & Master để xuất file</>}</StudioButton>
  {error&&<p className="sd-master-error">{error}</p>}
  {metrics&&<><div className="sd-master-meter"><div><small>ĐẦU VÀO</small><b>{metrics.beforeLufs.toFixed(1)}</b><span>est. LUFS</span></div><strong>→</strong><div><small>MỤC TIÊU</small><b>{metrics.safeTargetLufs.toFixed(1)}</b><span>LUFS</span></div><strong>→</strong><div><small>ĐẦU RA</small><b>{metrics.afterLufs.toFixed(1)}</b><span>est. LUFS</span></div></div>
   <div className="sd-master-stats"><span>Peak {metrics.afterPeak.toFixed(1)} dBFS</span><span>Crest {metrics.crestDb.toFixed(1)} dB</span><span>Gain {metrics.gainDb>0?'+':''}{metrics.gainDb.toFixed(1)} dB</span>{metrics.safeTargetLufs<metrics.requestedLufs&&<b>Auto Guard: {metrics.requestedLufs} → {metrics.safeTargetLufs} LUFS</b>}</div>
   <div className="sd-master-ab"><div><small>A · Bản gốc</small><audio controls preload="none" src={audio}/></div><div><small>B · Đã xử lý</small><audio controls preload="metadata" src={mastered||undefined}/></div></div>
   <StudioButton className="sd-master-download" onClick={download}><Download/> Tải WAV đã xử lý</StudioButton></>}
 </section>
}
