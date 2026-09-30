import type { KaraokeLine, Song } from './types';
import { publicAudioUrl } from './api';
import type { HighlightAnalysis } from './highlight-engine';

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const mean=(v:number[])=>v.length?v.reduce((s,x)=>s+x,0)/v.length:0;
const stdev=(v:number[])=>{if(v.length<2)return 0;const a=mean(v);return Math.sqrt(mean(v.map(x=>(x-a)**2)))};
const percentile=(v:number[],r:number)=>{if(!v.length)return 0;const s=[...v].sort((a,b)=>a-b),i=Math.min(s.length-1,Math.max(0,Math.round((s.length-1)*r)));return s[i]!};
const normalize=(v:number,l:number,h:number)=>h<=l+1e-8?0:clamp((v-l)/(h-l),0,1);
function lyricActivity(start:number,end:number,timeline:KaraokeLine[]){if(!timeline.length||end<=start)return 0;let active=0;for(const line of timeline)active+=Math.max(0,Math.min(end,line.end)-Math.max(start,line.start));return clamp(active/(end-start),0,1)}
function align(candidate:number,min:number,max:number,timeline:KaraokeLine[]){const n=timeline.map(x=>x.start).filter(x=>x>=min&&x<=max).map(start=>({start,d:Math.abs(start-candidate)})).filter(x=>x.d<=2.5).sort((a,b)=>a.d-b.d)[0];return n?n.start:candidate}
function frames(buffer:AudioBuffer,frameSeconds=.25){
 const size=Math.max(256,Math.round(buffer.sampleRate*frameSeconds)),stride=Math.max(1,Math.round(buffer.sampleRate/3000)),out:Array<{time:number;energy:number;peak:number;onset:number}>=[];let prev=0;
 for(let offset=0;offset<buffer.length;offset+=size){const end=Math.min(buffer.length,offset+size);let square=0,peak=0,n=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=offset;i<end;i+=stride){const x=data[i]||0;square+=x*x;peak=Math.max(peak,Math.abs(x));n++}}const energy=n?Math.sqrt(square/n):0;out.push({time:offset/buffer.sampleRate,energy,peak,onset:Math.max(0,energy-prev)});prev=energy}return out;
}
export async function findHighlight(song:Song,timeline:KaraokeLine[],minStart=0,maxEnd=song.duration||0,windowSeconds=30):Promise<HighlightAnalysis>{
 const duration=Math.max(0,song.duration||maxEnd||0),from=clamp(minStart,0,duration),to=clamp(maxEnd||duration,from,duration),available=Math.max(0,to-from),clipWindow=Math.min(windowSeconds,available||windowSeconds);
 if(available<=clipWindow+.5)return{startSeconds:from,endSeconds:to,confidence:1,score:1,reason:'short-track'};
 const response=await fetch(publicAudioUrl(song),{cache:'no-store'});if(!response.ok)throw new Error('Không tải được audio để tìm cao trào.');
 const bytes=await response.arrayBuffer(),AudioCtx=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioCtx)throw new Error('Web Audio API is unavailable.');
 const ctx=new AudioCtx();
 try{
  const buffer=await ctx.decodeAudioData(bytes.slice(0)),safeEnd=Math.min(to,buffer.duration),safeAvailable=safeEnd-from;
  if(safeAvailable<=clipWindow+.5)return{startSeconds:from,endSeconds:safeEnd,confidence:1,score:1,reason:'short-track'};
  const all=frames(buffer).filter(x=>x.time>=from&&x.time<=safeEnd);if(all.length<8)throw new Error('Not enough audio frames.');
  const eLow=percentile(all.map(x=>x.energy),.12),eHigh=percentile(all.map(x=>x.energy),.92),pLow=percentile(all.map(x=>x.peak),.12),pHigh=percentile(all.map(x=>x.peak),.92),oLow=percentile(all.map(x=>x.onset),.2),oHigh=percentile(all.map(x=>x.onset),.95);
  const lastStart=safeEnd-clipWindow,intro=safeAvailable>55?Math.min(7,safeAvailable*.06):0,outro=safeAvailable>55?Math.min(4,safeAvailable*.035):0,searchStart=Math.min(lastStart,from+intro),searchEnd=Math.max(searchStart,lastStart-outro),candidates:Array<{start:number;score:number}>=[];
  for(let start=searchStart;start<=searchEnd+.001;start+=.75){const end=start+clipWindow,w=all.filter(x=>x.time>=start&&x.time<end);if(!w.length)continue;const es=w.map(x=>x.energy),ps=w.map(x=>x.peak),os=w.map(x=>x.onset),center=((start+end)/2)/Math.max(1,safeEnd),placement=clamp(1-Math.abs(center-.62)*.45,.84,1);const score=(normalize(mean(es),eLow,eHigh)*.5+normalize(mean(os),oLow,oHigh)*.2+normalize(percentile(ps,.84),pLow,pHigh)*.12+normalize(stdev(es),0,Math.max(.015,eHigh-eLow))*.08+lyricActivity(start,end,timeline)*.1)*placement;candidates.push({start,score})}
  if(!candidates.length)throw new Error('No highlight candidates found.');
  candidates.sort((a,b)=>b.score-a.score);const best=candidates[0]!,runner=candidates[Math.min(4,candidates.length-1)]||best,start=clamp(align(best.start,from,lastStart,timeline),from,lastStart),separation=Math.max(0,best.score-runner.score),confidence=clamp(.55+best.score*.3+separation*.7,.55,.98);
  return{startSeconds:start,endSeconds:Math.min(safeEnd,start+window),confidence,score:best.score,reason:'audio-energy'};
 }finally{void ctx.close().catch(()=>undefined)}
}
