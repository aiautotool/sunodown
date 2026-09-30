import * as FileSystem from 'expo-file-system/legacy';
import { execute } from 'munim-ffmpeg';

function bytesFromBase64(base64:string){
  const binary=globalThis.atob(base64);
  const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i)&255;
  return out;
}
async function localInput(source:string){
  if(source.startsWith('file:')||source.startsWith('content:'))return source;
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  return (await FileSystem.downloadAsync(source,base+'wave-source-'+Date.now().toString(36)+'.m4a')).uri;
}
export async function extractWaveform(source:string,bins=320):Promise<number[]>{
  const base=FileSystem.cacheDirectory;
  if(!base)return [];
  const input=await localInput(source);
  const raw=base+'wave-'+Date.now().toString(36)+'.pcm';
  try{
    const result=await execute(['-y','-i',input,'-vn','-ac','1','-ar','800','-f','s16le',raw]);
    if(!result.success)return [];
    const base64=await FileSystem.readAsStringAsync(raw,{encoding:FileSystem.EncodingType.Base64});
    const bytes=bytesFromBase64(base64);
    const samples=Math.floor(bytes.length/2);
    if(!samples)return [];
    const count=Math.max(80,bins),block=Math.max(1,Math.floor(samples/count));
    const peaks=Array.from({length:count},(_,index)=>{
      const start=index*block,end=Math.min(samples,start+block);
      let peak=0;
      for(let i=start;i<end;i++){
        const lo=bytes[i*2]||0,hi=bytes[i*2+1]||0;
        let value=(hi<<8)|lo;if(value&0x8000)value-=0x10000;
        peak=Math.max(peak,Math.abs(value)/32768);
      }
      return peak;
    });
    const max=Math.max(.001,...peaks);
    return peaks.map(value=>value/max);
  }finally{void FileSystem.deleteAsync(raw,{idempotent:true}).catch(()=>undefined)}
}
