'use client';

export type ProcessedFormat = 'mp3' | 'wav' | 'm4a';
export type TikTokCalibrationResult={beforeLufs:number;beforePeak:number;afterLufs:number;afterPeak:number;gainDb:number};
function db(v:number){return 20*Math.log10(Math.max(v,1e-12))}
function measure(buffer:AudioBuffer){let sum=0,peak=0,count=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<d.length;i+=4){const v=d[i];sum+=v*v;peak=Math.max(peak,Math.abs(v));count++}}const rms=Math.sqrt(sum/Math.max(1,count));return{lufs:-.691+db(rms),peak:db(peak),linearPeak:peak}}
function wavBlob(buffer:AudioBuffer){const channels=Math.min(2,buffer.numberOfChannels),bytes=44+buffer.length*channels*2,out=new ArrayBuffer(bytes),v=new DataView(out);let p=0;const s=(x:string)=>{for(const c of x)v.setUint8(p++,c.charCodeAt(0))};s('RIFF');v.setUint32(p,bytes-8,true);p+=4;s('WAVEfmt ');v.setUint32(p,16,true);p+=4;v.setUint16(p,1,true);p+=2;v.setUint16(p,channels,true);p+=2;v.setUint32(p,buffer.sampleRate,true);p+=4;v.setUint32(p,buffer.sampleRate*channels*2,true);p+=4;v.setUint16(p,channels*2,true);p+=2;v.setUint16(p,16,true);p+=2;s('data');v.setUint32(p,buffer.length*channels*2,true);p+=4;for(let i=0;i<buffer.length;i++)for(let ch=0;ch<channels;ch++){const x=Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]));v.setInt16(p,x<0?x*32768:x*32767,true);p+=2}return new Blob([out],{type:'audio/wav'})}
async function decode(source:Blob){const bytes=await source.arrayBuffer(),AudioCtx=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioCtx)throw new Error('Trình duyệt không hỗ trợ xử lý audio.');const ctx=new AudioCtx();try{return await ctx.decodeAudioData(bytes.slice(0))}finally{await ctx.close()}}
async function socialChain(decoded:AudioBuffer){const sampleRate=48000,frames=Math.ceil(decoded.duration*sampleRate),offline=new OfflineAudioContext(2,frames,sampleRate),src=offline.createBufferSource();src.buffer=decoded;const hp=offline.createBiquadFilter();hp.type='highpass';hp.frequency.value=30;hp.Q.value=.707;const sub=offline.createBiquadFilter();sub.type='lowshelf';sub.frequency.value=80;sub.gain.value=-.8;const lowMid=offline.createBiquadFilter();lowMid.type='peaking';lowMid.frequency.value=220;lowMid.Q.value=1;lowMid.gain.value=.7;const presence=offline.createBiquadFilter();presence.type='peaking';presence.frequency.value=3000;presence.Q.value=1.2;presence.gain.value=1.2;const high=offline.createBiquadFilter();high.type='highshelf';high.frequency.value=8000;high.gain.value=-.7;const comp=offline.createDynamicsCompressor();comp.threshold.value=-18;comp.knee.value=10;comp.ratio.value=1.7;comp.attack.value=.02;comp.release.value=.11;src.connect(hp).connect(sub).connect(lowMid).connect(presence).connect(high).connect(comp).connect(offline.destination);src.start();return offline.startRendering()}
export async function renderTikTokCalibratedAudio(source:Blob){const decoded=await decode(source),before=measure(decoded),rendered=await socialChain(decoded),pre=measure(rendered),target=-14,ceiling=Math.pow(10,-1/20),loudnessGain=Math.pow(10,(target-pre.lufs)/20),peakGain=pre.linearPeak>0?ceiling/pre.linearPeak:1,gain=Math.max(.25,Math.min(4,loudnessGain,peakGain)),gainDb=db(gain),normalized=new AudioBuffer({length:rendered.length,numberOfChannels:2,sampleRate:rendered.sampleRate});for(let ch=0;ch<2;ch++){const input=rendered.getChannelData(Math.min(ch,rendered.numberOfChannels-1)),out=normalized.getChannelData(ch);for(let i=0;i<input.length;i++)out[i]=Math.max(-ceiling,Math.min(ceiling,input[i]*gain))}const after=measure(normalized);return{blob:wavBlob(normalized),metrics:{beforeLufs:before.lufs,beforePeak:before.peak,afterLufs:after.lufs,afterPeak:after.peak,gainDb} satisfies TikTokCalibrationResult}}
export async function renderTikTokLikeAudio(source: Blob) {return (await renderTikTokCalibratedAudio(source)).blob}

export async function renderLoopedFadeAudio(source:Blob,trimStart:number,trimEnd:number,outputStart:number,segmentDuration:number,totalDuration:number,fadeIn:number,fadeOut:number){
 const decoded=await decode(source),sampleRate=Math.min(48000,decoded.sampleRate||48000),frames=Math.max(1,Math.ceil(segmentDuration*sampleRate)),offline=new OfflineAudioContext(Math.min(2,Math.max(1,decoded.numberOfChannels)),frames,sampleRate),src=offline.createBufferSource(),gain=offline.createGain(),loopDuration=Math.max(.05,trimEnd-trimStart),offset=trimStart+(((outputStart%loopDuration)+loopDuration)%loopDuration);src.buffer=decoded;src.loop=true;src.loopStart=trimStart;src.loopEnd=trimEnd;src.connect(gain).connect(offline.destination);
 const globalEnd=outputStart+segmentDuration,fi=Math.max(0,Math.min(fadeIn,totalDuration)),fo=Math.max(0,Math.min(fadeOut,totalDuration)),gainAt=(t:number)=>Math.max(0,Math.min(1,fi>0?t/fi:1,fo>0?(totalDuration-t)/fo:1));gain.gain.setValueAtTime(gainAt(outputStart),0);const inBoundary=fi-outputStart;if(inBoundary>0&&inBoundary<segmentDuration)gain.gain.linearRampToValueAtTime(1,inBoundary);const outBoundary=totalDuration-fo-outputStart;if(fo>0&&outBoundary>0&&outBoundary<segmentDuration){gain.gain.setValueAtTime(1,outBoundary);gain.gain.linearRampToValueAtTime(gainAt(globalEnd),segmentDuration)}else gain.gain.linearRampToValueAtTime(gainAt(globalEnd),segmentDuration);src.start(0,offset);src.stop(segmentDuration);return wavBlob(await offline.startRendering())
}

export async function convertProcessedAudio(source: Blob, format: ProcessedFormat) {
  const { Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Mp3OutputFormat, WavOutputFormat, Mp4OutputFormat, Conversion, canEncodeAudio } = await import('mediabunny');
  if (format === 'mp3' && !(await canEncodeAudio('mp3'))) { const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder'); registerMp3Encoder(); }
  if (format === 'm4a' && !(await canEncodeAudio('aac'))) throw new Error('AAC encoder unavailable');
  const target = new BufferTarget(); const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const output = new Output({format: format === 'mp3' ? new Mp3OutputFormat() : format === 'wav' ? new WavOutputFormat() : new Mp4OutputFormat(),target});
  const conversion = await Conversion.init({input,output,video:{discard:true},audio:format==='mp3'?{bitrate:192_000,numberOfChannels:2,sampleRate:48_000,forceTranscode:true}:format==='wav'?{numberOfChannels:2,sampleRate:48_000,sampleFormat:'s16',forceTranscode:true}:{codec:'aac',bitrate:128_000,numberOfChannels:2,sampleRate:48_000,forceTranscode:true},copy:false,showWarnings:false});
  if (!conversion.isValid) throw new Error(`Không hỗ trợ ${format.toUpperCase()} trên thiết bị này.`); await conversion.execute(); if (!target.buffer) throw new Error(`Không tạo được ${format.toUpperCase()}.`); return new Blob([target.buffer], { type: format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/mp4' });
}


export type MasterProfileId = 'clean' | 'tiktok-loud' | 'punchy' | 'max-loud';
export type MasterProfile = {id:MasterProfileId;label:string;targetLufs:number;ceilingDb:number;ratio:number;drive:number;description:string};
export type MasterMetrics = {beforeLufs:number;beforePeak:number;crestDb:number;requestedLufs:number;safeTargetLufs:number;afterLufs:number;afterPeak:number;gainDb:number;risk:'Safe'|'Aggressive'|'Distortion risk'};
export const MASTER_PROFILES:MasterProfile[]=[
 {id:'clean',label:'Clean',targetLufs:-11,ceilingDb:-1,ratio:1.8,drive:.08,description:'Giữ transient và độ mở, chỉ làm bản mix chắc hơn.'},
 {id:'tiktok-loud',label:'TikTok Loud',targetLufs:-8,ceilingDb:-1,ratio:2.6,drive:.18,description:'Dày và tiến về phía trước cho loa điện thoại.'},
 {id:'punchy',label:'Punchy',targetLufs:-9,ceilingDb:-1,ratio:2.2,drive:.13,description:'Ưu tiên kick/snare và cảm giác đập, ít bóp transient.'},
 {id:'max-loud',label:'Max Loud',targetLufs:-7,ceilingDb:-1,ratio:3.2,drive:.26,description:'Đẩy loudness cao; Auto Guard tự lùi target nếu nguồn quá chật.'},
];
export function getMasterProfile(id:MasterProfileId){return MASTER_PROFILES.find(x=>x.id===id)||MASTER_PROFILES[0]}
function masterRisk(target:number,crest:number){return target>-7.5||crest<5?'Distortion risk':target>-9||crest<7?'Aggressive':'Safe'}
export async function masterAudio(source:Blob,profileId:MasterProfileId){
 const decoded=await decode(source),before=measure(decoded),profile=getMasterProfile(profileId),crest=Math.max(0,before.peak-before.lufs);
 // Auto Guard: dense sources get less requested gain; dynamic sources may use the full target.
 const guardFloor=crest<5?-9:crest<7?-8:profile.targetLufs;
 const safeTarget=Math.min(profile.targetLufs,guardFloor),sampleRate=48000,frames=Math.ceil(decoded.duration*sampleRate);
 const offline=new OfflineAudioContext(Math.min(2,Math.max(1,decoded.numberOfChannels)),frames,sampleRate),src=offline.createBufferSource();src.buffer=decoded;
 const hp=offline.createBiquadFilter();hp.type='highpass';hp.frequency.value=28;hp.Q.value=.707;
 const mud=offline.createBiquadFilter();mud.type='peaking';mud.frequency.value=260;mud.Q.value=.9;mud.gain.value=profileId==='clean'?-0.4:-.9;
 const presence=offline.createBiquadFilter();presence.type='peaking';presence.frequency.value=3200;presence.Q.value=.8;presence.gain.value=profileId==='punchy'?.7:1;
 const comp=offline.createDynamicsCompressor();comp.threshold.value=profileId==='clean'?-15:-19;comp.knee.value=9;comp.ratio.value=profile.ratio;comp.attack.value=profileId==='punchy'?.018:.009;comp.release.value=.12;
 const drive=offline.createWaveShaper(),curve=new Float32Array(65536),k=1+profile.drive*8;for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(k*x)/Math.tanh(k)}drive.curve=curve;drive.oversample='4x';
 src.connect(hp).connect(mud).connect(presence).connect(comp).connect(drive).connect(offline.destination);src.start();
 const shaped=await offline.startRendering(),pre=measure(shaped),ceiling=Math.pow(10,profile.ceilingDb/20),wanted=Math.pow(10,(safeTarget-pre.lufs)/20),peakLimited=pre.linearPeak?ceiling/pre.linearPeak:1,gain=Math.max(.2,Math.min(5,wanted,peakLimited*1.06));
 const out=new AudioBuffer({length:shaped.length,numberOfChannels:shaped.numberOfChannels,sampleRate:shaped.sampleRate});
 for(let ch=0;ch<out.numberOfChannels;ch++){const input=shaped.getChannelData(ch),dest=out.getChannelData(ch);for(let i=0;i<input.length;i++){const x=input[i]*gain;dest[i]=Math.max(-ceiling,Math.min(ceiling,x));}}
 const after=measure(out),risk=masterRisk(safeTarget,crest);
 return {blob:wavBlob(out),metrics:{beforeLufs:before.lufs,beforePeak:before.peak,crestDb:crest,requestedLufs:profile.targetLufs,safeTargetLufs:safeTarget,afterLufs:after.lufs,afterPeak:after.peak,gainDb:db(gain),risk} satisfies MasterMetrics};
}


export type Spatial5DMode = 'wide' | 'immersive' | 'orbit';
export async function render5DAudio(source:Blob,amount=.65,mode:Spatial5DMode='immersive'){
 const decoded=await decode(source),rate=48000,frames=Math.ceil(decoded.duration*rate),ctx=new OfflineAudioContext(2,frames,rate);
 const src=ctx.createBufferSource();src.buffer=decoded;
 const split=ctx.createChannelSplitter(Math.max(2,decoded.numberOfChannels)),merge=ctx.createChannelMerger(2);
 const left=ctx.createGain(),right=ctx.createGain(),crossL=ctx.createGain(),crossR=ctx.createGain(),delayL=ctx.createDelay(.05),delayR=ctx.createDelay(.05);
 const width=Math.max(0,Math.min(1,amount));left.gain.value=1;right.gain.value=1;crossL.gain.value=-.16*width;crossR.gain.value=-.16*width;
 delayL.delayTime.value=(mode==='wide'?5:mode==='orbit'?14:9)/1000;delayR.delayTime.value=(mode==='wide'?8:mode==='orbit'?5:13)/1000;
 const airL=ctx.createBiquadFilter(),airR=ctx.createBiquadFilter();airL.type=airR.type='highshelf';airL.frequency.value=airR.frequency.value=6500;airL.gain.value=airR.gain.value=1.1*width;
 src.connect(split);split.connect(left,0);split.connect(right,Math.min(1,decoded.numberOfChannels-1));split.connect(crossR,0);split.connect(crossL,Math.min(1,decoded.numberOfChannels-1));
 left.connect(airL).connect(merge,0,0);right.connect(airR).connect(merge,0,1);crossL.connect(delayL).connect(merge,0,0);crossR.connect(delayR).connect(merge,0,1);
 if(mode==='orbit'){const pan=ctx.createStereoPanner();merge.connect(pan).connect(ctx.destination);pan.pan.setValueAtTime(-.18,0);for(let t=2;t<decoded.duration;t+=4)pan.pan.linearRampToValueAtTime(((Math.floor(t/4)%2)*2-1)*.18,t)}
 else merge.connect(ctx.destination);
 src.start();const rendered=await ctx.startRendering(),ceiling=Math.pow(10,-1/20);
 for(let ch=0;ch<rendered.numberOfChannels;ch++){const d=rendered.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=Math.max(-ceiling,Math.min(ceiling,d[i]));}
 return wavBlob(rendered);
}
