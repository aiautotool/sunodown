'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KaraokeLine,
  activeKaraokeLine,
  buildEstimatedKaraokeTimeline,
  exportAss,
  exportEnhancedLrc,
  exportSrt,
  parseKaraokeJson,
  setLineTiming,
  setWordTiming,
  shiftTimeline,
  timelineFromLineStarts,
} from '../lib/karaoke';

type Props = {
  audioUrl: string;
  lyrics: string;
  duration: number;
  timeline: KaraokeLine[];
  onChange: (timeline: KaraokeLine[]) => void;
};

function saveText(value: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function seconds(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

export default function KaraokeEditor({ audioUrl, lyrics, duration, timeline, onChange }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [time, setTime] = useState(0);
  const [tapStarts, setTapStarts] = useState<number[]>([]);
  const [tapMode, setTapMode] = useState(false);
  const [selectedLine, setSelectedLine] = useState(0);
  const [expandedWordLine, setExpandedWordLine] = useState<number | null>(null);
  const [aligning, setAligning] = useState(false);
  const [alignMessage, setAlignMessage] = useState('');

  const active = useMemo(() => activeKaraokeLine(timeline, time), [timeline, time]);

  useEffect(() => {
    if (active.index >= 0) setSelectedLine(active.index);
  }, [active.index]);

  function estimate() {
    onChange(buildEstimatedKaraokeTimeline(lyrics, duration));
    setTapStarts([]);
  }

  async function autoAlign() {
    setAligning(true);
    setAlignMessage('');
    try {
      const audioResponse = await fetch(audioUrl, { cache: 'no-store' });
      if (!audioResponse.ok) throw new Error('Không tải được audio để căn lời.');
      const audioBlob = await audioResponse.blob();
      const form = new FormData();
      form.set('audio', new File([audioBlob], 'suno-audio', { type: audioBlob.type || 'audio/mpeg' }));
      form.set('lyrics', lyrics);
      form.set('language', 'vi');

      const response = await fetch('/api/karaoke/align', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Auto Sync thất bại.');

      const parsed = parseKaraokeJson(JSON.stringify(data));
      onChange(parsed);
      const rate = typeof data?.meta?.match_rate === 'number' ? Math.round(data.meta.match_rate * 100) : null;
      setAlignMessage(rate === null ? 'Auto Sync hoàn tất.' : `Auto Sync hoàn tất · khớp ${rate}% từ.`);
    } catch (error) {
      setAlignMessage(error instanceof Error ? error.message : 'Auto Sync thất bại.');
    } finally {
      setAligning(false);
    }
  }

  function startTapSync() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setTime(0);
    setTapStarts([]);
    setSelectedLine(0);
    setTapMode(true);
    void audio.play();
  }

  function tapCurrentLine() {
    const audio = audioRef.current;
    if (!audio || !tapMode) return;
    const current = audio.currentTime;
    const next = [...tapStarts, current];
    setTapStarts(next);
    setSelectedLine(Math.min(next.length, timeline.length - 1));
    if (next.length >= timeline.length) {
      setTapMode(false);
      onChange(timelineFromLineStarts(lyrics, next, duration));
    }
  }

  function stopTapSync() {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setTapMode(false);
    if (tapStarts.length) onChange(timelineFromLineStarts(lyrics, tapStarts, duration));
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration || audio.duration || 0, value));
    setTime(audio.currentTime);
  }

  function nudgeLine(index: number, delta: number) {
    const line = timeline[index];
    if (!line) return;
    onChange(setLineTiming(timeline, index, Math.max(0, line.start + delta), Math.max(0.02, line.end + delta)));
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseKaraokeJson(await file.text());
      onChange(parsed);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không đọc được file timing.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  const selected = timeline[selectedLine];

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold text-white/90">Karaoke timing editor</h4>
          <p className="mt-1 text-xs text-white/45">Tap Sync theo từng câu, sau đó tinh chỉnh dòng hoặc từng từ.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={estimate} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10">Auto estimate</button>
          <button onClick={() => void autoAlign()} disabled={aligning} className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-300/15 disabled:opacity-50">{aligning ? 'Đang Auto Sync AI...' : 'Auto Sync AI'}</button>
          {!tapMode ? (
            <button onClick={startTapSync} className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-300/15">Bắt đầu Tap Sync</button>
          ) : (
            <>
              <button onClick={tapCurrentLine} className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-black">Tap câu hiện tại</button>
              <button onClick={stopTapSync} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">Dừng</button>
            </>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        preload="metadata"
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onSeeked={(event) => setTime(event.currentTarget.currentTime)}
        className="mt-4 h-10 w-full"
      />

      {alignMessage && <div className="mt-2 rounded-lg border border-white/[.07] bg-white/[.035] px-3 py-2 text-xs text-white/60">{alignMessage}</div>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={Math.min(time, duration || 1)}
          onChange={(event) => seek(Number(event.target.value))}
          className="w-full"
        />
        <div className="text-right font-mono text-xs text-white/50">{seconds(time)} / {seconds(duration)}</div>
      </div>

      {tapMode && (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[.07] p-3 text-sm text-amber-100">
          <div className="font-semibold">Đang sync câu {tapStarts.length + 1}/{timeline.length}</div>
          <div className="mt-1 text-amber-100/70">{timeline[tapStarts.length]?.text || 'Đã hết câu.'}</div>
          <div className="mt-2 text-xs text-amber-100/50">Bấm “Tap câu hiện tại” đúng lúc ca sĩ bắt đầu câu. Có thể dừng giữa chừng rồi chỉnh tiếp bằng tay.</div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => onChange(shiftTimeline(timeline, -0.1))} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70">Toàn bài -100ms</button>
        <button onClick={() => onChange(shiftTimeline(timeline, 0.1))} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70">Toàn bài +100ms</button>
        <button onClick={() => saveText(JSON.stringify({ lines: timeline }, null, 2), 'karaoke-timing.json', 'application/json')} className="rounded-lg border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-100">JSON</button>
        <button onClick={() => saveText(exportAss(timeline), 'karaoke.ass')} className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-100">ASS</button>
        <button onClick={() => saveText(exportEnhancedLrc(timeline), 'karaoke.lrc')} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">LRC</button>
        <button onClick={() => saveText(exportSrt(timeline), 'karaoke.srt')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">SRT</button>
        <button onClick={() => importRef.current?.click()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">Import JSON</button>
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void importJson(event.target.files?.[0])} />
      </div>

      <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {timeline.map((line, index) => {
          const isActive = active.index === index;
          return (
            <div key={index} className={`rounded-xl border p-3 ${isActive ? 'border-fuchsia-300/30 bg-fuchsia-300/[.08]' : 'border-white/[.07] bg-white/[.03]'}`}>
              <button onClick={() => { setSelectedLine(index); seek(line.start); }} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm leading-6 text-white/80">{line.text}</span>
                  <span className="shrink-0 font-mono text-[11px] text-white/35">{seconds(line.start)}–{seconds(line.end)}</span>
                </div>
              </button>
              {selectedLine === index && (
                <div className="mt-3 border-t border-white/[.07] pt-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-[11px] text-white/40">Start
                      <input type="number" step="0.01" value={line.start} onChange={(e) => onChange(setLineTiming(timeline, index, Number(e.target.value), line.end))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 font-mono text-xs text-white/80" />
                    </label>
                    <label className="text-[11px] text-white/40">End
                      <input type="number" step="0.01" value={line.end} onChange={(e) => onChange(setLineTiming(timeline, index, line.start, Number(e.target.value)))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 font-mono text-xs text-white/80" />
                    </label>
                    <button onClick={() => nudgeLine(index, -0.05)} className="self-end rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/60">-50ms</button>
                    <button onClick={() => nudgeLine(index, 0.05)} className="self-end rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/60">+50ms</button>
                  </div>
                  <button onClick={() => setExpandedWordLine(expandedWordLine === index ? null : index)} className="mt-2 text-xs font-semibold text-fuchsia-200/70">
                    {expandedWordLine === index ? 'Ẩn timing từng từ' : 'Chỉnh timing từng từ'}
                  </button>
                  {expandedWordLine === index && (
                    <div className="mt-2 space-y-1.5">
                      {line.words.map((word, wordIndex) => (
                        <div key={wordIndex} className="grid grid-cols-[1fr_88px_88px] items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5">
                          <span className="truncate text-xs text-white/65">{word.text}</span>
                          <input type="number" step="0.01" value={word.start} onChange={(e) => onChange(setWordTiming(timeline, index, wordIndex, Number(e.target.value), word.end))} className="rounded-md border border-white/10 bg-black/25 px-2 py-1 font-mono text-[11px] text-white/70" />
                          <input type="number" step="0.01" value={word.end} onChange={(e) => onChange(setWordTiming(timeline, index, wordIndex, word.start, Number(e.target.value)))} className="rounded-md border border-white/10 bg-black/25 px-2 py-1 font-mono text-[11px] text-white/70" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 rounded-xl bg-white/[.035] p-3">
          <div className="text-xs font-semibold uppercase tracking-[.12em] text-white/35">Preview câu chọn</div>
          <div className="mt-2 flex flex-wrap gap-x-1.5 gap-y-1 text-lg font-bold">
            {selected.words.map((word, index) => {
              const done = time >= word.end;
              const activeWord = time >= word.start && time < word.end;
              return <span key={index} className={activeWord ? 'text-fuchsia-300' : done ? 'text-fuchsia-200/75' : 'text-white/35'}>{word.text}</span>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
