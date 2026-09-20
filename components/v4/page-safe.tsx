'use client';

import {useEffect,useRef,useState} from 'react';
import {Copy,Download,LoaderCircle,Play} from 'lucide-react';
import {generateVisualizerVideoArt} from '../v7/renderer-art';
import {LivePreview} from '../v8/live-preview';
import KaraokeEditor from '@/app/components/KaraokeEditor';
import {buildEstimatedKaraokeTimeline,type KaraokeLine} from '@/app/lib/karaoke';
import {useRenderWakeLock} from '@/hooks/use-render-wake-lock';
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

function fmt(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function V4SafePage() {
  const [url, setUrl] = useState('https://suno.com/s/0Uzw4fboYOyOzHjc');
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'preview' | 'full' | null>(null);
  const screenAwake = useRenderWakeLock(action !== null);
  const [progress, setProgress] = useState(0);
  const [aspect, setAspect] = useState<VideoAspect>('9:16');
  const [wave, setWave] = useState<WaveStyle>('bars');
  const [template, setTemplate] = useState<VisualTemplate>('cover-motion');
  const [motion, setMotion] = useState<MotionIntensity>('medium');
  const [lyrics, setLyrics] = useState<LyricsMode>('off');
  const [preset, setPreset] = useState<PlatformPreset>('tiktok');
  const [previewStart, setPreviewStart] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [copied, setCopied] = useState<'lyrics' | 'style' | null>(null);
  const [karaokeTimeline,setKaraokeTimeline]=useState<KaraokeLine[]>([]);
  const lastResolved = useRef('');
  const resolveNow = useRef<(() => void) | null>(null);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  useEffect(() => {
    const input = url.trim();
    if (!isSunoUrl(input)) return;
    const controller = new AbortController();
    let inFlight = false;
    const resolve = async () => {
      if (inFlight) return;
      inFlight = true;
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
        setPreviewStart(0);
        setCopied(null);
        setKaraokeTimeline(data?.lyrics&&data?.duration?buildEstimatedKaraokeTimeline(data.lyrics,data.duration):[]);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không đọc được bài hát.');
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    const timer = window.setTimeout(() => {
      if (input !== lastResolved.current) void resolve();
    }, 300);
    resolveNow.current = () => {
      window.clearTimeout(timer);
      void resolve();
    };
    return () => {
      resolveNow.current = null;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [url]);

  async function paste() {
    try { setUrl((await navigator.clipboard.readText()).trim()); }
    catch { setError('Không đọc được bộ nhớ tạm.'); }
  }

  async function copyText(kind: 'lyrics' | 'style', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1200);
    } catch {
      setError('Không sao chép được nội dung.');
    }
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
        motion,
        lyrics,
        startSeconds: mode === 'preview' ? previewStart : 0,
        previewSeconds: mode === 'preview' ? 10 : undefined,
        onProgress: setProgress,
        karaokeTimeline: lyrics==='off'?undefined:karaokeTimeline,
      });
      setProgress(100);
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xuất được video.');
    } finally { setAction(null); }
  }

  const size = VIDEO_SIZES[aspect];
  const previewMax = Math.max(0, (song?.duration || 10) - 10);
  const previewEnd = Math.min(song?.duration || previewStart + 10, previewStart + 10);

  return (
    <main className="min-h-screen bg-[#080812] text-white">
      <section className="mx-auto max-w-6xl px-5 py-8">
        <p className="font-bold">Suno Grab <span className="text-violet-300">v8</span></p>
        <h1 className="mt-8 text-4xl font-bold">Tải nhạc Suno & tạo video sóng nhạc</h1>

        <div className="relative mt-7">
          <input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (!isSunoUrl(url.trim())) {
              setError('Vui lòng nhập một liên kết Suno hợp lệ.');
              return;
            }
            resolveNow.current?.();
          }} placeholder="Dán liên kết Suno..." className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 pr-24" />
          <button onClick={paste} className="absolute right-2 top-2 h-10 rounded-xl bg-violet-500/20 px-4 font-bold">Dán</button>
        </div>

        {loading && <p className="mt-3 text-sm text-white/50">Đang lấy bài hát…</p>}
        {error && <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm">{error}</p>}

        {song && (
          <article className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex gap-4">
              {song.picture && <img src={song.picture} alt="Ảnh bìa" className="size-24 rounded-2xl object-cover" />}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold">{song.title}</h2>
                <p className="text-sm text-white/50">{song.creator}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {song.lyrics && (
                <details className="group rounded-2xl border border-white/[.07] bg-black/15">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold">Lời bài hát</p>
                      <p className="text-[11px] text-white/35">Nhấn để mở / thu gọn lời bài hát</p>
                    </div>
                    <span className="text-xs text-white/35 transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  <div className="border-t border-white/[.06] px-4 py-4">
                    <div className="mb-3 flex justify-end">
                      <button type="button" onClick={() => copyText('lyrics', song.lyrics || '')} className="rounded-lg bg-white/[.07] px-3 py-2 text-xs font-semibold text-white/70">
                        <Copy className="mr-1 inline size-3.5" />{copied === 'lyrics' ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-sans text-xs leading-6 text-white/65">{song.lyrics}</pre>{song.duration&&<KaraokeEditor audioUrl={song.audio} lyrics={song.lyrics} duration={song.duration} timeline={karaokeTimeline} onChange={setKaraokeTimeline}/>} 
                  </div>
                </details>
              )}

              {(song.style || song.tags) && (
                <details className="group rounded-2xl border border-white/[.07] bg-black/15">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold">Phong cách</p>
                      <p className="text-[11px] text-white/35">Nhấn để mở / thu gọn phong cách bài hát</p>
                    </div>
                    <span className="text-xs text-white/35 transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  <div className="border-t border-white/[.06] px-4 py-4">
                    <div className="mb-3 flex justify-end">
                      <button type="button" onClick={() => copyText('style', song.style || song.tags || '')} className="rounded-lg bg-white/[.07] px-3 py-2 text-xs font-semibold text-white/70">
                        <Copy className="mr-1 inline size-3.5" />{copied === 'style' ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-6 text-white/65">{song.style || song.tags}</p>
                    {song.style && song.tags && song.tags !== song.style && <p className="mt-3 border-t border-white/[.05] pt-3 text-[11px] leading-5 text-white/40">{song.tags}</p>}
                  </div>
                </details>
              )}
            </div>

            <div id="studio-editor" className="mt-6 grid gap-4">
              <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-violet-300">Bước 1 · Mẫu thiết lập</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_PRESETS.map((item) => <button key={item.id} onClick={() => { setPreset(item.id); if (item.id !== 'custom') setAspect(item.aspect); }} className={`rounded-lg px-3 py-2 text-xs ${preset === item.id ? 'bg-emerald-400/20 ring-1 ring-emerald-300/30' : 'bg-white/5'}`}>{item.label}</button>)}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-300">Bước 2 · Tùy chỉnh</p>
                <div className="grid gap-4">
                  <div><b className="text-sm">Kiểu trình bày</b><div className="mt-2 flex flex-wrap gap-2">{VISUAL_TEMPLATES.map((item) => <button key={item.id} onClick={() => setTemplate(item.id)} className={`rounded-lg px-3 py-2 text-xs ${template === item.id ? 'bg-fuchsia-400/20' : 'bg-white/5'}`}>{item.label}</button>)}</div></div>
                  <div><b className="text-sm">Tỉ lệ</b><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(VIDEO_SIZES) as VideoAspect[]).map((item) => <button key={item} onClick={() => setAspect(item)} className={`rounded-lg px-3 py-2 text-xs ${aspect === item ? 'bg-violet-400/20' : 'bg-white/5'}`}>{item}</button>)}</div></div>
                  <div><b className="text-sm">Dạng sóng</b><div className="mt-2 flex flex-wrap gap-2">{WAVE_STYLES.map((item) => <button key={item.id} onClick={() => setWave(item.id)} className={`rounded-lg px-3 py-2 text-xs ${wave === item.id ? 'bg-cyan-400/20' : 'bg-white/5'}`}>{item.label}</button>)}</div></div>
                  <div><b className="text-sm">Chuyển động</b><div className="mt-2 flex flex-wrap gap-2">{MOTION_LEVELS.map((item) => <button key={item.id} onClick={() => setMotion(item.id)} className={`rounded-lg px-3 py-2 text-xs ${motion === item.id ? 'bg-amber-400/20' : 'bg-white/5'}`}>{item.label}</button>)}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-pink-300">Bước 3 · Lời bài hát</p>
                <div className="flex flex-wrap gap-2">
                  {LYRIC_MODES.map((item) => <button key={item.id} disabled={!song.lyrics && item.id !== 'off'} onClick={() => setLyrics(item.id)} className={`rounded-lg px-3 py-2 text-xs ${lyrics === item.id ? 'bg-pink-400/20' : 'bg-white/5'} disabled:opacity-30`}>{item.label}</button>)}
                </div>
              </section>

              <div id="effects-slot" />
            </div>

            <section id="render-zone" className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-400/[.045] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-300">Bước 5 · Xem trước và xuất video</p><b>Kiểm tra trước khi xuất video</b></div>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/40">{size.width}×{size.height}</span>
              </div>

              <LivePreview song={song} aspect={aspect} template={template} wave={wave} motion={motion} lyrics={lyrics} karaokeTimeline={karaokeTimeline} start={previewStart} exporting={!!action} resultUrl={resultUrl} />

              <div className="mb-4 rounded-xl border border-cyan-300/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-white/65">Chọn đoạn xem trước 10 giây</span>
                  <span className="rounded-full bg-cyan-300/10 px-2 py-1 font-mono text-cyan-100">{fmt(previewStart)} → {fmt(previewEnd)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={previewMax}
                  step="0.1"
                  value={Math.min(previewStart, previewMax)}
                  onChange={(event) => setPreviewStart(Number(event.target.value))}
                  disabled={previewMax <= 0}
                  className="mt-3 w-full accent-cyan-300 disabled:opacity-30"
                  aria-label="Vị trí bắt đầu xem trước 10 giây"
                />
                <div className="mt-1 flex justify-between text-[10px] text-white/30"><span>0:00</span><span>{fmt(song.duration || 0)}</span></div>
              </div>

              {(action || progress > 0) && <div className="mb-4 rounded-xl border border-white/[.06] bg-black/20 p-3">
                {action && <p role="status" className="mb-2 text-xs text-amber-200">{screenAwake
                  ? 'Đang giữ màn hình sáng. Hãy giữ trang này mở đến khi xuất xong.'
                  : 'Hãy giữ màn hình sáng và trang này mở đến khi xuất xong. Trình duyệt chưa bật được chế độ giữ sáng tự động.'}</p>}
                <div className="flex justify-between text-sm"><span>{action === 'preview' ? `Đang xuất video ${fmt(previewStart)} → ${fmt(previewEnd)}` : action === 'full' ? 'Đang xuất toàn bộ video' : 'Xuất video hoàn tất'}</span><b>{Math.round(progress)}%</b></div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-violet-500 transition-[width] duration-200" style={{width: `${Math.max(0,Math.min(100,progress))}%`}} /></div>
              </div>}

              <div className="grid gap-2 sm:grid-cols-2">
                <button disabled={!!action} onClick={() => render('preview')} className="h-12 rounded-xl bg-cyan-400/10 font-bold disabled:opacity-40"><Play className="mr-2 inline size-4" />Render thử 10 giây · {fmt(previewStart)}</button>
                <button disabled={!!action} onClick={() => render('full')} className="h-12 rounded-xl bg-violet-500 font-bold disabled:opacity-40">{action === 'full' && <LoaderCircle className="mr-2 inline size-4 animate-spin" />}Xuất toàn bộ video</button>
              </div>
              {resultBlob && <button onClick={() => saveBlob(resultBlob, `${song.title || 'suno'}-${template}-${aspect}.mp4`)} className="mt-3 w-full rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-3 text-sm font-bold text-emerald-100"><Download className="mr-2 inline size-4" />Tải video đang hiển thị</button>}
            </section>
          </article>
        )}
      </section>
    </main>
  );
}
