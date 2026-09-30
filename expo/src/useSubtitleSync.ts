import { useCallback, useEffect, useRef, useState } from 'react';
import { getCloudSubtitle, regenerateSubtitle } from './api';
import type { KaraokeLine, Song } from './types';

export type SubtitleSyncStatus='idle'|'syncing'|'synced'|'fallback';

function estimatedTimeline(song:Song):KaraokeLine[]{
  const duration=Math.max(1,song.duration||0);
  const lines=(song.lyrics||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);
  if(!lines.length)return [];
  const intro=Math.min(8,Math.max(0,duration*.06));
  const usable=Math.max(1,duration-intro);
  const step=usable/lines.length;
  return lines.map((text,index)=>({
    text,
    start:intro+index*step,
    end:Math.min(duration,intro+(index+1)*step-.08),
  }));
}

function cloudLines(payload:any):KaraokeLine[]{
  const lines=payload?.subtitle?.lines;
  return Array.isArray(lines)?lines.filter((line:any)=>line&&typeof line.text==='string'&&Number.isFinite(Number(line.start))&&Number.isFinite(Number(line.end))).map((line:any)=>({text:String(line.text),start:Number(line.start),end:Number(line.end)})):[];
}

export function useSubtitleSync(song:Song){
  const [timeline,setTimeline]=useState<KaraokeLine[]>([]);
  const [status,setStatus]=useState<SubtitleSyncStatus>('idle');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [regenerating,setRegenerating]=useState(false);
  const run=useRef(0);

  const fallback=useCallback((reason:string)=>{
    const estimated=estimatedTimeline(song);
    setTimeline(estimated);
    setStatus('fallback');
    setMessage(estimated.length?'Đang dùng timing lời tạm thời.':'Subtitle cloud chưa sẵn sàng.');
    setError(reason);
  },[song]);

  useEffect(()=>{
    const current=++run.current;
    setTimeline([]);
    setError('');
    if(!song.id){
      setStatus('idle');
      setMessage('');
      return;
    }
    setStatus('syncing');
    setMessage('Đang tìm subtitle…');
    void (async()=>{
      try{
        let payload=await getCloudSubtitle(song.id!);
        if(current!==run.current)return;
        if(!payload){
          setMessage('Đang đồng bộ subtitle trên server…');
          try{
            const lines=await regenerateSubtitle(song);
            if(current!==run.current)return;
            if(lines.length){
              setTimeline(lines);setStatus('synced');setMessage('Subtitle cloud đã sẵn sàng.');return;
            }
          }catch{}
          payload=await getCloudSubtitle(song.id!);
        }
        if(current!==run.current)return;
        const lines=cloudLines(payload);
        if(lines.length){
          setTimeline(lines);
          const cloudStatus=payload?.subtitle?.status==='fallback'?'fallback':'synced';
          setStatus(cloudStatus);
          setMessage(cloudStatus==='synced'?'Subtitle cloud đã sẵn sàng.':'Subtitle cloud đã tạo. Nên kiểm tra lại timing.');
          return;
        }
        fallback('Subtitle cloud chưa trả về cue.');
      }catch(e){
        if(current!==run.current)return;
        fallback(e instanceof Error?e.message:'Không thể đồng bộ subtitle.');
      }
    })();
    return()=>{run.current+=1};
  },[song.id,song.audio,fallback]);

  const reget=useCallback(async()=>{
    if(!song.id){setError('Bài hát chưa có songId.');return}
    const current=++run.current;
    setRegenerating(true);setStatus('syncing');setMessage('Đang lấy lại subtitle…');setError('');
    try{
      const lines=await regenerateSubtitle(song);
      if(current!==run.current)return;
      setTimeline(lines);setStatus('synced');setMessage('Subtitle mới đã sẵn sàng.');
    }catch(e){
      if(current!==run.current)return;
      fallback(e instanceof Error?e.message:'Không lấy lại được subtitle.');
    }finally{
      if(current===run.current)setRegenerating(false);
    }
  },[song,fallback]);

  return {timeline,setTimeline,status,message,error,regenerating,reget};
}
