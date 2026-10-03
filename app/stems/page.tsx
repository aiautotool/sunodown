'use client';

import { useState } from 'react';
import { Download, Mic2, Music2, Scissors, Upload } from 'lucide-react';
import { MobileAppNav } from '@/components/mobile-app-nav';
import { separateVocals, type StemSeparationResult as Result } from '@/src/api/stems';

export default function StemsPage(){
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[result,setResult]=useState<Result|null>(null);
 async function separate(){
  if(!file||busy)return;setBusy(true);setResult(null);
  try{setResult(await separateVocals(file));}
  catch(e){setResult({error:e instanceof Error?e.message:'Không thể tách vocal'});}
  finally{setBusy(false)}
 }
 return <main className="sd-stems-page">
  <header><a href="/" aria-label="Quay lại">‹</a><b>Tách Vocal</b><span><Scissors/></span></header>
  <section className="sd-stems-card">
   <div className="sd-stems-hero"><Mic2/><h1>Vocal Remover</h1><p>Ultimate Vocal Remover</p></div>
   <label className="sd-stems-drop"><Upload/><b>{file?file.name:'Chọn file audio'}</b><input type="file" accept="audio/*,.mp3,.wav,.m4a,.flac" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <div className="sd-stems-mode"><button className="active"><Mic2/><span>Vocal</span></button><button disabled><Music2/><span>Stems</span></button></div>
   <button className="sd-stems-run" disabled={!file||busy} onClick={separate}>{busy?'Đang tách…':'Tách Vocal'}</button>
   {result?.error&&<div className="sd-stems-error">{result.error}</div>}
   {result?.vocals&&<div className="sd-stems-results"><a href={result.vocals} download><Mic2/><b>Vocals</b><Download/></a>{result.instrumental&&<a href={result.instrumental} download><Music2/><b>Instrumental</b><Download/></a>}</div>}
  </section><MobileAppNav/>
 </main>
}