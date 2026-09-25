'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRenderWakeLock } from '@/hooks/use-render-wake-lock';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Download,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2,
  ListMusic,
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
import { buildEstimatedKaraokeTimeline, exportSrt } from '@/app/lib/karaoke';
import { cleanLyricsForVideo } from '@/components/v4/lyrics-clean';
import { initAnalytics, track } from '@/app/lib/analytics';
import { DEFAULT_PLAN, canUse } from '@/app/lib/entitlements';
import type { KaraokeLine } from '@/app/lib/karaoke';
import { EditorTimeline, type MediaClip } from '@/components/editor-timeline';
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

type Song = {
  title: string;
  creator?: string;
  duration?: number;
  picture?: string;
  audio: string;
  video?: string;
  lyrics?: string;
  style?: string;
  tags?: string;
};

const fmt = (n = 0) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
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
const renderSong = (song: Song) => ({
  id: null,
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
function recommendQuickPresets(song: Song) {
  const haystack = `${song.style || ''} ${song.tags || ''} ${song.lyrics || ''}`.toLowerCase();
  const score = (preset: StudioPreset) => {
    let value = preset.config.aspect === '9:16' ? 2 : 0;
    if (song.lyrics && preset.config.lyrics !== 'off') value += 3;
    if (/ballad|sad|emotional|piano|acoustic|love|romantic/.test(haystack)) {
      if (['sad-lyrics','romantic-letter','acoustic-room','story-confession'].includes(preset.id)) value += 7;
    }
    if (/edm|electronic|dance|house|synth|techno|festival/.test(haystack)) {
      if (['neon-pulse','festival-energy','reels-velocity'].includes(preset.id)) value += 8;
    }
    if (/rap|hip hop|trap|fast|energetic|pop/.test(haystack)) {
      if (['social-hook','reels-velocity','neon-pulse'].includes(preset.id)) value += 5;
    }
    if (/chill|lofi|lo-fi|jazz|soul|retro/.test(haystack)) {
      if (['minimal-clean','midnight-drive','retro-vinyl'].includes(preset.id)) value += 6;
    }
    if (/podcast|spoken|speech|story/.test(haystack)) {
      if (['podcast-wave','story-confession'].includes(preset.id)) value += 8;
    }
    if (preset.id === 'social-hook') value += 1;
    return value;
  };
  return [...BUILTIN_STUDIO_PRESETS]
    .sort((a,b) => score(b) - score(a))
    .slice(0, QUICK_PRESET_LIMIT);
}

const makeEffectConfig = (effects: VideoEffect[]): EffectConfig => ({
  effects,
  intensity: 1,
  speed: 1,
  opacity: 0.75,
  wind: 0,
});

function ToolControls(p: {
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
                        <option value="system-ui, sans-serif">Modern</option>
                        <option value="Georgia, serif">Cinematic</option>
                        <option value="'Trebuchet MS', sans-serif">
                          Rounded
                        </option>
                        <option value="'Courier New', monospace">Mono</option>
                        <option value="Impact, sans-serif">Impact</option>
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

export default function CreatorStudio() {
  const [view, setView] = useState<
    'create' | 'projects' | 'library' | 'jobs' | 'settings'
  >('create');
  const [autoPreview, setAutoPreview] = useState(true);
  const [quickMode, setQuickMode] = useState(true);
  const [projects, setProjects] = useState<{ url: string; title: string }[]>(
    [],
  );
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
  const [background, setBackground] = useState<BackgroundConfig>(
    structuredClone(DEFAULT_BACKGROUND_CONFIG),
  );
  const [subtitleStyle, setSubtitleStyle] = useState<KaraokeDrawStyle>({
    font: 'system',
    color: '#ffffff',
    activeColor: '#f0abfc',
  });
  const [karaokeTimeline, setKaraokeTimeline] = useState<KaraokeLine[]>([]);
  const [audioBinary, setAudioBinary] = useState<Blob | null>(null);
  const mediaCache = useRef<Map<string, Blob>>(new Map());
  const [mediaClips, setMediaClips] = useState<MediaClip[]>([]);
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
  const [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const editedFieldsTracked = useRef(new Set<keyof StudioPresetConfig>());
  const previewPlayTracked = useRef(false);
  const firstExportTracked = useRef(false);
  const resolvedAt = useRef<number | null>(null);
  const lastPerfTrack = useRef(0);

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

  async function resolve(value = url): Promise<Song | null> {
    const startedAt = performance.now();
    if (!valid(value)) {
      setError('Hãy dán liên kết Suno hợp lệ.');
      track('song_resolve_failed', { reason: 'invalid_url' });
      return null;
    }
    setBusy(true);
    setError('');
    track('song_resolve_started');
    try {
      const r = await fetch('/api/resolve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: value }),
        }),
        data = await r.json();
      if (!r.ok) throw Error(data.error || 'Không thể tải bài hát này.');
      // Hydrate the complete song first: title/cover/lyrics/caption metadata must survive UI component migrations.
      const hydrated: Song = {
        ...data,
        title: data.title || 'Suno song',
        creator: data.creator || 'Suno',
        picture: data.picture || '',
        lyrics: typeof data.lyrics === 'string' ? data.lyrics : '',
        style: typeof data.style === 'string' ? data.style : '',
        tags: typeof data.tags === 'string' ? data.tags : '',
      };
      setSong(hydrated);
      // One remote load per media URL per session. Everything downstream reuses the binary.
      setAudioBinary(null);
      try {
        let source = mediaCache.current.get(hydrated.audio);
        if (!source) {
          const audioResponse = await fetch(hydrated.audio, { cache: 'no-store' });
          if (!audioResponse.ok) throw new Error('Không tải được binary audio.');
          source = await audioResponse.blob();
          mediaCache.current.set(hydrated.audio, source);
        }
        setAudioBinary(source);
      } catch (mediaError) {
        setError(mediaError instanceof Error ? mediaError.message : 'Không tải được binary audio.');
      }
      setPlaybackStart(0);
      setPreviewTime(0);
      setTrimStart(0);
      setTrimEnd(hydrated.duration || 30);
      setKaraokeTimeline(
        hydrated.lyrics
          ? buildEstimatedKaraokeTimeline(hydrated.lyrics, hydrated.duration || 30)
          : [],
      );
      setMediaClips([]);
      setQuickMode(true);
      editedFieldsTracked.current.clear();
      previewPlayTracked.current = false;
      firstExportTracked.current = false;
      resolvedAt.current = performance.now();
      setLastRenderFailure(null);
      track('quick_create_started', {
        has_lyrics: Boolean(hydrated.lyrics),
        style_hint: (hydrated.style || hydrated.tags || 'unknown').slice(0, 80),
      });
      track('song_resolve_succeeded', {
        duration_ms: Math.round(performance.now() - startedAt),
        has_lyrics: Boolean(hydrated.lyrics),
        song_duration_s: Math.round(hydrated.duration || 0),
      });
      return hydrated;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Không thể tải bài hát này.';
      setError(message);
      track('song_resolve_failed', {
        duration_ms: Math.round(performance.now() - startedAt),
        reason: message.slice(0, 120),
      });
      return null;
    } finally {
      setBusy(false);
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
      const startSeconds = trimStart;
      const available = Math.max(
        1,
        (trimEnd || song.duration || 30) - trimStart,
      );
      const previewSeconds =
        mode === '30' ? Math.min(30, available) : available;
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
      saveBlob(
        new Blob(
          [
            exportSrt(
              karaokeTimeline.length
                ? karaokeTimeline
                : buildEstimatedKaraokeTimeline(clean, song.duration || 1),
            ),
          ],
          {
            type: 'application/x-subrip;charset=utf-8',
          },
        ),
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
    try {
      setProjects(JSON.parse(localStorage.getItem('sundown-projects') || '[]'));
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
        url,
        title: song.title,
        updatedAt: Date.now(),
        wave,
        template,
        aspect,
        lyrics,
        motion,
        selectedPresetId,
        presetModified,
        presetOverrideFields,
        effects,
        layout,
        textStyles,
        subtitleStyle,
        background,
        backgroundAsset,
        trimStart,
        trimEnd,
        karaokeTimeline,
        media,
      });
      const next = [
        { url, title: song.title },
        ...projects.filter((x) => x.url !== url),
      ].slice(0, 30);
      setProjects(next);
      localStorage.setItem('sundown-projects', JSON.stringify(next));
      setSavedProject(true);
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
    if (!(await resolve(item.url))) return;
    const project = await loadProjectData(item.url);
    if (!project) return;
    setWave(project.wave);
    setTemplate(project.template);
    setAspect(project.aspect);
    setLyrics(project.lyrics);
    setMotion(project.motion || 'medium');
    setSelectedPresetId(project.selectedPresetId || null);
    setPresetModified(Boolean(project.presetModified));
    setPresetOverrideFields(project.presetOverrideFields || []);
    setEffects(project.effects);
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
    setKaraokeTimeline(project.karaokeTimeline);
    setMediaClips(
      project.media.map(({ blob, ...clip }) => ({
        ...clip,
        url: URL.createObjectURL(blob),
      })),
    );
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

  const toolControlsProps: Parameters<typeof ToolControls>[0] = {
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

  return (
    <div className="sd-app">
      <header className="sd-header">
        <div className="sd-brand">
          <span>
            <Music2 />
          </span>
          <b>SunoDown</b>
        </div>
        {song ? (
          <div className="sd-loaded">
            <i>✓</i> Suno song loaded
          </div>
        ) : (
          <div />
        )}
        <div className="sd-head-actions">
          <Bell />
          <span className="sd-avatar">S</span>
          <ChevronDown />
        </div>
      </header>
      <aside className="sd-sidebar">
        <nav>
          {[
            [Plus, 'Create', 'create'],
            [Folder, 'Projects', 'projects'],
            [BookOpen, 'Library', 'library'],
            [ListMusic, 'Jobs', 'jobs'],
            [Settings, 'Settings', 'settings'],
          ].map(([Icon, label, id]) => (
            <button
              key={String(id)}
              onClick={() => setView(id as typeof view)}
              className={view === id ? 'active' : ''}
            >
              {<Icon />}
              <span>{String(label)}</span>
            </button>
          ))}
        </nav>
      </aside>
      {view !== 'create' && (
        <section className="sd-section-panel">
          <div className="sd-section-head">
            <div>
              <small>SUNODOWN</small>
              <h1>{view[0].toUpperCase() + view.slice(1)}</h1>
            </div>
            {view === 'projects' && song && (
              <button onClick={() => void saveProject()}>
                + Save current project
              </button>
            )}
          </div>
          {view === 'projects' && (
            <div className="sd-section-grid">
              {projects.length ? (
                projects.map((x) => (
                  <button key={x.url} onClick={() => openProject(x)}>
                    <Folder />
                    <b>{x.title}</b>
                    <span>{x.url}</span>
                  </button>
                ))
              ) : (
                <p>No saved projects yet.</p>
              )}
            </div>
          )}
          {view === 'library' && (
            <AccountLibraryPanel
              onOpenSong={(songUrl) => {
                setView('create');
                setUrl(songUrl);
                void resolve(songUrl);
              }}
            />
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
      {!song ? (
        <main className="sd-empty">
          <div className="sd-mobile-brand">
            <div className="sd-brand">
              <span>
                <Music2 />
              </span>
              <b>SunoDown</b>
            </div>
            <Menu />
          </div>
          <div className="sd-empty-content">
            <p>SUNO CREATOR LIBRARY</p>
            <h1>
              Nhập tài khoản Suno
              <br />
              <em>quản lý toàn bộ bài hát</em>
            </h1>
            <p className="sd-control-hint">
              Nhập @username hoặc URL profile Suno. SunoDown sẽ quét các bài public và lưu thư viện ngay trên thiết bị.
            </p>
            <AccountLibraryPanel
              onOpenSong={(songUrl) => {
                setUrl(songUrl);
                void resolve(songUrl);
              }}
            />
            <div className="sd-choose">Hoặc mở nhanh một bài riêng lẻ</div>
            <div className="sd-input">
              <Link2 />
              <input
                value={url}
                onChange={(e) => change(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void resolve()}
                placeholder="Dán liên kết bài hát Suno"
              />
              <button onClick={paste}>Paste</button>
            </div>
            <button
              className="sd-analyze"
              disabled={busy}
              onClick={() => resolve()}
            >
              {busy ? 'Đang phân tích…' : 'Mở bài hát'}
            </button>
            {error && <div className="sd-error">{error}</div>}
            {projects[0] && (
              <button
                className="sd-resume-project"
                onClick={() => void openProject(projects[0])}
              >
                <Folder />
                <span>
                  <b>Tiếp tục dự án gần nhất</b>
                  <small>{projects[0].title}</small>
                </span>
                <i>Tiếp tục</i>
              </button>
            )}
            <span className="sd-choose">Chọn nội dung muốn tạo</span>
            <div className="sd-intents">
              <button className="active">
                <Play />
                <span>Social Video</span>
              </button>
              <button>
                <Music2 />
                <span>Audio</span>
              </button>
              <button>
                <FileText />
                <span>Lyrics</span>
              </button>
            </div>
          </div>
          <div className="sd-landscape" />
          <small>MUSIC LIVES FURTHER</small>
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
              <Menu />
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
                overlayTextStyles={studioModel.visual.textStyles}
                subtitleStyle={studioModel.visual.subtitleStyle}
                effects={effectConfig}
                background={studioModel.visual.background}
                audioBinary={audioBinary}
                resultUrl={resultUrl || undefined}
              />
            </div>
            {quickMode && (
              <section className="sd-quick-create" aria-label="Quick Create">
                <div className="sd-quick-create-head">
                  <div>
                    <small>QUICK CREATE · V16</small>
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
                    <Play /> Tạo bản 30s
                  </button>
                </div>
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
              clips={mediaClips}
              onClipsChange={setMediaClips}
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
                  30s video
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
    </div>
  );
}
