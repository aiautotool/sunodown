'use client';

export type SmartRenderQualityMode='auto'|'data-saver'|'balanced'|'high';
export type SmartRenderProfile={mode:Exclude<SmartRenderQualityMode,'auto'>;bitrate:number;reason:string};

function mobileDevice(){if(typeof navigator==='undefined')return false;const ua=navigator.userAgent||'';return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)||(navigator.maxTouchPoints>1&&/Macintosh/i.test(ua))}

/** Chooses a safe AVC bitrate from output duration + device class. Long/mobile renders
 * intentionally trade a little bitrate for substantially lower memory/thermal pressure. */
export function resolveSmartRenderQuality(mode:SmartRenderQualityMode='auto',durationSeconds=0,pixels=1080*1920):SmartRenderProfile{
 const mobile=mobileDevice(),long=durationSeconds>=30*60,veryLong=durationSeconds>=2*60*60,hd=pixels>=1_000_000;
 const chosen=mode==='auto'?(mobile||veryLong?'data-saver':long?'balanced':'high'):mode;
 const bitrate=chosen==='data-saver'?(hd?1_650_000:1_250_000):chosen==='balanced'?(hd?2_400_000:1_800_000):(hd?3_600_000:2_700_000);
 const reason=mode!=='auto'?'Chất lượng do người dùng chọn':mobile?'Tối ưu nhiệt/bộ nhớ cho thiết bị di động':veryLong?'Tối ưu dung lượng cho video từ 2 giờ':long?'Cân bằng chất lượng/dung lượng cho video dài':'Ưu tiên chất lượng cho video ngắn';
 return{mode:chosen,bitrate,reason};
}

export async function withSmartVideoEncoderBitrate<T>(bitrate:number,run:()=>Promise<T>):Promise<T>{
 if(typeof VideoEncoder==='undefined')return run();
 const proto=VideoEncoder.prototype,original=proto.configure;
 proto.configure=function(config:VideoEncoderConfig){return original.call(this,{...config,bitrate})};
 try{return await run()}finally{proto.configure=original}
}
