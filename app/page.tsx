'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Clapperboard, Link2, LoaderCircle, Music2, ShieldCheck, Sparkles } from 'lucide-react';
import { buildEstimatedKaraokeTimeline, drawKaraokeOverlay, type KaraokeLine } from './lib/karaoke';
import KaraokeEditor from './components/KaraokeEditor';

type Song = { id: string | null; title: string; picture: string | null; audio: string; sourceAudio: string; video: string | null; description: string | null; lyrics: string | null; style: string | null; tags: string | null; duration: number | null; creator: string | null };

function saveBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}


async function renderTikTokLikeAudio(source: Blob) {
  const arrayBuffer = await source.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error('Trình duyệt không hỗ trợ xử lý audio.');

  const decodeContext = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await decodeContext.close();
  }

  const sampleRate = 48_000;
  const frameCount = Math.ceil(decoded.duration * sampleRate);
  const offline = new OfflineAudioContext(2, frameCount, sampleRate);

  const sourceNode = offline.createBufferSource();
  sourceNode.buffer = decoded;

  const highpass = offline.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 30;
  highpass.Q.value = 0.707;

  const subCleanup = offline.createBiquadFilter();
  subCleanup.type = 'lowshelf';
  subCleanup.frequency.value = 80;
  subCleanup.gain.value = -0.8;

  const lowMid = offline.createBiquadFilter();
  lowMid.type = 'peaking';
  lowMid.frequency.value = 220;
  lowMid.Q.value = 1.0;
  lowMid.gain.value = 0.7;

  const presence = offline.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3000;
  presence.Q.value = 1.2;
  presence.gain.value = 1.2;

  const highSoftener = offline.createBiquadFilter();
  highSoftener.type = 'highshelf';
  highSoftener.frequency.value = 8000;
  highSoftener.gain.value = -0.7;

  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 10;
  compressor.ratio.value = 1.7;
  compressor.attack.value = 0.02;
  compressor.release.value = 0.11;

  sourceNode
    .connect(highpass)
    .connect(subCleanup)
    .connect(lowMid)
    .connect(presence)
    .connect(highSoftener)
    .connect(compressor)
    .connect(offline.destination);

  sourceNode.start();
  const rendered = await offline.startRendering();

  let sumSquares = 0;
  let peak = 0;
  let samples = 0;
  for (let channel = 0; channel < rendered.numberOfChannels; channel++) {
    const data = rendered.getChannelData(channel);
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i];
      sumSquares += value * value;
      peak = Math.max(peak, Math.abs(value));
      samples++;
    }
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, samples));
  const targetRms = Math.pow(10, -13 / 20);
  const ceiling = Math.pow(10, -1 / 20);
  const desiredGain = rms > 0 ? targetRms / rms : 1;
  const peakSafeGain = peak > 0 ? ceiling / peak : 1;
  const gain = Math.max(0.25, Math.min(4, desiredGain, peakSafeGain));

  const normalized = new AudioBuffer({
    length: rendered.length,
    numberOfChannels: 2,
    sampleRate,
  });

  for (let channel = 0; channel < 2; channel++) {
    const input = rendered.getChannelData(Math.min(channel, rendered.numberOfChannels - 1));
    const output = normalized.getChannelData(channel);
    for (let i = 0; i < input.length; i++) {
      const amplified = input[i] * gain;
      output[i] = Math.max(-ceiling, Math.min(ceiling, amplified));
    }
  }

  const wav = new ArrayBuffer(44 + normalized.length * 2 * 2);
  const view = new DataView(wav);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + normalized.length * 4, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, normalized.length * 4, true);

  let offset = 44;
  const left = normalized.getChannelData(0);
  const right = normalized.getChannelData(1);
  for (let i = 0; i < normalized.length; i++) {
    view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767))), true);
    offset += 2;
    view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767))), true);
    offset += 2;
  }

  return new Blob([wav], { type: 'audio/wav' });
}

async function generateVideo(song: Song, karaoke = false, suppliedTimeline: KaraokeLine[] = []) {
  if (!song.picture || !song.audio) throw new Error('Không đủ ảnh hoặc audio để tự tạo video.');
  const [imageResponse, audioResponse] = await Promise.all([
    fetch(song.picture, { cache: 'no-store' }),
    fetch(song.audio, { cache: 'no-store' }),
  ]);
  if (!imageResponse.ok || !audioResponse.ok) throw new Error('Không thể tải ảnh hoặc audio để tạo video.');

  if (!('VideoEncoder' in window)) throw new Error('Trình duyệt này chưa hỗ trợ tạo video MP4. Hãy dùng Chrome hoặc Edge mới nhất.');
  const {
    ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, EncodedAudioPacketSource,
    EncodedPacketSink, Input, Mp4OutputFormat, Output,
  } = await import('mediabunny');
  const processedAudio = await renderTikTokLikeAudio(await audioResponse.blob());
  const audioBlob = await convertMedia(processedAudio, 'm4a');
  const input = new Input({ source: new BlobSource(audioBlob), formats: ALL_FORMATS });
  const audioTrack = await input.getPrimaryAudioTrack();
  if (!audioTrack) throw new Error('File nguồn không có track audio hợp lệ.');
  const audioCodec = await audioTrack.getCodec();
  const decoderConfig = await audioTrack.getDecoderConfig();
  const duration = await input.computeDuration();
  if (!audioCodec || !decoderConfig || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('Không đọc được thông tin audio để tạo video.');
  }
  const karaokeTimeline = karaoke && song.lyrics
    ? (suppliedTimeline.length ? suppliedTimeline : buildEstimatedKaraokeTimeline(song.lyrics, duration))
    : [];

  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không tạo được khung hình video.');
  const bitmap = await createImageBitmap(await imageResponse.blob());
  const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
  const width = bitmap.width * scale; const height = bitmap.height * scale;
  const imageX = (canvas.width - width) / 2;
  const imageY = (canvas.height - height) / 2;

  const drawFrame = (time: number) => {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, imageX, imageY, width, height);
    if (karaokeTimeline.length) {
      context.fillStyle = 'rgba(0,0,0,.16)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawKaraokeOverlay(context, karaokeTimeline, time, canvas.width, canvas.height);
    }
  };

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: karaokeTimeline.length ? 1_200_000 : 600_000 });
  const audioSource = new EncodedAudioPacketSource(audioCodec);
  output.addVideoTrack(videoSource);
  output.addAudioTrack(audioSource, { decoderConfig });
  await output.start();
  try {
    if (karaokeTimeline.length) {
      const frameRate = 10;
      const frameDuration = 1 / frameRate;
      const frameCount = Math.ceil(duration * frameRate);
      for (let frame = 0; frame < frameCount; frame++) {
        const timestamp = frame * frameDuration;
        const sampleDuration = Math.min(frameDuration, duration - timestamp);
        if (sampleDuration <= 0) break;
        drawFrame(timestamp);
        await videoSource.add(timestamp, sampleDuration, { keyFrame: frame % (frameRate * 2) === 0 });
      }
    } else {
      drawFrame(0);
      await videoSource.add(0, duration, { keyFrame: true });
    }

    const packetSink = new EncodedPacketSink(audioTrack);
    const metadata = { decoderConfig };
    for await (const packet of packetSink.packets()) await audioSource.add(packet, metadata);
    await output.finalize();
  } catch (reason) {
    output.cancel();
    throw reason;
  } finally {
    bitmap.close();
  }
  if (!target.buffer) throw new Error('Không thể xuất file video MP4.');
  return new Blob([target.buffer], { type: 'video/mp4' });
}

async function convertMedia(source: Blob, format: 'mp3' | 'wav' | 'm4a') {
  const { Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Mp3OutputFormat, WavOutputFormat, Mp4OutputFormat, Conversion, canEncodeAudio } = await import('mediabunny');
  if (format === 'mp3' && !(await canEncodeAudio('mp3'))) {
    const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
    registerMp3Encoder();
  }
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const target = new BufferTarget();
  const output = new Output({
    format: format === 'mp3'
      ? new Mp3OutputFormat()
      : format === 'wav'
        ? new WavOutputFormat()
        : new Mp4OutputFormat(),
    target,
  });
  const conversion = await Conversion.init({
    input,
    output,
    video: { discard: true },
    audio: format === 'mp3'
      ? { bitrate: 192_000, numberOfChannels: 2, sampleRate: 48_000, forceTranscode: true }
      : format === 'wav'
        ? { numberOfChannels: 2, sampleRate: 48_000, sampleFormat: 's16', forceTranscode: true }
        : { codec: 'aac', bitrate: 128_000, numberOfChannels: 2, sampleRate: 48_000, forceTranscode: true },
    copy: false,
    showWarnings: false,
  });
  if (!conversion.isValid) throw new Error(`Trình duyệt không hỗ trợ tạo file ${format.toUpperCase()}.`);
  await conversion.execute();
  if (!target.buffer) throw new Error(`Không thể tạo file ${format.toUpperCase()}.`);
  return new Blob(
    [target.buffer],
    { type: format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/mp4' },
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [videoAction, setVideoAction] = useState<'original' | 'generated' | 'karaoke' | null>(null);
  const [converting, setConverting] = useState<'mp3' | 'wav' | null>(null);
  const [copied, setCopied] = useState<'lyrics' | 'style' | null>(null);
  const [karaokeTimeline, setKaraokeTimeline] = useState<KaraokeLine[]>([]);
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
    if (!song?.lyrics || !song.duration) {
      setKaraokeTimeline([]);
      return;
    }
    setKaraokeTimeline(buildEstimatedKaraokeTimeline(song.lyrics, song.duration));
  }, [song?.id, song?.lyrics, song?.duration]);

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
      const response = await fetch(song.audio, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không thể tải file âm thanh.');
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

  async function downloadGeneratedVideo(karaoke = false) {
    if (!song) return;
    setError(''); setVideoAction(karaoke ? 'karaoke' : 'generated');
    try {
      if (karaoke && !song.lyrics) throw new Error('Bài hát này chưa có lyrics từ Suno.');
      saveBlob(
        await generateVideo(song, karaoke, karaoke ? karaokeTimeline : []),
        `${song.title || 'suno-video'}-${karaoke ? 'karaoke' : 'image-audio'}.mp4`,
      );
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tạo video MP4.'); }
    finally { setVideoAction(null); }
  }

  async function downloadConverted(format: 'mp3' | 'wav') {
    if (!song) return;
    setError(''); setConverting(format);
    try {
      const response = await fetch(song.audio, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không thể tải nguồn âm thanh để chuyển đổi.');
      const processed = await renderTikTokLikeAudio(await response.blob());
      const blob = await convertMedia(processed, format);
      saveBlob(blob, `${song.title || 'suno-audio'}-processed.${format}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Không thể tạo file ${format.toUpperCase()}.`); }
    finally { setConverting(null); }
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
            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-1"><button onClick={() => downloadConverted('mp3')} disabled={converting !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 text-sm font-bold shadow-[0_12px_32px_rgba(124,58,237,.28)] transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-violet-400/25 disabled:opacity-60">{converting === 'mp3' ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}{converting === 'mp3' ? 'Đang đổi...' : 'Tải MP3'}</button><button onClick={() => downloadConverted('wav')} disabled={converting !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-300/20 bg-violet-300/10 px-4 text-sm font-bold text-violet-100 transition hover:bg-violet-300/15 disabled:opacity-60">{converting === 'wav' ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}{converting === 'wav' ? 'Đang đổi...' : 'Tải WAV'}</button><button onClick={downloadSong} disabled={downloading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-60">{downloading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}{downloading ? 'Đang tải...' : 'Tải M4A'}</button><button onClick={downloadOriginalVideo} disabled={videoAction !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/15 focus:outline-none focus:ring-4 focus:ring-cyan-300/15 disabled:opacity-60">{videoAction === 'original' ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}{videoAction === 'original' ? 'Đang tải...' : 'Tải video gốc'}</button><button onClick={() => downloadGeneratedVideo(false)} disabled={videoAction !== null} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/10 px-4 text-sm font-bold text-fuchsia-100 transition hover:bg-fuchsia-300/15 focus:outline-none focus:ring-4 focus:ring-fuchsia-300/15 disabled:opacity-60 sm:col-span-1">{videoAction === 'generated' ? <LoaderCircle className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}{videoAction === 'generated' ? 'Đang tạo MP4...' : 'Tạo video ảnh + audio'}</button>{song.lyrics && <button onClick={() => downloadGeneratedVideo(true)} disabled={videoAction !== null} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-bold text-amber-100 transition hover:bg-amber-300/15 focus:outline-none focus:ring-4 focus:ring-amber-300/15 disabled:opacity-60 sm:col-span-1">{videoAction === 'karaoke' ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{videoAction === 'karaoke' ? 'Đang render karaoke...' : 'Tạo video Karaoke'}</button>}</div>
          </div>{song.video && <details className="group mt-5 border-t border-white/10 pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white/80"><span>Xem video Suno</span><span className="text-xs text-cyan-300 group-open:hidden">Mở</span><span className="hidden text-xs text-cyan-300 group-open:inline">Đóng</span></summary><video controls preload="metadata" poster={song.picture || undefined} src={song.video} className="mt-4 aspect-video w-full rounded-2xl bg-black object-contain">Trình duyệt của bạn không hỗ trợ video.</video></details>}{song.style && <div className="mt-5 border-t border-white/10 pt-4"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white/80">Style</h3><button onClick={() => copyText(song.style!, 'style')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10">{copied === 'style' ? 'Đã sao chép' : 'Sao chép style'}</button></div><p className="whitespace-pre-wrap rounded-2xl bg-violet-400/[.07] p-4 text-sm leading-6 text-violet-100/70">{song.style}</p></div>}{song.lyrics && <details className="group mt-5 border-t border-white/10 pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white/80"><span>Xem lời bài hát</span><span className="text-xs text-violet-300 group-open:hidden">Mở</span><span className="hidden text-xs text-violet-300 group-open:inline">Đóng</span></summary><div className="mt-4 max-h-96 overflow-y-auto rounded-2xl bg-black/25 p-4"><div className="mb-3 flex justify-end"><button onClick={() => copyText(song.lyrics!, 'lyrics')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10">{copied === 'lyrics' ? 'Đã sao chép' : 'Sao chép lyrics'}</button></div><div className="mb-3 rounded-xl border border-amber-300/15 bg-amber-300/[.06] px-3 py-2 text-xs leading-5 text-amber-100/70">Lyrics Suno được dùng nguyên văn. Có thể Tap Sync theo từng câu, chỉnh tới từng từ rồi Gen Video sẽ dùng đúng timing đã lưu bên dưới.</div><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/65">{song.lyrics}</pre>{song.duration && <KaraokeEditor audioUrl={song.audio} lyrics={song.lyrics} duration={song.duration} timeline={karaokeTimeline} onChange={setKaraokeTimeline} />}</div></details>}</article>}
        </div>
        <div className="mt-14 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">{[['01','Dán liên kết','Sao chép link chia sẻ của bài hát trên Suno.'],['02','Lấy bài hát','Hệ thống tự tìm thông tin và file âm thanh.'],['03','Tải xuống','Lưu audio về thiết bị để nghe bất cứ lúc nào.']].map(([number,title,copy]) => <div key={number} className="rounded-2xl border border-white/[.07] bg-white/[.035] p-5"><span className="text-xs font-bold text-violet-300">{number}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-white/40">{copy}</p></div>)}</div>
        <p className="mt-10 max-w-xl text-xs leading-5 text-white/30">Chỉ tải nội dung bạn sở hữu hoặc được phép sử dụng. Suno Grab không lưu trữ file âm thanh trên máy chủ.</p>
      </section>
    </main>
  );
}
