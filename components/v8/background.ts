'use client';

export type BackgroundMode='suno'|'preset'|'image'|'video';
export type BackgroundFit='cover'|'contain';
export type BackgroundConfig={
  mode:BackgroundMode;
  presetId?:string;
  imageUrl?:string;
  videoUrl?:string;
  imageFingerprint?:string;
  videoFingerprint?:string;
  fit:BackgroundFit;
  blur:number;
  dim:number;
  overlayOpacity:number;
  loopVideo:boolean;
};

export const DEFAULT_BACKGROUND_CONFIG:BackgroundConfig={
  mode:'suno',fit:'cover',blur:0,dim:0,overlayOpacity:0,loopVideo:true,
};

export const BACKGROUND_PRESETS=[
  {id:'purple-gradient',label:'Purple Gradient'},
  {id:'neon-blur',label:'Neon Blur'},
  {id:'bokeh-night',label:'Bokeh Night'},
  {id:'soft-light',label:'Soft Light'},
  {id:'dark-film',label:'Dark Film'},
  {id:'concert-light',label:'Concert Light'},
  {id:'dreamy-blue',label:'Dreamy Blue'},
  {id:'romantic-glow',label:'Romantic Glow'},
] as const;

export function sanitizeStoredBackground(value:any):BackgroundConfig{
  const mode:value is BackgroundConfig = value;
  const safeMode:BackgroundMode=value?.mode==='preset'?'preset':value?.mode==='suno'?'suno':'suno';
  return {
    ...DEFAULT_BACKGROUND_CONFIG,
    mode:safeMode,
    presetId:typeof value?.presetId==='string'?value.presetId:undefined,
    fit:value?.fit==='contain'?'contain':'cover',
    blur:Math.max(0,Math.min(20,Number(value?.blur)||0)),
    dim:Math.max(0,Math.min(100,Number(value?.dim)||0)),
    overlayOpacity:Math.max(0,Math.min(80,Number(value?.overlayOpacity)||0)),
    loopVideo:value?.loopVideo!==false,
  };
}

function roundedGlow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,alpha:number){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,color.replace('ALPHA',String(alpha)));
  g.addColorStop(1,color.replace('ALPHA','0'));
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}

export function drawPresetBackground(ctx:CanvasRenderingContext2D,id:string|undefined,w:number,h:number,t:number){
  const key=id||'purple-gradient';
  ctx.save();
  const linear=(a:string,b:string,c?:string)=>{
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,a);if(c)g.addColorStop(.52,b),g.addColorStop(1,c);else g.addColorStop(1,b);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  };
  if(key==='purple-gradient'){
    linear('#120627','#4c1d95','#0f172a');roundedGlow(ctx,w*.72,h*.28,Math.max(w,h)*.55,'rgba(217,70,239,ALPHA)',.28);
  }else if(key==='neon-blur'){
    linear('#040711','#071426');roundedGlow(ctx,w*.25,h*.35,Math.max(w,h)*.48,'rgba(34,211,238,ALPHA)',.34);roundedGlow(ctx,w*.78,h*.62,Math.max(w,h)*.5,'rgba(217,70,239,ALPHA)',.3);
  }else if(key==='bokeh-night'){
    linear('#020617','#111827','#1e1b4b');for(let i=0;i<15;i++){const x=(Math.sin(i*7.7+1)*.5+.5)*w,y=(Math.cos(i*4.1+2)*.5+.5)*h,r=Math.max(18,Math.min(w,h)*(.025+(i%5)*.012));roundedGlow(ctx,x,y,r*3,i%3===0?'rgba(251,191,36,ALPHA)':i%3===1?'rgba(96,165,250,ALPHA)':'rgba(244,114,182,ALPHA)',.12+.03*(i%4));}
  }else if(key==='soft-light'){
    linear('#fdf4ff','#dbeafe','#fef3c7');roundedGlow(ctx,w*.2,h*.18,Math.max(w,h)*.6,'rgba(255,255,255,ALPHA)',.45);ctx.fillStyle='rgba(9,9,20,.2)';ctx.fillRect(0,0,w,h);
  }else if(key==='dark-film'){
    linear('#09090b','#18181b','#0f172a');ctx.globalAlpha=.1;for(let y=0;y<h;y+=6){ctx.fillStyle=y%12===0?'#fff':'#000';ctx.fillRect(0,y,w,1)}ctx.globalAlpha=1;
  }else if(key==='concert-light'){
    linear('#030712','#14091f');for(let i=0;i<5;i++){ctx.save();ctx.translate(w*(.1+i*.2),0);ctx.rotate((i-2)*.12);const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,255,255,.28)');g.addColorStop(.75,'rgba(168,85,247,.03)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-w*.035,0);ctx.lineTo(w*.18,h);ctx.lineTo(-w*.18,h);ctx.closePath();ctx.fill();ctx.restore();}
  }else if(key==='dreamy-blue'){
    linear('#082f49','#172554','#312e81');roundedGlow(ctx,w*.35,h*.38,Math.max(w,h)*.55,'rgba(125,211,252,ALPHA)',.25);roundedGlow(ctx,w*.8,h*.7,Math.max(w,h)*.45,'rgba(196,181,253,ALPHA)',.2);
  }else{
    linear('#2e1065','#831843','#3b0764');roundedGlow(ctx,w*.5,h*.46,Math.max(w,h)*.58,'rgba(251,113,133,ALPHA)',.26);roundedGlow(ctx,w*.25,h*.2,Math.max(w,h)*.38,'rgba(244,114,182,ALPHA)',.2);
  }
  const vignette=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.18,w/2,h/2,Math.max(w,h)*.75);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'rgba(0,0,0,.34)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  ctx.restore();
}

export function drawMediaBackground(ctx:CanvasRenderingContext2D,source:CanvasImageSource,sourceW:number,sourceH:number,w:number,h:number,config:BackgroundConfig){
  const fit=config.fit||'cover';
  const scale=fit==='cover'?Math.max(w/sourceW,h/sourceH):Math.min(w/sourceW,h/sourceH);
  const dw=sourceW*scale,dh=sourceH*scale,x=(w-dw)/2,y=(h-dh)/2;
  ctx.save();
  if(fit==='contain'){ctx.fillStyle='#050611';ctx.fillRect(0,0,w,h)}
  if(config.blur>0)ctx.filter=`blur(${config.blur}px)`;
  ctx.drawImage(source,x,y,dw,dh);
  ctx.restore();
}

export function applyBackgroundFinish(ctx:CanvasRenderingContext2D,w:number,h:number,config:BackgroundConfig){
  if(config.dim>0){ctx.fillStyle=`rgba(0,0,0,${Math.min(.9,config.dim/100)})`;ctx.fillRect(0,0,w,h)}
  if(config.overlayOpacity>0){const a=config.overlayOpacity/100;const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,`rgba(76,29,149,${a*.55})`);g.addColorStop(1,`rgba(8,47,73,${a*.45})`);ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}
}

export async function seekVideoFrame(video:HTMLVideoElement,time:number,loop=true){
  const duration=video.duration;
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Trình duyệt không đọc được video nền.');
  const target=loop?((time%duration)+duration)%duration:Math.min(Math.max(0,time),Math.max(0,duration-.02));
  if(Math.abs(video.currentTime-target)<.055)return;
  await new Promise<void>((resolve,reject)=>{
    const timer=window.setTimeout(()=>{cleanup();reject(new Error('Không lấy được frame từ video nền.'))},2500);
    const done=()=>{cleanup();resolve()};const fail=()=>{cleanup();reject(new Error('Không lấy được frame từ video nền.'))};
    const cleanup=()=>{window.clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail)};
    video.addEventListener('seeked',done,{once:true});video.addEventListener('error',fail,{once:true});
    try{video.currentTime=target}catch{cleanup();reject(new Error('Video nền không hỗ trợ trên thiết bị này.'))}
  });
}

export function backgroundFingerprint(config:BackgroundConfig){
  return [config.mode,config.presetId||'',config.imageFingerprint||'',config.videoFingerprint||'',config.fit,config.blur,config.dim,config.overlayOpacity,config.loopVideo?'1':'0'].join(':');
}
