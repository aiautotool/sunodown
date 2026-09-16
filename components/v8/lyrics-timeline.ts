import type { AlignedLyricLine } from './lyrics-alignment';
export function lyricAtTime(t:number,timeline:AlignedLyricLine[],hold=.22){
 let best:AlignedLyricLine|null=null;
 for(const line of timeline){if(t>=line.start&&t<=line.end+hold){best=line;break}if(line.start>t)break}
 return best;
}
export function wordProgress(t:number,line:AlignedLyricLine|null){if(!line?.words?.length)return null;const i=line.words.findIndex(w=>t>=w.start&&t<=w.end);if(i>=0){const w=line.words[i],p=Math.max(0,Math.min(1,(t-w.start)/Math.max(.03,w.end-w.start)));return {index:i,progress:p}}const completed=line.words.filter(w=>w.end<t).length;return {index:Math.min(completed,line.words.length-1),progress:completed?1:0}}
