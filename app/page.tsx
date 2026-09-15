'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Clapperboard, Link2, LoaderCircle, Music2, ShieldCheck, Sparkles, Waves } from 'lucide-react';

type Song = { id: string | null; title: string; picture: string | null; audio: string; sourceAudio: string; video: string | null; description: string | null; lyrics: string | null; style: string | null; tags: string | null; duration: number | null; creator: string | null };
type VideoAspect = '16:9' | '9:16' | '1:1' | '4:5' | '4:3';

const VIDEO_SIZES: Record<VideoAspect, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 864, height: 1080 },
  '4:3': { width: 960, height: 720 },
};

function saveBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function drawCover(context: CanvasRenderingContext2D, bitmap: ImageBitmap, width: number, height: number) {
  context.fillStyle = '#05050a';
  context.fillRect(0, 0, width, height);
  const coverScale = Math.max(width / bitmap.width, height / bitmap.height);
  const coverW = bitmap.width * coverScale;
  const coverH = bitmap.height * coverScale;
  context.globalAlpha = 0.35;
  context.filter = 'blur(30px)';
  context.drawImage(bitmap, (width - coverW) / 2, (height - coverH) / 2, coverW, coverH);
  context.filter = 'none';
  context.globalAlpha = 1;
  context.fillStyle = 'rgba(0,0,0,.35)';
  context.fillRect(0, 0, width, height);

  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const imageW = bitmap.width * scale;
  const imageH = bitmap.height * scale;
  context.drawImage(bitmap, (width - imageW) / 2, (height - imageH) / 2, imageW, imageH);
}

function drawWaveform(context: CanvasRenderingContext2D, samples: Float32Array | null, sampleRate: number, time: number, width: number, height: number) {
  const panelHeight = Math.max(112, Math.round(height * 0.13));
  const panelTop = height - panelHeight;
  const gradient = context.createLinearGradient(0, panelTop, 0, height);
  gradient.addColorStop(0, 'rgba(8,8,18,0)');
  gradient.addColorStop(0.25, 'rgba(8,8,18,.62)');
  gradient.addColorStop(1, 'rgba(8,8,18,.94)');
  context.fillStyle = gradient;
  context.fillRect(0, panelTop, width, panelHeight);

  const bars = Math.max(40, Math.min(96, Math.round(width / 14)));
  const gap = Math.max(3, Math.round(width * 0.004));
  const usableWidth = width * 0.84;
  const barWidth = Math.max(3, (usableWidth - gap * (bars - 1)) / bars);
  const startX = (width - usableWidth) / 2;
  const centerY = height - panelHeight * 0.42;
  const maxBarHeight = panelHeight * 0.54;
  const baseIndex = samples ? Math.floor(time * sampleRate) : 0;
  const windowSize = Math.max(64, Math.round(sampleRate * 0.035));

  for (let i = 0; i < bars; i++) {
    let amplitude = 0.12 + 0.08 * Math.sin(time * 4.5 + i * 0.45);
    if (samples) {
      const offset = Math.round((i - bars / 2) * windowSize * 0.45);
      const center = Math.max(0, Math.min(samples.length - 1, baseIndex + offset));
      let sum = 0;
      let count = 0;
      const from = Math.max(0, center - windowSize / 2);
      const to = Math.min(samples.length, center + windowSize / 2);
      const stride = Math.max(1, Math.floor((to - from) / 24));
      for (let j = from; j < to; j += stride) { sum += Math.abs(samples[j]); count++; }
      amplitude = count ? Math.min(1, (sum / count) * 4.8) : 0.08;
    }
    const pulse = 0.82 + 0.18 * Math.sin(time * 7 + i * 0.31);
    const barHeight = Math.max(6, maxBarHeight * amplitude * pulse);
    const x = startX + i * (barWidth + gap);
    const y = centerY - barHeight / 2;
    const g = context.createLinearGradient(x, y, x, y + barHeight);
    g.addColorStop(0, 'rgba(103,232,249,.96)');
    g.addColorStop(0.5, 'rgba(167,139,250,.96)');
    g.addColorStop(1, 'rgba(232,121,249,.88)');
    context.fillStyle = g;
    context.beginPath();
    context.roundRect(x, y, barWidth, barHeight, barWidth / 2);
    context.fill();
  }
}

async function generateVideo(song: Song, aspect: VideoAspect) {
  if (!song.picture || !song.audio) throw new Error('Không đủ ảnh hoặc audio để tự tạo video.');
  const [imageResponse, audioResponse] = await Promise.all([
    fetch(song.picture, { cache: 'no-store' }),
    fetch(song.audio, { cache: 'no-store' }),
  ]);
  if (!imageResponse.ok || !audioResponse.ok) throw new Error('Không thể tải ảnh hoặc audio để tạo video.');
  if (!('VideoEncoder' in window)) throw new Error('Trình duyệt này chưa hỗ trợ tạo video MP4. Hãy dùng Chrome hoặc Edge mới nhất.');

  const { ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, EncodedAudioPacketSource, EncodedPacketSink, Input, Mp4OutputFormat, Output } = await import('mediabunny');
  const audioBlob = await audioResponse.blob();
  const input = new Input({ source: new BlobSource(audioBlob), formats: ALL_FORMATS });
  const audioTrack = await input.getPrimaryAudioTrack();
  if (!audioTrack) throw new Error('File nguồn không có track audio hợp lệ.');
  const audioCodec = await audioTrack.getCodec();
  const decoderConfig = await audioTrack.getDecoderConfig();
  const duration = await input.computeDuration();
  if (!audioCodec || !decoderConfig || !Number.isFinite(duration) || duration <= 0) throw new Error('Không đọc được thông tin audio để tạo video.');

  let waveformSamples: Float32Array | null = null;
  let sampleRate = 48_000;
  try {
    const audioContext = new AudioContext();
    const decoded = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
    waveformSamples = decoded.getChannelData(0);
    sampleRate = decoded.sampleRate;
    await audioContext.close();
  } catch { waveformSamples = null; }

  const { width, height } = VIDEO_SIZES[aspect];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không tạo được khung hình video.');
  const bitmap = await createImageBitmap(await imageResponse.blob());

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const bitrate = width * height >= 1_000_000 ? 1_800_000 : 1_200_000;
  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate });
  const audioSource = new EncodedAudioPacketSource(audioCodec);
  output.addVideoTrack(videoSource);
  output.addAudioTrack(audioSource, { decoderConfig });
  await output.start();

  try {
    const fps = 12;
    const frameDuration = 1 / fps;
    const frames = Math.ceil(duration * fps);
    for (let frame = 0; frame < frames; frame++) {
      const timestamp = frame * frameDuration;
      drawCover(context, bitmap, width, height);
      drawWaveform(context, waveformSamples, sampleRate, timestamp, width, height);
      await videoSource.add(timestamp, Math.min(frameDuration, duration - timestamp), { keyFrame: frame % (fps * 2) === 0 });
    }
    bitmap.close();
    const packetSink = new EncodedPacketSink(audioTrack);
    const metadata = { decoderConfig };
    for await (const packet of packetSink.packets()) await audioSource.add(packet, metadata);
    await output.finalize();
  } catch (reason) {
    bitmap.close();
    output.cancel();
    throw reason;
  }
  if (!target.buffer) throw new Error('Không thể xuất file video MP4.');
  return new Blob([target.buffer], { type: 'video/mp4' });
}

async function convertMedia(source: Blob, format: 'mp3' | 'wav') {
  const { Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Mp3OutputFormat, WavOutputFormat, Conversion, canEncodeAudio } = await import('mediabunny');
  if (format === 'mp3' && !(await canEncodeAudio('mp3'))) {
    const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
    registerMp3Encoder();
  }
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const target = new BufferTarget();
  const output = new Output({ format: format === 'mp3' ? new Mp3OutputFormat() : new WavOutputFormat(), target });
  const conversion = await Conversion.init({ input, output, video: { discard: true }, audio: format === 'mp3' ? { bitrate: 192_000, numberOfChannels: 2, sampleRate: 48_000, forceTranscode: true } : { numberOfChannels: 2, sampleRate: 48_000, sampleFormat: 's16', forceTranscode: true }, copy: false, showWarnings: false });
  if (!conversion.isValid) throw new Error(`Trình duyệt không hỗ trợ tạo file ${format.toUpperCase()}.`);
  await conversion.execute();
  if (!target.buffer) throw new Error(`Không thể tạo file ${format.toUpperCase()}.`);
  return new Blob([target.buffer], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' });
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [videoAction, setVideoAction] = useState<'original' | 'generated' | null>(null);
  const [videoAspect, setVideoAspect] = useState<VideoAspect>('16:9');
  const [converting, setConverting] = useState<'mp3' | 'wav' | null>(null);
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
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Đã có lỗi xảy ra.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [url]);

  async function downloadSong() {
    if (!song) return;
    setError(''); setDownloading(true);
    try {
      const response = await fetch(song.audio, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không thể tải file âm thanh.');
      saveBlob(await response.blob(), `${song.title || 'suno-audio'}.m4a`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Đã có lỗi xảy ra.'); }
    finally { setDownloading(false); }
  }

  async function copyText(value: string, kind: 'lyrics' | 'style') {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function downloadOriginalVideo() {
    if (!song) return;
    setError(''); setVideoAction('original');
    try {
      if (!song.video) throw new Error('Bài hát này chưa có video gốc.');
      const response = await fetch(song.video, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không thể tải video gốc.');
      saveBlob(await response.blob(), `${song.title || 'suno-video'}-original.mp4`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Đã có lỗi xảy ra.'); }
    finally { setVideoAction(null); }
  }

  async function downloadGeneratedVideo() {
    if (!song) return;
    setError(''); setVideoAction('generated');
    try {
      saveBlob(await generateVideo(song, videoAspect), `${song.title || 'suno-video'}-${videoAspect.replace(':', 'x')}-waveform.mp4`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tạo video MP4.'); }
    finally { setVideoAction(null); }
  }

  async function downloadConverted(format: 'mp3' | 'wav') {
    if (!song) return;
    setError(''); setConverting(format);
    try {
      const response = await fetch(song.audio, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không thể tải nguồn âm thanh để chuyển đổi.');
      saveBlob(await convertMedia(await response.blob(), format), `${song.title || 'suno-audio'}.${format}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Không thể tạo file ${format.toUpperCase()}.`); }
    finally { setConverting(null); }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080812] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(139,92,246,.24),transparent_31%),radial-gradient(circle_at_82%_20%,rgba(34,211,238,.16),transparent_27%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:auto,auto,44px_44px,44px_44px]" />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400"><Music2 className="size-5" /></span><div><p className="text-base font-bold tracking-tight">Suno Grab <span className="text-violet-300">v2</span></p><p className="text-[10px] font-medium uppercase tracking-[.22em] text-white/45">Media downloader</p></div></div>
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 sm:flex"><ShieldCheck className="size-3.5 text-emerald-400" /> Không cần đăng nhập</span>
      </nav>
      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-20 pt-14 text-center sm:px-8 sm:pt-20">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3.5 py-1.5 text-xs font-medium text-violet-200"><Sparkles className="size-3.5" /> Nhanh, miễn phí và dễ dùng</div>
        <h1 className="max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-[-.04em] sm:text-6xl">Mang bản nhạc Suno của bạn <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">về máy.</span></h1>
        <p className="mt-5 max-w-xl text-balance text-base leading-7 text-white/55 sm:text-lg">Tải audio, ảnh, video gốc hoặc tạo video mới theo đúng tỉ lệ bạn cần.</p>
        <div className="mt-10 w-full rounded-[28px] border border-white/10 bg-white/[.055] p-2.5 shadow-[0_30px_100px_rgba(0,0,0,.38)] backdrop-blur-xl sm:p-3">
          <label className="relative block"><span className="sr-only">Liên kết bài hát Suno</span><Link2 className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/35" /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Dán link https://suno.com/s/..." autoComplete="url" inputMode="url" className="h-14 w-full rounded-[19px] border border-white/10 bg-black/25 pl-12 pr-36 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-500/10" /><span className="pointer-events-none absolute right-4 top-1/2 inline-flex -translate-y-1/2 items-center gap-2 text-xs font-semibold text-white/45">{loading ? <><LoaderCircle className="size-4 animate-spin text-violet-300" /> Đang lấy...</> : <><Sparkles className="size-4 text-cyan-300" /> Tự động</>}</span></label>
        </div>
        <div aria-live="polite" className="mt-5 w-full">
          {error && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
          {song && <article className="rounded-[26px] border border-white/10 bg-white/[.06] p-5 text-left shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              {song.picture ? <img src={song.picture} alt="Ảnh bìa bài hát" className="size-28 rounded-2xl object-cover shadow-lg sm:size-32" /> : <div className="grid size-28 place-items-center rounded-2xl bg-white/10 sm:size-32"><Music2 /></div>}
              <div className="min-w-0 flex-1 text-center sm:text-left"><p className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[.13em] text-emerald-300 sm:justify-start"><CheckCircle2 className="size-3.5" /> Đã tìm thấy</p><h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{song.title}</h2><p className="mt-2 text-sm text-white/45">{[song.creator, song.duration ? `${Math.floor(song.duration / 60)}:${String(Math.round(song.duration % 60)).padStart(2, '0')}` : null].filter(Boolean).join(' · ') || song.description || 'Bản nhạc được tạo trên Suno.'}</p>{song.tags && <p className="mt-1 line-clamp-1 text-xs text-violet-200/60">{song.tags}</p>}<audio key={song.audio} controls preload="metadata" src={song.audio} className="mt-4 h-10 w-full min-w-0 accent-violet-500" /></div>
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-1"><button onClick={() => downloadConverted('mp3')} disabled={converting !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 text-sm font-bold disabled:opacity-60">{converting === 'mp3' ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}Tải MP3</button><button onClick={() => downloadConverted('wav')} disabled={converting !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-300/20 bg-violet-300/10 px-4 text-sm font-bold text-violet-100 disabled:opacity-60">{converting === 'wav' ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}Tải WAV</button><button onClick={downloadSong} disabled={downloading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/70 disabled:opacity-60">{downloading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}Tải M4A</button><button onClick={downloadOriginalVideo} disabled={videoAction !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-bold text-cyan-100 disabled:opacity-60">{videoAction === 'original' ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}Tải video gốc</button></div>
            </div>
            <div className="mt-5 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[.055] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-100"><Waves className="size-4" /> Tạo video + sóng nhạc</div>
              <p className="mt-1 text-xs leading-5 text-white/45">Video tự tạo dùng ảnh bìa + audio hiện tại, thêm waveform động ở đáy. Video gốc không bị thay đổi.</p>
              <div className="mt-3 flex flex-wrap gap-2">{(['16:9','9:16','1:1','4:5','4:3'] as VideoAspect[]).map((aspect) => <button key={aspect} onClick={() => setVideoAspect(aspect)} disabled={videoAction !== null} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${videoAspect === aspect ? 'border-fuchsia-300/50 bg-fuchsia-300/20 text-fuchsia-50' : 'border-white/10 bg-black/20 text-white/55 hover:bg-white/10'}`}>{aspect}</button>)}</div>
              <button onClick={downloadGeneratedVideo} disabled={videoAction !== null} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 text-sm font-bold shadow-lg disabled:opacity-60">{videoAction === 'generated' ? <LoaderCircle className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}{videoAction === 'generated' ? `Đang tạo video ${videoAspect}...` : `Tạo & tải video ${videoAspect}`}</button>
            </div>
            {song.video && <details className="group mt-5 border-t border-white/10 pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white/80"><span>Xem video Suno</span><span className="text-xs text-cyan-300 group-open:hidden">Mở</span><span className="hidden text-xs text-cyan-300 group-open:inline">Đóng</span></summary><video controls preload="metadata" poster={song.picture || undefined} src={song.video} className="mt-4 aspect-video w-full rounded-2xl bg-black object-contain" /></details>}
            {song.style && <div className="mt-5 border-t border-white/10 pt-4"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white/80">Style</h3><button onClick={() => copyText(song.style!, 'style')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10">{copied === 'style' ? 'Đã sao chép' : 'Sao chép style'}</button></div><p className="whitespace-pre-wrap rounded-2xl bg-violet-400/[.07] p-4 text-sm leading-6 text-violet-100/70">{song.style}</p></div>}
            {song.lyrics && <details className="group mt-5 border-t border-white/10 pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white/80"><span>Xem lời bài hát</span><span className="text-xs text-violet-300 group-open:hidden">Mở</span><span className="hidden text-xs text-violet-300 group-open:inline">Đóng</span></summary><div className="mt-4 max-h-96 overflow-y-auto rounded-2xl bg-black/25 p-4"><div className="mb-3 flex justify-end"><button onClick={() => copyText(song.lyrics!, 'lyrics')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10">{copied === 'lyrics' ? 'Đã sao chép' : 'Sao chép lyrics'}</button></div><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/65">{song.lyrics}</pre></div></details>}
          </article>}
        </div>
        <div className="mt-14 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">{[['01','Dán liên kết','Sao chép link chia sẻ của bài hát trên Suno.'],['02','Lấy bài hát','Hệ thống tự tìm thông tin, ảnh, audio và video.'],['03','Tải xuống','Chọn định dạng hoặc tạo video theo tỉ lệ mong muốn.']].map(([number,title,copy]) => <div key={number} className="rounded-2xl border border-white/[.07] bg-white/[.035] p-5"><span className="text-xs font-bold text-violet-300">{number}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-white/40">{copy}</p></div>)}</div>
        <p className="mt-10 max-w-xl text-xs leading-5 text-white/30">Chỉ tải nội dung bạn sở hữu hoặc được phép sử dụng. Suno Grab không lưu trữ file âm thanh trên máy chủ.</p>
      </section>
    </main>
  );
}
