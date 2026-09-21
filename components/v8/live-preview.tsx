'use client';

import {useEffect, useRef, useState} from 'react';
import {createLiveFramePainter, type OverlayLayout} from '../v4/renderer-safe';
import {VIDEO_SIZES, type Song, type VideoAspect, type VisualTemplate, type WaveStyle, type MotionIntensity, type LyricsMode} from '../v4/types';
import {getStoredEffects} from './effects-panel';
import {drawVideoEffects, type EffectConfig} from './video-effects';
import {drawKaraokeOverlay, type KaraokeLine} from '@/app/lib/karaoke';
import {DEFAULT_BACKGROUND_CONFIG,applyBackgroundFinish,drawMediaBackground,drawPresetBackground,type BackgroundConfig} from './background';

type Props = {
  song: Song;
  aspect: VideoAspect;
  template: VisualTemplate;
  wave: WaveStyle;
  motion: MotionIntensity;
  lyrics: LyricsMode;
  karaokeTimeline?: KaraokeLine[];
  background?: BackgroundConfig;
  layout?: OverlayLayout;
  onLayoutChange?:(layout:OverlayLayout)=>void;
  start: number;
  exporting: boolean;
  resultUrl?: string;
};

function fmt(value:number){
  const seconds=Math.max(0,Math.floor(value));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}

export function LivePreview(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const current = useRef(props);
  current.current = props;
  const effects = useRef<EffectConfig>(getStoredEffects());
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(props.start);
  const [status, setStatus] = useState('Đang tải ảnh xem trước…');
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [backgroundBitmap,setBackgroundBitmap]=useState<ImageBitmap|null>(null);
  const backgroundVideo=useRef<HTMLVideoElement|null>(null);

  const previewEnd = Math.min(props.song.duration || props.start + 10, props.start + 10);
  const previewDuration = Math.max(.1, previewEnd - props.start);

  useEffect(() => {
    const update = (event: Event) => { effects.current = (event as CustomEvent<EffectConfig>).detail; };
    window.addEventListener('suno-effects-change', update);
    return () => window.removeEventListener('suno-effects-change', update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let image: ImageBitmap | null = null;
    setBitmap(null);
    setStatus('Đang tải ảnh xem trước…');
    (async () => {
      try {
        if (!props.song.picture) throw new Error('Bài hát chưa có ảnh bìa để xem trước.');
        const response = await fetch(props.song.picture, {signal: controller.signal});
        if (!response.ok) throw new Error('Không tải được ảnh xem trước. Hãy tải lại thông tin bài hát.');
        image = await createImageBitmap(await response.blob());
        if (controller.signal.aborted) { image.close(); return; }
        setBitmap(image);
        setStatus('');
      } catch (error) {
        if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : 'Không tải được ảnh xem trước.');
      }
    })();
    return () => { controller.abort(); image?.close(); };
  }, [props.song.picture]);

  useEffect(()=>{
    const config=props.background||DEFAULT_BACKGROUND_CONFIG;
    let cancelled=false,createdBitmap:ImageBitmap|null=null,createdVideo:HTMLVideoElement|null=null;
    setBackgroundBitmap(null);
    if(backgroundVideo.current){backgroundVideo.current.pause();backgroundVideo.current.removeAttribute('src');backgroundVideo.current.load();backgroundVideo.current=null}
    (async()=>{
      try{
        if(config.mode==='image'&&config.imageUrl){
          const response=await fetch(config.imageUrl);
          if(!response.ok)throw new Error('Không tải được ảnh nền.');
          createdBitmap=await createImageBitmap(await response.blob());
          if(cancelled){createdBitmap.close();return}
          setBackgroundBitmap(createdBitmap);
        }else if(config.mode==='video'&&config.videoUrl){
          const v=document.createElement('video');createdVideo=v;v.src=config.videoUrl;v.muted=true;v.playsInline=true;v.preload='auto';
          await new Promise<void>((resolve,reject)=>{const ok=()=>{cleanup();resolve()},bad=()=>{cleanup();reject(new Error('Trình duyệt không đọc được video này.'))},cleanup=()=>{v.removeEventListener('loadeddata',ok);v.removeEventListener('error',bad)};v.addEventListener('loadeddata',ok,{once:true});v.addEventListener('error',bad,{once:true});v.load()});
          if(cancelled){v.removeAttribute('src');v.load();return}
          backgroundVideo.current=v;
        }
      }catch(error){if(!cancelled)setStatus(error instanceof Error?error.message:'Không tải được background.')}
    })();
    return()=>{cancelled=true;if(createdBitmap)createdBitmap.close();if(createdVideo){createdVideo.pause();createdVideo.removeAttribute('src');createdVideo.load()}if(backgroundVideo.current===createdVideo)backgroundVideo.current=null};
  },[props.background?.mode,props.background?.presetId,props.background?.imageUrl,props.background?.videoUrl]);

  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    player.pause();
    player.currentTime = props.start;
    setTime(props.start);
    setPlaying(false);
  }, [props.song.audio, props.start, props.resultUrl]);

  useEffect(() => {
    if (props.exporting || props.resultUrl) {
      audio.current?.pause();
      setPlaying(false);
    }
  }, [props.exporting, props.resultUrl]);

  useEffect(() => {
    if (!bitmap || props.exporting || props.resultUrl) return;
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const paint = createLiveFramePainter(bitmap);
    let frame = 0;
    let previous = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - previous < 1000 / 30) return;
      previous = now;
      if (document.hidden) return;

      const p = current.current;
      const player = audio.current;
      let absoluteTime = player?.currentTime ?? p.start;
      const end = Math.min(p.song.duration || p.start + 10, p.start + 10);

      if (player && !player.paused && absoluteTime >= end - .02) {
        player.currentTime = p.start;
        absoluteTime = p.start;
        void player.play().catch(() => undefined);
      }

      setTime(absoluteTime);
      const size = VIDEO_SIZES[p.aspect];
      const surface = context.canvas;
      const scale = Math.min(1, 640 / Math.max(size.width, size.height));
      const width = Math.round(size.width * scale), height = Math.round(size.height * scale);
      if (surface.width !== width || surface.height !== height) { surface.width = width; surface.height = height; }

      context.setTransform(scale, 0, 0, scale, 0, 0);
      const hasExactLyrics = p.lyrics !== 'off' && !!p.karaokeTimeline?.length;
      const background=p.background||DEFAULT_BACKGROUND_CONFIG,customBackground=background.mode!=='suno';
      if(background.mode==='preset'){
        drawPresetBackground(context,background.presetId,size.width,size.height,absoluteTime);applyBackgroundFinish(context,size.width,size.height,background);
      }else if(background.mode==='image'&&backgroundBitmap){
        drawMediaBackground(context,backgroundBitmap,backgroundBitmap.width,backgroundBitmap.height,size.width,size.height,background);applyBackgroundFinish(context,size.width,size.height,background);
      }else if(background.mode==='video'&&backgroundVideo.current&&Number.isFinite(backgroundVideo.current.duration)){
        const v=backgroundVideo.current,d=v.duration,target=background.loopVideo&&d>0?absoluteTime%d:Math.min(absoluteTime,Math.max(0,d-.02));
        if(Math.abs(v.currentTime-target)>.12)try{v.currentTime=target}catch{}
        if(v.readyState>=2){drawMediaBackground(context,v,v.videoWidth,v.videoHeight,size.width,size.height,background);applyBackgroundFinish(context,size.width,size.height,background)}
      }
      paint(context, p.song, size.width, size.height, absoluteTime, p.template, p.wave, p.motion, hasExactLyrics ? 'off' : p.lyrics,customBackground);
      if (hasExactLyrics) drawKaraokeOverlay(context, p.karaokeTimeline!, absoluteTime, size.width, size.height);
      drawVideoEffects(context, size.width, size.height, absoluteTime, effects.current);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bitmap, backgroundBitmap, props.background, props.exporting, props.resultUrl]);

  async function togglePlayback() {
    const player = audio.current;
    if (!player || props.exporting || props.resultUrl) return;
    if (player.paused) {
      if (player.currentTime < props.start || player.currentTime >= previewEnd) player.currentTime = props.start;
      try {
        await player.play();
        setPlaying(true);
      } catch {
        setStatus('Trình duyệt chặn phát tự động. Hãy bấm Play lại.');
      }
    } else {
      player.pause();
      setPlaying(false);
    }
  }

  function seekPreview(value:number){
    const player=audio.current;
    if(!player)return;
    const next=Math.max(props.start,Math.min(previewEnd,value));
    player.currentTime=next;
    setTime(next);
  }

  const size = VIDEO_SIZES[props.aspect];
  const relative = Math.max(0, Math.min(previewDuration, time - props.start));

  return <div className="mb-4 rounded-xl border border-cyan-300/20 bg-black/30 p-3">
    <div className="mb-3 flex items-center justify-between gap-2">
      <div>
        <b className="text-sm text-cyan-100">{props.resultUrl ? 'Video đã xuất' : 'Xem trước trực tiếp'}</b>
        <p className="mt-0.5 text-[10px] text-white/35">{props.resultUrl ? 'Kết quả thay trực tiếp khung preview.' : 'Hình ảnh, lyrics và nhạc chạy cùng một timeline.'}</p>
      </div>
      {!props.resultUrl && <button type="button" disabled={!!status || props.exporting} onClick={() => void togglePlayback()} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-40">{playing ? 'Tạm dừng' : 'Phát preview'}</button>}
    </div>

    <div className="flex justify-center overflow-hidden rounded-lg bg-black">
      {props.resultUrl
        ? <video ref={video} src={props.resultUrl} controls playsInline autoPlay className="max-h-[70vh] w-full rounded-lg bg-black" />
        : <div className="relative" style={{aspectRatio:`${size.width}/${size.height}`,width:`min(100%, ${340*size.width/size.height}px)`,maxHeight:340}}>
            <canvas ref={canvas} role="img" aria-label="Xem trước video đồng bộ cùng âm thanh" className="h-full w-full" />
            {props.layout&&props.onLayoutChange&&(['wave','subtitle'] as const).map(key=><button key={key} type="button" aria-label={`Kéo ${key}`} onPointerDown={e=>{const box=e.currentTarget.parentElement!.getBoundingClientRect(),id=e.pointerId;e.currentTarget.setPointerCapture(id);const move=(ev:PointerEvent)=>{const x=Math.max(0,Math.min(100,(ev.clientX-box.left)/box.width*100)),y=Math.max(0,Math.min(100,(ev.clientY-box.top)/box.height*100));props.onLayoutChange?.({...props.layout!,[key]:{...props.layout![key],x,y}})};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true})}} className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border px-2 py-1 text-[9px] font-bold shadow-lg backdrop-blur ${key==='wave'?'border-cyan-300/70 bg-cyan-950/70 text-cyan-100':'border-pink-300/70 bg-pink-950/70 text-pink-100'}`} style={{left:`${props.layout[key].x}%`,top:`${props.layout[key].y}%`,touchAction:'none'}}>{key==='wave'?'↔ Sóng':'↔ Subtitle'}</button>)}
          </div>}
    </div>

    {!props.resultUrl && <>
      <audio
        ref={audio}
        src={props.song.audio}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button type="button" disabled={props.exporting} onClick={() => void togglePlayback()} className="rounded-lg bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40">{playing ? '❚❚' : '▶'}</button>
        <input
          type="range"
          min={props.start}
          max={previewEnd}
          step=".01"
          value={Math.min(previewEnd,Math.max(props.start,time))}
          onChange={event=>seekPreview(Number(event.target.value))}
          className="w-full accent-cyan-300"
          aria-label="Timeline preview có âm thanh"
        />
        <span className="min-w-[70px] text-right font-mono text-[10px] text-white/45">{fmt(relative)} / {fmt(previewDuration)}</span>
      </div>
    </>}

    {status && !props.resultUrl && <p role="status" className="mt-2 text-xs text-amber-200">{status}</p>}
    {!props.resultUrl && <p className="mt-2 text-[11px] leading-5 text-white/45">{props.exporting ? 'Preview đã dừng trong lúc xuất video.' : 'Preview dùng audio thật làm clock; thay đổi vị trí phát sẽ kéo hình và lyrics theo.'}</p>}
  </div>;
}
