'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Link2, LoaderCircle, Music2, ShieldCheck, Sparkles } from 'lucide-react';

type Song = { id: string | null; title: string; picture: string | null; audio: string; description: string | null; lyrics: string | null; style: string | null; tags: string | null; duration: number | null; creator: string | null };

export default function Home() {
  const [url, setUrl] = useState('');
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState<'lyrics' | 'style' | null>(null);
  const lastResolvedUrl = useRef('');

  useEffect(() => {
    const candidate = url.trim();
    const isSunoLink = /^https:\/\/(?:[^/]+\.)?suno\.com\//i.test(candidate);
    if (!candidate) { setSong(null); setError(''); setLoading(false); lastResolvedUrl.current = ''; return; }
    if (candidate === lastResolvedUrl.current) return;
    setSong(null); setError('');
    if (!isSunoLink) { setLoading(false); return; }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setError(''); setSong(null); setLoading(true);
      try {
        const response = await fetch('/api/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: candidate }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Không thể đọc bài hát này.');
        lastResolvedUrl.current = candidate;
        setSong(data);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Đã có lỗi xảy ra.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 450);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [url]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'resolve_suno_song',
      title: 'Lấy thông tin bài hát Suno',
      description: 'Nhận một liên kết chia sẻ Suno, tìm thông tin bài hát và cập nhật kết quả đang hiển thị trên trang.',
      inputSchema: { type: 'object', properties: { url: { type: 'string', format: 'uri', description: 'Liên kết https://suno.com/s/...' } }, required: ['url'], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input: unknown) {
        const candidate = (input as { url?: unknown })?.url;
        if (typeof candidate !== 'string') throw new Error('Thiếu liên kết Suno.');
        lastResolvedUrl.current = candidate.trim();
        setUrl(candidate); setError(''); setSong(null); setLoading(true);
        try {
          const response = await fetch('/api/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: candidate.trim() }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Không thể đọc bài hát này.');
          setSong(data);
          return { title: data.title, audioAvailable: true };
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : 'Đã có lỗi xảy ra.';
          setError(message); throw new Error(message);
        } finally { setLoading(false); }
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function downloadSong() {
    if (!song) return;
    setError(''); setDownloading(true);
    try {
      const response = await fetch('/api/download', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: url.trim() }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Không thể tải file âm thanh.'); }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl; anchor.download = `${song.title || 'suno-audio'}.m4a`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Đã có lỗi xảy ra.'); }
    finally { setDownloading(false); }
  }

  async function copyText(value: string, kind: 'lyrics' | 'style') {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080812] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(139,92,246,.24),transparent_31%),radial-gradient(circle_at_82%_20%,rgba(34,211,238,.16),transparent_27%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:auto,auto,44px_44px,44px_44px]" />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_28px_rgba(124,58,237,.34)]"><Music2 className="size-5" aria-hidden="true" /></span><div><p className="text-base font-bold tracking-tight">Suno Grab</p><p className="text-[10px] font-medium uppercase tracking-[.22em] text-white/45">Audio downloader</p></div></div>
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 sm:flex"><ShieldCheck className="size-3.5 text-emerald-400" /> Không cần đăng nhập</span>
      </nav>
      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-20 pt-14 text-center sm:px-8 sm:pt-20">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3.5 py-1.5 text-xs font-medium text-violet-200"><Sparkles className="size-3.5" /> Nhanh, miễn phí và dễ dùng</div>
        <h1 className="max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-[-.04em] sm:text-6xl">Mang bản nhạc Suno của bạn <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">về máy.</span></h1>
        <p className="mt-5 max-w-xl text-balance text-base leading-7 text-white/55 sm:text-lg">Dán liên kết chia sẻ từ Suno, xem trước thông tin và tải file âm thanh chất lượng cao chỉ trong vài giây.</p>
        <div className="mt-10 w-full rounded-[28px] border border-white/10 bg-white/[.055] p-2.5 shadow-[0_30px_100px_rgba(0,0,0,.38)] backdrop-blur-xl sm:p-3">
          <label className="relative block"><span className="sr-only">Liên kết bài hát Suno</span><Link2 className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/35" /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Dán link https://suno.com/s/..." autoComplete="url" inputMode="url" className="h-14 w-full rounded-[19px] border border-white/10 bg-black/25 pl-12 pr-36 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-500/10" /><span className="pointer-events-none absolute right-4 top-1/2 inline-flex -translate-y-1/2 items-center gap-2 text-xs font-semibold text-white/45">{loading ? <><LoaderCircle className="size-4 animate-spin text-violet-300" /> Đang lấy...</> : <><Sparkles className="size-4 text-cyan-300" /> Tự động</>}</span></label>
        </div>
        <div aria-live="polite" className="mt-5 w-full">
          {error && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
          {song && <article className="rounded-[26px] border border-white/10 bg-white/[.06] p-5 text-left shadow-2xl backdrop-blur-xl"><div className="flex flex-col items-center gap-5 sm:flex-row">
            {song.picture ? <img src={song.picture} alt="Ảnh bìa bài hát" className="size-28 rounded-2xl object-cover shadow-lg sm:size-32" /> : <div className="grid size-28 place-items-center rounded-2xl bg-white/10 sm:size-32"><Music2 /></div>}
            <div className="min-w-0 flex-1 text-center sm:text-left"><p className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[.13em] text-emerald-300 sm:justify-start"><CheckCircle2 className="size-3.5" /> Đã tìm thấy</p><h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{song.title}</h2><p className="mt-2 text-sm text-white/45">{[song.creator, song.duration ? `${Math.floor(song.duration / 60)}:${String(Math.round(song.duration % 60)).padStart(2, '0')}` : null].filter(Boolean).join(' · ') || song.description || 'Bản nhạc được tạo trên Suno.'}</p>{song.tags && <p className="mt-1 line-clamp-1 text-xs text-violet-200/60">{song.tags}</p>}<audio key={song.audio} controls preload="metadata" src={song.audio} className="mt-4 h-10 w-full min-w-0 accent-violet-500" aria-label={`Nghe thử ${song.title}`}>Trình duyệt của bạn không hỗ trợ phát audio.</audio></div>
            <button onClick={downloadSong} disabled={downloading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-bold shadow-[0_12px_32px_rgba(124,58,237,.28)] transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-violet-400/25 disabled:opacity-60 sm:w-auto">{downloading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}{downloading ? 'Đang tải...' : 'Tải audio'}</button>
          </div>{song.style && <div className="mt-5 border-t border-white/10 pt-4"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white/80">Style</h3><button onClick={() => copyText(song.style!, 'style')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10">{copied === 'style' ? 'Đã sao chép' : 'Sao chép style'}</button></div><p className="whitespace-pre-wrap rounded-2xl bg-violet-400/[.07] p-4 text-sm leading-6 text-violet-100/70">{song.style}</p></div>}{song.lyrics && <details className="group mt-5 border-t border-white/10 pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white/80"><span>Xem lời bài hát</span><span className="text-xs text-violet-300 group-open:hidden">Mở</span><span className="hidden text-xs text-violet-300 group-open:inline">Đóng</span></summary><div className="mt-4 max-h-96 overflow-y-auto rounded-2xl bg-black/25 p-4"><div className="mb-3 flex justify-end"><button onClick={() => copyText(song.lyrics!, 'lyrics')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10">{copied === 'lyrics' ? 'Đã sao chép' : 'Sao chép lyrics'}</button></div><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/65">{song.lyrics}</pre></div></details>}</article>}
        </div>
        <div className="mt-14 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">{[['01','Dán liên kết','Sao chép link chia sẻ của bài hát trên Suno.'],['02','Lấy bài hát','Hệ thống tự tìm thông tin và file âm thanh.'],['03','Tải xuống','Lưu audio về thiết bị để nghe bất cứ lúc nào.']].map(([number,title,copy]) => <div key={number} className="rounded-2xl border border-white/[.07] bg-white/[.035] p-5"><span className="text-xs font-bold text-violet-300">{number}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-white/40">{copy}</p></div>)}</div>
        <p className="mt-10 max-w-xl text-xs leading-5 text-white/30">Chỉ tải nội dung bạn sở hữu hoặc được phép sử dụng. Suno Grab không lưu trữ file âm thanh trên máy chủ.</p>
      </section>
    </main>
  );
}
