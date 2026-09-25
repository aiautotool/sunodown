'use client';

import type {
  LyricsMode,
  MotionIntensity,
  Song,
  VideoAspect,
  VisualTemplate,
  WaveStyle,
  WaveAppearance,
} from './types';
import { VIDEO_SIZES, DEFAULT_WAVE_APPEARANCE } from './types';
import { cleanLyricsForVideo } from './lyrics-clean';
import {
  convertProcessedAudio,
  renderTikTokLikeAudio,
} from '@/app/lib/audio-processing';
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
  seekVideoFrame,
  type BackgroundConfig,
} from '@/components/v8/background';
import type { MediaClip } from '@/components/editor-timeline';
import { drawVideoEffects, type EffectConfig } from '@/components/v8/video-effects';

const MOTION_GAIN: Record<MotionIntensity, number> = {
  low: 0.45,
  medium: 1,
  high: 1.75,
};
type Palette = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];
export type OverlayLayout = {
  wave: { x: number; y: number; scale: number };
  subtitle: { x: number; y: number; scale: number };
  title: { x: number; y: number; scale: number };
  creator: { x: number; y: number; scale: number };
};
export type OverlayTextStyles = {
  title: { font: string; color: string };
  creator: { font: string; color: string };
};
export type PreviewAudioAnalysis = {
  samples: Float32Array;
  rate: number;
};
export type RealtimeSpectrumBands = { bass:number; lowMid:number; vocal:number; high:number };
export type SafeRenderOptions = {
  motion: MotionIntensity;
  lyrics: LyricsMode;
  layout?: OverlayLayout;
  subtitleStyle?: KaraokeDrawStyle;
  overlayTextStyles?: OverlayTextStyles;
  karaokeTimeline?: KaraokeLine[];
  background?: BackgroundConfig;
  mediaClips?: MediaClip[];
  effects?: EffectConfig;
  waveAppearance?: WaveAppearance;
  loopDuration?: number;
  startSeconds?: number;
  previewSeconds?: number;
  onProgress?: (value: number) => void;
};

type AudioTrim = { start: number; end: number; duration: number };
function storedAudioTrim(fullDuration: number): AudioTrim | null {
  try {
    const v = JSON.parse(localStorage.getItem('suno-v10-audio-trim') || 'null');
    if (!v) return null;
    const start = Math.max(0, Math.min(fullDuration, Number(v.start) || 0)),
      end = Math.max(
        start + 0.05,
        Math.min(fullDuration, Number(v.end) || fullDuration),
      );
    if (start < 0.01 && end >= fullDuration - 0.01) return null;
    return { start, end, duration: fullDuration };
  } catch {
    return null;
  }
}
function clamp(v: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}
function rgb(c: [number, number, number], a = 1) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
function coverFit(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  w: number,
  h: number,
  scaleExtra = 1,
  dx = 0,
  dy = 0,
) {
  const s = Math.min(w / bmp.width, h / bmp.height) * scaleExtra,
    iw = bmp.width * s,
    ih = bmp.height * s;
  ctx.drawImage(bmp, (w - iw) / 2 + dx, (h - ih) / 2 + dy, iw, ih);
}
function coverFill(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  w: number,
  h: number,
  alpha = 0.34,
  blur = 30,
  scaleExtra = 1,
  dx = 0,
  dy = 0,
) {
  const s = Math.max(w / bmp.width, h / bmp.height) * scaleExtra,
    iw = bmp.width * s,
    ih = bmp.height * s;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(bmp, (w - iw) / 2 + dx, (h - ih) / 2 + dy, iw, ih);
  ctx.restore();
}
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines = 2,
) {
  const words = text.trim().split(/\s+/).filter(Boolean),
    lines: string[] = [];
  let line = '';
  for (const word of words) {
    const n = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(n).width <= maxW) line = n;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}
function amplitude(samples: Float32Array | null, rate: number, t: number) {
  if (!samples || !rate) return 0.06;
  const c = Math.max(0, Math.min(samples.length - 1, Math.floor(t * rate)));
  const r = Math.max(128, Math.floor(rate * 0.022));
  const from = Math.max(0, c - r), to = Math.min(samples.length, c + r);
  const stride = Math.max(1, Math.floor((to - from) / 96));
  let energy = 0, peak = 0, n = 0;
  for (let i = from; i < to; i += stride) { const v = Math.abs(samples[i]); energy += v * v; peak = Math.max(peak, v); n++; }
  if (!n) return 0.04;
  return Math.min(1, Math.max(0.035, Math.sqrt(energy / n) * 6.6 + peak * 0.22));
}
type SpectrumBands={bass:number;lowMid:number;vocal:number;high:number};
function spectrumBands(samples:Float32Array|null,rate:number,t:number):SpectrumBands{
 if(!samples||!rate)return{bass:.035,lowMid:.035,vocal:.035,high:.035};
 const N=256,center=Math.max(N/2,Math.min(samples.length-N/2-1,Math.floor(t*rate))),start=Math.floor(center-N/2);
 let bass=0,lowMid=0,vocal=0,high=0,bc=0,lc=0,vc=0,hc=0;
 // Small DFT focused on the visual bands. Hann window prevents one transient leaking across every column.
 for(let k=1;k<N/2;k++){const hz=k*rate/N;if(hz>12000)break;let re=0,im=0;
  for(let n=0;n<N;n++){const idx=start+n;if(idx<0||idx>=samples.length)continue;const win=.5-.5*Math.cos(2*Math.PI*n/(N-1)),v=samples[idx]*win,a=2*Math.PI*k*n/N;re+=v*Math.cos(a);im-=v*Math.sin(a)}
  const mag=Math.sqrt(re*re+im*im)/N;
  if(hz<180){bass+=mag;bc++}else if(hz<800){lowMid+=mag;lc++}else if(hz<4000){vocal+=mag;vc++}else{high+=mag;hc++}
 }
 const norm=(v:number,n:number,g:number)=>Math.min(1,Math.max(.025,(n?v/n:0)*g));
 return{bass:norm(bass,bc,28),lowMid:norm(lowMid,lc,42),vocal:norm(vocal,vc,62),high:norm(high,hc,95)};
}
function realtimeSpectrumValue(b:RealtimeSpectrumBands,column:number,total:number){const x=column/Math.max(1,total-1),c=[0,.31,.61,1],v=[b.bass,b.lowMid,b.vocal,b.high];let j=0;while(j<2&&x>c[j+1])j++;const q=(x-c[j])/(c[j+1]-c[j]);return Math.min(1,Math.max(.035,(v[j]*(1-q)+v[j+1]*q)*1.9));}
function spectrumValue(samples:Float32Array|null,rate:number,t:number,column:number,total:number){
 const b=spectrumBands(samples,rate,t),x=column/Math.max(1,total-1);
 // Left→right maps low→high frequency while softly blending neighboring musical bands.
 const centers=[0,.31,.61,1],vals=[b.bass,b.lowMid,b.vocal,b.high];
 let j=0;while(j<centers.length-2&&x>centers[j+1])j++;
 const q=(x-centers[j])/(centers[j+1]-centers[j]),v=vals[j]*(1-q)+vals[j+1]*q;
 return Math.min(1,Math.max(.035,v*2.35));
}
function extractPalette(bmp: ImageBitmap): Palette {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x)
    return [
      [103, 232, 249],
      [167, 139, 250],
      [232, 121, 249],
    ];
  x.drawImage(bmp, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < d.length; i += 16) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < 25 || lum > 235) continue;
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
    n++;
  }
  if (!n)
    return [
      [103, 232, 249],
      [167, 139, 250],
      [232, 121, 249],
    ];
  const base: [number, number, number] = [r / n, g / n, b / n].map((v) =>
    Math.round(v),
  ) as [number, number, number];
  return [
    base,
    [clamp(base[0] + 55), clamp(base[1] + 40), clamp(base[2] + 65)],
    [clamp(base[2] + 35), clamp(base[0] + 20), clamp(base[1] + 45)],
  ] as Palette;
}
function titleTypography(template: VisualTemplate, fs: number) {
  if (template === 'vinyl')
    return {
      font: `italic 700 ${Math.round(fs * 1.05)}px Georgia, 'Times New Roman', serif`,
      spacing: 1.4,
      stroke: 1.1,
    };
  if (template === 'glass-card')
    return {
      font: `800 ${Math.round(fs * 0.98)}px 'Trebuchet MS', Arial, sans-serif`,
      spacing: 2.2,
      stroke: 0.8,
    };
  if (template === 'lyrics-focus')
    return {
      font: `italic 700 ${Math.round(fs * 1.02)}px Georgia, 'Times New Roman', serif`,
      spacing: 0.7,
      stroke: 0.7,
    };
  return {
    font: `700 ${Math.round(fs * 1.08)}px Georgia, 'Times New Roman', serif`,
    spacing: 1,
    stroke: 1,
  };
}
function drawLetterSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'center' | 'left',
) {
  if (spacing <= 0) {
    ctx.fillText(text, x, y);
    return;
  }
  const chars = Array.from(text),
    widths = chars.map((c) => ctx.measureText(c).width),
    total =
      widths.reduce((a, b) => a + b, 0) +
      spacing * Math.max(0, chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : x;
  const old = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = old;
}
function drawMeta(
  ctx: CanvasRenderingContext2D,
  song: Song,
  w: number,
  y: number,
  align: 'center' | 'left' = 'center',
  max = 0.76,
  template: VisualTemplate = 'cover-motion',
  p?: Palette,
  h = w,
  layout?: OverlayLayout,
  textStyles?: OverlayTextStyles,
) {
  if (song.title === '__HIDE_META__') return;
  ctx.save();
  const fs = Math.max(26, Math.min(54, Math.round(w * 0.039))),
    art = titleTypography(template, fs);
  ctx.font = textStyles?.title.font
    ? `700 ${fs}px ${textStyles.title.font}`
    : art.font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textStyles?.title.color || 'rgba(255,255,255,.98)';
  ctx.strokeStyle = 'rgba(0,0,0,.28)';
  ctx.lineWidth = art.stroke;
  ctx.shadowColor =
    template === 'glass-card' && p ? rgb(p[1], 0.6) : 'rgba(0,0,0,.7)';
  ctx.shadowBlur = template === 'glass-card' ? 24 : 18;
  const titlePos = layout?.title || { x: 50, y: 67, scale: 100 },
    creatorPos = layout?.creator || { x: 50, y: 75, scale: 100 };
  const lines = wrap(ctx, song.title || 'Suno Track', w * max, 2),
    lh = fs * 1.22,
    x = (w * titlePos.x) / 100,
    titleY = (h * titlePos.y) / 100,
    titleScale = titlePos.scale / 100;
  ctx.save();
  ctx.translate(x, titleY);
  ctx.scale(titleScale, titleScale);
  lines.forEach((l, i) => {
    ctx.strokeText(l, 0, i * lh);
    drawLetterSpaced(ctx, l, 0, i * lh, art.spacing, align);
  });
  ctx.restore();
  if (song.creator) {
    ctx.shadowBlur = 7;
    ctx.font = `600 ${Math.max(15, Math.round(fs * 0.4))}px ${textStyles?.creator.font || "system-ui,-apple-system,'Segoe UI',sans-serif"}`;
    ctx.fillStyle = textStyles?.creator.color || 'rgba(255,255,255,.7)';
    ctx.textAlign = align;
    ctx.save();
    ctx.translate((w * creatorPos.x) / 100, (h * creatorPos.y) / 100);
    ctx.scale(creatorPos.scale / 100, creatorPos.scale / 100);
    ctx.fillText(song.creator.toUpperCase(), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
function lyricLines(song: Song) {
  return cleanLyricsForVideo(song.lyrics)
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function drawLyrics(
  ctx: CanvasRenderingContext2D,
  song: Song,
  w: number,
  h: number,
  absoluteT: number,
  fullDuration: number,
  mode: LyricsMode,
) {
  if (mode === 'off' || !song.lyrics) return;
  const lines = lyricLines(song);
  if (!lines.length) return;
  const idx = Math.min(
    lines.length - 1,
    Math.floor((absoluteT / Math.max(1, fullDuration)) * lines.length),
  );
  ctx.save();
  const fs = Math.max(22, Math.min(44, Math.round(w * 0.031)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fs}px system-ui,-apple-system,sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = 16;
  if (mode === 'focus') {
    const current = lines[idx],
      y = h * 0.58,
      boxW = w * 0.82;
    ctx.fillStyle = 'rgba(5,5,16,.48)';
    ctx.beginPath();
    ctx.roundRect(w * 0.09, y - fs * 1.4, boxW, fs * 2.8, 18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    wrap(ctx, current, boxW * 0.9, 2).forEach((l, i, a) =>
      ctx.fillText(l, w / 2, y + (i - (a.length - 1) / 2) * fs * 1.16),
    );
  } else {
    const rows = [
        lines[Math.max(0, idx - 1)],
        lines[idx],
        lines[Math.min(lines.length - 1, idx + 1)],
      ],
      ys = [h * 0.48, h * 0.57, h * 0.66];
    rows.forEach((l, i) => {
      ctx.globalAlpha = i === 1 ? 1 : 0.35;
      ctx.fillStyle = 'white';
      ctx.fillText(l, w / 2, ys[i], w * 0.78);
    });
  }
  ctx.restore();
}
function waveGradient(ctx: CanvasRenderingContext2D, w: number, p: Palette) {
  const g = ctx.createLinearGradient(w * 0.08, 0, w * 0.92, 0);
  g.addColorStop(0, rgb(p[0]));
  g.addColorStop(0.5, rgb(p[1]));
  g.addColorStop(1, rgb(p[2]));
  return g;
}
function drawWaveBase(
  ctx: CanvasRenderingContext2D,
  samples: Float32Array | null,
  rate: number,
  t: number,
  w: number,
  h: number,
  style: WaveStyle,
  p: Palette,
  realtimeBands?: RealtimeSpectrumBands,
  appearance?: WaveAppearance,
) {
  const look={...DEFAULT_WAVE_APPEARANCE,...appearance};
  const ph = Math.max(110, Math.round(h * 0.14)),
    top = h - ph,
    n = Math.max(34, Math.min(120, Math.round(34 + look.density * 0.86))),
    usable = w * 0.84,
    start = w * 0.08,
    cy = h - ph * 0.42,
    max = ph * 0.52,
    rawVals = Array.from({ length: n }, (_, i) => realtimeBands ? realtimeSpectrumValue(realtimeBands,i,n) : spectrumValue(samples, rate, t, i, n)),
    smooth = Math.max(0,Math.min(1,look.smoothing/100)),
    rawMin=Math.min(...rawVals),rawMax=Math.max(...rawVals),rawSpan=Math.max(.0001,rawMax-rawMin),
    currentBands=samples&&rate?spectrumBands(samples,rate,t):null,
    previousBands=samples&&rate?spectrumBands(samples,rate,Math.max(0,t-.09)):null,
    spectralFlux=currentBands&&previousBands?Math.max(0,
      (currentBands.bass-previousBands.bass)*1.7+
      (currentBands.lowMid-previousBands.lowMid)*1.2+
      (currentBands.vocal-previousBands.vocal)*.9+
      (currentBands.high-previousBands.high)*.65):0,
    avgEnergy=rawVals.reduce((sum,v)=>sum+v,0)/Math.max(1,rawVals.length),
    flatness=Math.max(0,Math.min(1,(.22-rawSpan)/.22)),
    adaptiveVals=rawVals.map((v,i)=>{
      const normalized=(v-rawMin)/rawSpan;
      const shaped=.055+Math.pow(Math.max(.001,v),.72)*.72+normalized*(.18+flatness*.16);
      const transient=Math.min(.28,spectralFlux*3.8)*(0.45+0.55*Math.sin((i/n)*Math.PI));
      const living=flatness*(.035+.085*Math.min(1,avgEnergy*1.6))*(.5+.5*Math.sin(t*(5.2+avgEnergy*4.4)+i*.52));
      return Math.max(.04,Math.min(1,shaped+transient+living));
    }),
    vals = adaptiveVals.map((v,i)=>{const a=adaptiveVals[Math.max(0,i-1)],b=adaptiveVals[Math.min(adaptiveVals.length-1,i+1)];return v*(1-smooth*.72)+((a+v+b)/3)*(smooth*.72)}),
    grad = ctx.createLinearGradient(w * 0.08, 0, w * 0.92, 0);
  grad.addColorStop(0,look.color);
  grad.addColorStop(.5,look.color2);
  grad.addColorStop(1,look.color);
  const radial = [
    'circle',
    'circle-bars',
    'orbit-dots',
    'radial-spectrum',
    'neon-ring',
    'arc-burst',
    'spiral',
    'radial-wave',
    'pinwheel',
    'mandala',
    'spectrum-rings',
  ].includes(style);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.strokeStyle = grad;
  ctx.globalAlpha=Math.max(.1,Math.min(1,look.opacity/100));
  ctx.shadowColor = look.color2;
  ctx.shadowBlur = Math.max(0,look.glow*.28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (radial) {
    const cx = w / 2,
      ry = h * 0.84,
      r = Math.min(w, h) * 0.085;
    ctx.translate(cx, ry);
    if (style === 'neon-ring' || style === 'spectrum-rings') {
      for (let ring = 0; ring < (style === 'spectrum-rings' ? 3 : 1); ring++) {
        ctx.beginPath();
        ctx.lineWidth = Math.max(3, w * 0.004);
        ctx.arc(
          0,
          0,
          r + ring * 18 + Math.sin(t * 3 + ring) * 5,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    } else {
      const count = style === 'orbit-dots' ? 42 : 64;
      for (let i = 0; i < count; i++) {
        const a =
            (i / count) * Math.PI * 2 +
            (style === 'spiral' || style === 'pinwheel' ? t * 0.35 : 0),
          v = vals[i % vals.length],
          inner = r + (style === 'spiral' ? (i / count) * 35 : 0),
          len = (12 + v * max * 0.55) * (style === 'mandala' ? 0.75 : 1);
        const x = Math.cos(a) * inner,
          y = Math.sin(a) * inner;
        if (style === 'orbit-dots') {
          ctx.beginPath();
          ctx.arc(
            Math.cos(a) * (inner + v * 24),
            Math.sin(a) * (inner + v * 24),
            2 + v * 3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(Math.cos(a) * (inner + len), Math.sin(a) * (inner + len));
          ctx.lineWidth = style === 'circle-bars' ? 5 : 2.5;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    return;
  }
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = grad;
  ctx.strokeStyle = grad;
  if (
    style === 'line' ||
    style === 'mountain' ||
    style === 'ribbon' ||
    style === 'center-line' ||
    style === 'spark'
  ) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = start + (i / (n - 1)) * usable,
        v = vals[i],
        y = cy - (v - 0.18) * max * (style === 'mountain' ? 1.35 : 0.8);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineWidth = style === 'ribbon' ? 8 : style === 'center-line' ? 2 : 4;
    ctx.stroke();
    if (style === 'ribbon') {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 18;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (style === 'dots') {
    for (let i = 0; i < n; i++) {
      const x = start + (i / (n - 1)) * usable,
        v = vals[i];
      ctx.beginPath();
      ctx.arc(x, cy - (v - 0.15) * max * 0.7, 2 + v * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const gap = Math.max(2, w * 0.004),
    bw = Math.max(
      style === 'thin-bars' || style === 'needles' ? 2 : 3,
      (usable - gap * (n - 1)) / n,
    );
  for (let i = 0; i < n; i++) {
    const a = vals[i],
      x = start + (i / (n - 1)) * usable - bw / 2,
      pulse = 1,
      hh = Math.max(5, max * a * pulse) * (style === 'pulse' ? 1.45 : 1);
    ctx.beginPath();
    if (style === 'mirror') {
      ctx.roundRect(x, cy - hh, bw, hh * 2, bw / 2);
    } else if (
      style === 'blocks' ||
      style === 'equalizer' ||
      style === 'stacked-spectrum' ||
      style === 'wave-bars'
    ) {
      const step = 7;
      for (let y = 0; y < hh; y += step)
        ctx.rect(x, cy - y, bw, Math.max(3, step - 2));
    } else ctx.roundRect(x, cy - hh / 2, bw, hh, bw / 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawWave(
  ctx: CanvasRenderingContext2D,
  samples: Float32Array | null,
  rate: number,
  t: number,
  w: number,
  h: number,
  style: WaveStyle,
  p: Palette,
  layout?: OverlayLayout,
  textStyles?: OverlayTextStyles,
  realtimeBands?: RealtimeSpectrumBands,
  appearance?: WaveAppearance,
) {
  const pos = layout?.wave || { x: 50, y: 86, scale: 100 },
    sx = pos.scale / 100;
  ctx.save();
  ctx.translate((w * pos.x) / 100, (h * pos.y) / 100);
  ctx.scale(sx, sx);
  ctx.translate(-w * 0.5, -h * 0.86);
  drawWaveBase(ctx, samples, rate, t, w, h, style, p, realtimeBands, appearance);
  ctx.restore();
}
export function withSubtitleLayout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  layout: OverlayLayout | undefined,
  draw: () => void,
) {
  const pos = layout?.subtitle || { x: 50, y: 58, scale: 100 },
    s = pos.scale / 100;
  ctx.save();
  ctx.translate((w * pos.x) / 100, (h * pos.y) / 100);
  ctx.scale(s, s);
  ctx.translate(-w * 0.5, -(h - 119));
  draw();
  ctx.restore();
}
function drawRoundImage(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  cx: number,
  cy: number,
  radius: number,
  rotation = 0,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();
  const side = radius * 2;
  const s = Math.max(side / bmp.width, side / bmp.height);
  const iw = bmp.width * s, ih = bmp.height * s;
  ctx.drawImage(bmp, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
}

function drawVinylDisc(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  w: number,
  h: number,
  t: number,
  level: number,
  gain: number,
  gold = false,
) {
  const portrait = h > w * 1.2;
  const r = Math.min(w * (portrait ? .34 : .22), h * .24);
  const cx = w * .5;
  const cy = portrait ? h * .39 : h * .43;
  const beat = 1 + level * .035 * gain;
  const rotation = t * (.52 + gain * .12);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(beat, beat);
  ctx.rotate(rotation);

  const grad = ctx.createRadialGradient(0, 0, r * .08, 0, 0, r);
  if (gold) {
    grad.addColorStop(0, '#f7d768');
    grad.addColorStop(.22, '#9b6814');
    grad.addColorStop(.48, '#f0c34e');
    grad.addColorStop(.72, '#68430c');
    grad.addColorStop(1, '#d69b25');
  } else {
    grad.addColorStop(0, '#20202a');
    grad.addColorStop(.25, '#080910');
    grad.addColorStop(.55, '#1b1b24');
    grad.addColorStop(.78, '#05060a');
    grad.addColorStop(1, '#171721');
  }
  ctx.fillStyle = grad;
  ctx.shadowColor = gold ? 'rgba(247,190,62,.45)' : 'rgba(125,92,255,.38)';
  ctx.shadowBlur = r * .18;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = gold ? 'rgba(255,239,172,.19)' : 'rgba(255,255,255,.10)';
  ctx.lineWidth = Math.max(1, r * .006);
  for (let i = .28; i < .96; i += .055) {
    ctx.beginPath();
    ctx.arc(0, 0, r * i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  drawRoundImage(ctx, bmp, cx, cy, r * .32, rotation * .92);
  ctx.save();
  ctx.fillStyle = gold ? 'rgba(255,231,148,.9)' : 'rgba(220,210,255,.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, r * .035), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Tonearm makes the vinyl metaphor instantly readable.
  if (!gold) {
    ctx.save();
    ctx.strokeStyle = 'rgba(214,219,232,.78)';
    ctx.lineWidth = Math.max(5, w * .006);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 10;
    const ax = cx + r * .92, ay = cy - r * .96;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(cx + r * .62, cy - r * .18);
    ctx.stroke();
    ctx.fillStyle = '#252a35';
    ctx.beginPath();
    ctx.arc(ax, ay, Math.max(8, r * .09), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGlassCard(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  w: number,
  h: number,
  t: number,
  level: number,
  gain: number,
) {
  const cw = w * .64, ch = Math.min(h * .38, cw * .82);
  const x = (w - cw) / 2 + Math.sin(t * .45) * w * .015 * gain;
  const y = h * .25 + Math.cos(t * .36) * h * .012 * gain;
  ctx.save();
  ctx.translate(x + cw / 2, y + ch / 2);
  ctx.rotate(Math.sin(t * .3) * .025 * gain);
  ctx.translate(-cw / 2, -ch / 2);
  ctx.fillStyle = 'rgba(15,20,36,.42)';
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = Math.max(2, w * .002);
  ctx.shadowColor = 'rgba(129,92,246,.38)';
  ctx.shadowBlur = 36 + level * 24;
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, Math.min(28, cw * .05));
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(10, 10, cw - 20, ch - 20, Math.min(22, cw * .045));
  ctx.clip();
  const s = Math.max((cw - 20) / bmp.width, (ch - 20) / bmp.height);
  const iw = bmp.width * s, ih = bmp.height * s;
  ctx.globalAlpha = .82;
  ctx.drawImage(bmp, 10 + (cw - 20 - iw) / 2, 10 + (ch - 20 - ih) / 2, iw, ih);
  ctx.restore();
  ctx.restore();
}

function drawEditorial(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  song: Song,
  w: number,
  h: number,
) {
  const portrait = h > w * 1.2;
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,14,.28)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(242,228,196,.8)';
  ctx.lineWidth = Math.max(2, w * .002);
  ctx.strokeRect(w * .06, h * .08, w * .88, h * .82);
  ctx.fillStyle = 'rgba(244,232,202,.94)';
  ctx.font = `900 ${Math.round(w * (portrait ? .115 : .072))}px Georgia,serif`;
  ctx.textAlign = 'left';
  ctx.fillText('MUSIC', w * .075, h * .19);
  ctx.font = `700 ${Math.round(w * .025)}px system-ui,sans-serif`;
  ctx.fillText('EDITORIAL / 01', w * .078, h * .235);
  ctx.restore();

  const size = Math.min(w * .46, h * .34);
  const x = portrait ? w * .47 : w * .58;
  const y = portrait ? h * .42 : h * .43;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-.045);
  ctx.fillStyle = '#efe6d3';
  ctx.fillRect(-size * .52, -size * .52, size * 1.04, size * 1.04);
  ctx.beginPath();
  ctx.rect(-size * .47, -size * .47, size * .94, size * .94);
  ctx.clip();
  const s = Math.max((size * .94) / bmp.width, (size * .94) / bmp.height);
  ctx.drawImage(bmp, -bmp.width * s / 2, -bmp.height * s / 2, bmp.width * s, bmp.height * s);
  ctx.restore();
}

function drawSpotlight(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  w: number,
  h: number,
  t: number,
  level: number,
  gain: number,
) {
  const cx = w / 2, top = h * .08, baseY = h * .69;
  const sweep = Math.sin(t * .42) * w * .08 * gain;
  const g = ctx.createLinearGradient(cx + sweep, top, cx, baseY);
  g.addColorStop(0, 'rgba(183,145,255,.55)');
  g.addColorStop(1, 'rgba(126,66,255,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - w * .035 + sweep, top);
  ctx.lineTo(cx + w * .035 + sweep, top);
  ctx.lineTo(cx + w * (.30 + level * .04), baseY);
  ctx.lineTo(cx - w * (.30 + level * .04), baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const size = Math.min(w * .52, h * .36);
  ctx.save();
  ctx.translate(cx, h * .39);
  ctx.rotate(Math.sin(t * .33) * .035 * gain);
  ctx.shadowColor = 'rgba(147,105,255,.62)';
  ctx.shadowBlur = 38 + level * 35;
  ctx.fillStyle = '#101521';
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.beginPath();
  ctx.rect(-size * .47, -size * .47, size * .94, size * .94);
  ctx.clip();
  const s = Math.max((size * .94) / bmp.width, (size * .94) / bmp.height);
  ctx.drawImage(bmp, -bmp.width * s / 2, -bmp.height * s / 2, bmp.width * s, bmp.height * s);
  ctx.restore();
}

function drawLyricsFocusScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  level: number,
) {
  ctx.save();
  const g = ctx.createLinearGradient(0, h * .2, 0, h * .78);
  g.addColorStop(0, 'rgba(4,7,15,.20)');
  g.addColorStop(.5, 'rgba(3,6,14,.58)');
  g.addColorStop(1, 'rgba(3,6,14,.20)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * .18, w, h * .62);
  ctx.strokeStyle = `rgba(175,139,255,${.22 + level * .3})`;
  ctx.lineWidth = Math.max(2, w * .0025);
  ctx.beginPath();
  const cy = h * .5;
  for (let i = 0; i <= 48; i++) {
    const x = (i / 48) * w;
    const y = cy + Math.sin(i * .72 + t * 4.2) * h * (.006 + level * .016);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawTemplate(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  song: Song,
  w: number,
  h: number,
  t: number,
  level: number,
  template: VisualTemplate,
  motion: MotionIntensity,
  p: Palette,
  preserveBackground = false,
  layout?: OverlayLayout,
  textStyles?: OverlayTextStyles,
) {
  const gain = MOTION_GAIN[motion];

  // Draw the base only when the user has not supplied a custom background.
  if (!preserveBackground) {
    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, w, h);
    const zoom = 1.045 + 0.018 * Math.sin(t * .45) * gain + level * .018 * gain;
    const dx = Math.sin(t * .22) * w * .012 * gain;
    const dy = Math.cos(t * .18) * h * .010 * gain;
    coverFill(ctx, bmp, w, h, template === 'cover-motion' ? .94 : .58, template === 'cover-motion' ? 0 : 24, zoom, dx, dy);
    ctx.fillStyle = template === 'cover-motion' ? 'rgba(3,4,12,.16)' : 'rgba(3,4,12,.42)';
    ctx.fillRect(0, 0, w, h);
  } else {
    // Keep custom background intact, but give the style overlays enough contrast.
    ctx.fillStyle = 'rgba(3,4,12,.10)';
    ctx.fillRect(0, 0, w, h);
  }

  if (template === 'vinyl') {
    drawVinylDisc(ctx, bmp, w, h, t, level, gain, false);
  } else if (template === 'gold-record') {
    drawVinylDisc(ctx, bmp, w, h, t, level, gain, true);
  } else if (template === 'glass-card') {
    drawGlassCard(ctx, bmp, w, h, t, level, gain);
  } else if (template === 'editorial') {
    drawEditorial(ctx, bmp, song, w, h);
  } else if (template === 'spotlight') {
    drawSpotlight(ctx, bmp, w, h, t, level, gain);
  } else if (template === 'lyrics-focus') {
    drawLyricsFocusScene(ctx, w, h, t, level);
  }

  drawMeta(
    ctx,
    song,
    w,
    h * .67,
    'center',
    template === 'editorial' ? .62 : .72,
    template,
    p,
    h,
    layout,
    textStyles,
  );
}
export function createLiveFramePainter(bitmap: ImageBitmap) {
  const palette = extractPalette(bitmap);
  return (
    ctx: CanvasRenderingContext2D,
    song: Song,
    w: number,
    h: number,
    time: number,
    template: VisualTemplate,
    wave: WaveStyle,
    motion: MotionIntensity,
    lyrics: LyricsMode,
    preserveBackground = false,
    layout?: OverlayLayout,
    textStyles?: OverlayTextStyles,
    audioAnalysis?: PreviewAudioAnalysis | null,
    realtimeBands?: RealtimeSpectrumBands,
    waveAppearance?: WaveAppearance,
  ) => {
    drawTemplate(
      ctx,
      bitmap,
      song,
      w,
      h,
      time,
      amplitude(audioAnalysis?.samples || null, audioAnalysis?.rate || 0, time),
      template,
      motion,
      palette,
      preserveBackground,
      layout,
      textStyles,
    );
    withSubtitleLayout(ctx, w, h, layout, () =>
      drawLyrics(ctx, song, w, h, time, song.duration || 1, lyrics),
    );
    drawWave(
      ctx,
      audioAnalysis?.samples || null,
      audioAnalysis?.rate || 0,
      time,
      w,
      h,
      wave,
      palette,
      layout,
      undefined,
      realtimeBands,
      waveAppearance,
    );
  };
}
function isMobileRenderDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua))
  );
}
async function yieldToBrowser() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
async function loadBackgroundVideo(url: string) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    const done = () => {
        cleanup();
        resolve();
      },
      fail = () => {
        cleanup();
        reject(new Error('Trình duyệt không đọc được video này.'));
      },
      cleanup = () => {
        video.removeEventListener('loadedmetadata', done);
        video.removeEventListener('error', fail);
      };
    video.addEventListener('loadedmetadata', done, { once: true });
    video.addEventListener('error', fail, { once: true });
    video.load();
  });
  return video;
}
export async function generateVisualizerVideoSafe(
  song: Song,
  aspect: VideoAspect,
  waveStyle: WaveStyle,
  template: VisualTemplate,
  options: SafeRenderOptions,
) {
  if (!song.picture || !song.audio)
    throw new Error('Không đủ ảnh hoặc âm thanh để tạo video.');
  options.onProgress?.(1);
  const [ir, ar] = await Promise.all([
    fetch(song.picture, { cache: 'no-store' }),
    fetch(song.audio, { cache: 'no-store' }),
  ]);
  if (!ir.ok || !ar.ok) throw new Error('Không thể tải ảnh hoặc âm thanh.');
  options.onProgress?.(4);
  if (!('VideoEncoder' in window))
    throw new Error('Trình duyệt chưa hỗ trợ tạo video MP4.');
  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    CanvasSource,
    EncodedAudioPacketSource,
    EncodedPacketSink,
    EncodedPacket,
    Input,
    Mp4OutputFormat,
    Output,
  } = await import('mediabunny');
  const originalAudio = await ar.blob(),
    mobile = isMobileRenderDevice();
  let processedWav: Blob | null = null,
    audioBlob: Blob = originalAudio;
  if (!mobile) {
    options.onProgress?.(6);
    processedWav = await renderTikTokLikeAudio(originalAudio);
    options.onProgress?.(8);
    try {
      audioBlob = await convertProcessedAudio(processedWav, 'm4a');
    } catch {
      audioBlob = await convertProcessedAudio(processedWav, 'mp3');
    }
  } else {
    options.onProgress?.(8);
    await yieldToBrowser();
  }
  const input = new Input({
      source: new BlobSource(audioBlob),
      formats: ALL_FORMATS,
    }),
    track = await input.getPrimaryAudioTrack();
  if (!track) throw new Error('Không có luồng âm thanh hợp lệ.');
  const codec = await track.getCodec(),
    decoderConfig = await track.getDecoderConfig(),
    sourceDuration = await input.computeDuration();
  if (
    !codec ||
    !decoderConfig ||
    !Number.isFinite(sourceDuration) ||
    sourceDuration <= 0
  )
    throw new Error('Không đọc được âm thanh.');
  const trim = storedAudioTrim(sourceDuration),
    trimStart = trim?.start || 0,
    trimEnd = trim?.end || sourceDuration,
    fullDuration = Math.max(0.05, trimEnd - trimStart),
    outputDuration = Math.max(
      fullDuration,
      Number.isFinite(options.loopDuration)
        ? Number(options.loopDuration)
        : fullDuration,
    ),
    start = Math.max(
      0,
      Math.min(options.startSeconds || 0, Math.max(0, outputDuration - 0.05)),
    ),
    duration = options.previewSeconds
      ? Math.min(options.previewSeconds, outputDuration - start)
      : outputDuration,
    end = start + duration;
  let samples: Float32Array | null = null,
    rate = 48000;
  if (!mobile && processedWav) {
    try {
      const ac = new AudioContext(),
        d = await ac.decodeAudioData(await processedWav.arrayBuffer());
      samples = d.getChannelData(0);
      rate = d.sampleRate;
      await ac.close();
    } catch {
      samples = null;
    }
  }
  const { width, height } = VIDEO_SIZES[aspect],
    canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Không tạo được khung hình.');
  const bmp = await createImageBitmap(await ir.blob()),
    palette = extractPalette(bmp),
    background = options.background || DEFAULT_BACKGROUND_CONFIG;
  let backgroundBitmap: ImageBitmap | null = null,
    backgroundVideo: HTMLVideoElement | null = null;
  if (background.mode === 'image' && background.imageUrl) {
    const r = await fetch(background.imageUrl);
    if (!r.ok) throw new Error('Không tải được ảnh nền.');
    backgroundBitmap = await createImageBitmap(await r.blob());
  }
  if (background.mode === 'video' && background.videoUrl)
    backgroundVideo = await loadBackgroundVideo(background.videoUrl);
  const sceneMedia = await Promise.all(
    (options.mediaClips || []).map(async (clip) => ({
      clip,
      bitmap:
        clip.type === 'image'
          ? await createImageBitmap(await (await fetch(clip.url)).blob())
          : null,
      video: clip.type === 'video' ? await loadBackgroundVideo(clip.url) : null,
    })),
  );
  const target = new BufferTarget(),
    output = new Output({ format: new Mp4OutputFormat(), target }),
    bitrate = width * height >= 1_000_000 ? 2_700_000 : 1_900_000,
    videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate }),
    audioSource = new EncodedAudioPacketSource(codec);
  output.addVideoTrack(videoSource);
  output.addAudioTrack(audioSource, { decoderConfig });
  await output.start();
  try {
    const fps = mobile && background.mode === 'video' ? 10 : 15,
      fd = 1 / fps,
      frames = Math.ceil(duration * fps);
    for (let i = 0; i < frames; i++) {
      const localT = i * fd,
        absoluteT = start + localT,
        trimT = ((absoluteT % fullDuration) + fullDuration) % fullDuration,
        songT = trimStart + trimT,
        level = amplitude(samples, rate, songT),
        scene = sceneMedia.find(
          ({ clip }) => absoluteT >= clip.start && absoluteT < clip.end,
        ),
        customBackground = Boolean(scene) || background.mode !== 'suno';
      if (scene?.bitmap) {
        drawMediaBackground(
          ctx,
          scene.bitmap,
          scene.bitmap.width,
          scene.bitmap.height,
          width,
          height,
          background,
        );
      } else if (scene?.video) {
        await seekVideoFrame(scene.video, absoluteT - scene.clip.start, true);
        drawMediaBackground(
          ctx,
          scene.video,
          scene.video.videoWidth,
          scene.video.videoHeight,
          width,
          height,
          background,
        );
      } else if (background.mode === 'preset') {
        drawPresetBackground(
          ctx,
          background.presetId,
          width,
          height,
          absoluteT,
        );
        applyBackgroundFinish(ctx, width, height, background);
      } else if (background.mode === 'image' && backgroundBitmap) {
        drawMediaBackground(
          ctx,
          backgroundBitmap,
          backgroundBitmap.width,
          backgroundBitmap.height,
          width,
          height,
          background,
        );
        applyBackgroundFinish(ctx, width, height, background);
      } else if (background.mode === 'video' && backgroundVideo) {
        await seekVideoFrame(
          backgroundVideo,
          absoluteT,
          background.loopVideo,
          background.videoStart || 0,
          background.videoEnd,
        );
        drawMediaBackground(
          ctx,
          backgroundVideo,
          backgroundVideo.videoWidth,
          backgroundVideo.videoHeight,
          width,
          height,
          background,
        );
        applyBackgroundFinish(ctx, width, height, background);
      }
      drawTemplate(
        ctx,
        bmp,
        song,
        width,
        height,
        absoluteT,
        level,
        template,
        options.motion,
        palette,
        customBackground,
        options.layout,
        options.overlayTextStyles,
      );
      withSubtitleLayout(ctx, width, height, options.layout, () => {
        if (options.lyrics !== 'off' && options.karaokeTimeline?.length)
          drawKaraokeOverlay(
            ctx,
            options.karaokeTimeline,
            songT,
            width,
            height,
            options.subtitleStyle,
          );
        else
          drawLyrics(
            ctx,
            song,
            width,
            height,
            songT,
            sourceDuration,
            options.lyrics,
          );
      });
      drawWave(
        ctx,
        samples,
        rate,
        songT,
        width,
        height,
        waveStyle,
        palette,
        options.layout,
        undefined,
        undefined,
        options.waveAppearance,
      );
      if (options.effects?.effects?.length) {
        drawVideoEffects(
          ctx,
          width,
          height,
          songT,
          options.effects,
        );
      }
      await videoSource.add(localT, Math.min(fd, duration - localT), {
        keyFrame: i % (fps * 2) === 0,
      });
      if (mobile && i % 8 === 0) await yieldToBrowser();
      if (i % 3 === 0 || i === frames - 1)
        options.onProgress?.(
          Math.min(90, 10 + Math.round(((i + 1) / frames) * 80)),
        );
    }
    bmp.close();
    backgroundBitmap?.close();
    sceneMedia.forEach(({ bitmap, video }) => {
      bitmap?.close();
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    });
    if (backgroundVideo) {
      backgroundVideo.removeAttribute('src');
      backgroundVideo.load();
    }
    const sink = new EncodedPacketSink(track),
      sourcePackets = [] as EncodedPacket[];
    for await (const p of sink.packets()) sourcePackets.push(p);
    const meta = { decoderConfig };
    let added = 0;
    const firstLoop = Math.max(0, Math.floor(start / fullDuration)),
      lastLoop = Math.max(
        firstLoop,
        Math.floor(Math.max(start, end - 0.0001) / fullDuration),
      );
    for (let loop = firstLoop; loop <= lastLoop; loop++) {
      const loopOffset = loop * fullDuration;
      for (const p of sourcePackets) {
        const sourceStart = p.timestamp,
          sourceEnd = sourceStart + p.duration;
        if (sourceEnd <= trimStart) continue;
        if (sourceStart >= trimEnd) break;
        const clippedStart = Math.max(sourceStart, trimStart),
          clippedEnd = Math.min(sourceEnd, trimEnd),
          globalStart = loopOffset + (clippedStart - trimStart),
          globalEnd = loopOffset + (clippedEnd - trimStart);
        if (globalEnd <= start) continue;
        if (globalStart >= end) break;
        const packet = new EncodedPacket(
          p.data,
          p.type,
          Math.max(0, globalStart - start),
          Math.max(0.001, clippedEnd - clippedStart),
        );
        await audioSource.add(packet, meta);
        added++;
        if (added % 25 === 0) options.onProgress?.(94);
      }
    }
    options.onProgress?.(97);
    await output.finalize();
    options.onProgress?.(100);
  } catch (e) {
    bmp.close();
    output.cancel();
    throw e;
  }
  if (!target.buffer) throw new Error('Không xuất được MP4.');
  return new Blob([target.buffer], { type: 'video/mp4' });
}
