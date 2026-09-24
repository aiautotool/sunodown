import type { KaraokeDrawStyle } from '@/app/lib/karaoke';
import type { OverlayTextStyles } from '@/components/v4/renderer-safe';
import type { OverlayLayout } from '@/components/v9/overlay-layout-panel';
import type {
  LyricsMode,
  MotionIntensity,
  VideoAspect,
  VisualTemplate,
  WaveStyle,
} from '@/components/v4/types';
import type { VideoEffect } from '@/components/v8/video-effects';

export type StudioPresetCategory =
  | 'Social'
  | 'Lyrics'
  | 'Cinematic'
  | 'Album'
  | 'Visualizer';

export type StudioPresetConfig = {
  template: VisualTemplate;
  wave: WaveStyle;
  motion: MotionIntensity;
  aspect: VideoAspect;
  lyrics: LyricsMode;
  effects: VideoEffect[];
  layout: OverlayLayout;
  textStyles: OverlayTextStyles;
  subtitleStyle: KaraokeDrawStyle;
};

export type StudioPreset = {
  id: string;
  name: string;
  description: string;
  category: StudioPresetCategory;
  badge?: string;
  accent: string;
  secondary: string;
  builtin?: boolean;
  config: StudioPresetConfig;
};

const layout = (
  waveY: number,
  subtitleY: number,
  titleY: number,
  creatorY: number,
  waveScale = 100,
  subtitleScale = 100,
  titleScale = 100,
): OverlayLayout => ({
  wave: { x: 50, y: waveY, scale: waveScale },
  subtitle: { x: 50, y: subtitleY, scale: subtitleScale },
  title: { x: 50, y: titleY, scale: titleScale },
  creator: { x: 50, y: creatorY, scale: 100 },
});

const text = (
  titleFont: string,
  creatorFont: string,
  titleColor = '#ffffff',
  creatorColor = '#d1d5db',
): OverlayTextStyles => ({
  title: { font: titleFont, color: titleColor },
  creator: { font: creatorFont, color: creatorColor },
});

export const BUILTIN_STUDIO_PRESETS: StudioPreset[] = [
  {
    id: 'social-hook',
    name: 'Social Hook',
    description: 'Hook mạnh cho TikTok, Reels và Shorts. Chữ lớn, pulse rõ, bắt mắt ngay 3 giây đầu.',
    category: 'Social',
    badge: 'Popular',
    accent: '#8b5cf6',
    secondary: '#ec4899',
    builtin: true,
    config: {
      template: 'glass-card',
      wave: 'pulse',
      motion: 'high',
      aspect: '9:16',
      lyrics: 'focus',
      effects: ['sparkles', 'vignette'],
      layout: layout(83, 61, 18, 26, 118, 125, 116),
      textStyles: text('Impact, sans-serif', 'system-ui, sans-serif'),
      subtitleStyle: {
        font: 'rounded',
        color: '#ffffff',
        activeColor: '#c4b5fd',
      },
    },
  },
  {
    id: 'sad-lyrics',
    name: 'Sad Lyrics',
    description: 'Ballad và ca khúc cảm xúc. Bố cục tối, lyric tập trung, chuyển động chậm và hạt phim nhẹ.',
    category: 'Lyrics',
    badge: 'Ballad',
    accent: '#6366f1',
    secondary: '#94a3b8',
    builtin: true,
    config: {
      template: 'lyrics-focus',
      wave: 'line',
      motion: 'low',
      aspect: '9:16',
      lyrics: 'focus',
      effects: ['film', 'vignette'],
      layout: layout(86, 58, 22, 30, 92, 112, 96),
      textStyles: text('Georgia, serif', 'system-ui, sans-serif', '#f8fafc', '#cbd5e1'),
      subtitleStyle: {
        font: 'serif',
        color: '#f8fafc',
        activeColor: '#a5b4fc',
      },
    },
  },
  {
    id: 'cinematic-story',
    name: 'Cinema Story',
    description: 'Video kể chuyện điện ảnh, title thanh lịch, ánh sáng dịu và bố cục rộng.',
    category: 'Cinematic',
    badge: 'Premium',
    accent: '#f59e0b',
    secondary: '#7c2d12',
    builtin: true,
    config: {
      template: 'editorial',
      wave: 'thin-bars',
      motion: 'low',
      aspect: '16:9',
      lyrics: 'scroll',
      effects: ['lightleak', 'film', 'vignette'],
      layout: layout(88, 72, 20, 29, 86, 90, 110),
      textStyles: text('Georgia, serif', "'Trebuchet MS', sans-serif", '#fff7ed', '#fed7aa'),
      subtitleStyle: {
        font: 'serif',
        color: '#fff7ed',
        activeColor: '#fbbf24',
      },
    },
  },
  {
    id: 'album-motion',
    name: 'Album Motion',
    description: 'Cover art là trung tâm, waveform vòng tròn và chuyển động vừa đủ cho music visualizer.',
    category: 'Album',
    badge: 'Album',
    accent: '#22c55e',
    secondary: '#06b6d4',
    builtin: true,
    config: {
      template: 'vinyl',
      wave: 'circle-bars',
      motion: 'medium',
      aspect: '1:1',
      lyrics: 'off',
      effects: ['bokeh', 'vignette'],
      layout: layout(72, 81, 14, 22, 112, 90, 104),
      textStyles: text("'Trebuchet MS', sans-serif", 'system-ui, sans-serif'),
      subtitleStyle: {
        font: 'system',
        color: '#ffffff',
        activeColor: '#86efac',
      },
    },
  },
  {
    id: 'neon-pulse',
    name: 'Neon Pulse',
    description: 'EDM, synthwave và electronic. Neon ring, glow, chuyển động mạnh và màu tương phản cao.',
    category: 'Visualizer',
    badge: 'EDM',
    accent: '#06b6d4',
    secondary: '#d946ef',
    builtin: true,
    config: {
      template: 'glass-card',
      wave: 'neon-ring',
      motion: 'high',
      aspect: '9:16',
      lyrics: 'off',
      effects: ['sparkles', 'stars', 'lightleak'],
      layout: layout(67, 80, 15, 23, 132, 90, 110),
      textStyles: text('Impact, sans-serif', "'Courier New', monospace", '#ecfeff', '#67e8f9'),
      subtitleStyle: {
        font: 'impact',
        color: '#ecfeff',
        activeColor: '#e879f9',
      },
    },
  },
  {
    id: 'minimal-clean',
    name: 'Minimal Clean',
    description: 'Tối giản, sạch, ít hiệu ứng. Phù hợp acoustic, chill, podcast music và portfolio.',
    category: 'Album',
    badge: 'Clean',
    accent: '#64748b',
    secondary: '#e2e8f0',
    builtin: true,
    config: {
      template: 'cover-motion',
      wave: 'center-line',
      motion: 'low',
      aspect: '4:5',
      lyrics: 'off',
      effects: ['vignette'],
      layout: layout(88, 76, 68, 76, 82, 90, 92),
      textStyles: text('system-ui, sans-serif', 'system-ui, sans-serif', '#ffffff', '#cbd5e1'),
      subtitleStyle: {
        font: 'system',
        color: '#ffffff',
        activeColor: '#cbd5e1',
      },
    },
  },
  {
    id: 'karaoke-pop',
    name: 'Karaoke Pop',
    description: 'Lyric rõ, highlight từng câu, bố cục cân bằng cho video hát theo và social clips.',
    category: 'Lyrics',
    badge: 'Karaoke',
    accent: '#f43f5e',
    secondary: '#fb7185',
    builtin: true,
    config: {
      template: 'lyrics-focus',
      wave: 'mirror',
      motion: 'medium',
      aspect: '16:9',
      lyrics: 'focus',
      effects: ['bokeh'],
      layout: layout(84, 56, 17, 25, 100, 132, 104),
      textStyles: text("'Trebuchet MS', sans-serif", 'system-ui, sans-serif'),
      subtitleStyle: {
        font: 'rounded',
        color: '#ffffff',
        activeColor: '#fb7185',
      },
    },
  },
  {
    id: 'gold-premiere',
    name: 'Gold Premiere',
    description: 'Luxury music launch: gold record, chữ serif, glow nhẹ và hạt phim cao cấp.',
    category: 'Cinematic',
    badge: 'Launch',
    accent: '#fbbf24',
    secondary: '#92400e',
    builtin: true,
    config: {
      template: 'gold-record',
      wave: 'dots',
      motion: 'low',
      aspect: '16:9',
      lyrics: 'off',
      effects: ['dust', 'film', 'vignette'],
      layout: layout(87, 73, 20, 29, 86, 90, 106),
      textStyles: text('Georgia, serif', 'Georgia, serif', '#fef3c7', '#fde68a'),
      subtitleStyle: {
        font: 'serif',
        color: '#fff7ed',
        activeColor: '#fbbf24',
      },
    },
  },
];

export function clonePresetConfig(config: StudioPresetConfig): StudioPresetConfig {
  return structuredClone(config);
}
