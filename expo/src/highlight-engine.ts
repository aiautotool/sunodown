import type { KaraokeLine, Song } from './types';

export type HighlightAnalysis={
  startSeconds:number;
  endSeconds:number;
  confidence:number;
  score:number;
  reason:'audio-energy'|'short-track'|'fallback';
};

function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value))}
function alignToLyricStart(candidate:number,minStart:number,maxStart:number,timeline:KaraokeLine[]){
  const nearby=timeline.map(line=>line.start).filter(start=>start>=minStart&&start<=maxStart).map(start=>({start,distance:Math.abs(start-candidate)})).filter(x=>x.distance<=2.5).sort((a,b)=>a.distance-b.distance)[0];
  return nearby?.start??candidate;
}

export async function findHighlight(song:Song,timeline:KaraokeLine[],minStart=0,maxEnd=song.duration||0,windowSeconds=30):Promise<HighlightAnalysis>{
  const duration=Math.max(0,song.duration||maxEnd||0),from=clamp(minStart,0,duration),to=clamp(maxEnd||duration,from,duration),available=Math.max(0,to-from),window=Math.min(windowSeconds,available||windowSeconds);
  if(available<=window+.5)return{startSeconds:from,endSeconds:to,confidence:1,score:1,reason:'short-track'};
  const lastStart=to-window;
  const preferred=from+(available-window)*.62;
  const start=clamp(alignToLyricStart(preferred,from,lastStart,timeline),from,lastStart);
  return{startSeconds:start,endSeconds:Math.min(to,start+window),confidence:.58,score:.5,reason:'fallback'};
}
