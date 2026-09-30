import type { KaraokeLine } from './types';

function parseTime(value:string){
  const clean=value.trim().replace(',', '.');
  const parts=clean.split(':').map(Number);
  if(parts.some(Number.isNaN))return NaN;
  if(parts.length===3)return parts[0]!*3600+parts[1]!*60+parts[2]!;
  if(parts.length===2)return parts[0]!*60+parts[1]!;
  return parts[0]||0;
}

export function parseSubtitleText(input:string):KaraokeLine[]{
  const text=input.replace(/^\uFEFF/,'').replace(/\r/g,'').replace(/^WEBVTT[^\n]*\n+/i,'').trim();
  if(!text)return [];
  const blocks=text.split(/\n{2,}/);
  const lines:KaraokeLine[]=[];
  for(const block of blocks){
    const rows=block.split('\n').map(v=>v.trim()).filter(Boolean);
    if(!rows.length)continue;
    const timeIndex=rows.findIndex(row=>row.includes('-->'));
    if(timeIndex<0)continue;
    const match=rows[timeIndex]!.match(/([^\s]+)\s*-->\s*([^\s]+)/);
    if(!match)continue;
    const start=parseTime(match[1]!),end=parseTime(match[2]!);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
    const cueText=rows.slice(timeIndex+1).join('\n').replace(/<[^>]+>/g,'').trim();
    if(!cueText)continue;
    lines.push({text:cueText,start,end});
  }
  return lines.sort((a,b)=>a.start-b.start);
}

export function toSrt(lines:KaraokeLine[]){
  const stamp=(seconds:number)=>{
    const ms=Math.max(0,Math.round(seconds*1000));
    const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),x=ms%1000;
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(x).padStart(3,'0');
  };
  return lines.map((line,index)=>String(index+1)+'\n'+stamp(line.start)+' --> '+stamp(line.end)+'\n'+line.text+'\n').join('\n');
}
