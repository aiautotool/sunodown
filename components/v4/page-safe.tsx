'use client';

import {useEffect,useRef,useState} from 'react';
import {Download,LoaderCircle,Play} from 'lucide-react';
import {generateVisualizerVideoArt} from '../v7/renderer-art';
import {
  LYRIC_MODES,
  MOTION_LEVELS,
  PLATFORM_PRESETS,
  VIDEO_SIZES,
  VISUAL_TEMPLATES,
  WAVE_STYLES,
  type LyricsMode,
  type MotionIntensity,
  type PlatformPreset,
  type Song,
  type VideoAspect,
  type VisualTemplate,
  type WaveStyle,
} from './types';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function isSunoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'suno.com' || url.hostname.endsWith('.suno.com'));
  } catch {
    return false;
  }
}

export default function V4SafePage() {
  const [url, setUrl] = useState('https://suno.com/s/0Uzw4fboYOyOzHjc');
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'preview' | 'full' | null>(null);
  const [progress, setProgress] = useState(0);
  const [aspect, setAspect] = useState<VideoAspect>('9:16');
  const [wave, setWave] = useState<WaveStyle>('bars');
  const [template, setTemplate] = useState<VisualTemplate>('cover-motion');
  const [motion, setMotion] = useState<MotionIntensity>('medium');
  const [lyrics, setLyrics] = useState<LyricsMode>('off');
  const [preset, setPreset] = useState<PlatformPreset>('tiktok');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const lastResolved = useRef('');

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  useEffect(() => {
    const input = url.trim();
    if (!isSunoUrl(input) || input === lastResolved.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/resolve', {
          method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({input}), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Không đọc được bài hát.');
        lastResolved.current = input;
        setSong(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không đọc được bài hát.');
      } finally { setLoading(false); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [url]);

  async function paste() {
    try { setUrl((await navigator.clipboard.readText()).trim()); }
    catch { setError('Không đọc được clipboard.'); }
  }

  async function render(mode: 'preview' | 'full') {
    if (!song) return;
    setAction(mode);
    setProgress(0);
    setError('');
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl('');
    setResultBlob(null);
    try {
      const blob = await generateVisualizerVideoArt(song, aspect, wave, template, {
        motion, lyrics, startSeconds: 0, previewSeconds: mode === 'preview' ? 10 : undefined, onProgress: setProgress,
      });
      setProgress(100);
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Render lỗi.');
    } finally { setAction(null); }
  }

  const size = VIDEO_SIZES[aspect];

  return (
    <main className="min-h-screen bg-[#080812] text-white">
      <section className="mx-auto max-w-6xl px-5 py-8">
        <p className="font-bold">Suno Grab <span className="text-violet-300">v8</span></p>
        <h1 className="mt-8 text-4xl font-bold">Tải nhạc Suno & tạo video visualizer</h1>

        <div className="relative mt-7">
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Dán link Suno..." className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 pr-24" />
          <button onClick={paste} className="absolute right-2 top-2 h-10 rounded-xl bg-violet-500/20 px-4 font-bold">Dán</button>
        </div>

        {loading && <p className="mt-3 text-sm text-white/50">Đang lấy bài hát…</p>}
        {error && <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm">{error}</p>}

        {song && (
          <article className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex gap-4">
              {song.picture && <img src={song.picture} alt="cover" className="size-24 rounded-2xl object-cover" />}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold">{song.title}</h2>
                <p className="text-sm text-white/50">{song.creator}</p>
                <audio controls src={song.audio} className="mt-2 w-full" />
              </div>
            </div>

            <div id="studio-editor" className="mt-6 grid gap-4">
              <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-violet-300">Bước 1 · Preset</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_PRESETS.map((item) => <button key={item.id} onClick={() => { setPreset(item.id); if (item.id !== 'custom') setAspect(item.aspect); }} className={`rounded-lg px-3 py-2 text-xs ${preset === item.id ? 'bg-emerald-400/20 ring-1 ring-emerald-300/30' : 'bg-white/5'}`}>{item.label}</button>)}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-300">Bước 2 · Tùy chỉnh</p>
                <div className="grid gap-4">
                  <div><b className="text-sm">Template</b><div className="mt-2 flex flex-wrap gap-2">{VISUAL_TEMPLATES.map((item) => <button key={item.id} onClick={() => setTemplate(item.id)} className={`rounded-lg px-3 py-2 text-xs ${template === item.id ? 'bg-fuchsia-400/20' : 'bg-white/5'}`}>{item.label}</button>)}</div></div>
                  <div><b className="text-sm">Tỉ lệ</b><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(VIDEO_SIZES) as VideoAspect[]).map((item) => <button key={item} onClick={() => setAspect(item)} className={`rounded-lg px-3 py-2 text-xs ${aspect === item ? 'bg-violet-400/20' : 'bg-white/5'}`}>{item}</button>)}</div></div>
                  <div><b className="text-sm">Waveform</b><div className="mt-2 flex flex-wrap gap-2">{WAVE_STYLES.map((item) => <button key={item.id} onClick={() => setWave(item.id)} className={`rounded-lg px-3 py-2 text-xs ${wave === item.id ? 'bg-cyan-400/20' : 'bg-white/5'}`}>{item.label}</button>)}</div></div>
                  <div><b className="text-sm">Motion</b><div className="mt-2 flex flex-wrap gap-2">{MOTION_LEVELS.map((item) => <button key={item.id} onClick={() => setMotion(item.id)} className={`rounded-lg px-3 py-2 text-xs ${motion === item.id ? 'bg-amber-400/20' : 'bg-white/5'}`}>{item.label}</button>)}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-pink-300">Bước 3 · Lyrics</p>
                <div className="flex flex-wrap gap-2">
                  {LYRIC_MODES.map((item) => <button key={item.id} disabled={!song.lyrics && item.id !== 'off'} onClick={() => setLyrics(item.id)} className={`rounded-lg px-3 py-2 text-xs ${lyrics === item.id ? 'bg-pink-400/20' : 'bg-white/5'} disabled:opacity-30`}>{item.label}</button>)}
                </div>
              </section>

              <div id="effects-slot" />
            </div>

            <section id="render-zone" className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-400/[.045] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-300">Bước 5 · Preview & Render</p><b>Kiểm tra trước khi xuất video</b></div>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/40">{size.width}×{size.height}</span>
              </div>

              {(action || progress > 0) && <div className="mb-4 rounded-xl border border-white/[.06] bg-black/20 p-3">
                <div className="flex justify-between text-sm"><span>{action === 'preview' ? 'Đang render preview' : action === 'full' ? 'Đang render full' : 'Render hoàn tất'}</span><b>{Math.round(progress)}%</b></div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-violet-500 transition-[width] duration-200" style={{width: `${Math.max(0,Math.min(100,progress))}%`}} /></div>
              </div>}

              <div className="grid gap-2 sm:grid-cols-2">
                <button disabled={!!action} onClick={() => render('preview')} className="h-12 rounded-xl bg-cyan-400/10 font-bold disabled:opacity-40"><Play className="mr-2 inline size-4" />Preview 10s</button>
                <button disabled={!!action} onClick={() => render('full')} className="h-12 rounded-xl bg-violet-500 font-bold disabled:opacity-40">{action === 'full' && <LoaderCircle className="mr-2 inline size-4 animate-spin" />}Render full</button>
              </div>
            </section>

            {resultUrl && <section id="preview-result" className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3">
              <p className="mb-3 text-sm font-bold text-emerald-200">Preview / video đã render</p>
              <video src={resultUrl} controls playsInline className="max-h-[70vh] w-full rounded-xl bg-black" />
              <button onClick={() => resultBlob && saveBlob(resultBlob, `${song.title || 'suno'}-${template}-${aspect}.mp4`)} className="mt-3 rounded-lg bg-white/10 px-3 py-2"><Download className="mr-2 inline size-4" />Tải video</button>
            </section>}
          </article>
        )}
      </section>
    </main>
  );
}
