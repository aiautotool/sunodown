'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileJson, FileText, Image as ImageIcon, Music2 } from 'lucide-react';
import type { Song } from '@/components/v4/types';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function name(value: string) {
  return (value || 'suno').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 120) || 'suno';
}

async function convertAudio(source: Blob, format: 'mp3' | 'wav') {
  const { Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Mp3OutputFormat, WavOutputFormat, Conversion, canEncodeAudio } = await import('mediabunny');
  if (format === 'mp3' && !(await canEncodeAudio('mp3'))) {
    const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
    registerMp3Encoder();
  }
  const target = new BufferTarget();
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const output = new Output({ format: format === 'mp3' ? new Mp3OutputFormat() : new WavOutputFormat(), target });
  const conversion = await Conversion.init({
    input,
    output,
    video: { discard: true },
    audio: format === 'mp3' ? { bitrate: 192000, numberOfChannels: 2, sampleRate: 48000, forceTranscode: true } : { numberOfChannels: 2, sampleRate: 48000, sampleFormat: 's16', forceTranscode: true },
    copy: false,
    showWarnings: false,
  });
  if (!conversion.isValid) throw new Error(`Không hỗ trợ ${format.toUpperCase()} trên thiết bị này.`);
  await conversion.execute();
  if (!target.buffer) throw new Error(`Không tạo được ${format.toUpperCase()}.`);
  return new Blob([target.buffer], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' });
}

export function V5DownloadEnhancer() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let timer: number | undefined;
    let controller: AbortController | null = null;
    const input = document.querySelector<HTMLInputElement>('input[placeholder^="Dán link Suno"]');
    if (!input) return;

    const sync = () => {
      const value = input.value.trim();
      if (!/^https:\/\/(?:[^/]+\.)?suno\.com\//i.test(value)) return;
      if (value === sourceUrl) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        controller?.abort();
        controller = new AbortController();
        try {
          const res = await fetch('/api/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: value }), signal: controller.signal });
          const data = await res.json();
          if (!res.ok) return;
          setSong(data);
          setSourceUrl(value);
        } catch {}
      }, 450);
    };

    input.addEventListener('input', sync);
    sync();

    const observer = new MutationObserver(() => {
      const article = document.querySelector('main article');
      if (!article) return;
      let host = article.querySelector<HTMLElement>('[data-v5-download-panel]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.v5DownloadPanel = 'true';
        const visualizer = article.children[1];
        if (visualizer) article.insertBefore(host, visualizer);
        else article.appendChild(host);
      }
      setMount(host);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      input.removeEventListener('input', sync);
      observer.disconnect();
      controller?.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [sourceUrl]);

  async function audio(format: 'm4a' | 'mp3' | 'wav') {
    if (!song) return;
    setBusy(format);
    setError('');
    try {
      const res = await fetch(song.audio, { cache: 'no-store' });
      if (!res.ok) throw new Error('Không tải được audio.');
      const source = await res.blob();
      const blob = format === 'm4a' ? source : await convertAudio(source, format);
      saveBlob(blob, `${name(song.title)}.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được audio.');
    } finally {
      setBusy(null);
    }
  }

  async function cover() {
    if (!song?.picture) return;
    setBusy('cover');
    try {
      const res = await fetch(song.picture, { cache: 'no-store' });
      if (!res.ok) throw new Error('Không tải được ảnh bìa.');
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      saveBlob(blob, `${name(song.title)}-cover.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được ảnh bìa.');
    } finally {
      setBusy(null);
    }
  }

  function lyrics() {
    if (song?.lyrics) saveBlob(new Blob([song.lyrics], { type: 'text/plain;charset=utf-8' }), `${name(song.title)}-lyrics.txt`);
  }

  function metadata() {
    if (!song) return;
    saveBlob(new Blob([JSON.stringify({ title: song.title, creator: song.creator, description: song.description, style: song.style, tags: song.tags, duration: song.duration, sourceUrl }, null, 2)], { type: 'application/json;charset=utf-8' }), `${name(song.title)}-metadata.json`);
  }

  if (!mount || !song) return null;

  return createPortal(
    <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[.045] p-4">
      <div className="flex items-center gap-2"><Download className="size-4 text-cyan-300" /><div><p className="font-bold">Tải bài hát</p><p className="text-xs text-white/45">Chọn file cần tải trước khi dùng Visualizer.</p></div></div>
      {error && <p className="mt-3 text-xs text-rose-200">{error}</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button onClick={() => audio('mp3')} disabled={!!busy} className="rounded-xl bg-violet-500 px-4 py-3 font-bold disabled:opacity-45">{busy === 'mp3' ? 'Đang tạo...' : 'Tải MP3'}</button>
        <button onClick={() => audio('wav')} disabled={!!busy} className="rounded-xl bg-white/10 px-4 py-3 font-bold disabled:opacity-45">{busy === 'wav' ? 'Đang tạo...' : 'Tải WAV'}</button>
        <button onClick={() => audio('m4a')} disabled={!!busy} className="rounded-xl bg-white/10 px-4 py-3 font-bold disabled:opacity-45"><Music2 className="mr-2 inline size-4" />Tải M4A</button>
        <button onClick={cover} disabled={!song.picture || !!busy} className="rounded-xl bg-white/10 px-4 py-3 font-bold disabled:opacity-35"><ImageIcon className="mr-2 inline size-4" />Ảnh bìa</button>
        <button onClick={lyrics} disabled={!song.lyrics} className="rounded-xl bg-white/10 px-4 py-3 font-bold disabled:opacity-35"><FileText className="mr-2 inline size-4" />Lyrics TXT</button>
        <button onClick={metadata} className="rounded-xl bg-white/10 px-4 py-3 font-bold"><FileJson className="mr-2 inline size-4" />Metadata</button>
      </div>
    </div>,
    mount,
  );
}
