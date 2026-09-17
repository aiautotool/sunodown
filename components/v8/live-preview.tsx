'use client';

import {useEffect, useRef, useState} from 'react';
import {createLiveFramePainter} from '../v4/renderer-safe';
import {VIDEO_SIZES, type Song, type VideoAspect, type VisualTemplate, type WaveStyle, type MotionIntensity, type LyricsMode} from '../v4/types';
import {getStoredEffects} from './effects-panel';
import {drawVideoEffects, type EffectConfig} from './video-effects';

type Props = {song: Song; aspect: VideoAspect; template: VisualTemplate; wave: WaveStyle; motion: MotionIntensity; lyrics: LyricsMode; start: number; exporting: boolean};

export function LivePreview(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(props);
  current.current = props;
  const effects = useRef<EffectConfig>(getStoredEffects());
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState('Đang tải ảnh xem trước…');
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);

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

  useEffect(() => {
    if (!bitmap || props.exporting) return;
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const paint = createLiveFramePainter(bitmap);
    let frame = 0, previous = 0, elapsed = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - previous < 1000 / 30) return;
      if (playing && previous && !document.hidden) elapsed += Math.min((now - previous) / 1000, .1);
      previous = now;
      if (document.hidden) return;
      const p = current.current;
      const size = VIDEO_SIZES[p.aspect];
      const surface = context.canvas;
      // Keep the renderer's coordinates while drawing a smaller preview surface.
      const scale = Math.min(1, 640 / Math.max(size.width, size.height));
      const width = Math.round(size.width * scale), height = Math.round(size.height * scale);
      if (surface.width !== width || surface.height !== height) { surface.width = width; surface.height = height; }
      context.setTransform(scale, 0, 0, scale, 0, 0);
      const time = p.start + elapsed % 10;
      paint(context, p.song, size.width, size.height, time, p.template, p.wave, p.motion, p.lyrics);
      drawVideoEffects(context, size.width, size.height, time, effects.current);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bitmap, playing, props.exporting]);

  const size = VIDEO_SIZES[props.aspect];
  return <div className="mb-4 rounded-xl border border-cyan-300/20 bg-black/30 p-3">
    <div className="mb-3 flex items-center justify-between gap-2">
      <b className="text-sm text-cyan-100">Xem trước trực tiếp</b>
      <button type="button" disabled={!!status || props.exporting} onClick={() => setPlaying(value => !value)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-40">{playing ? 'Tạm dừng' : 'Tiếp tục'}</button>
    </div>
    <div className="flex justify-center overflow-hidden rounded-lg bg-black">
      <canvas ref={canvas} role="img" aria-label="Xem trước mẫu video và hiệu ứng đã chọn" style={{aspectRatio: `${size.width}/${size.height}`, width: `min(100%, ${340 * size.width / size.height}px)`, maxHeight: 340}} />
    </div>
    {status && <p role="status" className="mt-2 text-xs text-amber-200">{status}</p>}
    <p className="mt-2 text-[11px] leading-5 text-white/45">{props.exporting ? 'Tạm dừng xem trước trong khi xuất video.' : 'Hiệu ứng cập nhật ngay khi chọn. Sóng nhạc đang mô phỏng, chưa đồng bộ âm thanh.'}</p>
  </div>;
}
