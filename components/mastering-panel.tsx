'use client';

import { useEffect, useState } from 'react';
import { Download, Headphones, ShieldCheck, Sparkles } from 'lucide-react';
import { MASTER_PROFILES, masterAudio, type MasterMetrics, type MasterProfileId } from '@/app/lib/audio-processing';

export function MasteringPanel({audio,title}:{audio:string;title:string}){
 const [profile,setProfile]=useState<MasterProfileId>('tiktok-loud'),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[metrics,setMetrics]=useState<MasterMetrics|null>(null),[mastered,setMastered]=useState<string|null>(null),[blob,setBlob]=useState<Blob|null>(null),[error,setError]=useState('');
 useEffect(()=>()=>{if(mastered)URL.revokeObjectURL(mastered)},[mastered]);
 const run=async()=>{setBusy(true);setError('');setProgress('Analyzing source…');try{const r=await fetch(audio,{cache:'no-store'});if(!r.ok)throw Error('Không tải được audio nguồn.');setProgress('EQ · dynamics · soft clip · Auto Guard…');const result=await masterAudio(await r.blob(),profile);if(mastered)URL.revokeObjectURL(mastered);setBlob(result.blob);setMastered(URL.createObjectURL(result.blob));setMetrics(result.metrics);setProgress('')}catch(e){setError(e instanceof Error?e.message:'Mastering thất bại.')}finally{setBusy(false)}};
 const download=()=>{if(!blob)return;const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=(title||'suno').replace(/[\\/:*?"<>|]+/g,'-')+'-'+profile+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
 return <section className="sd-master">
  <div className="sd-master-head"><div><span><Sparkles/> MASTERING</span><b>AI Loudness Lab</b><small>Auto Guard protects dense mixes instead of blindly chasing LUFS.</small></div>{metrics&&<em className={'risk-'+metrics.risk.toLowerCase().replace(/ /g,'-')}><ShieldCheck/>{metrics.risk}</em>}</div>
  <div className="sd-master-presets">{MASTER_PROFILES.map(p=><button key={p.id} className={profile===p.id?'active':''} onClick={()=>{setProfile(p.id);setMetrics(null);}}><b>{p.label}</b><span>{p.targetLufs} LUFS</span></button>)}</div>
  <p className="sd-master-desc">{MASTER_PROFILES.find(p=>p.id===profile)?.description}</p>
  <button className="sd-master-run" disabled={busy} onClick={()=>void run()}>{busy?<><i/> {progress}</>:<><Headphones/> Analyze & Master</>}</button>
  {error&&<p className="sd-master-error">{error}</p>}
  {metrics&&<><div className="sd-master-meter"><div><small>INPUT</small><b>{metrics.beforeLufs.toFixed(1)}</b><span>est. LUFS</span></div><strong>→</strong><div><small>SAFE TARGET</small><b>{metrics.safeTargetLufs.toFixed(1)}</b><span>LUFS</span></div><strong>→</strong><div><small>OUTPUT</small><b>{metrics.afterLufs.toFixed(1)}</b><span>est. LUFS</span></div></div>
   <div className="sd-master-stats"><span>Peak {metrics.afterPeak.toFixed(1)} dBFS</span><span>Crest {metrics.crestDb.toFixed(1)} dB</span><span>Gain {metrics.gainDb>0?'+':''}{metrics.gainDb.toFixed(1)} dB</span>{metrics.safeTargetLufs<metrics.requestedLufs&&<b>Guard reduced {metrics.requestedLufs} → {metrics.safeTargetLufs} LUFS</b>}</div>
   <div className="sd-master-ab"><div><small>A · Original</small><audio controls preload="none" src={audio}/></div><div><small>B · Mastered</small><audio controls preload="metadata" src={mastered||undefined}/></div></div>
   <button className="sd-master-download" onClick={download}><Download/> Download mastered WAV</button></>}
 </section>
}
