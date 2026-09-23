'use client';

import { useEffect, useRef, useState } from 'react';
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
  Settings,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react';
import { generateVisualizerVideoArt } from '@/components/v7/renderer-art';
import {
  VIDEO_EFFECTS,
  type EffectConfig,
  type VideoEffect,
} from '@/components/v8/video-effects';
import { LivePreview } from '@/components/v8/live-preview';
import {
  WAVE_STYLES,
  VISUAL_TEMPLATES,
  type WaveStyle,
  type VisualTemplate,
  type VideoAspect,
  type LyricsMode,
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
  effects: VideoEffect[];
  setEffects: (v: VideoEffect[]) => void;
  layout: OverlayLayout;
  setLayout: (v: OverlayLayout) => void;
  trimStart: number;
  trimEnd: number;
  duration: number;
  setTrimStart: (v: number) => void;
  setTrimEnd: (v: number) => void;
}) {
  const rows = [
    ['style', 'Style', Sparkles],
    ['wave', 'Waveform', SlidersHorizontal],
    ['lyrics', 'Lyrics', FileText],
    ['format', 'Format', SlidersHorizontal],
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
  const [url, setUrl] = useState(''),
    [song, setSong] = useState<Song | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [playbackStart, setPlaybackStart] = useState(0),
    [panel, setPanel] = useState('style'),
    [mobileTools, setMobileTools] = useState(false);
  const [wave, setWave] = useState<WaveStyle>('bars'),
    [template, setTemplate] = useState<VisualTemplate>('cover-motion'),
    [aspect, setAspect] = useState<VideoAspect>('16:9'),
    [lyrics, setLyrics] = useState<LyricsMode>('focus'),
    [effects, setEffects] = useState<VideoEffect[]>([]),
    [rendering, setRendering] = useState(false),
    [progress, setProgress] = useState(0),
    [downloading, setDownloading] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null),
    [resultUrl, setResultUrl] = useState(''),
    [resultName, setResultName] = useState('');
  const [layout, setLayout] = useState<OverlayLayout>(DEFAULT_OVERLAY_LAYOUT);
  const [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(0);
  const timeline = useRef<HTMLDivElement>(null),
    timer = useRef<number | undefined>(undefined);
  async function resolve(value = url) {
    if (!valid(value)) {
      setError('Paste a valid Suno link.');
      return;
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
      setTrimStart(0);
      setTrimEnd(data.duration || 30);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load this song.');
    } finally {
      setBusy(false);
    }
  }
  function change(value: string) {
    setUrl(value);
    setError('');
    if (timer.current) clearTimeout(timer.current);
    if (valid(value.trim()))
      timer.current = window.setTimeout(() => void resolve(value.trim()), 350);
  }
  async function paste() {
    const value = await navigator.clipboard.readText();
    change(value);
  }
  function seekTimeline(clientX: number) {
    if (!song?.duration || !timeline.current) return;
    const box = timeline.current.getBoundingClientRect(),
      next = Math.max(
        0,
        Math.min(
          song.duration,
          ((clientX - box.left) / box.width) * song.duration,
        ),
      );
    setPlaybackStart(next);
  }
  async function renderVideo(mode: 'cut' | '30' = 'cut') {
    if (!song || rendering) return;
    setRendering(true);
    setProgress(0);
    setError('');
    try {
      const config: EffectConfig = {
        effects,
        intensity: 1,
        speed: 1,
        opacity: 0.75,
        wind: 0,
      };
      const startSeconds = trimStart,
        available = Math.max(1, (trimEnd || song.duration || 30) - trimStart),
        previewSeconds = mode === '30' ? Math.min(30, available) : available;
      const blob = await generateVisualizerVideoArt(
        renderSong(song),
        aspect,
        wave,
        template,
        {
          motion: 'medium',
          lyrics,
          layout,
          startSeconds,
          previewSeconds,
          onProgress: setProgress,
          effects: config,
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
      const timeline = buildEstimatedKaraokeTimeline(clean, song.duration || 1);
      saveBlob(
        new Blob([exportSrt(timeline)], {
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
    try {
      setProjects(JSON.parse(localStorage.getItem('sundown-projects') || '[]'));
    } catch {}
  }, []);
  function saveProject() {
    if (!song || !url) return;
    const next = [
      { url, title: song.title },
      ...projects.filter((x) => x.url !== url),
    ].slice(0, 30);
    setProjects(next);
    localStorage.setItem('sundown-projects', JSON.stringify(next));
  }
  function openProject(item: { url: string; title: string }) {
    setView('create');
    change(item.url);
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
              <button onClick={saveProject}>+ Save current project</button>
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
        <main className="sd-studio">
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
                motion="medium"
                lyrics={lyrics}
                layout={layout}
                onLayoutChange={setLayout}
                start={playbackStart}
                exporting={rendering}
                autoPlay={autoPreview}
                fullPlayback
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
            <div className="sd-timeline">
              <div className="sd-ruler">
                <span>00:00</span>
                <span>{fmt((song.duration || 0) / 6)}</span>
                <span>{fmt(((song.duration || 0) * 2) / 6)}</span>
                <span>{fmt(((song.duration || 0) * 3) / 6)}</span>
                <span>{fmt(((song.duration || 0) * 4) / 6)}</span>
                <span>{fmt(((song.duration || 0) * 5) / 6)}</span>
                <span>{fmt(song.duration)}</span>
              </div>
              <div
                className="sd-film"
                ref={timeline}
                onPointerDown={(e) => seekTimeline(e.clientX)}
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{ backgroundImage: `url(${song.picture})` }}
                  />
                ))}
                <i
                  style={{
                    left: `${song.duration ? (playbackStart / song.duration) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
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
            <hr />
            <h3>Recommended</h3>
            <div className="sd-presets">
              {VISUAL_TEMPLATES.slice(0, 4).map((x, i) => (
                <button
                  onClick={() => setTemplate(x.id)}
                  className={template === x.id ? 'active' : ''}
                  key={x.id}
                >
                  <span style={{ backgroundImage: `url(${song.picture})` }} />
                  <small>{x.label}</small>
                </button>
              ))}
            </div>
            <ToolControls
              panel={panel}
              setPanel={setPanel}
              wave={wave}
              setWave={setWave}
              template={template}
              setTemplate={setTemplate}
              aspect={aspect}
              setAspect={setAspect}
              lyrics={lyrics}
              setLyrics={setLyrics}
              effects={effects}
              setEffects={setEffects}
              layout={layout}
              setLayout={setLayout}
              trimStart={trimStart}
              trimEnd={trimEnd}
              duration={song.duration || 0}
              setTrimStart={setTrimStart}
              setTrimEnd={setTrimEnd}
            />
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
                onClick={() => {
                  setPanel('style');
                  setMobileTools(true);
                }}
              >
                <Sparkles />
                Style
              </button>
              <button
                onClick={() => {
                  setPanel('lyrics');
                  setMobileTools(true);
                }}
              >
                <FileText />
                Lyrics
              </button>
              <button
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
          <ToolControls
            panel={panel}
            setPanel={setPanel}
            wave={wave}
            setWave={setWave}
            template={template}
            setTemplate={setTemplate}
            aspect={aspect}
            setAspect={setAspect}
            lyrics={lyrics}
            setLyrics={setLyrics}
            effects={effects}
            setEffects={setEffects}
            layout={layout}
            setLayout={setLayout}
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
