'use client';
import type {StoredSegment} from './local-resume';

export async function muxStoredSegments(segments:StoredSegment[],onProgress?:(n:number)=>void){
 if(!segments.length)throw new Error('Không có segment để ghép.');
 const sorted=[...segments].sort((a,b)=>a.index-b.index);
 const {ALL_FORMATS,BlobSource,BufferTarget,EncodedAudioPacketSource,EncodedPacket,EncodedPacketSink,EncodedVideoPacketSource,Input,Mp4OutputFormat,Output}=await import('mediabunny');
 const first=new Input({source:new BlobSource(sorted[0].blob),formats:ALL_FORMATS});
 const vt=await first.getPrimaryVideoTrack(),at=await first.getPrimaryAudioTrack();if(!vt||!at)throw new Error('Segment đầu không đủ video/audio.');
 const vc=await vt.getCodec(),ac=await at.getCodec(),vdc=await vt.getDecoderConfig(),adc=await at.getDecoderConfig();if(!vc||!ac||!vdc||!adc)throw new Error('Không đọc được codec segment.');
 const target=new BufferTarget(),out=new Output({format:new Mp4OutputFormat(),target}),vs=new EncodedVideoPacketSource(vc),as=new EncodedAudioPacketSource(ac);out.addVideoTrack(vs,{decoderConfig:vdc});out.addAudioTrack(as,{decoderConfig:adc});await out.start();
 try{let offset=0;for(let i=0;i<sorted.length;i++){const seg=sorted[i],input=new Input({source:new BlobSource(seg.blob),formats:ALL_FORMATS}),v=await input.getPrimaryVideoTrack(),a=await input.getPrimaryAudioTrack();if(!v||!a)throw new Error(`Segment ${i+1} bị lỗi.`);const vSink=new EncodedPacketSink(v),aSink=new EncodedPacketSink(a);for await(const p of vSink.packets())await vs.add(new EncodedPacket(p.data,p.type,p.timestamp+offset,p.duration),{decoderConfig:vdc});for await(const p of aSink.packets())await as.add(new EncodedPacket(p.data,p.type,p.timestamp+offset,p.duration),{decoderConfig:adc});offset+=seg.duration;onProgress?.(Math.round((i+1)/sorted.length*100))}await out.finalize();const buffer=target.buffer;if(!buffer)throw new Error('Mux không tạo được dữ liệu MP4.');return new Blob([buffer],{type:'video/mp4'})}catch(e){out.cancel();throw e}
}
