import { cleanLyricsForVideo } from '../v4/lyrics-clean';

export type TranscriptWord={word:string;start:number;end:number;confidence?:number};
export type AlignedLyricLine={text:string;start:number;end:number;confidence:number;words?:TranscriptWord[]};

function norm(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi').replace(/đ/g,'d').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function tokens(s:string){return norm(s).split(' ').filter(Boolean)}
function similarity(a:string,b:string){const x=tokens(a),y=tokens(b);if(!x.length||!y.length)return 0;const m=x.length,n=y.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=x[i-1]===y[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);const l=dp[m][n];return (2*l)/(m+n)}
function isSection(line:string){return /^\s*[\[(]?(verse|chorus|bridge|intro|outro|pre[ -]?chorus|hook|instrumental|break|interlude)[^\])]*[\])]?:?\s*$/i.test(line)}

/**
 * Align known lyrics to timestamped speech-recognition words.
 * Lyrics remain authoritative; recognition is only the clock.
 * Monotonic window search prevents later repeated choruses matching earlier audio.
 */
export function alignTranscriptToLyrics(lyrics:string,words:TranscriptWord[],minConfidence=.48):AlignedLyricLine[]{
 const lines=cleanLyricsForVideo(lyrics).split(/\n+/).map(x=>x.trim()).filter(x=>x&&!isSection(x));
 const spoken=words.filter(w=>w.word&&Number.isFinite(w.start)&&Number.isFinite(w.end)).sort((a,b)=>a.start-b.start);
 if(!lines.length||!spoken.length)return [];
 const out:AlignedLyricLine[]=[];let cursor=0;
 for(const line of lines){
  const expected=Math.max(1,tokens(line).length),maxWindow=Math.min(spoken.length-cursor,Math.max(expected+8,Math.ceil(expected*1.9)));let best:{score:number;from:number;to:number}|null=null;
  const searchEnd=Math.min(spoken.length,cursor+Math.max(30,expected*5));
  for(let from=cursor;from<searchEnd;from++){
   for(let len=Math.max(1,expected-3);len<=maxWindow&&from+len<=spoken.length;len++){
    const phrase=spoken.slice(from,from+len).map(w=>w.word).join(' '),score=similarity(line,phrase);
    const lengthPenalty=Math.abs(len-expected)/Math.max(expected,1)*.08,final=score-lengthPenalty;
    if(!best||final>best.score)best={score:final,from,to:from+len};
   }
  }
  if(best&&best.score>=minConfidence){const matched=spoken.slice(best.from,best.to),recognition=matched.reduce((s,w)=>s+(w.confidence??1),0)/matched.length,confidence=Math.max(0,Math.min(1,best.score*.82+recognition*.18));out.push({text:line,start:matched[0].start,end:matched[matched.length-1].end,confidence,words:matched});cursor=best.to}
 }
 return out;
}

export function activeAlignedLine(t:number,timeline:AlignedLyricLine[],holdSeconds=.35){return timeline.find(x=>t>=x.start&&t<=x.end+holdSeconds)||null}
