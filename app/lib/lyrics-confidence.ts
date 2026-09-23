import type {KaraokeLine} from './karaoke';

export type WordConfidence={lineIndex:number;wordIndex:number;score:number;level:'high'|'medium'|'low';reasons:string[]};
export type LineConfidence={lineIndex:number;score:number;level:'high'|'medium'|'low';words:WordConfidence[]};
export type LyricsConfidenceReport={score:number;level:'high'|'medium'|'low';lines:LineConfidence[];lowCount:number};

const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const level=(score:number):'high'|'medium'|'low'=>score>=78?'high':score>=55?'medium':'low';

/**
 * Estimates sync confidence from the decoded waveform plus timing geometry.
 * This deliberately does not pretend to be speech recognition: it measures whether
 * word boundaries land near acoustic onsets and whether durations/gaps are plausible.
 */
export function analyzeLyricsConfidence(timeline:KaraokeLine[],peaks:number[],duration:number):LyricsConfidenceReport{
  if(!timeline.length)return{score:0,level:'low',lines:[],lowCount:0};
  const bins=Math.max(1,peaks.length),total=Math.max(.01,duration);
  const peakAt=(time:number)=>peaks[Math.max(0,Math.min(bins-1,Math.round(time/total*(bins-1))))]||0;
  const onsetAt=(time:number)=>{
    const i=Math.max(1,Math.min(bins-2,Math.round(time/total*(bins-1))));
    const before=(peaks[i-1]||0)*.55+(peaks[Math.max(0,i-2)]||0)*.45;
    const after=(peaks[i]||0)*.6+(peaks[i+1]||0)*.4;
    return clamp((after-before)*2.8+.5);
  };
  const lines=timeline.map((line,lineIndex)=>{
    const words=line.words.map((word,wordIndex)=>{
      const span=Math.max(.01,word.end-word.start);
      const reasons:string[]=[];
      const onset=onsetAt(word.start);
      const energy=clamp(peakAt((word.start+word.end)/2)*1.6);
      const durationFit=span<.045?0.1:span<.09?.45:span<=1.35?1:span<=2.2?.6:.25;
      const previous=wordIndex?line.words[wordIndex-1]:null;
      const gap=previous?word.start-previous.end:word.start-line.start;
      const continuity=gap<-.03?.15:gap>.9?.35:gap>.45?.65:1;
      const score=Math.round(100*clamp(onset*.38+energy*.18+durationFit*.28+continuity*.16));
      if(onset<.42)reasons.push('không rõ onset âm thanh');
      if(durationFit<.7)reasons.push('thời lượng từ bất thường');
      if(continuity<.7)reasons.push('khoảng cách timing lớn');
      if(energy<.25)reasons.push('năng lượng âm thanh thấp');
      return{lineIndex,wordIndex,score,level:level(score),reasons};
    });
    const score=words.length?Math.round(words.reduce((sum,w)=>sum+w.score,0)/words.length):0;
    return{lineIndex,score,level:level(score),words};
  });
  const all=lines.flatMap(line=>line.words);
  const score=all.length?Math.round(all.reduce((sum,w)=>sum+w.score,0)/all.length):0;
  return{score,level:level(score),lines,lowCount:all.filter(w=>w.level==='low').length};
}
