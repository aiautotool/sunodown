'use client';
import {DEFAULT_EFFECT_SETTINGS,normalizeEffectSettings,type EffectSettings} from './v8/video-effects';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRenderWakeLock } from '@/hooks/use-render-wake-lock';
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2,
  ListMusic,
  LogIn,
  LogOut,
  Menu,
  Music2,
  Play,
  Plus,
  Save,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react';
import { generateVisualizerVideoArt } from '@/components/v7/renderer-art';
import type { OverlayTextStyles } from '@/components/v4/renderer-safe';
import type { KaraokeDrawStyle } from '@/app/lib/karaoke';
import {
  VIDEO_EFFECTS,
  type EffectConfig,
  type VideoEffect,
} from '@/components/v8/video-effects';
import { LivePreview } from '@/components/v8/live-preview';
import type { AddPexelsToTimeline } from '@/components/v8/pexels-library';
import { PreviewTextEditor } from '@/components/v8/preview-text-editor';
import { SuggestedBackground } from '@/components/v8/suggested-background';
import { BackgroundPanel } from '@/components/v8/background-panel';
import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND_CONFIG,
  type BackgroundConfig,
} from '@/components/v8/background';
import {
  WAVE_STYLES,
  type WaveStyle,
  type WaveAppearance,
  DEFAULT_WAVE_APPEARANCE,
  type VisualTemplate,
  type VideoAspect,
  type LyricsMode,
  type MotionIntensity,
} from '@/components/v4/types';
import {
  DEFAULT_OVERLAY_LAYOUT,
  type OverlayLayout,
} from '@/components/v9/overlay-layout-panel';
import {
  convertProcessedAudio,
  renderTikTokLikeAudio,
} from '@/app/lib/audio-processing';
import { exportSrt } from '@/app/lib/karaoke';
import { runKaraokePipeline } from '@/app/lib/karaoke-pipeline';
import { findMusicHighlight } from '@/app/lib/audio-highlight';
import { cleanLyricsForVideo } from '@/components/v4/lyrics-clean';
import { initAnalytics, track } from '@/app/lib/analytics';
import { DEFAULT_PLAN, canUse } from '@/app/lib/entitlements';
import type { KaraokeLine } from '@/app/lib/karaoke';
import { EditorTimeline, type MediaClip, type TimelineTrackState } from '@/components/editor-timeline';
import { PresetGallery } from '@/components/presets/preset-gallery';
import { MasteringPanel } from '@/components/mastering-panel';
import {
  DEFAULT_PRODUCTION_EXPORT,
  DEFAULT_PRODUCTION_MASTERING,
  masteringLabel,
  normalizeProductionPreset,
  type ProductionExportConfig,
  type ProductionMasteringConfig,
} from '@/components/presets/production-preset';
import { StudioSheet, StudioTabs } from '@/components/studio-ui';
import { StyleStudio } from '@/components/style-studio';
import { AccountLibraryPanel } from '@/components/account-library-panel';
import { MobileAppNav } from '@/components/mobile-app-nav';
import { STUDIO_TITLE_FONTS } from '@/components/studio-fonts';
import {
  BUILTIN_STUDIO_PRESETS,
  PRESET_SCHEMA_VERSION,
  clonePresetConfig,
  normalizeStoredPresets,
  normalizeStudioPreset,
  type StudioPreset,
  type StudioPresetConfig,
} from '@/components/presets/studio-presets';
import {
  auditPresetLibrary,
  visualFingerprint,
} from '@/components/presets/preset-regression';
import {
  assertStudioRenderParity,
  createStudioRenderModel,
} from '@/components/studio-render-model';
import {
  auditPresetApplyTransaction,
  auditPresetVisualCommit,
  commitPresetVisualState,
  createPresetApplyTransaction,
  createPresetVisualCommit,
  type PresetApplyMode,
  type PresetVisualCommit,
} from '@/components/presets/preset-apply-engine';
import {
  clearProjectData,
  loadProjectData,
  saveProjectData,
} from '@/components/project-store';

type AppView = 'create' | 'projects' | 'library' | 'jobs' | 'settings';

type Song = {
  id?: string;
  sourceToken?: string;
  title: string;
  creator?: string;
  handle?: string;
  duration?: number;
  picture?: string;
  audio: string;
  video?: string;
  lyrics?: string;
  style?: string;
  tags?: string;
  isPublic?: boolean | null;
};

type SignedInUser = { sub: string; email: string; name: string; picture?: string };

type SavedProjectListItem = { url: string; title: string };
type LocalLibraryItem = {
  id: string;
  url: string;
  title: string;
  creator?: string;
  picture?: string;
  duration?: number;
  updatedAt: number;
  lastEvent?: 'resolved' | 'downloaded' | 'rendered';
  favorite?: boolean;
  collections?: string[];
};

type SubtitleDebugValue = string | number | boolean | null;
type SubtitleDebugEntry = {
  id: number;
  time: string;
  message: string;
  data?: Record<string, SubtitleDebugValue>;
};

const fmt = (n = 0) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const shortDate = (value?: number) =>
  value ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Gần đây';
const localLibraryEventLabel: Record<string, string> = {
  resolved: 'Đã mở',
  downloaded: 'Đã tải',
  rendered: 'Đã render',
};
const readSavedProjectList = (): SavedProjectListItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const items = JSON.parse(localStorage.getItem('sundown-projects') || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};
const readLocalLibraryItems = (): LocalLibraryItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const items = JSON.parse(localStorage.getItem('sunodown-v10-local-library') || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};
const valid = (value: string) => {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'suno.com' || u.hostname.endsWith('.suno.com'))
    );
  } catch {
    return false;
  }
};
const validSourceInput = (value: string) =>
  valid(value) || (/^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) && value.length <= 5000);
const renderSong = (song: Song) => ({
  id: song.id || null,
  title: song.title,
  picture: song.picture || null,
  audio: song.audio,
  sourceAudio: song.audio,
  video: song.video || null,
  description: null,
  lyrics: song.lyrics || null,
  style: song.style || null,
  tags: song.tags || null,
  duration: song.duration || null,
  creator: song.creator || null,
});
function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}
const safeName = (value: string) =>
  (value || 'suno').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120);

const QUICK_PRESET_LIMIT = 3;
const QUICK_PRESET_RANDOM_POOL = 10;

function shufflePresets<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

function recommendQuickPresets(song: Song) {
  const haystack =
    `${song.style || ''} ${song.tags || ''} ${song.lyrics || ''}`.toLowerCase();

  const score = (preset: StudioPreset) => {
    let value = preset.config.aspect === '9:16' ? 2 : 0;
    if (song.lyrics && preset.config.lyrics !== 'off') value += 3;

    if (/ballad|sad|emotional|piano|acoustic|love|romantic/.test(haystack)) {
      if (
        [
          'sad-lyrics',
          'romantic-letter',
          'acoustic-room',
          'story-confession',
          'golden-floating-title',
          'silver-moon-script',
          'vintage-love-letter',
          'midnight-blue-glow',
        ].includes(preset.id)
      ) value += 7;
    }

    if (/edm|electronic|dance|house|synth|techno|festival/.test(haystack)) {
      if (
        [
          'neon-pulse',
          'festival-energy',
          'reels-velocity',
          'neon-heartbeat-title',
        ].includes(preset.id)
      ) value += 8;
    }

    if (/rap|hip hop|trap|fast|energetic|pop/.test(haystack)) {
      if (
        ['social-hook', 'reels-velocity', 'neon-pulse', 'neon-heartbeat-title']
          .includes(preset.id)
      ) value += 5;
    }

    if (/chill|lofi|lo-fi|jazz|soul|retro|night|dream/.test(haystack)) {
      if (
        [
          'minimal-clean',
          'midnight-drive',
          'retro-vinyl',
          'silver-moon-script',
          'midnight-blue-glow',
        ].includes(preset.id)
      ) value += 6;
    }

    if (/podcast|spoken|speech|story/.test(haystack)) {
      if (['podcast-wave', 'story-confession'].includes(preset.id)) value += 8;
    }

    if (preset.id === 'social-hook') value += 1;
    return value;
  };

  const ranked = [...BUILTIN_STUDIO_PRESETS]
    .map((preset) => ({ preset, score: score(preset) }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return [];

  // Keep one trustworthy recommendation, then rotate the remaining cards
  // from a high-scoring pool so Quick Create does not look hard-coded.
  const recommended = ranked[0].preset;
  const pool = ranked
    .slice(1, 1 + QUICK_PRESET_RANDOM_POOL)
    .map((entry) => entry.preset);

  const result: StudioPreset[] = [recommended];
  const shuffled = shufflePresets(pool);

  // Prefer visual variety: avoid immediately repeating the same template/category.
  for (const preset of shuffled) {
    if (result.length >= QUICK_PRESET_LIMIT) break;
    const templateAlreadyUsed = result.some(
      (item) => item.config.template === preset.config.template,
    );
    const categoryAlreadyUsed = result.some(
      (item) => item.category === preset.category,
    );
    if (!templateAlreadyUsed || !categoryAlreadyUsed) result.push(preset);
  }

  // If diversity filtering left fewer than three, fill from the same ranked pool.
  for (const preset of shuffled) {
    if (result.length >= QUICK_PRESET_LIMIT) break;
    if (!result.some((item) => item.id === preset.id)) result.push(preset);
  }

  return result.slice(0, QUICK_PRESET_LIMIT);
}

const makeEffectConfig = (effects: VideoEffect[]): EffectConfig => ({
  effects,
  intensity: 1,
  speed: 1,
  opacity: 0.75,
  wind: 0,
});

function ToolControls(p: {
  onAddToTimeline: AddPexelsToTimeline;
  panel: string;
  setPanel: (v: string) => void;
  wave: WaveStyle;
  setWave: (v: WaveStyle) => void;
  waveAppearance: WaveAppearance;
  setWaveAppearance: (v: WaveAppearance) => void;
  template: VisualTemplate;
  setTemplate: (v: VisualTemplate) => void;
  aspect: VideoAspect;
  setAspect: (v: VideoAspect) => void;
  lyrics: LyricsMode;
  setLyrics: (v: LyricsMode) => void;
  motion: MotionIntensity;
  setMotion: (v: MotionIntensity) => void;
  effectSettings:EffectSettings;
  setEffectSettings:(value:EffectSettings)=>void;
  effects: VideoEffect[];
  setEffects: (v: VideoEffect[]) => void;
  layout: OverlayLayout;
  setLayout: (v: OverlayLayout) => void;
  textStyles: OverlayTextStyles;
  setTextStyles: (v: OverlayTextStyles) => void;
  subtitleStyle: KaraokeDrawStyle;
  setSubtitleStyle: (v: KaraokeDrawStyle) => void;
  background: BackgroundConfig;
  setBackground: (v: BackgroundConfig) => void;
  onError: (message: string) => void;
  trimStart: number;
  trimEnd: number;
  duration: number;
  setTrimStart: (v: number) => void;
  setTrimEnd: (v: number) => void;
  audioUrl: string;
  audioBinary: Blob | null;
  songTitle: string;
  songPicture?: string;
  mastering: ProductionMasteringConfig;
  setMastering: (value: ProductionMasteringConfig) => void;
  exportConfig: ProductionExportConfig;
  setExportConfig: (value: ProductionExportConfig) => void;
  presetContent?: React.ReactNode;
}) {
  const safeBackground = p.background || DEFAULT_BACKGROUND_CONFIG;
  const rows = [
    ['audio', 'Âm thanh', Music2],
    ['presets', 'Mẫu hoàn chỉnh', Sparkles],
    ['style', 'Kiểu hình ảnh', Sparkles],
    ['text', 'Văn bản', FileText],
    ['wave', 'Sóng nhạc', SlidersHorizontal],
    ['lyrics', 'Lời bài hát', FileText],
    ['format', 'Định dạng', SlidersHorizontal],
    ['background', 'Nền', ImageIcon],
    ['effects', 'Hiệu ứng', Sparkles],
    ['trim', 'Cắt', SlidersHorizontal],
  ] as const;
  const toggle = (id: VideoEffect) =>
    p.setEffects(
      p.effects.includes(id)
        ? p.effects.filter((x) => x !== id)
        : [...p.effects, id],
    );
  return (
    <>
      <StudioTabs value={(p.panel || 'audio') as string} tabs={rows.map(([id,label,Icon])=>({value:id,label,icon:<Icon/>}))} onChange={id=>p.setPanel(id)} />
      {rows.map(([id]) => p.panel === id && (
        <div className="sd-tab-panel" key={id}>
          <div className="sd-options">
              {id === 'presets' && p.presetContent}
              {id === 'style' && (
                <StyleStudio
                  template={p.template}
                  setTemplate={p.setTemplate}
                  motion={p.motion}
                  setMotion={p.setMotion}
                  picture={p.songPicture}
                  onOpenPanel={p.setPanel}
                />
              )}
              {id === 'text' && (
                <div className="sd-text-style">
                  <p className="sd-control-hint">
                    Chọn font, màu, kích thước hoặc bấm chữ trên video rồi kéo
                    nút tím ở góc để resize.
                  </p>
                  {(['title', 'creator'] as const).map((key) => (
                    <div key={key}>
                      <b>{key === 'title' ? 'Tiêu đề' : 'Tác giả'}</b>
                      {p.textStyles[key].text===''&&<button type="button" onClick={()=>p.setTextStyles({...p.textStyles,[key]:{...p.textStyles[key],text:undefined}})}>Hiện lại</button>}
                      <select
                        value={p.textStyles[key].font}
                        onChange={(e) =>
                          p.setTextStyles({
                            ...p.textStyles,
                            [key]: {
                              ...p.textStyles[key],
                              font: e.target.value,
                            },
                          })
                        }
                      >
                        {(['Core', 'CoolText'] as const).map((group) => (
                          <optgroup
                            key={group}
                            label={group === 'CoolText' ? 'CoolText · Title Fonts' : 'Cơ bản'}
                          >
                            {STUDIO_TITLE_FONTS.filter((font) => font.group === group).map((font) => (
                              <option key={font.id} value={font.family}>
                                {font.label}{group === 'CoolText' ? ` · ${font.hint}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <input
                        type="color"
                        value={p.textStyles[key].color}
                        onChange={(e) =>
                          p.setTextStyles({
                            ...p.textStyles,
                            [key]: {
                              ...p.textStyles[key],
                              color: e.target.value,
                            },
                          })
                        }
                      />
                      <input
                        type="range"
                        min="40"
                        max="220"
                        value={p.layout[key].scale}
                        onChange={(e) =>
                          p.setLayout({
                            ...p.layout,
                            [key]: { ...p.layout[key], scale: +e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              {id === 'wave' && (
                <p className="sd-control-hint">
                  Chọn kiểu sóng rồi kéo trực tiếp vùng sóng trên preview.
                </p>
              )}
              {id === 'wave' && (
                <div className="sd-wave-studio">
                  <div className="sd-wave-style-grid">
                    {WAVE_STYLES.map((x) => (
                      <button
                        className={p.wave === x.id ? 'active' : ''}
                        onClick={() => p.setWave(x.id)}
                        key={x.id}
                        title={x.label}
                      >
                        <i className={'sd-wave-icon wave-'+x.id} />
                        <span>{x.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="sd-wave-look">
                    <div className="sd-wave-colors">
                      <label>Màu chính<input type="color" value={p.waveAppearance.color} onChange={e=>p.setWaveAppearance({...p.waveAppearance,color:e.target.value})}/></label>
                      <label>Màu phụ<input type="color" value={p.waveAppearance.color2} onChange={e=>p.setWaveAppearance({...p.waveAppearance,color2:e.target.value})}/></label>
                    </div>
                    {[
                      ['Kích thước',50,180,p.layout.wave.scale,(v:number)=>p.setLayout({...p.layout,wave:{...p.layout.wave,scale:v}}),'%'],
                      ['Glow',0,100,p.waveAppearance.glow,(v:number)=>p.setWaveAppearance({...p.waveAppearance,glow:v}),'%'],
                      ['Độ đậm',20,100,p.waveAppearance.opacity,(v:number)=>p.setWaveAppearance({...p.waveAppearance,opacity:v}),'%'],
                      ['Mật độ',20,100,p.waveAppearance.density,(v:number)=>p.setWaveAppearance({...p.waveAppearance,density:v}),'%'],
                      ['Mượt',0,100,p.waveAppearance.smoothing,(v:number)=>p.setWaveAppearance({...p.waveAppearance,smoothing:v}),'%'],
                    ].map(([label,min,max,value,setter,suffix])=><label className="sd-wave-slider" key={String(label)}><span>{String(label)} <b>{Number(value)}{String(suffix)}</b></span><input type="range" min={Number(min)} max={Number(max)} value={Number(value)} onChange={e=>(setter as (v:number)=>void)(+e.target.value)}/></label>)}
                    <p className="sd-control-hint">Kéo trực tiếp waveform trên preview để đặt vị trí. Preview và video xuất dùng cùng một renderer.</p>
                  </div>
                </div>
              )}
              {id === 'lyrics' && (
                <p className="sd-control-hint">
                  Bật subtitle rồi kéo trực tiếp chữ trên preview.
                </p>
              )}
              {id === 'lyrics' &&
                (['off', 'scroll', 'focus'] as LyricsMode[]).map((x) => (
                  <button
                    className={p.lyrics === x ? 'active' : ''}
                    onClick={() => p.setLyrics(x)}
                    key={x}
                  >
                    {x === 'off'
                      ? 'Off'
                      : x === 'scroll'
                        ? 'Scroll'
                        : 'Karaoke'}
                  </button>
                ))}
              {id === 'lyrics' && p.lyrics !== 'off' && (
                <>
                  <div className="sd-text-style">
                    <div>
                      <b>Kiểu subtitle</b>
                      <select
                        value={p.subtitleStyle.font || 'system'}
                        onChange={(e) =>
                          p.setSubtitleStyle({
                            ...p.subtitleStyle,
                            font: e.target.value as KaraokeDrawStyle['font'],
                          })
                        }
                      >
                        <option value="system">Modern</option>
                        <option value="serif">Serif</option>
                        <option value="rounded">Rounded</option>
                        <option value="mono">Mono</option>
                        <option value="impact">Impact</option>
                      </select>
                      <input
                        type="color"
                        value={p.subtitleStyle.color || '#ffffff'}
                        onChange={(e) =>
                          p.setSubtitleStyle({
                            ...p.subtitleStyle,
                            color: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <label className="sd-scale">
                    Kích thước chữ
                    <input
                      type="range"
                      min="60"
                      max="180"
                      value={p.layout.subtitle.scale}
                      onChange={(e) =>
                        p.setLayout({
                          ...p.layout,
                          subtitle: {
                            ...p.layout.subtitle,
                            scale: +e.target.value,
                          },
                        })
                      }
                    />
                    <span>{p.layout.subtitle.scale}%</span>
                  </label>
                </>
              )}
              {id === 'format' &&
                (['16:9', '9:16', '1:1', '4:5'] as VideoAspect[]).map((x) => (
                  <button
                    className={p.aspect === x ? 'active' : ''}
                    onClick={() => p.setAspect(x)}
                    key={x}
                  >
                    {x}
                  </button>
                ))}
              {id === 'background' && (
                <BackgroundPanel
                  onAddToTimeline={p.onAddToTimeline}
                  value={safeBackground}
                  onChange={p.setBackground}
                  onError={p.onError}
                />
              )}
              {id === 'effects' &&
                VIDEO_EFFECTS.map((x) => (
                  <button
                    className={p.effects.includes(x.id) ? 'active' : ''}
                    onClick={() => toggle(x.id)}
                    key={x.id}
                  >
                    {x.icon} {x.label}
                  </button>
                ))}
              {id === 'effects' && <div className="w-full space-y-3 rounded-xl border border-white/10 p-3">
                <p className="text-xs text-white/60">Điều chỉnh chung cho hiệu ứng đã bật. Góc xiên và kích thước áp dụng cho các hạt rơi như mưa, tuyết, lá, cánh hoa.</p>
                {([
                  ['speed','Tốc độ rơi',.2,3,.1,'×'],
                  ['angle','Góc xiên (− trái / + phải)',-60,60,1,'°'],
                  ['density','Mật độ hạt',.2,3,.1,'×'],
                  ['size','Kích thước / độ dày hạt',.5,3,.1,'×'],
                ] as const).map(([key,label,min,max,step,unit])=><label key={key} className="block text-xs text-white/70">{label} · {p.effectSettings[key]}{unit}<input aria-label={label} type="range" min={min} max={max} step={step} value={p.effectSettings[key]} onChange={e=>p.setEffectSettings({...p.effectSettings,[key]:Number(e.target.value)})} className="mt-2 block w-full accent-sky-300"/></label>)}
                <button type="button" onClick={()=>p.setEffectSettings({...DEFAULT_EFFECT_SETTINGS})}>Đặt lại hiệu ứng</button>
              </div>}
              {id === 'audio' && (
                <MasteringPanel audio={p.audioUrl} binary={p.audioBinary} title={p.songTitle} value={p.mastering} onChange={p.setMastering} />
              )}
              {id === 'trim' && (
                <div className="sd-trim">
                  <label>
                    Start{' '}
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, p.duration - 1)}
                      step=".1"
                      value={p.trimStart}
                      onChange={(e) =>
                        p.setTrimStart(Math.min(+e.target.value, p.trimEnd - 1))
                      }
                    />
                    <span>{fmt(p.trimStart)}</span>
                  </label>
                  <label>
                    End{' '}
                    <input
                      type="range"
                      min="1"
                      max={p.duration}
                      step=".1"
                      value={p.trimEnd}
                      onChange={(e) =>
                        p.setTrimEnd(Math.max(+e.target.value, p.trimStart + 1))
                      }
                    />
                    <span>{fmt(p.trimEnd)}</span>
                  </label>
                  <p>Output: {fmt(p.trimEnd - p.trimStart)}</p>
                </div>
              )}
          </div>
        </div>
      ))}
    </>
  );
}

export default function CreatorStudio({
  initialView = 'create',
}: {
  initialView?: AppView;
}) {
  const [view, setView] = useState<AppView>(initialView);
  const [autoPreview, setAutoPreview] = useState(true);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [homeSideCollapsed, setHomeSideCollapsed] = useState(false);
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);
  const [quickMode, setQuickMode] = useState(true);
  const [projects, setProjects] = useState<SavedProjectListItem[]>(readSavedProjectList);
  const [projectQuery, setProjectQuery] = useState('');
  const [libraryItems, setLibraryItems] = useState<LocalLibraryItem[]>(readLocalLibraryItems);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [url, setUrl] = useState('https://suno.com/s/tszo0jGdVUua4rT4'),
    [song, setSong] = useState<Song | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [playbackStart, setPlaybackStart] = useState(0),
    [previewTime, setPreviewTime] = useState(0),
    [timelinePauseSignal, setTimelinePauseSignal] = useState(0),
    [panel, setPanel] = useState('audio'),
    [mobileTools, setMobileTools] = useState(false),
    [savingProject, setSavingProject] = useState(false),
    [savedProject, setSavedProject] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [initTitle, setInitTitle] = useState('Đang khởi tạo bài hát');
  const [initDetail, setInitDetail] = useState('Chuẩn bị dữ liệu mới…');
  const [wave, setWave] = useState<WaveStyle>('bars'),
    [waveAppearance, setWaveAppearance] = useState<WaveAppearance>({...DEFAULT_WAVE_APPEARANCE}),
    [template, setTemplate] = useState<VisualTemplate>('cover-motion'),
    [aspect, setAspect] = useState<VideoAspect>('9:16'),
    [lyrics, setLyrics] = useState<LyricsMode>('focus'),
    [motion, setMotion] = useState<MotionIntensity>('medium'),
    [effects, setEffects] = useState<VideoEffect[]>([]),
    [rendering, setRendering] = useState(false),
    [renderStage, setRenderStage] = useState<'idle' | 'validation' | 'prepare' | 'render' | 'finalize'>('idle'),
    [lastRenderFailure, setLastRenderFailure] = useState<{
      mode: 'cut' | '30';
      stage: string;
      retryable: boolean;
      attempt: number;
      message: string;
    } | null>(null),
    [progress, setProgress] = useState(0),
    [downloading, setDownloading] = useState('');
  const [renderNotice, setRenderNotice] = useState('');
  const [highlightNotice, setHighlightNotice] = useState('');
  useRenderWakeLock(rendering);

  const [masteringConfig, setMasteringConfig] = useState<ProductionMasteringConfig>(structuredClone(DEFAULT_PRODUCTION_MASTERING));
  const [exportConfig, setExportConfig] = useState<ProductionExportConfig>({...DEFAULT_PRODUCTION_EXPORT,aspect:'9:16'});
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [lastPresetId, setLastPresetId] = useState<string | null>(null);
  const [presetModified, setPresetModified] = useState(false);
  const [presetOverrideFields, setPresetOverrideFields] = useState<Array<keyof StudioPresetConfig>>([]);
  const [customPresets, setCustomPresets] = useState<StudioPreset[]>([]);
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>([]);
  const [presetUndo, setPresetUndo] = useState<{
    config: StudioPresetConfig;
    mastering: ProductionMasteringConfig;
    exportConfig: ProductionExportConfig;
    selectedId: string | null;
    modified: boolean;
    overrideFields: Array<keyof StudioPresetConfig>;
  } | null>(null);
  const [presetCommit, setPresetCommit] = useState<PresetVisualCommit | null>(null);

  const [resultBlob, setResultBlob] = useState<Blob | null>(null),
    [resultUrl, setResultUrl] = useState(''),
    [resultName, setResultName] = useState('');
  const [layout, setLayout] = useState<OverlayLayout>(DEFAULT_OVERLAY_LAYOUT);
  const [textStyles, setTextStyles] = useState<OverlayTextStyles>({
    title: { font: 'Georgia, serif', color: '#ffffff' },
    creator: { font: 'system-ui, sans-serif', color: '#d1d5db' },
  });
  const [editingText,setEditingText]=useState<'title'|'creator'|'subtitle'|null>(null);
  const [effectSettings,setEffectSettings]=useState<EffectSettings>({...DEFAULT_EFFECT_SETTINGS});
  const [background, setBackground] = useState<BackgroundConfig>(
    structuredClone(DEFAULT_BACKGROUND_CONFIG),
  );
  const [subtitleStyle, setSubtitleStyle] = useState<KaraokeDrawStyle>({
    font: 'system',
    color: '#ffffff',
    activeColor: '#f0abfc',
  });
  const [karaokeTimeline, setKaraokeTimeline] = useState<KaraokeLine[]>([]);
  const [karaokeSyncStatus, setKaraokeSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'fallback'>('idle');
  const [karaokeSyncMessage, setKaraokeSyncMessage] = useState('');
  const [subtitleNotice, setSubtitleNotice] = useState('');
  const [subtitleDebugEnabled, setSubtitleDebugEnabled] = useState(false);
  const [subtitleDebugOpen, setSubtitleDebugOpen] = useState(false);
  const [subtitleDebugLogs, setSubtitleDebugLogs] = useState<SubtitleDebugEntry[]>([]);
  const [webSpeechTesting, setWebSpeechTesting] = useState(false);
  const subtitleDebugEnabledRef = useRef(false);
  const subtitleDebugSeq = useRef(0);
  const [audioBinary, setAudioBinary] = useState<Blob | null>(null);
  const mediaCache = useRef<Map<string, Blob>>(new Map());
  const [mediaClips, setMediaClips] = useState<MediaClip[]>([]);
  const [timelineTracks, setTimelineTracks] = useState<TimelineTrackState>({
    audio: { hidden: false, muted: false, locked: false },
    visual: { hidden: false, muted: false, locked: false },
    subtitle: { hidden: false, muted: false, locked: false },
    effects: { hidden: false, muted: false, locked: false },
  });
  const studioModel = useMemo(
    () =>
      createStudioRenderModel({
        template,
        wave,
        waveAppearance,
        motion,
        aspect,
        lyrics,
        effects,
        effectSettings,
        layout,
        textStyles,
        subtitleStyle,
        background,
      }),
    [
      template,
      wave,
      waveAppearance,
      motion,
      aspect,
      lyrics,
      effects,
      effectSettings,
      layout,
      textStyles,
      subtitleStyle,
      background,
    ],
  );
  const visualSnapshot = studioModel.visual;
  const effectConfig = studioModel.effects;
  const visualHash = studioModel.fingerprint;
  const quickPresets = useMemo(
    () => (song ? recommendQuickPresets(song) : []),
    [song],
  );

  const homeFeaturedPresets = useMemo(() => {
    const featuredIds = [
      'sad-lyrics',
      'karaoke-pop',
      'neon-pulse',
      'cinematic-story',
      'romantic-letter',
      'midnight-drive',
    ];
    return featuredIds
      .map((id) => BUILTIN_STUDIO_PRESETS.find((preset) => preset.id === id))
      .filter((preset): preset is StudioPreset => Boolean(preset));
  }, []);
  const [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(0);
  const timelineMediaClips = useMemo<MediaClip[]>(
    () =>
      mediaClips.length
        ? mediaClips
        : song?.picture
          ? [{
              id: 'fallback-cover',
              type: 'image',
              url: song.picture,
              name: song.title || 'Ảnh bìa',
              start: 0,
              end: song.duration || trimEnd || 1,
              isDefault: true,
            }]
          : [],
    [mediaClips, song?.picture, song?.title, song?.duration, trimEnd],
  );
  const timer = useRef<number | undefined>(undefined);
  const editedFieldsTracked = useRef(new Set<keyof StudioPresetConfig>());
  const previewPlayTracked = useRef(false);
  const firstExportTracked = useRef(false);
  const resolvedAt = useRef<number | null>(null);
  const lastPerfTrack = useRef(0);
  const karaokeSyncRun = useRef(0);
  const initialRouteHandled = useRef(false);

  const pushSubtitleDebug = (
    message: string,
    data?: Record<string, SubtitleDebugValue>,
  ) => {
    if (!subtitleDebugEnabledRef.current) return;
    const entry: SubtitleDebugEntry = {
      id: ++subtitleDebugSeq.current,
      time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      message,
      data,
    };
    console.info('[SUBTITLE DEBUG]', message, data || '');
    setSubtitleDebugLogs((logs) => [...logs.slice(-199), entry]);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHomeSideCollapsed(
      localStorage.getItem('sunodown-v23-home-side-collapsed') === '1',
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const enabled =
      new URLSearchParams(window.location.search).get('debug') === 'subtitle';
    subtitleDebugEnabledRef.current = enabled;
    setSubtitleDebugEnabled(enabled);
    setSubtitleDebugOpen(enabled);
    if (!enabled) return;

    const nav = navigator as Navigator & {
      userAgentData?: { mobile?: boolean };
    };
    const entry: SubtitleDebugEntry = {
      id: ++subtitleDebugSeq.current,
      time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      message: 'debug-enabled',
      data: {
        uaMobile: nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent),
        touchPoints: nav.maxTouchPoints || 0,
        online: navigator.onLine,
      },
    };
    setSubtitleDebugLogs([entry]);
  }, []);

  const testSafariSpeechTrack = async () => {
    if (!audioBinary || webSpeechTesting) {
      pushSubtitleDebug('web-speech-unavailable', {
        hasAudio: Boolean(audioBinary),
        testing: webSpeechTesting,
      });
      return;
    }

    type BrowserSpeechRecognition = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: (track?: MediaStreamTrack) => void;
      stop: () => void;
      abort: () => void;
      onstart: (() => void) | null;
      onaudiostart: (() => void) | null;
      onspeechstart: (() => void) | null;
      onspeechend: (() => void) | null;
      onresult: ((event: any) => void) | null;
      onerror: ((event: any) => void) | null;
      onend: (() => void) | null;
    };
    type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

    const SpeechRecognitionCtor =
      ((window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition) as
        | BrowserSpeechRecognitionCtor
        | undefined;

    if (!SpeechRecognitionCtor) {
      pushSubtitleDebug('web-speech-unsupported', {
        speechRecognition: false,
      });
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioCtx) {
      pushSubtitleDebug('web-speech-unsupported', {
        speechRecognition: true,
        audioContext: false,
      });
      return;
    }

    setWebSpeechTesting(true);
    const objectUrl = URL.createObjectURL(audioBinary);
    const audio = new Audio(objectUrl);
    audio.preload = 'auto';
    audio.playsInline = true;

    let context: AudioContext | null = null;
    let track: MediaStreamTrack | null = null;
    let recognition: BrowserSpeechRecognition | null = null;
    let stopTimer: number | undefined;
    let endTimer: number | undefined;
    let finished = false;
    let stopRequested = false;
    const startAt =
      previewTime > 1
        ? Math.max(0, previewTime)
        : Math.min(12, Math.max(0, (song?.duration || 0) - 22));

    const cleanup = async (reason: string) => {
      if (finished) return;
      finished = true;
      if (stopTimer) window.clearTimeout(stopTimer);
      if (endTimer) window.clearTimeout(endTimer);
      audio.pause();
      try {
        recognition?.abort();
      } catch {}
      try {
        track?.stop();
      } catch {}
      try {
        await context?.close();
      } catch {}
      URL.revokeObjectURL(objectUrl);
      setWebSpeechTesting(false);
      pushSubtitleDebug('web-speech-test-finished', {
        reason,
        audioTime: Math.round(audio.currentTime * 100) / 100,
      });
    };

    try {
      context = new AudioCtx();
      await context.resume();

      const source = context.createMediaElementSource(audio);
      const streamDestination = context.createMediaStreamDestination();
      const silentGain = context.createGain();
      silentGain.gain.value = 0;

      source.connect(streamDestination);
      source.connect(silentGain);
      silentGain.connect(context.destination);

      track = streamDestination.stream.getAudioTracks()[0] || null;
      if (!track) throw new Error('Không tạo được audio MediaStreamTrack.');

      recognition = new SpeechRecognitionCtor();
      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;

      pushSubtitleDebug('web-speech-capability', {
        speechRecognition: true,
        trackKind: track.kind,
        trackState: track.readyState,
        audioType: audioBinary.type || 'unknown',
        startAt: Math.round(startAt * 100) / 100,
        testSeconds: 20,
      });

      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (Number.isFinite(startAt) && startAt > 0) {
            try {
              audio.currentTime = Math.min(
                startAt,
                Math.max(0, audio.duration - 1),
              );
            } catch {}
          }
        },
        { once: true },
      );

      recognition.onstart = () => {
        pushSubtitleDebug('web-speech-start', {
          audioTime: Math.round(audio.currentTime * 100) / 100,
        });
      };
      recognition.onaudiostart = () => {
        pushSubtitleDebug('web-speech-audio-start', {
          audioTime: Math.round(audio.currentTime * 100) / 100,
        });
      };
      recognition.onspeechstart = () => {
        pushSubtitleDebug('web-speech-speech-start', {
          audioTime: Math.round(audio.currentTime * 100) / 100,
        });
      };
      recognition.onspeechend = () => {
        pushSubtitleDebug('web-speech-speech-end', {
          audioTime: Math.round(audio.currentTime * 100) / 100,
        });
      };
      recognition.onresult = (event: any) => {
        const items: string[] = [];
        let bestConfidence = 0;
        let final = false;

        for (
          let index = event.resultIndex || 0;
          index < event.results.length;
          index++
        ) {
          const result = event.results[index];
          const alternative = result?.[0];
          const transcript = String(alternative?.transcript || '').trim();
          if (transcript) items.push(transcript);
          if (Number.isFinite(alternative?.confidence)) {
            bestConfidence = Math.max(
              bestConfidence,
              Number(alternative.confidence),
            );
          }
          final ||= Boolean(result?.isFinal);
        }

        pushSubtitleDebug('web-speech-result', {
          transcript: items.join(' ').slice(0, 500),
          final,
          confidence: Math.round(bestConfidence * 1000) / 1000,
          audioTime: Math.round(audio.currentTime * 100) / 100,
        });
      };
      recognition.onerror = (event: any) => {
        pushSubtitleDebug('web-speech-error', {
          error: String(event?.error || 'unknown'),
          message: String(event?.message || ''),
          audioTime: Math.round(audio.currentTime * 100) / 100,
        });
        void cleanup('error');
      };
      recognition.onend = () => {
        pushSubtitleDebug('web-speech-end', {
          stopRequested,
          audioTime: Math.round(audio.currentTime * 100) / 100,
        });
        void cleanup(stopRequested ? 'completed' : 'ended-early');
      };

      try {
        recognition.start(track);
      } catch (error) {
        throw new Error(
          `SpeechRecognition.start(track) bị từ chối: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      await audio.play();
      pushSubtitleDebug('web-speech-audio-playing', {
        startAt: Math.round(startAt * 100) / 100,
      });

      stopTimer = window.setTimeout(() => {
        if (finished) return;
        stopRequested = true;
        audio.pause();
        pushSubtitleDebug('web-speech-stop-requested', {
          audioTime: Math.round(audio.currentTime * 100) / 100,
        });
        try {
          recognition?.stop();
        } catch {
          void cleanup('stop-failed');
          return;
        }
        endTimer = window.setTimeout(() => {
          if (!finished) {
            pushSubtitleDebug('web-speech-end-timeout', {
              audioTime: Math.round(audio.currentTime * 100) / 100,
            });
            void cleanup('end-timeout');
          }
        }, 3000);
      }, 20_000);
    } catch (error) {
      pushSubtitleDebug('web-speech-test-error', {
        error: error instanceof Error ? error.message : String(error),
      });
      await cleanup('setup-error');
    }
  };

  const updateEditorUrl = (source: string, saved = false, replace = false) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    params.set(saved ? 'project' : 'source', source);
    const debugMode = new URLSearchParams(window.location.search).get('debug');
    if (debugMode) params.set('debug', debugMode);
    window.history[replace ? 'replaceState' : 'pushState'](
      { editor: true, source },
      '',
      `/editor?${params}`,
    );
  };

  useEffect(() => {
    if (!subtitleNotice) return;
    const timeout = window.setTimeout(() => setSubtitleNotice(''), 5200);
    return () => window.clearTimeout(timeout);
  }, [subtitleNotice]);

  const currentPresetConfig = (): StudioPresetConfig =>
    structuredClone(visualSnapshot);

  const markPresetField = (field: keyof StudioPresetConfig) => {
    if (!editedFieldsTracked.current.has(field)) {
      editedFieldsTracked.current.add(field);
      track('manual_edit', {
        field,
        preset_id: selectedPresetId,
        template,
        aspect,
      });
    }
    setPresetCommit(null);
    if (!selectedPresetId) return;
    setPresetModified(true);
    setPresetOverrideFields((fields) => fields.includes(field) ? fields : [...fields, field]);
  };

  const applyPreset = (
    preset: StudioPreset,
    mode: PresetApplyMode = 'replace-all',
  ) => {
    const current = currentPresetConfig();
    setPresetUndo({
      config: current,
      mastering: structuredClone(masteringConfig),
      exportConfig: structuredClone(exportConfig),
      selectedId: selectedPresetId,
      modified: presetModified,
      overrideFields: [...presetOverrideFields],
    });

    const transaction = createPresetApplyTransaction(current, preset, mode);
    const audit = auditPresetApplyTransaction(transaction);
    if (!audit.ok) {
      setError(`Preset apply blocked: ${audit.issues.join(', ')}`);
      return;
    }

    setMasteringConfig(structuredClone(transaction.production.mastering));
    setExportConfig(structuredClone(transaction.production.export));
    window.dispatchEvent(new CustomEvent('suno-master-preview',{detail:{profile:transaction.production.mastering.profile}}));
    window.dispatchEvent(new CustomEvent('suno-spatial-change',{detail:transaction.production.mastering.spatial || DEFAULT_PRODUCTION_MASTERING.spatial}));

    const commit = commitPresetVisualState(transaction.next, {
      setTemplate,
      setWave,
      setWaveAppearance: (value) =>
        setWaveAppearance({ ...DEFAULT_WAVE_APPEARANCE, ...value }),
      setMotion,
      setAspect,
      setLyrics,
      setEffects,
      setEffectSettings,
      setLayout,
      setTextStyles,
      setSubtitleStyle,
      setBackground,
    }, presetCommit?.revision || 0);

    setPresetCommit(commit);
    setSelectedPresetId(preset.id);
    setPresetModified(transaction.modified);
    setPresetOverrideFields(
      mode === 'preserve-custom' ? [...presetOverrideFields] : [],
    );
    localStorage.setItem('sunodown-v16-last-preset', preset.id);
    setLastPresetId(preset.id);
    track('production_recipe_applied', {
      preset_id:preset.id,
      mastering_profile:transaction.production.mastering.profile,
      export_quality:transaction.production.export.quality,
      export_duration_mode:transaction.production.export.durationMode,
      production_fingerprint:transaction.productionFingerprint,
    });
    track('preset_applied', {
      preset_id: preset.id,
      mode,
      template: commit.snapshot.template,
      wave: commit.snapshot.wave,
      aspect: commit.snapshot.aspect,
      lyrics: commit.snapshot.lyrics,
      visual_fingerprint: commit.fingerprint,
      production_fingerprint: transaction.productionFingerprint,
      mastering_profile: transaction.production.mastering.profile,
      export_quality: transaction.production.export.quality,
      export_duration_mode: transaction.production.export.durationMode,
      revision: commit.revision,
    });
    setResultBlob(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl('');
    }
    setError('');
  };

  const openHomeFeaturedPreset = async (preset: StudioPreset) => {
    if (!validSourceInput(url)) {
      setError('Hãy dán liên kết Suno vào ô Phân tích trước khi chọn mẫu.');
      document.querySelector<HTMLInputElement>('.sd-home-linkbox input')?.focus();
      return;
    }

    setError('');
    applyPreset(preset, 'replace-all');
    track('suggested_preset_selected', {
      preset_id: preset.id,
      category: preset.category,
      source: 'home_featured',
    });

    const resolved = await resolve(url, { replaceUrl: true });
    if (!resolved) return;
    setQuickMode(true);
  };

  const restorePresetSnapshot = () => {
    if (!presetUndo) return;
    const commit = commitPresetVisualState(presetUndo.config, {
      setTemplate,
      setWave,
      setWaveAppearance: (value) =>
        setWaveAppearance({ ...DEFAULT_WAVE_APPEARANCE, ...value }),
      setMotion,
      setAspect,
      setLyrics,
      setEffects,
      setEffectSettings,
      setLayout,
      setTextStyles,
      setSubtitleStyle,
      setBackground,
    }, presetCommit?.revision || 0);
    setPresetCommit(commit);
    setMasteringConfig(structuredClone(presetUndo.mastering));
    setExportConfig(structuredClone(presetUndo.exportConfig));
    window.dispatchEvent(new CustomEvent('suno-master-preview',{detail:{profile:presetUndo.mastering.profile}}));
    window.dispatchEvent(new CustomEvent('suno-spatial-change',{detail:presetUndo.mastering.spatial || DEFAULT_PRODUCTION_MASTERING.spatial}));
    setSelectedPresetId(presetUndo.selectedId);
    setPresetModified(presetUndo.modified);
    setPresetOverrideFields([...presetUndo.overrideFields]);
    setPresetUndo(null);
    setResultBlob(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl('');
    }
  };

  const persistCustomPresets = (items: StudioPreset[]) => {
    setCustomPresets(items);
    localStorage.setItem('sunodown-v16-custom-presets', JSON.stringify(items));
  };

  const capturePresetThumbnail = () => {
    const source = document.querySelector(
      '.sd-live-preview canvas',
    ) as HTMLCanvasElement | null;
    if (!source || !source.width || !source.height) return undefined;
    try {
      const width = 240;
      const height = Math.max(120, Math.round((source.height / source.width) * width));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return undefined;
      context.drawImage(source, 0, 0, width, height);
      return canvas.toDataURL('image/webp', 0.68);
    } catch {
      return undefined;
    }
  };

  const saveCurrentAsPreset = (name: string) => {
    const preset: StudioPreset = {
      schemaVersion: PRESET_SCHEMA_VERSION,
      id: `user-${Date.now()}`,
      name,
      description: 'Preset cá nhân lưu từ cấu hình hiện tại của Creator Studio.',
      category:
        [...BUILTIN_STUDIO_PRESETS, ...customPresets].find(
          (item) => item.id === selectedPresetId,
        )?.category || 'Social',
      badge: 'My preset',
      accent: subtitleStyle.activeColor || '#8b5cf6',
      secondary: textStyles.title.color || '#ffffff',
      thumbnail: capturePresetThumbnail(),
      builtin: false,
      config: currentPresetConfig(),
      mastering: structuredClone(masteringConfig),
      export: { ...exportConfig, aspect },
    };
    persistCustomPresets([preset, ...customPresets]);
    setSelectedPresetId(preset.id);
    setPresetModified(false);
    setPresetOverrideFields([]);
    setPresetCommit(createPresetVisualCommit(preset.config, presetCommit?.revision || 0));
  };

  const duplicatePreset = (source: StudioPreset) => {
    const copy: StudioPreset = {
      ...source,
      schemaVersion: PRESET_SCHEMA_VERSION,
      id: `user-${Date.now()}`,
      name: `${source.name} Copy`,
      description: `Bản sao tùy chỉnh từ ${source.name}.`,
      badge: 'My preset',
      thumbnail: source.thumbnail || capturePresetThumbnail(),
      builtin: false,
      config: clonePresetConfig(source.config),
      mastering: source.mastering ? structuredClone(source.mastering) : structuredClone(DEFAULT_PRODUCTION_MASTERING),
      export: source.export ? structuredClone(source.export) : { ...DEFAULT_PRODUCTION_EXPORT, aspect: source.config.aspect },
    };
    persistCustomPresets([copy, ...customPresets]);
    applyPreset(copy);
  };

  const renameCustomPreset = (preset: StudioPreset, name: string) => {
    const next = customPresets.map((item) =>
      item.id === preset.id ? { ...item, name } : item,
    );
    persistCustomPresets(next);
  };

  const updateCurrentPreset = (preset: StudioPreset) => {
    if (preset.builtin) return;
    const nextPreset: StudioPreset = {
      ...preset,
      schemaVersion: PRESET_SCHEMA_VERSION,
      accent: subtitleStyle.activeColor || preset.accent,
      secondary: textStyles.title.color || preset.secondary,
      thumbnail: capturePresetThumbnail() || preset.thumbnail,
      config: currentPresetConfig(),
      mastering: structuredClone(masteringConfig),
      export: { ...exportConfig, aspect },
    };
    const next = customPresets.map((item) =>
      item.id === preset.id ? nextPreset : item,
    );
    persistCustomPresets(next);
    setSelectedPresetId(preset.id);
    setPresetModified(false);
    setPresetOverrideFields([]);
    setPresetCommit(createPresetVisualCommit(nextPreset.config, presetCommit?.revision || 0));
  };

  const resetSelectedPreset = (preset: StudioPreset) => {
    applyPreset(preset, 'replace-all');
  };

  const exportPreset = (preset: StudioPreset) => {
    const payload: StudioPreset = {
      ...preset,
      schemaVersion: PRESET_SCHEMA_VERSION,
      config: clonePresetConfig(preset.config),
      ...normalizeProductionPreset({mastering:preset.mastering,export:preset.export},preset.config.aspect),
    };
    const filename = `${safeName(preset.name)}.sunodown-preset.json`;
    saveBlob(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      }),
      filename,
    );
  };

  const importPreset = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const normalized = normalizeStudioPreset(parsed);
      if (!normalized) throw new Error('Preset file is invalid.');
      const imported: StudioPreset = {
        ...normalized,
        schemaVersion: PRESET_SCHEMA_VERSION,
        id: `user-${Date.now()}`,
        name: normalized.name.endsWith(' Imported')
          ? normalized.name
          : `${normalized.name} Imported`,
        badge: 'Imported',
        builtin: false,
      };
      persistCustomPresets([imported, ...customPresets]);
      applyPreset(imported, 'replace-all');
      setError('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Không thể import preset này.',
      );
    }
  };

  const deleteCustomPreset = (preset: StudioPreset) => {
    persistCustomPresets(customPresets.filter((item) => item.id !== preset.id));
    if (selectedPresetId === preset.id) {
      setSelectedPresetId(null);
      setPresetModified(false);
      setPresetOverrideFields([]);
      setPresetCommit(null);
    }
    if (favoritePresetIds.includes(preset.id)) {
      const nextFavorites = favoritePresetIds.filter((id) => id !== preset.id);
      setFavoritePresetIds(nextFavorites);
      localStorage.setItem(
        'sunodown-v16-favorite-presets',
        JSON.stringify(nextFavorites),
      );
    }
  };

  const toggleFavoritePreset = (id: string) => {
    const next = favoritePresetIds.includes(id)
      ? favoritePresetIds.filter((item) => item !== id)
      : [...favoritePresetIds, id];
    setFavoritePresetIds(next);
    localStorage.setItem('sunodown-v16-favorite-presets', JSON.stringify(next));
  };

  async function generateSubtitlesInBackground(
    target: Song,
    audio: Blob,
    duration: number,
    syncRun: number,
  ) {
    setKaraokeSyncStatus('syncing');
    setKaraokeSyncMessage('Đang chuẩn bị subtitle…');
    pushSubtitleDebug('subtitle-run-start', {
      run: syncRun,
      audioBytes: audio.size,
      duration: Math.round(duration * 100) / 100,
      hasLyrics: Boolean(target.lyrics?.trim()),
      lyricChars: target.lyrics?.length || 0,
    });

    // Mobile backend emits useful chunk-by-chunk timelines before the whole
    // song has finished. Keep the best one so a later network/validation
    // failure never wipes already synchronized cues back to Subtitle 0.
    let bestPartialTimeline: KaraokeLine[] = [];

    const delays = [0, 2200];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (karaokeSyncRun.current !== syncRun) return;
      pushSubtitleDebug('attempt-start', {
        attempt: attempt + 1,
        totalAttempts: delays.length,
      });

      if (delays[attempt] > 0) {
        setKaraokeSyncMessage('Đang thử lại subtitle…');
        await new Promise<void>((resolveDelay) =>
          window.setTimeout(resolveDelay, delays[attempt]),
        );
        if (karaokeSyncRun.current !== syncRun) return;
      }

      try {
        const result = await runKaraokePipeline({
          audio,
          lyrics: target.lyrics,
          duration,
          language: 'vi',
          onProgress: ({ stage, engine, message }) => {
            if (karaokeSyncRun.current !== syncRun) return;
            pushSubtitleDebug('pipeline-progress', {
              stage,
              engine: engine || 'none',
              message,
            });
            const publicMessage =
              stage === 'prepare'
                ? 'Đang chuẩn bị subtitle…'
                : stage === 'done'
                  ? 'Subtitle đã sẵn sàng.'
                  : 'Đang xử lý subtitle…';
            setKaraokeSyncMessage(publicMessage);
          },
          onDebug: (message, data) => {
            if (karaokeSyncRun.current !== syncRun) return;
            pushSubtitleDebug(message, data);
          },
          onPartialTimeline: (partialTimeline) => {
            if (karaokeSyncRun.current !== syncRun || !partialTimeline.length) return;
            if (partialTimeline.length >= bestPartialTimeline.length) {
              bestPartialTimeline = partialTimeline;
            }
            pushSubtitleDebug('partial-timeline', {
              lines: partialTimeline.length,
              firstStart: Math.round((partialTimeline[0]?.start || 0) * 100) / 100,
              lastEnd: Math.round((partialTimeline.at(-1)?.end || 0) * 100) / 100,
            });
            setKaraokeTimeline(partialTimeline);
            setLyrics((mode) => (mode === 'off' ? 'focus' : mode));
            setKaraokeSyncMessage(
              `Đã tìm thấy ${partialTimeline.length} dòng subtitle…`,
            );
          },
        });

        if (karaokeSyncRun.current !== syncRun) return;
        if (!result.timeline.length) {
          throw new Error('Không tìm thấy lời có timestamp.');
        }

        const publicResultMessage =
          result.status === 'synced'
            ? 'Subtitle đã sẵn sàng.'
            : 'Subtitle đã được tạo. Nên kiểm tra lại trước khi xuất.';

        pushSubtitleDebug('subtitle-run-result', {
          status: result.status,
          engine: result.engine,
          confidence: result.quality.confidence,
          lines: result.timeline.length,
          attempts: result.attempts.length,
        });
        setKaraokeTimeline(result.timeline);
        setKaraokeSyncStatus(result.status);
        setKaraokeSyncMessage(publicResultMessage);
        setLyrics((mode) => (mode === 'off' ? 'focus' : mode));
        setSubtitleNotice(publicResultMessage);

        track(
          result.status === 'synced'
            ? 'karaoke_auto_sync_succeeded'
            : 'karaoke_auto_sync_fallback',
          {
            lines: result.timeline.length,
          },
        );
        return;
      } catch (error) {
        if (karaokeSyncRun.current !== syncRun) return;
        const debugError =
          error instanceof Error ? error.message : 'Unknown subtitle error';
        pushSubtitleDebug('attempt-failed', {
          attempt: attempt + 1,
          error: debugError,
          bestPartialLines: bestPartialTimeline.length,
        });
        track('karaoke_auto_sync_attempt_failed', {
          attempt: attempt + 1,
        });
      }
    }

    if (karaokeSyncRun.current !== syncRun) return;
    if (bestPartialTimeline.length) {
      pushSubtitleDebug('partial-preserved', {
        lines: bestPartialTimeline.length,
      });
      setKaraokeTimeline(bestPartialTimeline);
      setKaraokeSyncStatus('fallback');
      setLyrics((mode) => (mode === 'off' ? 'focus' : mode));
      setKaraokeSyncMessage(
        `Đã giữ ${bestPartialTimeline.length} dòng subtitle đã căn được · đang dùng bản fallback.`,
      );
      setSubtitleNotice(
        `Đã giữ ${bestPartialTimeline.length} dòng subtitle đã căn được. Có thể kiểm tra lại timing trước khi xuất.`,
      );
      track('karaoke_auto_sync_fallback', {
        lines: bestPartialTimeline.length,
        reason: 'partial_timeline_preserved',
      });
      return;
    }
    pushSubtitleDebug('subtitle-run-failed', {
      attempts: delays.length,
      partialLines: bestPartialTimeline.length,
    });
    setKaraokeTimeline([]);
    setKaraokeSyncStatus('fallback');
    setKaraokeSyncMessage('Chưa tạo được subtitle.');
    track('karaoke_auto_sync_failed', {
      attempts: delays.length,
    });
  }

  async function resolve(
    value = url,
    options: { generateSubtitles?: boolean; updateUrl?: boolean; replaceUrl?: boolean } = {},
  ): Promise<Song | null> {
    const startedAt = performance.now();
    pushSubtitleDebug('resolve-start', {
      sourceChars: value.length,
    });
    if (!validSourceInput(value)) {
      setError('Hãy dán liên kết Suno hợp lệ.');
      track('song_resolve_failed', { reason: 'invalid_url' });
      return null;
    }

    // Prepare only the media needed by the editor. Subtitle discovery starts
    // after the editor is visible and never blocks navigation into Studio.
    const syncRun = ++karaokeSyncRun.current;
    setSong(null);
    setHighlightNotice('');
    setKaraokeTimeline([]);
    setKaraokeSyncStatus('idle');
    setKaraokeSyncMessage('');
    setAudioBinary(null);
    setMediaClips([]);
    setBusy(true);
    setError('');
    setInitProgress(5);
    setInitTitle('Đang mở bài hát mới');
    setInitDetail('Đọc thông tin bài hát từ Suno…');
    track('song_resolve_started');

    try {
      const r = await fetch('/api/resolve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: value }),
        }),
        data = await r.json();
      if (!r.ok) throw Error(data.error || 'Không thể tải bài hát này.');
      if (karaokeSyncRun.current !== syncRun) return null;

      const hydrated: Song = {
        ...data,
        title: data.title || 'Suno song',
        creator: data.creator || 'Suno',
        picture: data.picture || '',
        lyrics:
          typeof data.lyrics === 'string'
            ? cleanLyricsForVideo(data.lyrics)
            : '',
        style: typeof data.style === 'string' ? data.style : '',
        tags: typeof data.tags === 'string' ? data.tags : '',
      };
      pushSubtitleDebug('resolve-metadata', {
        duration: Math.round((hydrated.duration || 0) * 100) / 100,
        hasLyrics: Boolean(hydrated.lyrics),
        lyricChars: hydrated.lyrics?.length || 0,
        hasPicture: Boolean(hydrated.picture),
      });
      const privateSource = hydrated.sourceToken || value;
      setUrl(privateSource);

      setInitProgress(24);
      setInitTitle('Đang tải âm thanh');
      setInitDetail('Chuẩn bị audio và dữ liệu preview…');

      let source = mediaCache.current.get(hydrated.audio) || null;
      if (!source) {
        const audioResponse = await fetch(hydrated.audio, { cache: 'no-store' });
        if (!audioResponse.ok) throw new Error('Không tải được binary audio.');
        source = await audioResponse.blob();
        mediaCache.current.set(hydrated.audio, source);
      }
      if (karaokeSyncRun.current !== syncRun) return null;
      pushSubtitleDebug('audio-loaded', {
        audioBytes: source.size,
        audioType: source.type || 'unknown',
      });

      const duration = hydrated.duration || 30;
      setInitProgress(82);
      setInitTitle('Đang dựng Studio');
      setInitDetail('Ghép audio và preview…');
      if (karaokeSyncRun.current !== syncRun) return null;

      setPlaybackStart(0);
      setPreviewTime(0);
      setTrimStart(0);
      setTrimEnd(duration);
      setAudioBinary(source);
      setKaraokeTimeline([]);
      setKaraokeSyncStatus('syncing');
      setKaraokeSyncMessage('Subtitle sẽ được tìm trong nền…');
      setMediaClips(hydrated.picture ? [{
        id: crypto.randomUUID(),
        type: 'image',
        url: /^https:\/\//i.test(hydrated.picture)
          ? `/api/image?source=${encodeURIComponent(hydrated.picture)}`
          : hydrated.picture,
        name: hydrated.title || 'Cover',
        start: 0,
        end: duration,
        isDefault: true,
      }] : []);
      setQuickMode(true);
      editedFieldsTracked.current.clear();
      previewPlayTracked.current = false;
      firstExportTracked.current = false;
      resolvedAt.current = performance.now();
      setLastRenderFailure(null);
      setInitProgress(100);
      setInitTitle('Sẵn sàng');
      setInitDetail('Mọi dữ liệu đã được khởi tạo.');
      setSong(hydrated);
      if (options.updateUrl !== false) updateEditorUrl(privateSource, false, options.replaceUrl);
      if (options.generateSubtitles !== false) {
        void generateSubtitlesInBackground(hydrated, source, duration, syncRun);
      }

      track('quick_create_started', {
        has_lyrics: Boolean(hydrated.lyrics),
        style_hint: (hydrated.style || hydrated.tags || 'unknown').slice(0, 80),
      });
      track('song_resolve_succeeded', {
        duration_ms: Math.round(performance.now() - startedAt),
        has_lyrics: Boolean(hydrated.lyrics),
        song_duration_s: Math.round(hydrated.duration || 0),
        subtitle_status: 'background_started',
      });
      return hydrated;
    } catch (e) {
      if (karaokeSyncRun.current !== syncRun) return null;
      const message = e instanceof Error ? e.message : 'Không thể tải bài hát này.';
      setSong(null);
      setKaraokeTimeline([]);
      setAudioBinary(null);
      setError(message);
      track('song_resolve_failed', {
        duration_ms: Math.round(performance.now() - startedAt),
        reason: message.slice(0, 120),
      });
      return null;
    } finally {
      if (karaokeSyncRun.current === syncRun) setBusy(false);
    }
  }

  function change(value: string) {
    setUrl(value);
    setError('');
    if (timer.current) clearTimeout(timer.current);
  }
  async function paste() {
    const value = await navigator.clipboard.readText();
    change(value);
  }
  const assertVisualParity = () => {
    const parity = assertStudioRenderParity(visualSnapshot, studioModel.visual);
    if (presetCommit && !presetModified) {
      const presetAudit = auditPresetVisualCommit(
        presetCommit,
        visualSnapshot,
        studioModel.visual,
      );
      if (!presetAudit.ok) {
        throw new Error(
          `Preset regression failed [r${presetAudit.revision}]: ${presetAudit.issues.join(', ')}`,
        );
      }
    }
    return parity;
  };

  const classifyRenderFailure = (message: string, stage: string) => {
    const lower = message.toLowerCase();
    const nonRetryable =
      stage === 'validation' ||
      lower.includes('preset regression') ||
      lower.includes('visual sync failed') ||
      lower.includes('invalid') ||
      lower.includes('unsupported');
    return { retryable: !nonRetryable };
  };

  const triggerQuickRender = (mode: 'cut' | '30') => {
    setError('');
    window.requestAnimationFrame(() => {
      document.querySelector('.sd-quick-create')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    void renderVideo(mode);
  };

  async function renderVideo(mode: 'cut' | '30' = 'cut', attempt = 1) {
    if (!song || rendering) return;
    const renderStartedAt = performance.now();
    let stage: 'validation' | 'prepare' | 'render' | 'finalize' = 'validation';
    setRendering(true);
    setRenderStage(stage);
    setProgress(0);
    setError('');
    setRenderNotice('');
    setHighlightNotice(mode === '30' ? 'Đang phân tích toàn bài để tìm đoạn cao trào 30 giây…' : '');
    setLastRenderFailure(null);
    track(attempt > 1 ? 'render_retry' : 'render_started', {
      mode,
      attempt,
      template,
      preset_id: selectedPresetId,
      aspect,
      plan: DEFAULT_PLAN,
    });
    const stageTrack = (next: typeof stage) => {
      stage = next;
      setRenderStage(next);
      track('render_stage', {
        mode,
        attempt,
        stage: next,
        elapsed_ms: Math.round(performance.now() - renderStartedAt),
        preset_id: selectedPresetId,
      });
    };
    try {
      track('render_stage', {
        mode,
        attempt,
        stage,
        elapsed_ms: 0,
        preset_id: selectedPresetId,
      });
      const parity = assertVisualParity();
      console.info('[SunoDown visual QA]', {
        fingerprint: parity.fingerprint,
        selectedPresetId,
        modified: presetModified,
      });

      stageTrack('prepare');
      const config = studioModel.effects;
      const available = Math.max(
        1,
        (trimEnd || song.duration || 30) - trimStart,
      );
      let startSeconds = trimStart;
      let previewSeconds =
        mode === '30' ? Math.min(30, available) : available;

      if (mode === '30' && available > 30.5) {
        try {
          let sourceForHighlight =
            audioBinary || mediaCache.current.get(song.audio) || null;
          if (!sourceForHighlight && song.audio) {
            const response = await fetch(song.audio, { cache: 'no-store' });
            if (response.ok) {
              sourceForHighlight = await response.blob();
              mediaCache.current.set(song.audio, sourceForHighlight);
              setAudioBinary(sourceForHighlight);
            }
          }

          if (sourceForHighlight) {
            const highlight = await findMusicHighlight(sourceForHighlight, {
              duration: song.duration || trimEnd || available,
              minStart: trimStart,
              maxEnd: trimEnd || song.duration || trimStart + available,
              windowSeconds: 30,
              karaokeTimeline,
            });
            startSeconds = highlight.startSeconds;
            previewSeconds = Math.max(
              1,
              Math.min(30, highlight.endSeconds - highlight.startSeconds),
            );
            setPlaybackStart(startSeconds);
            setPreviewTime(startSeconds);
            setHighlightNotice(
              `Đã chọn cao trào ${fmt(startSeconds)}–${fmt(startSeconds + previewSeconds)} · ưu tiên năng lượng, nhịp bùng và câu hát.`,
            );
            track('smart_30s_highlight_selected', {
              start_seconds: Math.round(startSeconds * 10) / 10,
              end_seconds: Math.round((startSeconds + previewSeconds) * 10) / 10,
              confidence: Math.round(highlight.confidence * 100) / 100,
              score: Math.round(highlight.score * 1000) / 1000,
              reason: highlight.reason,
              subtitle_lines: karaokeTimeline.length,
            });
          } else {
            setHighlightNotice(
              `Không đọc được audio để dò cao trào · dùng 30 giây từ ${fmt(trimStart)}.`,
            );
          }
        } catch (highlightError) {
          console.warn('[SunoDown highlight analysis fallback]', highlightError);
          setHighlightNotice(
            `Không phân tích được cao trào · dùng 30 giây từ ${fmt(trimStart)}.`,
          );
          track('smart_30s_highlight_fallback', {
            reason:
              highlightError instanceof Error
                ? highlightError.message.slice(0, 160)
                : 'unknown',
          });
        }
      } else if (mode === '30') {
        setHighlightNotice(
          `Bài/đoạn chọn dài ${fmt(available)} · dùng toàn bộ phần khả dụng.`,
        );
      }

      const visual = studioModel.visual;

      stageTrack('render');
      const blob = await generateVisualizerVideoArt(
        renderSong(song),
        visual.aspect,
        visual.wave,
        visual.template,
        {
          motion: visual.motion,
          lyrics: visual.lyrics,
          waveAppearance: visual.waveAppearance,
          layout: visual.layout,
          startSeconds,
          previewSeconds,
          onProgress: setProgress,
          effects: config,
          karaokeTimeline,
          mediaClips,
          overlayTextStyles: visual.textStyles,
          subtitleStyle: visual.subtitleStyle,
          background: visual.background,
          quality: exportConfig.quality,
          productionMastering: masteringConfig,
          onAudioFallback: (reason) => {
            setRenderNotice('iPhone không giải mã được mastering của nguồn này nên video sẽ dùng audio gốc để đảm bảo xuất thành công.');
            track('render_audio_fallback', {
              reason,
              preset_id: selectedPresetId,
              mastering_profile: masteringConfig.profile,
            });
          },
        },
      );

      stageTrack('finalize');
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const name = `${safeName(song.title)}${mode === '30' ? '-30s' : ''}.mp4`;
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(name);
      setProgress(100);
      const totalMs = Math.round(performance.now() - renderStartedAt);
      const timeToFirstExport =
        !firstExportTracked.current && resolvedAt.current
          ? Math.round(performance.now() - resolvedAt.current)
          : undefined;
      firstExportTracked.current = true;
      track('render_succeeded', {
        mode,
        attempt,
        duration_ms: totalMs,
        time_to_first_export_ms: timeToFirstExport,
        output_seconds: Math.round(previewSeconds),
        template,
        preset_id: selectedPresetId,
        visual_fingerprint: parity.fingerprint,
        mastering_profile: masteringConfig.profile,
        export_quality: exportConfig.quality,
         export_duration_mode: mode === '30' ? '30s' : exportConfig.durationMode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Không thể tạo video.';
      const classification = classifyRenderFailure(message, stage);
      setError(message);
      setLastRenderFailure({
        mode,
        stage,
        retryable: classification.retryable,
        attempt,
        message,
      });
      track('render_failed', {
        mode,
        attempt,
        duration_ms: Math.round(performance.now() - renderStartedAt),
        failure_stage: stage,
        retryable: classification.retryable,
        template,
        preset_id: selectedPresetId,
        reason: message.slice(0, 120),
      });
    } finally {
      setRendering(false);
      setRenderStage('idle');
    }
  }
  async function saveVideo() {
    if (!resultBlob) return;
    const file = new File([resultBlob], resultName || 'suno-video.mp4', {
      type: 'video/mp4',
    });
    if (
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) &&
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: resultName });
        track('video_saved', { method: 'share' });
        return;
      } catch {}
    }
    saveBlob(resultBlob, resultName || 'suno-video.mp4');
    track('video_saved', { method: 'download' });
  }
  async function downloadAudio(format: 'm4a' | 'mp3' | 'wav') {
    if (!song || downloading) return;
    setDownloading(format);
    setError('');
    try {
      let source = audioBinary || mediaCache.current.get(song.audio);
      if (!source) { const response = await fetch(song.audio, { cache: 'no-store' }); if (!response.ok) throw Error('Không tải được audio.'); source = await response.blob(); mediaCache.current.set(song.audio, source); setAudioBinary(source); }
      if (format === 'm4a') saveBlob(source, `${safeName(song.title)}.m4a`);
      else {
        const processed = await renderTikTokLikeAudio(source),
          blob = await convertProcessedAudio(processed, format);
        saveBlob(blob, `${safeName(song.title)}.${format}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được audio.');
    } finally {
      setDownloading('');
    }
  }
  function downloadLyrics(format: 'txt' | 'srt') {
    if (!song?.lyrics) return;
    const clean = cleanLyricsForVideo(song.lyrics);
    if (format === 'txt')
      saveBlob(
        new Blob([clean], { type: 'text/plain;charset=utf-8' }),
        `${safeName(song.title)}-lyrics.txt`,
      );
    else {
      if (!karaokeTimeline.length) {
        setError('Subtitle chưa có timestamp. Hãy chờ đồng bộ hoàn tất trước khi tải SRT.');
        return;
      }
      saveBlob(
        new Blob([exportSrt(karaokeTimeline)], {
          type: 'application/x-subrip;charset=utf-8',
        }),
        `${safeName(song.title)}-lyrics.srt`,
      );
    }
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(
    () => () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    },
    [resultUrl],
  );
  useEffect(() => {
    const config: EffectConfig = {
      effects,
      intensity: 1,
      speed: 1,
      opacity: 0.75,
      wind: 0,
    };
    localStorage.setItem('suno-v8-video-effects', JSON.stringify(config));
    window.dispatchEvent(
      new CustomEvent('suno-effects-change', { detail: config }),
    );
  }, [effects]);
  useEffect(() => {
    const cleanupAnalytics = initAnalytics();
    return cleanupAnalytics;
  }, []);
  useEffect(() => {
    void fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ user?: SignedInUser | null }>)
      .then((data) => setSignedInUser(data.user || null))
      .catch(() => setSignedInUser(null));
  }, []);

  useEffect(() => {
    const readProjects = () => setProjects(readSavedProjectList());
    const readLibrary = () => setLibraryItems(readLocalLibraryItems());
    window.addEventListener('sunodown-v10-library-change', readLibrary);
    window.addEventListener('storage', readLibrary);
    window.addEventListener('storage', readProjects);
    return () => {
      window.removeEventListener('sunodown-v10-library-change', readLibrary);
      window.removeEventListener('storage', readLibrary);
      window.removeEventListener('storage', readProjects);
    };
  }, []);

  useEffect(() => {
    try {
      const storedPresets = normalizeStoredPresets(
        JSON.parse(localStorage.getItem('sunodown-v16-custom-presets') || '[]'),
      );
      setCustomPresets(storedPresets);
      localStorage.setItem(
        'sunodown-v16-custom-presets',
        JSON.stringify(storedPresets),
      );
      setFavoritePresetIds(
        JSON.parse(localStorage.getItem('sunodown-v16-favorite-presets') || '[]'),
      );
      setLastPresetId(localStorage.getItem('sunodown-v16-last-preset'));
      const allPresets = [
        ...BUILTIN_STUDIO_PRESETS,
        ...storedPresets,
      ];
      const presetIssues = auditPresetLibrary(allPresets);
      if (presetIssues.length) {
        setError(
          `Preset QA failed: ${presetIssues.slice(0, 4).join(', ')}`,
        );
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (initialRouteHandled.current || window.location.pathname !== '/editor') return;
    initialRouteHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    const source = params.get('source');
    if (projectId) {
      void openProject({ url: projectId, title: 'Dự án đã lưu' });
    } else if (source && validSourceInput(source)) {
      setUrl(source);
      void resolve(source, { replaceUrl: true });
    }
  }, []);
  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== '/editor') {
        karaokeSyncRun.current += 1;
        setSong(null);
        setView('create');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  async function saveProject() {
    if (!song || !url) return;
    setSavingProject(true);
    setSavedProject(false);
    try {
      const media = await Promise.all(
        mediaClips.map(async ({ url: clipUrl, ...clip }) => ({
          ...clip,
          blob: await (await fetch(clipUrl)).blob(),
        })),
      );
      const backgroundAsset =
        background.mode === 'image' && background.imageUrl
          ? {
              kind: 'image' as const,
              blob: await (await fetch(background.imageUrl)).blob(),
              fingerprint: background.imageFingerprint,
            }
          : background.mode === 'video' && background.videoUrl
            ? {
                kind: 'video' as const,
                blob: await (await fetch(background.videoUrl)).blob(),
                fingerprint: background.videoFingerprint,
              }
            : undefined;
      await saveProjectData({
        schemaVersion: 3,
        url,
        title: song.title,
        updatedAt: Date.now(),
        wave,
        waveAppearance,
        template,
        aspect,
        lyrics,
        motion,
        quickMode,
        activePanel: panel,
        selectedPresetId,
        presetModified,
        presetOverrideFields,
        effects,
        effectSettings,
        layout,
        textStyles,
        subtitleStyle,
        background,
        backgroundAsset,
        trimStart,
        trimEnd,
        mastering: masteringConfig,
        exportConfig,
        timelineTracks,
        karaokeSyncStatus,
        karaokeSyncMessage,
        karaokeTimeline,
        media,
        audioAsset:
          url.startsWith('local-audio:') && audioBinary
            ? { blob: audioBinary, duration: song.duration || trimEnd, title: song.title }
            : undefined,
      });
      const next = [
        { url, title: song.title },
        ...projects.filter((x) => x.url !== url),
      ].slice(0, 30);
      setProjects(next);
      localStorage.setItem('sundown-projects', JSON.stringify(next));
      setSavedProject(true);
      updateEditorUrl(url, true);
      track('project_saved', {
        preset_id: selectedPresetId,
        template,
        aspect,
      });
      window.setTimeout(() => setSavedProject(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được dự án.');
    } finally {
      setSavingProject(false);
    }
  }
  async function openProject(item: { url: string; title: string }) {
    setView('create');
    track('project_resumed');
    setUrl(item.url);
    const project = await loadProjectData(item.url);
    if (!project) return;
    let restoredSong: Song;
    let restoredAudio: Blob | null = null;
    if (project.audioAsset) {
      const audio = URL.createObjectURL(project.audioAsset.blob);
      const coverAsset = project.media.find((clip) => clip.isDefault)?.blob;
      const picture = coverAsset ? URL.createObjectURL(coverAsset) : undefined;
      setAudioBinary(project.audioAsset.blob);
      restoredSong = {
        title: project.audioAsset.title,
        creator: 'Local audio',
        duration: project.audioAsset.duration,
        audio,
        picture,
      };
      restoredAudio = project.audioAsset.blob;
      setSong(restoredSong);
      setPlaybackStart(0);
      setPreviewTime(0);
    } else {
      const resolved = await resolve(item.url, { generateSubtitles: false, updateUrl: false });
      if (!resolved) return;
      restoredSong = resolved;
      restoredAudio = mediaCache.current.get(resolved.audio) || null;
    }
    setWave(project.wave);
    setWaveAppearance({ ...DEFAULT_WAVE_APPEARANCE, ...project.waveAppearance });
    setTemplate(project.template);
    setAspect(project.aspect);
    setLyrics(project.lyrics);
    setMotion(project.motion || 'medium');
    setQuickMode(project.quickMode ?? false);
    setPanel(project.activePanel || 'audio');
    setSelectedPresetId(project.selectedPresetId || null);
    setPresetModified(Boolean(project.presetModified));
    setPresetOverrideFields(project.presetOverrideFields || []);
    setEffects(project.effects);
    setEffectSettings(normalizeEffectSettings(project.effectSettings));
    setLayout(project.layout);
    if (project.textStyles) setTextStyles(project.textStyles);
    if (project.subtitleStyle) setSubtitleStyle(project.subtitleStyle);
    if (project.background) {
      const restoredBackground = structuredClone(project.background);
      if (project.backgroundAsset) {
        const assetUrl = URL.createObjectURL(project.backgroundAsset.blob);
        if (project.backgroundAsset.kind === 'image') {
          restoredBackground.mode = 'image';
          restoredBackground.imageUrl = assetUrl;
          restoredBackground.videoUrl = undefined;
          restoredBackground.imageFingerprint =
            project.backgroundAsset.fingerprint;
        } else {
          restoredBackground.mode = 'video';
          restoredBackground.videoUrl = assetUrl;
          restoredBackground.imageUrl = undefined;
          restoredBackground.videoFingerprint =
            project.backgroundAsset.fingerprint;
        }
      }
      setBackground(restoredBackground);
    } else setBackground(structuredClone(DEFAULT_BACKGROUND_CONFIG));
    setTrimStart(project.trimStart);
    setTrimEnd(project.trimEnd);
    setMasteringConfig(structuredClone(project.mastering || DEFAULT_PRODUCTION_MASTERING));
    setExportConfig({
      ...DEFAULT_PRODUCTION_EXPORT,
      aspect: project.aspect,
      ...project.exportConfig,
    });
    setTimelineTracks(project.timelineTracks || {
      audio: { hidden: false, muted: false, locked: false },
      visual: { hidden: false, muted: false, locked: false },
      subtitle: { hidden: false, muted: false, locked: false },
      effects: { hidden: false, muted: false, locked: false },
    });
    setKaraokeTimeline(project.karaokeTimeline);
    setKaraokeSyncStatus(
      project.karaokeTimeline.length
        ? (project.karaokeSyncStatus === 'fallback' ? 'fallback' : 'synced')
        : (project.karaokeSyncStatus || 'idle'),
    );
    setKaraokeSyncMessage(
      project.karaokeSyncMessage ||
        (project.karaokeTimeline.length ? 'Subtitle đã được khôi phục từ dự án.' : ''),
    );
    setMediaClips(
      project.media.map(({ blob, ...clip }) => ({
        ...clip,
        url: URL.createObjectURL(blob),
      })),
    );
    setSavedProject(true);
    updateEditorUrl(item.url, true);
    if (
      !project.karaokeTimeline.length &&
      project.karaokeSyncStatus === 'syncing' &&
      restoredAudio
    ) {
      void generateSubtitlesInBackground(
        restoredSong,
        restoredAudio,
        restoredSong.duration || project.trimEnd || 30,
        karaokeSyncRun.current,
      );
    }
  }

  const readAudioDuration = (source: string) =>
    new Promise<number>((resolveDuration, reject) => {
      const player = document.createElement('audio');
      player.preload = 'metadata';
      player.onloadedmetadata = () =>
        Number.isFinite(player.duration) && player.duration > 0
          ? resolveDuration(player.duration)
          : reject(new Error('Không đọc được thời lượng audio.'));
      player.onerror = () => reject(new Error('File audio không hợp lệ hoặc không được trình duyệt hỗ trợ.'));
      player.src = source;
    });

  const createAudioCover = (title: string) =>
    new Promise<Blob>((resolveCover, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Không thể tạo ảnh bìa.'));
      const gradient = ctx.createLinearGradient(0, 0, 1200, 1200);
      gradient.addColorStop(0, '#17112d');
      gradient.addColorStop(0.52, '#5234b8');
      gradient.addColorStop(1, '#111827');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1200, 1200);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.arc(920, 220, 280, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 210px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('♫', 600, 570);
      ctx.font = '700 58px system-ui';
      const label = title.length > 28 ? `${title.slice(0, 27)}…` : title;
      ctx.fillText(label, 600, 760);
      ctx.fillStyle = 'rgba(255,255,255,.62)';
      ctx.font = '600 25px system-ui';
      ctx.fillText('SUNODOWN · LOCAL AUDIO', 600, 825);
      canvas.toBlob((blob) => blob ? resolveCover(blob) : reject(new Error('Không thể tạo ảnh bìa.')), 'image/png');
    });

  async function openAudioFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) {
      setError('Hãy chọn file audio MP3, WAV, M4A, AAC, OGG hoặc FLAC.');
      return;
    }
    const syncRun = ++karaokeSyncRun.current;
    setBusy(true);
    setError('');
    setInitProgress(12);
    setInitTitle('Đang mở file audio');
    setInitDetail('Đọc metadata và thời lượng…');
    try {
      const audio = URL.createObjectURL(file);
      const duration = await readAudioDuration(audio);
      const title = file.name.replace(/\.[^.]+$/, '') || 'Local audio';
      setInitProgress(55);
      setInitDetail('Tạo cover và timeline mặc định…');
      const coverBlob = await createAudioCover(title);
      const picture = URL.createObjectURL(coverBlob);
      const projectUrl = `local-audio:${Date.now()}:${encodeURIComponent(file.name)}`;
      setUrl(projectUrl);
      setAudioBinary(file);
      setKaraokeTimeline([]);
      setKaraokeSyncStatus('idle');
      setKaraokeSyncMessage('');
      setTrimStart(0);
      setTrimEnd(duration);
      setPlaybackStart(0);
      setPreviewTime(0);
      setLyrics('off');
      setMediaClips([{ id: crypto.randomUUID(), type: 'image', url: picture, name: title, start: 0, end: duration, isDefault: true }]);
      setSong({ title, creator: 'Local audio', duration, audio, picture });
      updateEditorUrl(projectUrl);
      setQuickMode(true);
      setInitProgress(100);
      void generateSubtitlesInBackground(
        { title, creator: 'Local audio', duration, audio, picture },
        file,
        duration,
        syncRun,
      );
      track('quick_create_started', { has_lyrics: false, style_hint: 'local_audio' });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không thể mở file audio.');
    } finally {
      setBusy(false);
    }
  }
  const invalidateRenderedResult = () => {
    setResultBlob(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl('');
    }
    setResultName('');
  };

  const changeVisual = (change: () => void) => {
    invalidateRenderedResult();
    change();
  };

  const addPexelsToTimeline: AddPexelsToTimeline = async (file,kind,duration) => {
    if(rendering)return;
    const endOfSong=Math.max(.1,song?.duration||trimEnd||30);
    const start=Math.max(0,Math.min(previewTime,endOfSong-.1));
    const length=kind==='video'&&typeof duration==='number'&&Number.isFinite(duration)&&duration>0?duration:5;
    const clip:MediaClip={id:crypto.randomUUID(),type:kind==='video'?'video':'image',url:URL.createObjectURL(file),name:file.name,start,end:Math.min(endOfSong,start+length)};
    invalidateRenderedResult();
    setMediaClips(clips=>[...clips,clip]);
    setTimelineTracks(tracks=>({...tracks,visual:{...tracks.visual,hidden:false}}));
    setAutoPreview(false);
    setTimelinePauseSignal(value=>value+1);
    setPlaybackStart(start);
    setPreviewTime(start);
    setQuickMode(false);
  };

  const toolControlsProps: Parameters<typeof ToolControls>[0] = {
    onAddToTimeline: addPexelsToTimeline,
    panel,
    setPanel,
    wave,
    setWave: (value) => { markPresetField('wave'); changeVisual(() => setWave(value)); },
    waveAppearance,
    setWaveAppearance: (value) => { markPresetField('waveAppearance'); changeVisual(() => setWaveAppearance(value)); },
    template,
    setTemplate: (value) => { markPresetField('template'); changeVisual(() => setTemplate(value)); },
    aspect,
    setAspect: (value) => { markPresetField('aspect'); changeVisual(() => setAspect(value)); },
    lyrics,
    setLyrics: (value) => { markPresetField('lyrics'); changeVisual(() => setLyrics(value)); },
    motion,
    setMotion: (value) => { markPresetField('motion'); changeVisual(() => setMotion(value)); },
    effectSettings,
    setEffectSettings:(value)=>{markPresetField('effectSettings');changeVisual(()=>setEffectSettings(value));},
    effects,
    setEffects: (value) => { markPresetField('effects'); changeVisual(() => setEffects(value)); },
    layout,
    setLayout: (value) => { markPresetField('layout'); changeVisual(() => setLayout(value)); },
    textStyles,
    setTextStyles: (value) => { markPresetField('textStyles'); changeVisual(() => setTextStyles(value)); },
    subtitleStyle,
    setSubtitleStyle: (value) => { markPresetField('subtitleStyle'); changeVisual(() => setSubtitleStyle(value)); },
    background,
    setBackground: (value) => { markPresetField('background'); changeVisual(() => setBackground(value)); },
    onError: setError,
    trimStart,
    trimEnd,
    duration: song?.duration || 0,
    audioUrl: song?.audio || '',
    audioBinary,
    songTitle: song?.title || 'suno',
    songPicture: song?.picture || undefined,
    mastering: masteringConfig,
    setMastering: (value) => {
      setMasteringConfig(value);
      invalidateRenderedResult();
    },
    exportConfig,
    setExportConfig: (value) => {
      setExportConfig(value);
      invalidateRenderedResult();
    },
    setTrimStart: (value) => {
      invalidateRenderedResult();
      setTrimStart(value);
    },
    setTrimEnd: (value) => {
      invalidateRenderedResult();
      setTrimEnd(value);
    },
  };

  const filteredProjects = projects.filter((project) =>
    `${project.title} ${project.url}`.toLowerCase().includes(projectQuery.toLowerCase()),
  );
  const filteredLibraryItems = libraryItems.filter((item) =>
    `${item.title} ${item.creator || ''} ${item.url}`.toLowerCase().includes(libraryQuery.toLowerCase()),
  );
  const projectCountLabel = `${projects.length} dự án`;
  const libraryCountLabel = `${libraryItems.length} bài`;
  const latestProject = projects[0];
  const latestLibraryItem = libraryItems[0];
  const openLibraryItem = (item: LocalLibraryItem) => {
    setView('create');
    setUrl(item.url);
    void resolve(item.url);
  };
  const removeProject = (project: SavedProjectListItem) => {
    const next = projects.filter((item) => item.url !== project.url);
    setProjects(next);
    localStorage.setItem('sundown-projects', JSON.stringify(next));
  };
  const clearLocalLibrary = () => {
    localStorage.removeItem('sunodown-v10-local-library');
    setLibraryItems([]);
    window.dispatchEvent(new CustomEvent('sunodown-v10-library-change'));
  };

  const analyzeHomeSource = () => {
    void resolve();
  };
  const toggleHomeSide = () => {
    setHomeSideCollapsed((collapsed) => {
      const next = !collapsed;
      localStorage.setItem(
        'sunodown-v23-home-side-collapsed',
        next ? '1' : '0',
      );
      return next;
    });
  };

  const navigationItems = [
    [Plus, 'Create', '/create', 'create'],
    [Music2, 'Music', '/music', 'music'],
    [Folder, 'Projects', '/projects', 'projects'],
    [BookOpen, 'Library', '/library', 'library'],
    [ListMusic, 'Jobs', '/jobs', 'jobs'],
    [Settings, 'Settings', '/settings', 'settings'],
  ] as const;
  const navigationMenu = (
    <nav className="sd-profile-menu" aria-label="Điều hướng chính">
      <div className="sd-profile-menu-head">
        <span className="sd-avatar">{signedInUser?.picture ? <img src={signedInUser.picture} alt="" /> : (signedInUser?.name?.[0] || 'S').toUpperCase()}</span>
        <span><b>{signedInUser?.name || 'SunoDown'}</b><small>{signedInUser?.email || 'Creator Studio'}</small></span>
      </div>
      {navigationItems.map(([Icon, label, href, id]) => (
        <a key={href} href={href} className={view === id ? 'sd-profile-menu-link active' : 'sd-profile-menu-link'}>
          <Icon /><span>{label}</span>
        </a>
      ))}
      <div className="sd-profile-auth">
        {signedInUser ? (
          <button onClick={() => { void fetch('/api/auth/logout', { method: 'POST' }).then(() => { setSignedInUser(null); setNavigationOpen(false); }); }}><LogOut /><span>Đăng xuất</span></button>
        ) : (
          <a href="/api/auth/google"><LogIn /><span>Đăng nhập với Google</span></a>
        )}
      </div>
    </nav>
  );

  return (
    <div className="sd-app">

      <header className="sd-header">
        <a className="sd-brand" href="/" aria-label="Về trang chủ SunoDown">
          <span>
            <Music2 />
          </span>
          <b>SunoDown</b>
        </a>
        {song ? (
          <div className="sd-loaded-group">
            <div className="sd-loaded">
              <i>✓</i> Suno song loaded
            </div>
            {song.id && song.isPublic !== false && (
              <a
                className="sd-song-public-link"
                href={song.handle ? `/music/@${song.handle}/${song.id}` : `/music/${song.id}`}
                target="_blank"
                rel="noopener"
                title="Mở trang nghe nhạc public"
              >
                <Play /> Trang bài hát
              </a>
            )}
          </div>
        ) : (
          <nav className="sd-home-head-nav" aria-label="Điều hướng Home">
            <a href="/" className={view === 'create' ? 'active' : ''}>Trang chủ</a>
            <a href="/music">Music</a>
            <a href="/projects" className={view === 'projects' ? 'active' : ''}>Dự án</a>
            <a href="/library" className={view === 'library' ? 'active' : ''}>Thư viện</a>
            <a href="/jobs" className={view === 'jobs' ? 'active' : ''}>Jobs</a>
          </nav>
        )}
        <div className="sd-head-actions">
          <Bell />
          <button className="sd-profile-trigger" aria-label="Mở menu tài khoản" aria-expanded={navigationOpen} onClick={() => setNavigationOpen((open) => !open)}>
            <span className="sd-avatar">{signedInUser?.picture ? <img src={signedInUser.picture} alt="" /> : (signedInUser?.name?.[0] || 'S').toUpperCase()}</span><ChevronDown />
          </button>
          {navigationOpen && navigationMenu}
        </div>
      </header>
      {subtitleNotice && (
        <output className="sd-subtitle-notice" aria-live="polite">
          <span><Sparkles /></span>
          <div>
            <b>Đã tìm thấy subtitle</b>
            <small>{subtitleNotice}</small>
          </div>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setSubtitleNotice('')}>×</button>
        </output>
      )}
      {navigationOpen && <button className="sd-nav-backdrop" aria-label="Đóng menu" onClick={() => setNavigationOpen(false)} />}

      {subtitleDebugEnabled && (
        <>
          <button
            type="button"
            className="sd-sub-debug-toggle"
            onClick={() => setSubtitleDebugOpen((open) => !open)}
          >
            SUB {karaokeTimeline.length} · {karaokeSyncStatus}
          </button>
          {subtitleDebugOpen && (
            <aside className="sd-sub-debug-panel" aria-label="Subtitle Debug Console">
              <header>
                <div>
                  <b>Subtitle Debug</b>
                  <small>{karaokeSyncStatus} · {karaokeTimeline.length} cues</small>
                </div>
                <button type="button" onClick={() => setSubtitleDebugOpen(false)}>×</button>
              </header>
              <div className="sd-sub-debug-summary">
                <span><b>Status</b><i>{karaokeSyncStatus}</i></span>
                <span><b>Cues</b><i>{karaokeTimeline.length}</i></span>
                <span><b>Message</b><i>{karaokeSyncMessage || '—'}</i></span>
              </div>
              <div className="sd-sub-debug-log">
                {subtitleDebugLogs.length ? subtitleDebugLogs.map((entry) => (
                  <div key={entry.id}>
                    <time>{entry.time}</time>
                    <b>{entry.message}</b>
                    {entry.data && <code>{JSON.stringify(entry.data)}</code>}
                  </div>
                )) : <p>Chưa có log.</p>}
              </div>
              <footer>
                <button
                  type="button"
                  disabled={!audioBinary || webSpeechTesting}
                  onClick={() => void testSafariSpeechTrack()}
                >
                  {webSpeechTesting ? 'Testing Speech…' : 'Test Safari Speech 20s'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = subtitleDebugLogs
                      .map((entry) => `[${entry.time}] ${entry.message} ${entry.data ? JSON.stringify(entry.data) : ''}`)
                      .join('\n');
                    void navigator.clipboard?.writeText(text);
                  }}
                >
                  Copy log
                </button>
                <button type="button" onClick={() => setSubtitleDebugLogs([])}>Clear</button>
              </footer>
            </aside>
          )}
        </>
      )}

      {view !== 'create' && (
        <section className={`sd-section-panel sd-section-${view}`}>
          <div className="sd-section-head">
            <div>
              <small>SUNODOWN</small>
              <h1>
                {view === 'projects'
                  ? 'Dự án'
                  : view === 'library'
                    ? 'Thư viện'
                    : view[0].toUpperCase() + view.slice(1)}
              </h1>
              <p>
                {view === 'projects'
                  ? 'Lưu, mở lại và tiếp tục dựng video từ những phiên gần đây.'
                  : view === 'library'
                    ? 'Tập hợp bài Suno đã mở, tải hoặc render trên thiết bị này.'
                    : 'Quản lý trạng thái SunoDown.'}
              </p>
            </div>
            <button onClick={() => setView('create')}>
              <Plus />
              Tạo mới
            </button>
          </div>
          {view === 'projects' && (
            <>
              <div className="sd-library-hero">
                <article>
                  <small>PROJECT HUB</small>
                  <h2>{projectCountLabel}</h2>
                  <p>
                    Project lưu toàn bộ preset, subtitle, timeline, media và cấu hình export.
                  </p>
                </article>
                <article>
                  <small>GẦN NHẤT</small>
                  <h2>{latestProject?.title || 'Chưa có'}</h2>
                  <p>{latestProject?.url || 'Lưu project đầu tiên từ Studio để tiếp tục sau.'}</p>
                </article>
                <article>
                  <small>TRẠNG THÁI</small>
                  <h2>{song ? 'Đang mở bài' : 'Sẵn sàng'}</h2>
                  <p>{song ? song.title : 'Chọn project hoặc tạo mới từ link Suno/audio.'}</p>
                </article>
              </div>
              <div className="sd-library-toolbar">
                <label>
                  <span>Tìm project</span>
                  <input
                    value={projectQuery}
                    onChange={(event) => setProjectQuery(event.target.value)}
                    placeholder="Tên dự án hoặc link Suno..."
                  />
                </label>
                {song && (
                  <button className="primary" onClick={() => void saveProject()}>
                    <Save />
                    {savingProject ? 'Đang lưu...' : 'Lưu project hiện tại'}
                  </button>
                )}
              </div>
              <div className="sd-project-list">
                {filteredProjects.length ? (
                  filteredProjects.map((project, index) => (
                    <article key={project.url}>
                      <button className="sd-project-open" onClick={() => void openProject(project)}>
                        <span><Folder /></span>
                        <b>{project.title}</b>
                        <small>{project.url}</small>
                        <i>{index === 0 ? 'Gần nhất' : 'Project'}</i>
                      </button>
                      <div>
                        <button onClick={() => void openProject(project)}>Mở</button>
                        <button onClick={() => removeProject(project)}>Ẩn khỏi danh sách</button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="sd-empty-state">
                    <Folder />
                    <b>Chưa có project phù hợp</b>
                    <span>Lưu project trong Studio hoặc đổi từ khoá tìm kiếm.</span>
                    <button onClick={() => setView('create')}>Tạo project mới</button>
                  </div>
                )}
              </div>
            </>
          )}
          {view === 'library' && (
            <>
              <div className="sd-library-hero">
                <article>
                  <small>LOCAL LIBRARY</small>
                  <h2>{libraryCountLabel}</h2>
                  <p>Những bài từng mở, tải audio hoặc render video trên máy này.</p>
                </article>
                <article>
                  <small>GẦN NHẤT</small>
                  <h2>{latestLibraryItem?.title || 'Chưa có'}</h2>
                  <p>{latestLibraryItem ? `${latestLibraryItem.creator || 'Suno'} · ${shortDate(latestLibraryItem.updatedAt)}` : 'Mở một bài Suno để tự động lưu vào thư viện.'}</p>
                </article>
                <article>
                  <small>FAVORITE</small>
                  <h2>{libraryItems.filter((item) => item.favorite).length}</h2>
                  <p>Bài đã đánh dấu yêu thích trong lịch sử local.</p>
                </article>
              </div>
              <div className="sd-library-toolbar">
                <label>
                  <span>Tìm bài hát</span>
                  <input
                    value={libraryQuery}
                    onChange={(event) => setLibraryQuery(event.target.value)}
                    placeholder="Tên bài, nghệ sĩ hoặc link Suno..."
                  />
                </label>
                {libraryItems.length > 0 && (
                  <button onClick={clearLocalLibrary}>Xóa lịch sử local</button>
                )}
              </div>
              <div className="sd-song-library-grid">
                {filteredLibraryItems.length ? (
                  filteredLibraryItems.map((item) => (
                    <article key={item.id || item.url}>
                      <span
                        className={item.picture ? 'has-cover' : ''}
                        style={item.picture ? { backgroundImage: `url("${item.picture}")` } : undefined}
                      >
                        {!item.picture && <Music2 />}
                      </span>
                      <button onClick={() => openLibraryItem(item)}>
                        <b>{item.title || 'Suno song'}</b>
                        <small>{item.creator || 'Suno'} · {fmt(item.duration || 0)}</small>
                        <em>
                          {localLibraryEventLabel[item.lastEvent || 'resolved'] || 'Đã mở'} · {shortDate(item.updatedAt)}
                          {item.collections?.length ? ` · ${item.collections.join(', ')}` : ''}
                        </em>
                      </button>
                      <a href={item.url} target="_blank" rel="noreferrer">Suno</a>
                    </article>
                  ))
                ) : (
                  <div className="sd-empty-state">
                    <BookOpen />
                    <b>Thư viện local còn trống</b>
                    <span>Dán link Suno ở trang chủ, tải audio hoặc render video để lưu lịch sử.</span>
                    <button onClick={() => setView('create')}>Mở bài mới</button>
                  </div>
                )}
              </div>
              <div className="sd-account-library-wrap">
                <AccountLibraryPanel
                  onOpenSong={(songUrl) => {
                    setView('create');
                    setUrl(songUrl);
                    void resolve(songUrl);
                  }}
                />
              </div>
            </>
          )}
          {view === 'jobs' && (
            <div className="sd-job-card">
              <ListMusic />
              <div>
                <b>{rendering ? 'Rendering video' : 'No active render job'}</b>
                <span>
                  {rendering
                    ? `${Math.round(progress)}% complete`
                    : 'Completed videos download automatically.'}
                </span>
              </div>
              {rendering && <i style={{ width: `${progress}%` }} />}
            </div>
          )}
          {view === 'settings' && (
            <div className="sd-settings">
              <label>
                <span>
                  <b>Auto-play preview</b>
                  <small>Play the full song when media is ready.</small>
                </span>
                <input
                  type="checkbox"
                  checked={autoPreview}
                  onChange={(e) => setAutoPreview(e.target.checked)}
                />
              </label>
              <div className="sd-plan-foundation">
                <b>Plan foundation</b>
                <span>
                  {DEFAULT_PLAN.toUpperCase()} · Advanced mastering {canUse(DEFAULT_PLAN, 'advanced_mastering') ? 'enabled' : 'locked'} · Pro entitlements ready
                </span>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('sundown-projects');
                  setProjects([]);
                  void clearProjectData();
                }}
              >
                Clear saved projects
              </button>
            </div>
          )}
        </section>
      )}
      {busy ? (
        <main className="sd-init-screen" aria-live="polite">
          <div className="sd-init-stage">
            <div className="sd-init-orbit" aria-hidden="true">
              <span />
              <i />
              <Music2 />
            </div>
            <small>CREATOR STUDIO</small>
            <h1>{initTitle}</h1>
            <p>{initDetail}</p>
            <div className="sd-init-progress">
              <div style={{ width: `${initProgress}%` }} />
            </div>
            <div className="sd-init-progress-meta">
              <b>{Math.round(initProgress)}%</b>
              <span>
                {initProgress < 25
                  ? 'Metadata'
                  : initProgress < 82
                    ? 'Audio'
                    : 'Studio'}
              </span>
            </div>
            <div className="sd-init-steps">
              <span className={initProgress >= 24 ? 'done' : 'active'}>01 · Bài hát</span>
              <span className={initProgress >= 82 ? 'done' : initProgress >= 24 ? 'active' : ''}>02 · Audio</span>
              <span className={initProgress >= 100 ? 'done' : initProgress >= 82 ? 'active' : ''}>03 · Studio</span>
            </div>
          </div>
        </main>
      ) : !song ? (
        <main className={`sd-empty sd-home-v23 ${homeSideCollapsed ? 'sd-home-side-collapsed' : ''}`}>
          <div className="sd-home-ambient" aria-hidden="true">
            <i className="orb-a" />
            <i className="orb-b" />
            <i className="orb-c" />
          </div>

          <aside className="sd-home-side" aria-label="Điều hướng nhanh">
            <button
              type="button"
              className="sd-home-side-collapse"
              onClick={toggleHomeSide}
              aria-label={homeSideCollapsed ? 'Mở rộng menu trái' : 'Thu gọn menu trái'}
              title={homeSideCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            >
              {homeSideCollapsed ? <ChevronRight /> : <ChevronLeft />}
              <span>{homeSideCollapsed ? 'Mở menu' : 'Thu gọn'}</span>
            </button>
            <button className="primary" disabled={busy} onClick={analyzeHomeSource} aria-label="Tạo mới từ link Suno" title="Tạo mới"><Plus /><span>{busy ? 'Đang phân tích…' : 'Tạo mới'}</span><i>›</i></button>
            <button onClick={() => setView('create')} aria-label="Từ link Suno" title="Từ link Suno"><Link2 /><span>Từ link Suno</span></button>
            <label className="sd-home-side-upload" aria-label="Tải audio lên" title="Tải audio lên">
              <Upload /><span>Tải audio lên</span>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                onChange={(event) => {
                  void openAudioFile(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <a className="sd-home-side-link" href="/music" aria-label="Music Player" title="Music Player"><Music2 /><span>Music Player</span></a>
            <a className="sd-home-side-link" href="/library" aria-label="Thư viện bài hát" title="Thư viện bài hát"><BookOpen /><span>Thư viện bài hát</span></a>
            <button aria-label="Preset và Style" title="Preset & Style" onClick={() => document.querySelector('.sd-home-featured')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Sparkles /><span>Preset & Style</span></button>
            <a className="sd-home-side-link" href="/projects" aria-label="Dự án" title="Dự án"><Folder /><span>Dự án</span></a>
            <a className="sd-home-side-link" href="/jobs" aria-label="Lịch sử render" title="Lịch sử render"><ListMusic /><span>Lịch sử render</span></a>

            <button className="sd-home-side-pro" onClick={() => setView('settings')} aria-label="Nâng cấp Pro" title="Nâng cấp Pro">
              <span>♛</span>
              <b>Nâng cấp Pro</b>
              <small>Không giới hạn, chất lượng cao hơn</small>
              <i>›</i>
            </button>
          </aside>

          <div className="sd-mobile-brand">
            <a className="sd-brand" href="/" aria-label="Về trang chủ SunoDown">
              <span><Music2 /></span>
              <b>SunoDown</b>
            </a>
            <button className="sd-mobile-menu-trigger" aria-label="Mở menu" onClick={() => setNavigationOpen((open) => !open)}><Menu /></button>
            {navigationOpen && navigationMenu}
          </div>

          <section className="sd-home-shell">
            <div className="sd-home-hero">
              <div className="sd-home-copy">
                <span className="sd-home-kicker"><Sparkles /> CREATOR STUDIO</span>
                <h1>
                  Turn your Suno song
                  <br />
                  <em>into stunning content</em>
                </h1>
                <p>
                  Biến nhạc Suno thành video lyric, karaoke và social video chuyên nghiệp
                  chỉ trong vài phút.
                </p>

                <div className="sd-home-analyze-row">
                  <div className="sd-home-linkbox">
                    <Link2 />
                    <input
                      value={url}
                      onChange={(e) => change(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void resolve()}
                      placeholder="https://suno.com/s/..."
                    />
                    <button type="button" onClick={paste}>Dán</button>
                  </div>
                  <button className="sd-home-analyze" disabled={busy} onClick={analyzeHomeSource}>
                    <Sparkles />
                    <span>{busy ? 'Đang phân tích…' : 'Phân tích'}</span>
                    <i>›</i>
                  </button>
                </div>

                <div className="sd-home-or"><span>HOẶC</span></div>

                <div className="sd-home-source-grid">
                  <label
                    className="sd-home-source-card"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void openAudioFile(event.dataTransfer.files[0]);
                    }}
                  >
                    <span className="icon"><Upload /></span>
                    <span className="copy">
                      <b>Tải file audio lên</b>
                      <small>MP3, WAV, M4A, AAC, OGG, FLAC</small>
                    </span>
                    <i>›</i>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                      onChange={(event) => {
                        void openAudioFile(event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>

                  <button className="sd-home-source-card" onClick={() => setView('library')}>
                    <span className="icon"><Music2 /></span>
                    <span className="copy">
                      <b>Thư viện bài hát</b>
                      <small>Quản lý bài đã lưu và quét theo tài khoản Suno</small>
                    </span>
                    <i>›</i>
                  </button>
                </div>

                {error && <div className="sd-error">{error}</div>}

                {projects[0] && (
                  <button className="sd-home-continue" onClick={() => void openProject(projects[0])}>
                    <Folder />
                    <span><small>TIẾP TỤC DỰ ÁN</small><b>{projects[0].title}</b></span>
                    <i>›</i>
                  </button>
                )}
              </div>

              <div className="sd-home-showcase" aria-label="Ví dụ video SunoDown">
                <div className="sd-home-showcase-glow" aria-hidden="true" />

                <div className="sd-home-tool-stack" aria-hidden="true">
                  <span><FileText /><b>Lyrics</b></span>
                  <span><Music2 /><b>Waveform</b></span>
                  <span><ImageIcon /><b>Background</b></span>
                  <span><Sparkles /><b>Preset</b></span>
                </div>

                <div className="sd-home-phone">
                  <div className="sd-home-phone-screen">
                    <img src="/home-cinematic-v23.svg" alt="" />
                    <span className="ratio">9:16</span>
                    <div className="lyrics">Có những ngày<br/>chỉ muốn đi thật xa...</div>
                    <div className="wave" aria-hidden="true" />
                    <div className="time"><span>00:42</span><span>03:18</span></div>
                    <div className="controls"><span>‹</span><b><Play /></b><span>›</span></div>
                  </div>
                </div>

                <div className="sd-home-control-card" aria-hidden="true">
                  <div className="thumb"><img src="/home-cinematic-v23.svg" alt="" /></div>
                  <b>Cinematic</b>
                  <label><span>Blur</span><i><u style={{width:'32%'}} /></i><small>30%</small></label>
                  <label><span>Zoom</span><i><u style={{width:'68%'}} /></i><small>100%</small></label>
                  <label><span>Glow</span><i><u style={{width:'50%'}} /></i><small>50%</small></label>
                </div>
              </div>
            </div>

            <div className="sd-home-benefits">
              <span><i>⚡</i><b>Nhanh chóng</b><small>Tạo video trong vài phút</small></span>
              <span><i>HD</i><b>Chất lượng cao</b><small>Preset và export sắc nét</small></span>
              <span><i>✦</i><b>Nhiều phong cách</b><small>Lyrics, cinematic, visualizer</small></span>
              <span><i>9:16</i><b>Tối ưu social</b><small>TikTok, Reels, Shorts</small></span>
              <span><i>☁</i><b>Không cần cài đặt</b><small>Dùng ngay trên trình duyệt</small></span>
            </div>

            <section className="sd-home-featured">
              <header>
                <div><span>🔥</span><b>Mẫu video nổi bật</b></div>
                <button onClick={() => setView('create')}>Xem tất cả <i>›</i></button>
              </header>
              <div className="sd-home-template-row">
                {homeFeaturedPresets.map((preset, index) => (
                  <button
                    key={preset.id}
                    className={`sd-home-template preset-${preset.id} ${index === 0 ? 'active' : ''}`}
                    onClick={() => void openHomeFeaturedPreset(preset)}
                    title={preset.description}
                  >
                    <span
                      className={`thumb scene-${preset.config.template}`}
                      style={{
                        backgroundImage: preset.thumbnail
                          ? `url(${preset.thumbnail})`
                          : 'url(/home-cinematic-v23.svg)',
                      }}
                    >
                      <em>{preset.badge || preset.category}</em>
                    </span>
                    <b>{preset.name}</b>
                    <i><Play /></i>
                  </button>
                ))}
              </div>
            </section>

            <footer className="sd-home-footer">
              <nav aria-label="Công cụ SunoDown">
                <a href="/tai-suno-mp3">Tải Suno MP3</a>
                <a href="/tai-suno-wav">Tải Suno WAV</a>
                <a href="/tai-video-suno">Tải & tạo video Suno</a>
              </nav>
              <span>
                MUSIC LIVES FURTHER · {process.env.NEXT_PUBLIC_BUILD_VERSION}
                {process.env.NEXT_PUBLIC_BUILD_IDENTITY && ` · ${process.env.NEXT_PUBLIC_BUILD_IDENTITY}`}
              </span>
            </footer>
          </section>
        </main>
      ) : (
        <main className={`sd-studio ${rendering ? 'sd-render-locked' : ''} ${quickMode ? 'sd-quick-mode' : ''}`}>
          <section className="sd-canvas-column">
            <div className="sd-mobile-title">
              <button onClick={() => setSong(null)}>‹</button>
              <img src={song.picture} />
              <div>
                <b>{song.title}</b>
                <span>{fmt(song.duration)} · Suno song</span>
              </div>
              <button className="sd-mobile-menu-trigger" aria-label="Mở menu" onClick={() => setNavigationOpen((open) => !open)}><Menu /></button>
              {navigationOpen && navigationMenu}
            </div>
            <div className="sd-stage sd-live-preview">
              <LivePreview
                song={renderSong(song)}
                aspect={studioModel.visual.aspect}
                template={studioModel.visual.template}
                wave={studioModel.visual.wave}
                waveAppearance={studioModel.visual.waveAppearance}
                motion={studioModel.visual.motion}
                lyrics={studioModel.visual.lyrics}
                layout={studioModel.visual.layout}
                textEditor={editingText&&song&&<PreviewTextEditor target={editingText} title={song.title} creator={song.creator||''} time={previewTime} styles={textStyles} subtitle={subtitleStyle} layout={layout} lines={karaokeTimeline} onStyles={toolControlsProps.setTextStyles} onSubtitle={toolControlsProps.setSubtitleStyle} onLayout={toolControlsProps.setLayout} onLines={lines=>{invalidateRenderedResult();setKaraokeTimeline(lines);}} onDelete={()=>{if(editingText==='subtitle')toolControlsProps.setLyrics('off');else toolControlsProps.setTextStyles({...textStyles,[editingText]:{...textStyles[editingText],text:''}});setEditingText(null);}} onClose={()=>setEditingText(null)}/>}
                onEditText={rendering?undefined:(key)=>{setAutoPreview(false);setTimelinePauseSignal(value=>value+1);setEditingText(key);}}
                onLayoutChange={rendering ? undefined : (value) => { markPresetField('layout'); changeVisual(() => setLayout(value)); }}
                start={trimStart}
                end={trimEnd || song.duration || undefined}
                seekTo={playbackStart}
                pauseSignal={timelinePauseSignal}
                exporting={rendering}
                autoPlay={autoPreview}
                fullPlayback
                onTimeChange={setPreviewTime}
                onPreviewPlay={() => {
                  if (previewPlayTracked.current) return;
                  previewPlayTracked.current = true;
                  track('preview_played', {
                    template,
                    preset_id: selectedPresetId,
                    aspect,
                    time_to_first_preview_ms: resolvedAt.current
                      ? Math.round(performance.now() - resolvedAt.current)
                      : undefined,
                  });
                }}
                onPerformance={(sample) => {
                  const now = Date.now();
                  if (now - lastPerfTrack.current < 15000) return;
                  lastPerfTrack.current = now;
                  track('preview_performance', {
                    ...sample,
                    template,
                    aspect,
                  });
                }}
                karaokeTimeline={karaokeTimeline}
                mediaClips={mediaClips}
                timelineTracks={timelineTracks}
                overlayTextStyles={studioModel.visual.textStyles}
                subtitleStyle={studioModel.visual.subtitleStyle}
                effects={effectConfig}
                background={studioModel.visual.background}
                audioBinary={audioBinary}
                resultUrl={resultUrl || undefined}
              />
            </div>
            {karaokeSyncStatus === 'syncing' && (
              <output
                className="sd-subtitle-job"
                aria-live="polite"
                aria-label="Đang tìm subtitle"
              >
                <i aria-hidden="true" />
                <span>
                  <b>Đang tìm subtitle…</b>
                  <small>Bạn vẫn có thể chỉnh sửa trong khi chạy nền.</small>
                </span>
              </output>
            )}
            <SuggestedBackground
              key={song.audio}
              onAddToTimeline={addPexelsToTimeline}
              songKey={song.audio}
              text={`${song.title} ${song.style || ''} ${song.tags || ''}`}
              aspect={aspect}
              background={background}
              disabled={rendering}
              onChange={toolControlsProps.setBackground}
              onBrowse={() => { setQuickMode(false); setPanel('background'); setMobileTools(true); }}
            />
            {quickMode && (
              <section className="sd-quick-create" aria-label="Quick Create">
                <div className="sd-quick-create-head">
                  <div>
                    <small>QUICK CREATE · V23</small>
                    <b>Chọn một mẫu, xem preview rồi xuất</b>
                    <span>Đã gợi ý theo style, lyrics và định dạng phù hợp với bài này.</span>
                  </div>
                  <button
                    className="sd-quick-customize"
                    disabled={rendering}
                    onClick={() => {
                      setQuickMode(false);
                      track('customize_opened', {
                        preset_id: selectedPresetId,
                        template,
                        aspect,
                      });
                    }}
                  >
                    <SlidersHorizontal /> Customize
                  </button>
                </div>
                <div className="sd-quick-presets">
                  {quickPresets.map((preset, index) => (
                    <button
                      key={preset.id}
                      className={selectedPresetId === preset.id ? 'active' : ''}
                      disabled={rendering}
                      onClick={() => {
                        applyPreset(preset, 'replace-all');
                        track('suggested_preset_selected', {
                          preset_id: preset.id,
                          rank: index + 1,
                          category: preset.category,
                        });
                      }}
                    >
                      <span
                        className={`scene-thumb scene-${preset.config.template}`}
                        style={{
                          backgroundImage: song.picture
                            ? `linear-gradient(#080b1299,#080b1299),url("${song.picture}")`
                            : undefined,
                        }}
                      />
                      <span>
                        <small>{index === 0 ? 'ĐỀ XUẤT' : preset.badge || preset.category}</small>
                        <b>{preset.name}</b>
                        <em>{preset.config.aspect} · {preset.config.lyrics === 'off' ? 'Visualizer' : 'Lyrics'} · {masteringLabel(normalizeProductionPreset({mastering:preset.mastering,export:preset.export},preset.config.aspect).mastering.profile)}</em>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="sd-quick-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={rendering}
                    onClick={() => triggerQuickRender('cut')}
                  >
                    <Upload />
                    {rendering
                      ? `${renderStage === 'validation' ? 'Checking' : renderStage === 'prepare' ? 'Preparing' : renderStage === 'finalize' ? 'Finalizing' : 'Rendering'} ${Math.round(progress)}%`
                      : 'Create video'}
                  </button>
                  <button
                    type="button"
                    disabled={rendering}
                    onClick={() => triggerQuickRender('30')}
                  >
                    <Play /> Tạo 30s cao trào
                  </button>
                </div>
                {highlightNotice && !error && (
                  <div className="sd-quick-highlight-status" role="status" aria-live="polite">
                    <Sparkles />
                    <span>{highlightNotice}</span>
                  </div>
                )}
                {renderNotice && !error && (
                  <div className="sd-quick-render-status" role="status" aria-live="polite">
                    <b>Đang dùng audio gốc</b>
                    <span>{renderNotice}</span>
                  </div>
                )}
                {(rendering || error || lastRenderFailure) && (
                  <div className={`sd-quick-render-status ${error ? 'error' : ''}`} role="status" aria-live="polite">
                    {rendering ? (
                      <>
                        <b>{renderStage === 'validation' ? 'Đang kiểm tra video…' : renderStage === 'prepare' ? 'Đang chuẩn bị media…' : renderStage === 'finalize' ? 'Đang hoàn tất video…' : 'Đang tạo video…'}</b>
                        <span>{Math.round(progress)}% · Không đóng trang trong khi đang xử lý.</span>
                      </>
                    ) : (
                      <>
                        <b>Không thể tạo video</b>
                        <span>{error || lastRenderFailure?.message || 'Render thất bại. Hãy thử lại.'}</span>
                        {lastRenderFailure?.retryable && (
                          <button type="button" onClick={() => triggerQuickRender(lastRenderFailure.mode)}>
                            Thử lại
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
            {lastPresetId && (
              <button
                className="sd-last-preset"
                disabled={rendering}
                onClick={() => {
                  const preset = [...BUILTIN_STUDIO_PRESETS, ...customPresets].find(
                    (item) => item.id === lastPresetId,
                  );
                  if (preset) applyPreset(preset, 'replace-all');
                }}
              >
                <Sparkles />
                <span>
                  <b>Dùng lại mẫu gần nhất</b>
                  <small>
                    {[...BUILTIN_STUDIO_PRESETS, ...customPresets].find(
                      (item) => item.id === lastPresetId,
                    )?.name || 'Mẫu đã dùng trước đó'}
                  </small>
                </span>
              </button>
            )}
            {!quickMode && <div className="sd-first-run-flow" aria-label="Quy trình tạo video nhanh">
              <button
                className="primary"
                disabled={rendering}
                onClick={() => {
                  setPanel('presets');
                  setMobileTools(true);
                }}
              >
                <b>1 · Chọn mẫu</b>
                Mẫu hoàn chỉnh
              </button>
              <span>
                <b>2 · Xem preview</b>
                Chạm Play để kiểm tra
              </span>
              <button disabled={rendering} onClick={() => renderVideo('cut')}>
                <b>3 · Xuất video</b>
                {rendering ? `${Math.round(progress)}%` : 'Tạo video'}
              </button>
            </div>}
            {resultUrl && (
              <div className="sd-result-actions">
                <div>
                  <b>Video ready</b>
                  <span>Play the exported video above or save it now.</span>
                </div>
                <button onClick={saveVideo}>
                  <Download />
                  <span className="sd-save-desktop">Download video</span>
                  <span className="sd-save-mobile">Save to Photos</span>
                </button>
              </div>
            )}
            <EditorTimeline
              duration={song.duration || 1}
              picture={song.picture}
              playhead={previewTime}
              onEditStart={() => {
                setAutoPreview(false);
                setTimelinePauseSignal((value) => value + 1);
              }}
              onSeek={(time) => {
                setPlaybackStart(time);
                setPreviewTime(time);
              }}
              onEditEnd={() => setTimelinePauseSignal((value) => value + 1)}
              subtitles={karaokeTimeline}
              onSubtitlesChange={(lines) => {
                markPresetField('lyrics');
                setKaraokeTimeline(lines);
              }}
              clips={timelineMediaClips}
              onClipsChange={setMediaClips}
              onTrackStateChange={setTimelineTracks}
              trackState={timelineTracks}
              audioBinary={audioBinary}
              audioUrl={song.audio}
              visualLabel={`${template} · ${background.mode}`}
              effectLabels={effects.length ? effects : ['Không có effect']}
            />
          </section>
          <aside className="sd-inspector">
            <div className="sd-song">
              <img src={song.picture} />
              <div>
                <h2>{song.title}</h2>
                <p>Created by {song.creator || 'Suno'}</p>
                <span>{fmt(song.duration)}</span>
              </div>
            </div>
            <button
              className={`sd-save-project ${savedProject ? 'saved' : ''}`}
              disabled={savingProject}
              onClick={() => void saveProject()}
            >
              <Save />
              {savingProject
                ? 'Đang lưu dự án…'
                : savedProject
                  ? 'Đã lưu dự án'
                  : 'Lưu dự án'}
            </button>
            <hr />
            <ToolControls {...toolControlsProps} presetContent={<PresetGallery
              presets={[...BUILTIN_STUDIO_PRESETS, ...customPresets]}
              selectedId={selectedPresetId}
              picture={song.picture}
              favoriteIds={favoritePresetIds}
              canUndo={Boolean(presetUndo)}
              modified={presetModified}
              onApply={applyPreset}
              onToggleFavorite={toggleFavoritePreset}
              onDuplicate={duplicatePreset}
              onRename={renameCustomPreset}
              onDelete={deleteCustomPreset}
              onSaveCurrent={saveCurrentAsPreset}
              onUpdateCurrent={updateCurrentPreset}
              onResetSelected={resetSelectedPreset}
              onExportPreset={exportPreset}
              onImportPreset={importPreset}
              onUndo={restorePresetSnapshot}
            />} />
            <div className="sd-visual-sync" title="Preview/render visual fingerprint">
              <span>Visual sync</span>
              <b>{visualHash}</b>
            </div>
            <div className="sd-actions">
              <button
                className="sd-export"
                disabled={rendering}
                onClick={() => renderVideo('cut')}
              >
                <Upload />{' '}
                {rendering
                  ? `${renderStage === 'validation' ? 'Checking' : renderStage === 'prepare' ? 'Preparing' : renderStage === 'finalize' ? 'Finalizing' : 'Rendering'} ${Math.round(progress)}%`
                  : `Export ${fmt(Math.max(0, trimEnd - trimStart))} video`}
              </button>
              {rendering && (
                <div className="sd-progress">
                  <i style={{ width: `${progress}%` }} />
                </div>
              )}
              {lastRenderFailure && (
                <div className="sd-render-retry" role="status">
                  <span>
                    Lỗi ở bước <b>{lastRenderFailure.stage}</b>
                    {lastRenderFailure.retryable
                      ? ' · có thể thử lại'
                      : ' · cần chỉnh cấu hình trước khi render lại'}
                  </span>
                  {lastRenderFailure.retryable && (
                    <button
                      disabled={rendering}
                      onClick={() =>
                        renderVideo(
                          lastRenderFailure.mode,
                          lastRenderFailure.attempt + 1,
                        )
                      }
                    >
                      Thử lại render
                    </button>
                  )}
                </div>
              )}
              <div className="sd-downloads">
                <button disabled={rendering} onClick={() => renderVideo('30')}>
                  <Play />
                  30s cao trào
                </button>
                <button
                  disabled={!!downloading}
                  onClick={() => downloadAudio('mp3')}
                >
                  <Download />
                  {downloading === 'mp3' ? 'Creating…' : 'MP3'}
                </button>
                <button
                  disabled={!!downloading}
                  onClick={() => downloadAudio('wav')}
                >
                  <Download />
                  {downloading === 'wav' ? 'Creating…' : 'WAV'}
                </button>
                <button
                  disabled={!!downloading}
                  onClick={() => downloadAudio('m4a')}
                >
                  <Music2 />
                  M4A
                </button>
                <button
                  disabled={!song.lyrics}
                  onClick={() => downloadLyrics('txt')}
                >
                  <FileText />
                  Lyrics
                </button>
                <button
                  disabled={!song.lyrics}
                  onClick={() => downloadLyrics('srt')}
                >
                  <FileText />
                  SRT
                </button>
                {song.picture && (
                  <a href={song.picture} download>
                    <ImageIcon />
                    Cover
                  </a>
                )}
              </div>
            </div>
          </aside>
          <div className="sd-mobile-export">
            <button type="button" disabled={rendering} onClick={() => triggerQuickRender('cut')}>
              <Upload />
              {rendering
                ? `${renderStage === 'validation' ? 'Checking' : renderStage === 'prepare' ? 'Preparing' : renderStage === 'finalize' ? 'Finalizing' : 'Rendering'} ${Math.round(progress)}%`
                : 'Create & export video'}
            </button>
            <nav>
              <button
                disabled={rendering}
                onClick={() => {
                  setPanel('presets');
                  setMobileTools(true);
                }}
              >
                <Sparkles />
                Mẫu
              </button>
              <button
                disabled={rendering}
                onClick={() => {
                  setPanel('style');
                  setMobileTools(true);
                }}
              >
                <SlidersHorizontal />
                Tùy chỉnh
              </button>
              <button
                disabled={rendering}
                onClick={() => {
                  setPanel('lyrics');
                  setMobileTools(true);
                }}
              >
                <FileText />
                Lời
              </button>
              <button type="button" disabled={rendering} onClick={() => triggerQuickRender('cut')}>
                <Upload />
                Xuất
              </button>
            </nav>
          </div>
        </main>
      )}
      {song && mobileTools && (
        <StudioSheet title="Điều khiển video" onClose={() => setMobileTools(false)} className="sd-tool-sheet">
          <ToolControls {...toolControlsProps} presetContent={<PresetGallery
              presets={[...BUILTIN_STUDIO_PRESETS, ...customPresets]}
              selectedId={selectedPresetId}
              picture={song.picture}
              favoriteIds={favoritePresetIds}
              canUndo={Boolean(presetUndo)}
              modified={presetModified}
              onApply={applyPreset}
              onToggleFavorite={toggleFavoritePreset}
              onDuplicate={duplicatePreset}
              onRename={renameCustomPreset}
              onDelete={deleteCustomPreset}
              onSaveCurrent={saveCurrentAsPreset}
              onUpdateCurrent={updateCurrentPreset}
              onResetSelected={resetSelectedPreset}
              onExportPreset={exportPreset}
              onImportPreset={importPreset}
              onUndo={restorePresetSnapshot}
            />} />
        </StudioSheet>
      )}
      {!song && <MobileAppNav />}
    </div>
  );
}
