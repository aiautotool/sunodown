export async function extractWaveform(source:string,bins=320):Promise<number[]>{
  const response=await fetch(source,{cache:'no-store'});
  if(!response.ok)throw new Error('Không tải được audio để dựng waveform.');
  const bytes=await response.arrayBuffer();
  const AudioCtx=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!AudioCtx)return [];
  const ctx=new AudioCtx();
  try{
    const decoded=await ctx.decodeAudioData(bytes.slice(0));
    const left=decoded.getChannelData(0);
    const right=decoded.numberOfChannels>1?decoded.getChannelData(1):left;
    const count=Math.max(80,bins);
    const block=Math.max(1,Math.floor(left.length/count));
    const peaks=Array.from({length:count},(_,index)=>{
      const start=index*block,end=Math.min(left.length,start+block);
      let peak=0;
      const stride=Math.max(1,Math.floor(block/96));
      for(let i=start;i<end;i+=stride)peak=Math.max(peak,Math.abs(((left[i]||0)+(right[i]||0))*.5));
      return peak;
    });
    const max=Math.max(.001,...peaks);
    return peaks.map(value=>value/max);
  }finally{await ctx.close().catch(()=>undefined)}
}
