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
import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND_CONFIG,
  type BackgroundConfig,
} from '@/components/v8/background';
import {
  WAVE_STYLES,
  VISUAL_TEMPLATES,
  type WaveStyle,
  type VisualTemplate,
  type VideoAspect,
  type LyricsMode,
  type MotionIntensity,
  MOTION_LEVELS,
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
import type { KaraokeLine } from '@/app/lib/karaoke';
import { EditorTimeline, type MediaClip } from '@/components/editor-timeline';
import { PresetGallery } from '@/components/presets/preset-gallery';
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
  comparePreviewAndRender,
  visualFingerprint,
} from '@/components/presets/preset-regression';
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
  trimStart: number;
  trimEnd: number;
  duration: number;
  setTrimStart: (v: number) => void;
  setTrimEnd: (v: number) => void;
}) {
  const rows = [
    ['style', 'Style', Sparkles],
    ['text', 'Text & resize', FileText],
    ['wave', 'Waveform', SlidersHorizontal],
    ['lyrics', 'Lyrics', FileText],
    ['format', 'Format', SlidersHorizontal],
    ['background', 'Background', ImageIcon],
    ['effects', 'Effects', Sparkles],
    ['trim', 'Cut & duration', SlidersHorizontal],
  ] as const;
  const toggle = (id: VideoEffect) =>
    p.setEffects(
      p.effects.includes(id)
        ? p.effects.filter((x) => x !== id)
        : [...p.effects, id],
    );
  return (
    <>
      {rows.map(([id, label, Icon]) => (
        <div className="sd-fold" key={id}>
          <button onClick={() => p.setPanel(p.panel === id ? '' : id)}>
            <Icon />
            <b>{label}</b>
            <ChevronDown />
          </button>
          {p.panel === id && (
            <div className="sd-options">
              {id === 'style' && (
                <p className="sd-control-hint">
                  Preset thay đổi toàn bộ video. Các nút dưới đây dùng để tinh chỉnh thủ công sau khi chọn preset.
                </p>
              )}
              {id === 'style' &&
                VISUAL_TEMPLATES.map((x) => (
                  <button
                    className={p.template === x.id ? 'active' : ''}
                    onClick={() => p.setTemplate(x.id)}
                    key={x.id}
                  >
                    {x.label}
                  </button>
                ))}
              {id === 'style' && (
                <div className="sd-motion-row">
                  <span>Motion</span>
                  {MOTION_LEVELS.map((x) => (
                    <button
                      key={x.id}
                      className={p.motion === x.id ? 'active' : ''}
                      onClick={() => p.setMotion(x.id)}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
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
              {id === 'wave' &&
                WAVE_STYLES.map((x) => (
                  <button
                    className={p.wave === x.id ? 'active' : ''}
                    onClick={() => p.setWave(x.id)}
                    key={x.id}
                  >
                    {x.label}
                  </button>
                ))}
              {id === 'wave' && (
                <label className="sd-scale">
                  Kích thước sóng
                  <input
                    type="range"
                    min="50"
                    max="180"
                    value={p.layout.wave.scale}
                    onChange={(e) =>
                      p.setLayout({
                        ...p.layout,
                        wave: { ...p.layout.wave, scale: +e.target.value },
                      })
                    }
                  />
                  <span>{p.layout.wave.scale}%</span>
                </label>
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
                <p className="sd-control-hint">
                  Preset có thể thay toàn bộ nền. Bạn vẫn có thể chỉnh nền thủ công sau khi apply.
                </p>
              )}
              {id === 'background' && (
                <>
                  <button
                    className={p.background.mode === 'suno' ? 'active' : ''}
                    onClick={() =>
                      p.setBackground({
                        ...p.background,
                        mode: 'suno',
                        presetId: undefined,
                      })
                    }
                  >
                    Suno cover
                  </button>
                  {BACKGROUND_PRESETS.map((item) => (
                    <button
                      key={item.id}
                      className={
                        p.background.mode === 'preset' &&
                        p.background.presetId === item.id
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        p.setBackground({
                          ...p.background,
                          mode: 'preset',
                          presetId: item.id,
                        })
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                  <label className="sd-scale">
                    Dim
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={p.background.dim}
                      onChange={(e) =>
                        p.setBackground({
                          ...p.background,
                          dim: Number(e.target.value),
                        })
                      }
                    />
                    <span>{p.background.dim}%</span>
                  </label>
                  <label className="sd-scale">
                    Overlay
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={p.background.overlayOpacity}
                      onChange={(e) =>
                        p.setBackground({
                          ...p.background,
                          overlayOpacity: Number(e.target.value),
                        })
                      }
                    />
                    <span>{p.background.overlayOpacity}%</span>
                  </label>
                  <label className="sd-scale">
                    Blur
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={p.background.blur}
                      onChange={(e) =>
                        p.setBackground({
                          ...p.background,
                          blur: Number(e.target.value),
                        })
                      }
                    />
                    <span>{p.background.blur}</span>
                  </label>
                </>
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
          )}
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
  const [projects, setProjects] = useState<{ url: string; title: string }[]>(
    [],
  );
  const [url, setUrl] = useState('https://suno.com/s/tszo0jGdVUua4rT4'),
    [song, setSong] = useState<Song | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [playbackStart, setPlaybackStart] = useState(0),
    [previewTime, setPreviewTime] = useState(0),
    [panel, setPanel] = useState('style'),
    [mobileTools, setMobileTools] = useState(false),
    [savingProject, setSavingProject] = useState(false),
    [savedProject, setSavedProject] = useState(false);
  const [wave, setWave] = useState<WaveStyle>('bars'),
    [template, setTemplate] = useState<VisualTemplate>('cover-motion'),
    [aspect, setAspect] = useState<VideoAspect>('16:9'),
    [lyrics, setLyrics] = useState<LyricsMode>('focus'),
    [motion, setMotion] = useState<MotionIntensity>('medium'),
    [effects, setEffects] = useState<VideoEffect[]>([]),
    [rendering, setRendering] = useState(false),
    [progress, setProgress] = useState(0),
    [downloading, setDownloading] = useState('');
  useRenderWakeLock(rendering);

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetModified, setPresetModified] = useState(false);
  const [customPresets, setCustomPresets] = useState<StudioPreset[]>([]);
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>([]);
  const [presetUndo, setPresetUndo] = useState<{
    config: StudioPresetConfig;
    selectedId: string | null;
    modified: boolean;
  } | null>(null);

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
  const [mediaClips, setMediaClips] = useState<MediaClip[]>([]);
  const effectConfig = useMemo(() => makeEffectConfig(effects), [effects]);
  const visualSnapshot = useMemo<StudioPresetConfig>(
    () => ({
      template,
      wave,
      motion,
      aspect,
      lyrics,
      effects: [...effects],
      layout: structuredClone(layout),
      textStyles: structuredClone(textStyles),
      subtitleStyle: structuredClone(subtitleStyle),
      background: structuredClone(background),
    }),
    [
      template,
      wave,
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
  const visualHash = useMemo(
    () => visualFingerprint(visualSnapshot),
    [visualSnapshot],
  );
  const [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const currentPresetConfig = (): StudioPresetConfig =>
    structuredClone(visualSnapshot);

  const markPresetModified = () => {
    if (selectedPresetId) setPresetModified(true);
  };

  const applyPreset = (
    preset: StudioPreset,
    mode: 'replace-all' | 'preserve-custom' = 'replace-all',
  ) => {
    const current = currentPresetConfig();
    setPresetUndo({
      config: current,
      selectedId: selectedPresetId,
      modified: presetModified,
    });
    const next = clonePresetConfig(preset.config);
    if (mode === 'preserve-custom') {
      next.layout = structuredClone(current.layout);
      next.textStyles = structuredClone(current.textStyles);
      next.subtitleStyle = structuredClone(current.subtitleStyle);
      next.background = structuredClone(current.background);
    }
    setTemplate(next.template);
    setWave(next.wave);
    setMotion(next.motion);
    setAspect(next.aspect);
    setLyrics(next.lyrics);
    setEffects(next.effects);
    setLayout(next.layout);
    setTextStyles(next.textStyles);
    setSubtitleStyle(next.subtitleStyle);
    setBackground(next.background);
    setSelectedPresetId(preset.id);
    setPresetModified(mode === 'preserve-custom');
    setResultBlob(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl('');
    }
  };

  const restorePresetSnapshot = () => {
    if (!presetUndo) return;
    const next = clonePresetConfig(presetUndo.config);
    setTemplate(next.template);
    setWave(next.wave);
    setMotion(next.motion);
    setAspect(next.aspect);
    setLyrics(next.lyrics);
    setEffects(next.effects);
    setLayout(next.layout);
    setTextStyles(next.textStyles);
    setSubtitleStyle(next.subtitleStyle);
    setBackground(next.background);
    setSelectedPresetId(presetUndo.selectedId);
    setPresetModified(presetUndo.modified);
    setPresetUndo(null);
  };

  const persistCustomPresets = (items: StudioPreset[]) => {
    setCustomPresets(items);
    localStorage.setItem('sunodown-v14-custom-presets', JSON.stringify(items));
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
    };
    persistCustomPresets([preset, ...customPresets]);
    setSelectedPresetId(preset.id);
    setPresetModified(false);
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
    };
    const next = customPresets.map((item) =>
      item.id === preset.id ? nextPreset : item,
    );
    persistCustomPresets(next);
    setSelectedPresetId(preset.id);
    setPresetModified(false);
  };

  const resetSelectedPreset = (preset: StudioPreset) => {
    applyPreset(preset, 'replace-all');
  };

  const exportPreset = (preset: StudioPreset) => {
    const payload: StudioPreset = {
      ...preset,
      schemaVersion: PRESET_SCHEMA_VERSION,
      config: clonePresetConfig(preset.config),
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
    }
    if (favoritePresetIds.includes(preset.id)) {
      const nextFavorites = favoritePresetIds.filter((id) => id !== preset.id);
      setFavoritePresetIds(nextFavorites);
      localStorage.setItem(
        'sunodown-v14-favorite-presets',
        JSON.stringify(nextFavorites),
      );
    }
  };

  const toggleFavoritePreset = (id: string) => {
    const next = favoritePresetIds.includes(id)
      ? favoritePresetIds.filter((item) => item !== id)
      : [...favoritePresetIds, id];
    setFavoritePresetIds(next);
    localStorage.setItem('sunodown-v14-favorite-presets', JSON.stringify(next));
  };

  async function resolve(value = url): Promise<Song | null> {
    if (!valid(value)) {
      setError('Paste a valid Suno link.');
      return null;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/resolve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: value }),
        }),
        data = await r.json();
      if (!r.ok) throw Error(data.error || 'Unable to load this song.');
      setSong(data);
      setPlaybackStart(0);
      setPreviewTime(0);
      setTrimStart(0);
      setTrimEnd(data.duration || 30);
      setKaraokeTimeline(
        data.lyrics
          ? buildEstimatedKaraokeTimeline(data.lyrics, data.duration || 30)
          : [],
      );
      setMediaClips([]);
      return data as Song;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load this song.');
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
    const renderSnapshot: StudioPresetConfig = {
      template,
      wave,
      motion,
      aspect,
      lyrics,
      effects: [...effectConfig.effects],
      layout: structuredClone(layout),
      textStyles: structuredClone(textStyles),
      subtitleStyle: structuredClone(subtitleStyle),
      background: structuredClone(background),
    };
    const report = comparePreviewAndRender(visualSnapshot, renderSnapshot);
    if (!report.ok) {
      throw new Error(
        `Visual sync failed [${report.fingerprint}]: ${report.issues.join(', ')}`,
      );
    }
    return report;
  };

  async function renderVideo(mode: 'cut' | '30' = 'cut') {
    if (!song || rendering) return;
    setRendering(true);
    setProgress(0);
    setError('');
    try {
      const parity = assertVisualParity();
      console.info('[SunoDown visual QA]', {
        fingerprint: parity.fingerprint,
        selectedPresetId,
        modified: presetModified,
      });
      const config = effectConfig;
      const startSeconds = trimStart,
        available = Math.max(1, (trimEnd || song.duration || 30) - trimStart),
        previewSeconds = mode === '30' ? Math.min(30, available) : available;
      const blob = await generateVisualizerVideoArt(
        renderSong(song),
        aspect,
        wave,
        template,
        {
          motion,
          lyrics,
          layout,
          startSeconds,
          previewSeconds,
          onProgress: setProgress,
          effects: config,
          karaokeTimeline,
          mediaClips,
          overlayTextStyles: textStyles,
          subtitleStyle,
          background,
        },
      );
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const name = `${safeName(song.title)}${mode === '30' ? '-30s' : ''}.mp4`;
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo video.');
    } finally {
      setRendering(false);
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
        return;
      } catch {}
    }
    saveBlob(resultBlob, resultName || 'suno-video.mp4');
  }
  async function downloadAudio(format: 'm4a' | 'mp3' | 'wav') {
    if (!song || downloading) return;
    setDownloading(format);
    setError('');
    try {
      const response = await fetch(song.audio, { cache: 'no-store' });
      if (!response.ok) throw Error('Không tải được audio.');
      const source = await response.blob();
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
    try {
      setProjects(JSON.parse(localStorage.getItem('sundown-projects') || '[]'));
      const storedPresets = normalizeStoredPresets(
        JSON.parse(localStorage.getItem('sunodown-v14-custom-presets') || '[]'),
      );
      setCustomPresets(storedPresets);
      localStorage.setItem(
        'sunodown-v14-custom-presets',
        JSON.stringify(storedPresets),
      );
      setFavoritePresetIds(
        JSON.parse(localStorage.getItem('sunodown-v14-favorite-presets') || '[]'),
      );
      const presetIssues = auditPresetLibrary([
        ...BUILTIN_STUDIO_PRESETS,
        ...storedPresets,
      ]);
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
        effects,
        layout,
        textStyles,
        subtitleStyle,
        background,
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
      window.setTimeout(() => setSavedProject(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được dự án.');
    } finally {
      setSavingProject(false);
    }
  }
  async function openProject(item: { url: string; title: string }) {
    setView('create');
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
    setEffects(project.effects);
    setLayout(project.layout);
    if (project.textStyles) setTextStyles(project.textStyles);
    if (project.subtitleStyle) setSubtitleStyle(project.subtitleStyle);
    if (project.background) setBackground(project.background);
    else setBackground(structuredClone(DEFAULT_BACKGROUND_CONFIG));
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
            <div className="sd-section-grid">
              {song ? (
                <button onClick={() => setView('create')}>
                  <img src={song.picture} />
                  <b>{song.title}</b>
                  <span>{song.creator || 'Suno'}</span>
                </button>
              ) : (
                <p>Paste a Suno link to add a song to your library.</p>
              )}
            </div>
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
            <p>CREATOR STUDIO</p>
            <h1>
              Turn your Suno song
              <br />
              <em>into content</em>
            </h1>
            <div className="sd-input">
              <Link2 />
              <input
                value={url}
                onChange={(e) => change(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void resolve()}
                placeholder="Paste a Suno link"
              />
              <button onClick={paste}>Paste</button>
            </div>
            <button
              className="sd-analyze"
              disabled={busy}
              onClick={() => resolve()}
            >
              {busy ? 'Analyzing…' : 'Analyze'}
            </button>
            {error && <div className="sd-error">{error}</div>}
            <span className="sd-choose">Choose what to create</span>
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
        <main className={`sd-studio ${rendering ? 'sd-render-locked' : ''}`}>
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
                aspect={aspect}
                template={template}
                wave={wave}
                motion={motion}
                lyrics={lyrics}
                layout={layout}
                onLayoutChange={rendering ? undefined : (value) => { markPresetModified(); setLayout(value); }}
                start={trimStart}
                end={trimEnd || song.duration || undefined}
                seekTo={playbackStart}
                exporting={rendering}
                autoPlay={autoPreview}
                fullPlayback
                onTimeChange={setPreviewTime}
                karaokeTimeline={karaokeTimeline}
                mediaClips={mediaClips}
                overlayTextStyles={textStyles}
                subtitleStyle={subtitleStyle}
                effects={effectConfig}
                background={background}
                resultUrl={resultUrl || undefined}
              />
            </div>
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
              onSeek={(time) => {
                setPlaybackStart(time);
                setPreviewTime(time);
              }}
              subtitles={karaokeTimeline}
              onSubtitlesChange={setKaraokeTimeline}
              clips={mediaClips}
              onClipsChange={setMediaClips}
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
            <PresetGallery
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
            />
            <ToolControls
              panel={panel}
              setPanel={setPanel}
              wave={wave}
              setWave={(value) => { markPresetModified(); setWave(value); }}
              template={template}
              setTemplate={(value) => { markPresetModified(); setTemplate(value); }}
              aspect={aspect}
              setAspect={(value) => { markPresetModified(); setAspect(value); }}
              lyrics={lyrics}
              setLyrics={(value) => { markPresetModified(); setLyrics(value); }}
              motion={motion}
              setMotion={(value) => { markPresetModified(); setMotion(value); }}
              effects={effects}
              setEffects={(value) => { markPresetModified(); setEffects(value); }}
              layout={layout}
              setLayout={(value) => { markPresetModified(); setLayout(value); }}
              textStyles={textStyles}
              setTextStyles={(value) => { markPresetModified(); setTextStyles(value); }}
              subtitleStyle={subtitleStyle}
              setSubtitleStyle={(value) => { markPresetModified(); setSubtitleStyle(value); }}
              background={background}
              setBackground={(value) => { markPresetModified(); setBackground(value); }}
              trimStart={trimStart}
              trimEnd={trimEnd}
              duration={song.duration || 0}
              setTrimStart={setTrimStart}
              setTrimEnd={setTrimEnd}
            />
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
                  ? `Rendering ${Math.round(progress)}%`
                  : `Export ${fmt(Math.max(0, trimEnd - trimStart))} video`}
              </button>
              {rendering && (
                <div className="sd-progress">
                  <i style={{ width: `${progress}%` }} />
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
            <button disabled={rendering} onClick={() => renderVideo('cut')}>
              <Upload />
              {rendering
                ? `Rendering ${Math.round(progress)}%`
                : 'Create & export video'}
            </button>
            <nav>
              <button
                disabled={rendering}
                onClick={() => {
                  setPanel('style');
                  setMobileTools(true);
                }}
              >
                <Sparkles />
                Style
              </button>
              <button
                disabled={rendering}
                onClick={() => {
                  setPanel('lyrics');
                  setMobileTools(true);
                }}
              >
                <FileText />
                Lyrics
              </button>
              <button
                disabled={rendering}
                onClick={() => {
                  setPanel('wave');
                  setMobileTools(true);
                }}
              >
                <Music2 />
                Wave
              </button>
              <button onClick={() => renderVideo('30')}>
                <Upload />
                Export
              </button>
            </nav>
          </div>
        </main>
      )}
      {song && mobileTools && (
        <div className="sd-tool-sheet">
          <div className="sd-sheet-head">
            <b>Video controls</b>
            <button onClick={() => setMobileTools(false)}>×</button>
          </div>
          {panel === 'style' && (
            <PresetGallery
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
            />
          )}
          <ToolControls
            panel={panel}
            setPanel={setPanel}
            wave={wave}
            setWave={(value) => { markPresetModified(); setWave(value); }}
            template={template}
            setTemplate={(value) => { markPresetModified(); setTemplate(value); }}
            aspect={aspect}
            setAspect={(value) => { markPresetModified(); setAspect(value); }}
            lyrics={lyrics}
            setLyrics={(value) => { markPresetModified(); setLyrics(value); }}
            motion={motion}
            setMotion={(value) => { markPresetModified(); setMotion(value); }}
            effects={effects}
            setEffects={(value) => { markPresetModified(); setEffects(value); }}
            layout={layout}
            setLayout={(value) => { markPresetModified(); setLayout(value); }}
            textStyles={textStyles}
            setTextStyles={(value) => { markPresetModified(); setTextStyles(value); }}
            subtitleStyle={subtitleStyle}
            setSubtitleStyle={(value) => { markPresetModified(); setSubtitleStyle(value); }}
            trimStart={trimStart}
            trimEnd={trimEnd}
            duration={song.duration || 0}
            setTrimStart={setTrimStart}
            setTrimEnd={setTrimEnd}
          />
        </div>
      )}
    </div>
  );
}
