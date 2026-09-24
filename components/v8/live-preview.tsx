'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import {
  createLiveFramePainter,
  type OverlayLayout,
  type OverlayTextStyles,
  type PreviewAudioAnalysis,
} from '../v4/renderer-safe';
import {
  VIDEO_SIZES,
  type Song,
  type VideoAspect,
  type VisualTemplate,
  type WaveStyle,
  type MotionIntensity,
  type LyricsMode,
} from '../v4/types';
import { getStoredEffects } from './effects-panel';
import { drawVideoEffects, type EffectConfig } from './video-effects';
import {
  drawKaraokeOverlay,
  type KaraokeLine,
  type KaraokeDrawStyle,
} from '@/app/lib/karaoke';
import {
  DEFAULT_BACKGROUND_CONFIG,
  applyBackgroundFinish,
  drawMediaBackground,
  drawPresetBackground,
  type BackgroundConfig,
} from './background';
import type { MediaClip } from '@/components/editor-timeline';

type Props = {
  song: Song;
  aspect: VideoAspect;
  template: VisualTemplate;
  wave: WaveStyle;
  motion: MotionIntensity;
  lyrics: LyricsMode;
  karaokeTimeline?: KaraokeLine[];
  background?: BackgroundConfig;
  mediaClips?: MediaClip[];
  layout?: OverlayLayout;
  subtitleStyle?: KaraokeDrawStyle;
  overlayTextStyles?: OverlayTextStyles;
  effects?: EffectConfig;
  onLayoutChange?: (layout: OverlayLayout) => void;
  start: number;
  exporting: boolean;
  resultUrl?: string;
  autoPlay?: boolean;
  fullPlayback?: boolean;
  onTimeChange?: (time: number) => void;
};

function fmt(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function LivePreview(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const current = useRef(props);
  current.current = props;
  const effects = useRef<EffectConfig>(getStoredEffects());
  const [playing, setPlaying] = useState(false);
  const [selectedOverlay, setSelectedOverlay] = useState<
    'wave' | 'subtitle' | 'title' | 'creator' | null
  >(null);
  const [time, setTime] = useState(props.start);
  const [status, setStatus] = useState('Đang tải ảnh xem trước…');
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [backgroundBitmap, setBackgroundBitmap] = useState<ImageBitmap | null>(
    null,
  );
  const backgroundVideo = useRef<HTMLVideoElement | null>(null);
  const lastTimeNotify = useRef(0);
  const audioAnalysis = useRef<PreviewAudioAnalysis | null>(null);
  const [audioAnalysisVersion, setAudioAnalysisVersion] = useState(0);
  const sceneMedia = useRef(
    new Map<string, { bitmap?: ImageBitmap; video?: HTMLVideoElement }>(),
  );
  const [sceneVersion, setSceneVersion] = useState(0);
  const mediaSourceKey = (props.mediaClips || [])
    .map((clip) => `${clip.id}:${clip.type}:${clip.url}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    const loaded = new Map<
      string,
      { bitmap?: ImageBitmap; video?: HTMLVideoElement }
    >();
    void Promise.all(
      (props.mediaClips || []).map(async (clip) => {
        if (clip.type === 'image') {
          const bitmap = await createImageBitmap(
            await (await fetch(clip.url)).blob(),
          );
          loaded.set(clip.id, { bitmap });
        } else {
          const video = document.createElement('video');
          video.src = clip.url;
          video.muted = true;
          video.playsInline = true;
          video.preload = 'auto';
          await new Promise<void>((resolve, reject) => {
            video.addEventListener('loadeddata', () => resolve(), {
              once: true,
            });
            video.addEventListener(
              'error',
              () => reject(new Error('Không đọc được video trong timeline.')),
              { once: true },
            );
            video.load();
          });
          loaded.set(clip.id, { video });
        }
      }),
    )
      .then(() => {
        if (cancelled) return;
        sceneMedia.current.forEach(({ video }) => {
          if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
          }
        });
        sceneMedia.current = loaded;
        setSceneVersion((value) => value + 1);
      })
      .catch(
        (error) =>
          !cancelled &&
          setStatus(
            error instanceof Error
              ? error.message
              : 'Không đọc được media timeline.',
          ),
      );
    return () => {
      cancelled = true;
      if (sceneMedia.current === loaded) sceneMedia.current = new Map();
      loaded.forEach(({ video }) => {
        if (video) {
          video.pause();
          video.removeAttribute('src');
          video.load();
        }
      });
    };
  }, [mediaSourceKey]);

  const previewEnd = props.fullPlayback
    ? props.song.duration || props.start + 10
    : Math.min(props.song.duration || props.start + 10, props.start + 10);
  const previewDuration = Math.max(0.1, previewEnd - props.start);

  useEffect(() => {
    const update = (event: Event) => {
      effects.current = (event as CustomEvent<EffectConfig>).detail;
    };
    window.addEventListener('suno-effects-change', update);
    return () => window.removeEventListener('suno-effects-change', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    audioAnalysis.current = null;
    setAudioAnalysisVersion((value) => value + 1);
    (async () => {
      try {
        const response = await fetch(props.song.audio, { cache: 'no-store' });
        if (!response.ok) return;
        const context = new AudioContext();
        try {
          const decoded = await context.decodeAudioData(
            await response.arrayBuffer(),
          );
          if (cancelled) return;
          const channel = decoded.getChannelData(0);
          const samples = new Float32Array(channel.length);
          samples.set(channel);
          audioAnalysis.current = {
            samples,
            rate: decoded.sampleRate,
          };
          setAudioAnalysisVersion((value) => value + 1);
        } finally {
          await context.close();
        }
      } catch {
        if (!cancelled) {
          audioAnalysis.current = null;
          setAudioAnalysisVersion((value) => value + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
      audioAnalysis.current = null;
    };
  }, [props.song.audio]);

  useEffect(() => {
    const controller = new AbortController();
    let image: ImageBitmap | null = null;
    setBitmap(null);
    setStatus('Đang tải ảnh xem trước…');
    (async () => {
      try {
        if (!props.song.picture)
          throw new Error('Bài hát chưa có ảnh bìa để xem trước.');
        const response = await fetch(props.song.picture, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            'Không tải được ảnh xem trước. Hãy tải lại thông tin bài hát.',
          );
        image = await createImageBitmap(await response.blob());
        if (controller.signal.aborted) {
          return;
        }
        setBitmap(image);
        setStatus('');
      } catch (error) {
        if (!controller.signal.aborted)
          setStatus(
            error instanceof Error
              ? error.message
              : 'Không tải được ảnh xem trước.',
          );
      }
    })();
    return () => {
      controller.abort();
    };
  }, [props.song.picture]);

  useEffect(() => {
    const config = props.background || DEFAULT_BACKGROUND_CONFIG;
    let cancelled = false,
      createdBitmap: ImageBitmap | null = null,
      createdVideo: HTMLVideoElement | null = null;
    setBackgroundBitmap(null);
    if (backgroundVideo.current) {
      backgroundVideo.current.pause();
      backgroundVideo.current.removeAttribute('src');
      backgroundVideo.current.load();
      backgroundVideo.current = null;
    }
    (async () => {
      try {
        if (config.mode === 'image' && config.imageUrl) {
          const response = await fetch(config.imageUrl);
          if (!response.ok) throw new Error('Không tải được ảnh nền.');
          createdBitmap = await createImageBitmap(await response.blob());
          if (cancelled) {
            return;
          }
          setBackgroundBitmap(createdBitmap);
        } else if (config.mode === 'video' && config.videoUrl) {
          const v = document.createElement('video');
          createdVideo = v;
          v.src = config.videoUrl;
          v.muted = true;
          v.playsInline = true;
          v.preload = 'auto';
          await new Promise<void>((resolve, reject) => {
            const ok = () => {
                cleanup();
                resolve();
              },
              bad = () => {
                cleanup();
                reject(new Error('Trình duyệt không đọc được video này.'));
              },
              cleanup = () => {
                v.removeEventListener('loadeddata', ok);
                v.removeEventListener('error', bad);
              };
            v.addEventListener('loadeddata', ok, { once: true });
            v.addEventListener('error', bad, { once: true });
            v.load();
          });
          if (cancelled) {
            v.removeAttribute('src');
            v.load();
            return;
          }
          backgroundVideo.current = v;
        }
      } catch (error) {
        if (!cancelled)
          setStatus(
            error instanceof Error
              ? error.message
              : 'Không tải được background.',
          );
      }
    })();
    return () => {
      cancelled = true;
      if (createdVideo) {
        createdVideo.pause();
        createdVideo.removeAttribute('src');
        createdVideo.load();
      }
      if (backgroundVideo.current === createdVideo)
        backgroundVideo.current = null;
    };
  }, [
    props.background?.mode,
    props.background?.presetId,
    props.background?.imageUrl,
    props.background?.videoUrl,
  ]);

  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    player.pause();
    player.currentTime = props.start;
    setTime(props.start);
    setPlaying(false);
  }, [props.song.audio, props.start, props.resultUrl]);

  useEffect(() => {
    if (!props.autoPlay || !bitmap || props.exporting || props.resultUrl)
      return;
    const player = audio.current;
    if (!player) return;
    player.currentTime = props.start;
    void player
      .play()
      .then(() => setPlaying(true))
      .catch(() => undefined);
  }, [
    props.autoPlay,
    bitmap,
    props.song.audio,
    props.start,
    props.exporting,
    props.resultUrl,
  ]);

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
      const end = p.fullPlayback
        ? p.song.duration || p.start + 10
        : Math.min(p.song.duration || p.start + 10, p.start + 10);

      if (player && !player.paused && absoluteTime >= end - 0.02) {
        player.currentTime = p.start;
        absoluteTime = p.start;
        void player.play().catch(() => undefined);
      }

      setTime(absoluteTime);
      if (now - lastTimeNotify.current > 90) {
        lastTimeNotify.current = now;
        p.onTimeChange?.(absoluteTime);
      }
      const size = VIDEO_SIZES[p.aspect];
      const surface = context.canvas;
      const scale = Math.min(1, 640 / Math.max(size.width, size.height));
      const width = Math.round(size.width * scale),
        height = Math.round(size.height * scale);
      if (surface.width !== width || surface.height !== height) {
        surface.width = width;
        surface.height = height;
      }

      context.setTransform(scale, 0, 0, scale, 0, 0);
      const hasExactLyrics = p.lyrics !== 'off' && !!p.karaokeTimeline?.length;
      const background = p.background || DEFAULT_BACKGROUND_CONFIG,
        activeClip = p.mediaClips?.find(
          (clip) => absoluteTime >= clip.start && absoluteTime < clip.end,
        ),
        activeMedia = activeClip
          ? sceneMedia.current.get(activeClip.id)
          : undefined,
        customBackground = Boolean(activeMedia) || background.mode !== 'suno';
      if (activeMedia?.bitmap?.width) {
        drawMediaBackground(
          context,
          activeMedia.bitmap,
          activeMedia.bitmap.width,
          activeMedia.bitmap.height,
          size.width,
          size.height,
          background,
        );
      } else if (activeMedia?.video && activeClip) {
        const v = activeMedia.video,
          duration = v.duration || 1,
          target = (absoluteTime - activeClip.start) % duration;
        if (Math.abs(v.currentTime - target) > 0.1)
          try {
            v.currentTime = target;
          } catch {}
        if (v.readyState >= 2)
          drawMediaBackground(
            context,
            v,
            v.videoWidth,
            v.videoHeight,
            size.width,
            size.height,
            background,
          );
      } else if (background.mode === 'preset') {
        drawPresetBackground(
          context,
          background.presetId,
          size.width,
          size.height,
          absoluteTime,
        );
        applyBackgroundFinish(context, size.width, size.height, background);
      } else if (background.mode === 'image' && backgroundBitmap?.width) {
        drawMediaBackground(
          context,
          backgroundBitmap,
          backgroundBitmap.width,
          backgroundBitmap.height,
          size.width,
          size.height,
          background,
        );
        applyBackgroundFinish(context, size.width, size.height, background);
      } else if (
        background.mode === 'video' &&
        backgroundVideo.current &&
        Number.isFinite(backgroundVideo.current.duration)
      ) {
        const v = backgroundVideo.current,
          d = v.duration,
          target =
            background.loopVideo && d > 0
              ? absoluteTime % d
              : Math.min(absoluteTime, Math.max(0, d - 0.02));
        if (Math.abs(v.currentTime - target) > 0.12)
          try {
            v.currentTime = target;
          } catch {}
        if (v.readyState >= 2) {
          drawMediaBackground(
            context,
            v,
            v.videoWidth,
            v.videoHeight,
            size.width,
            size.height,
            background,
          );
          applyBackgroundFinish(context, size.width, size.height, background);
        }
      }
      if (!bitmap.width) return;
      paint(
        context,
        p.song,
        size.width,
        size.height,
        absoluteTime,
        p.template,
        p.wave,
        p.motion,
        hasExactLyrics ? 'off' : p.lyrics,
        customBackground,
        p.layout,
        p.overlayTextStyles,
        audioAnalysis.current,
      );
      if (hasExactLyrics) {
        const q = p.layout?.subtitle || { x: 50, y: 58, scale: 100 },
          s = q.scale / 100;
        context.save();
        context.translate((size.width * q.x) / 100, (size.height * q.y) / 100);
        context.scale(s, s);
        context.translate(-size.width * 0.5, -(size.height - 119));
        drawKaraokeOverlay(
          context,
          p.karaokeTimeline!,
          absoluteTime,
          size.width,
          size.height,
          p.subtitleStyle,
        );
        context.restore();
      }
      drawVideoEffects(
        context,
        size.width,
        size.height,
        absoluteTime,
        p.effects || effects.current,
      );
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [
    bitmap,
    backgroundBitmap,
    props.background,
    props.aspect,
    props.template,
    props.wave,
    props.motion,
    props.lyrics,
    props.mediaClips,
    sceneVersion,
    props.karaokeTimeline,
    props.layout,
    props.subtitleStyle,
    props.overlayTextStyles,
    props.effects,
    audioAnalysisVersion,
    props.exporting,
    props.resultUrl,
  ]);

  async function togglePlayback() {
    const player = audio.current;
    if (!player || props.exporting || props.resultUrl) return;
    if (player.paused) {
      if (player.currentTime < props.start || player.currentTime >= previewEnd)
        player.currentTime = props.start;
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

  function seekPreview(value: number) {
    const player = audio.current;
    if (!player) return;
    const next = Math.max(props.start, Math.min(previewEnd, value));
    player.currentTime = next;
    setTime(next);
  }

  const size = VIDEO_SIZES[props.aspect];
  const relative = Math.max(0, Math.min(previewDuration, time - props.start));

  return (
    <div className="mb-4 rounded-xl border border-cyan-300/20 bg-black/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <b className="text-sm text-cyan-100">
            {props.resultUrl ? 'Video đã xuất' : 'Xem trước trực tiếp'}
          </b>
          <p className="mt-0.5 text-[10px] text-white/35">
            {props.resultUrl
              ? 'Kết quả thay trực tiếp khung preview.'
              : 'Hình ảnh, lyrics và nhạc chạy cùng một timeline.'}
          </p>
        </div>
        {!props.resultUrl && (
          <button
            type="button"
            disabled={props.exporting}
            onClick={() => void togglePlayback()}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-40"
          >
            {playing ? 'Tạm dừng' : 'Phát preview'}
          </button>
        )}
      </div>

      <div className="flex justify-center overflow-hidden rounded-lg bg-black">
        {props.resultUrl ? (
          <video
            ref={video}
            src={props.resultUrl}
            controls
            playsInline
            autoPlay
            className="max-h-[70vh] w-full rounded-lg bg-black"
          />
        ) : (
          <div
            className="sd-preview-click relative"
            role="button"
            tabIndex={0}
            aria-label={playing ? 'Tạm dừng video' : 'Phát video'}
            onClick={() => void togglePlayback()}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                void togglePlayback();
              }
            }}
            style={{
              aspectRatio: `${size.width}/${size.height}`,
              width: `min(100%, ${(340 * size.width) / size.height}px)`,
              maxHeight: 340,
            }}
          >
            <canvas
              ref={canvas}
              role="img"
              aria-label="Xem trước video đồng bộ cùng âm thanh"
              className="h-full w-full"
              onPointerDown={() => setSelectedOverlay(null)}
            />
            {props.layout &&
              props.onLayoutChange &&
              (['wave', 'subtitle', 'title', 'creator'] as const).map((key) => {
                if (key === 'subtitle' && props.lyrics === 'off') return null;
                const p =
                    props.layout?.[key] ||
                    (key === 'title'
                      ? { x: 50, y: 67, scale: 100 }
                      : key === 'creator'
                        ? { x: 50, y: 75, scale: 100 }
                        : key === 'subtitle'
                          ? { x: 50, y: 70, scale: 100 }
                          : { x: 50, y: 82, scale: 100 }),
                  isWave = key === 'wave',
                  isText = key === 'title' || key === 'creator',
                  ww = isWave
                    ? Math.max(24, (64 * p.scale) / 100)
                    : isText
                      ? Math.max(
                          24,
                          ((key === 'title' ? 52 : 34) * p.scale) / 100,
                        )
                      : Math.max(34, (72 * p.scale) / 100),
                  hh = isWave
                    ? Math.max(8, (18 * p.scale) / 100)
                    : isText
                      ? Math.max(
                          7,
                          ((key === 'title' ? 13 : 9) * p.scale) / 100,
                        )
                      : Math.max(10, (18 * p.scale) / 100);
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-label={`Kéo trực tiếp ${key}`}
                    title={`Nắm trực tiếp ${key} để kéo`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedOverlay(key);
                      const el = e.currentTarget,
                        box = el.parentElement!.getBoundingClientRect(),
                        startX = e.clientX,
                        startY = e.clientY,
                        origin = { ...p };
                      el.setPointerCapture(e.pointerId);
                      const move = (ev: PointerEvent) => {
                        const x = Math.max(
                            0,
                            Math.min(
                              100,
                              origin.x +
                                ((ev.clientX - startX) / box.width) * 100,
                            ),
                          ),
                          y = Math.max(
                            0,
                            Math.min(
                              100,
                              origin.y +
                                ((ev.clientY - startY) / box.height) * 100,
                            ),
                          );
                        props.onLayoutChange?.({
                          ...props.layout!,
                          [key]: { ...origin, x, y },
                        });
                      };
                      const up = () => {
                        window.removeEventListener('pointermove', move);
                        window.removeEventListener('pointerup', up);
                      };
                      window.addEventListener('pointermove', move);
                      window.addEventListener('pointerup', up, { once: true });
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="absolute z-20 -translate-x-1/2 cursor-grab active:cursor-grabbing"
                    style={{
                      left: `${p.x}%`,
                      top: `calc(${p.y}% - ${hh / 2}%)`,
                      width: `${ww}%`,
                      height: `${hh}%`,
                      touchAction: 'none',
                    }}
                  >
                    <span
                      className={`pointer-events-none absolute inset-0 rounded-md border transition-colors ${selectedOverlay === key ? 'border-violet-400 bg-violet-400/[.06]' : 'border-transparent'}`}
                    />
                    <i
                      className={`sd-overlay-resize ${selectedOverlay === key ? 'show' : ''}`}
                      title="Kéo để thay đổi kích thước"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedOverlay(key);
                        const startX = event.clientX,
                          startY = event.clientY,
                          startScale = p.scale;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        const move = (e: PointerEvent) => {
                          const delta =
                            (e.clientX - startX + e.clientY - startY) * 0.75;
                          props.onLayoutChange?.({
                            ...props.layout!,
                            [key]: {
                              ...p,
                              scale: Math.max(
                                40,
                                Math.min(220, startScale + delta),
                              ),
                            },
                          });
                        };
                        const up = () => {
                          window.removeEventListener('pointermove', move);
                          window.removeEventListener('pointerup', up);
                        };
                        window.addEventListener('pointermove', move);
                        window.addEventListener('pointerup', up, {
                          once: true,
                        });
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                );
              })}
            <button
              type="button"
              className={`sd-center-play ${playing ? 'playing' : ''}`}
              aria-label={playing ? 'Tạm dừng' : 'Phát'}
              onClick={(event) => {
                event.stopPropagation();
                void togglePlayback();
              }}
            >
              {playing ? <Pause /> : <Play />}
            </button>
          </div>
        )}
      </div>

      {!props.resultUrl && (
        <>
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
            <button
              type="button"
              disabled={props.exporting}
              onClick={() => void togglePlayback()}
              className="rounded-lg bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40"
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              min={props.start}
              max={previewEnd}
              step=".01"
              value={Math.min(previewEnd, Math.max(props.start, time))}
              onChange={(event) => seekPreview(Number(event.target.value))}
              onInput={(event) =>
                seekPreview(Number(event.currentTarget.value))
              }
              className="w-full accent-cyan-300"
              aria-label="Timeline preview có âm thanh"
            />
            <span className="min-w-[70px] text-right font-mono text-[10px] text-white/45">
              {fmt(relative)} / {fmt(previewDuration)}
            </span>
          </div>
        </>
      )}

      {status && !props.resultUrl && (
        <p role="status" className="mt-2 text-xs text-amber-200">
          {status}
        </p>
      )}
      {!props.resultUrl && (
        <p className="mt-2 text-[11px] leading-5 text-white/45">
          {props.exporting
            ? 'Preview đã dừng trong lúc xuất video.'
            : 'Preview dùng audio thật làm clock. Nắm trực tiếp sóng hoặc subtitle trên video để kéo tới vị trí mong muốn.'}
        </p>
      )}
    </div>
  );
}
