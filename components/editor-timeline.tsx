'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Focus,
  ChevronDown,
  ImagePlus,
  Lock,
  Magnet,
  Minus,
  MousePointer2,
  Scissors,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  Plus,
  Redo2,
  Sparkles,
  Undo2,
  Video,
  Waves,
} from 'lucide-react';
import type { KaraokeLine } from '@/app/lib/karaoke';

export type MediaClip = {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  start: number;
  end: number;
  isDefault?: boolean;
};

export type TimelineTrackState = Record<TrackName, TrackState>;

type Snapshot = {
  subtitles: KaraokeLine[];
  clips: MediaClip[];
};

type TrackName = 'audio' | 'visual' | 'subtitle' | 'effects';
type Tool = 'select' | 'razor';
type TrackState = { hidden: boolean; muted: boolean; locked: boolean };

type Props = {
  duration: number;
  picture?: string;
  playhead: number;
  onSeek: (time: number) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  subtitles: KaraokeLine[];
  onSubtitlesChange: (lines: KaraokeLine[]) => void;
  clips: MediaClip[];
  onClipsChange: (clips: MediaClip[]) => void;
  audioBinary?: Blob | null;
  audioUrl?: string;
  visualLabel?: string;
  effectLabels?: string[];
  subtitleSyncStatus?: 'idle' | 'syncing' | 'synced' | 'fallback';
  subtitleSyncMessage?: string;
  onTrackStateChange?: (state: TimelineTrackState) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const stamp = (value: number) => {
  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
};

const cloneSnapshot = (props: Props): Snapshot => ({
  subtitles: structuredClone(props.subtitles),
  clips: props.clips.map((clip) => ({ ...clip })),
});

export function EditorTimeline(props: Props) {
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>('select');
  const [snapping, setSnapping] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedTrack, setExpandedTrack] = useState<
    'audio' | 'visual' | 'subtitle' | 'effects'
  >('subtitle');
  const [waveform, setWaveform] = useState<number[]>([]);
  const [snapHint, setSnapHint] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [trackHeight, setTrackHeight] = useState(1);
  const [tracks, setTracks] = useState<Record<TrackName, TrackState>>({
    audio: { hidden: false, muted: false, locked: false },
    visual: { hidden: false, muted: false, locked: false },
    subtitle: { hidden: false, muted: false, locked: false },
    effects: { hidden: false, muted: false, locked: false },
  });
  const clipboard = useRef<{ kind: 'clip' | 'subtitle'; value: MediaClip | KaraokeLine } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const touchDistance = useRef<number | null>(null);
  const touchZoom = useRef(1);
  const zoomRef = useRef(zoom);
  const touchTap = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchActive = useRef(false);
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const width = Math.max(900, props.duration * 22 * zoom);
  const px = width / Math.max(1, props.duration);
  const grid = zoom >= 2 ? 0.1 : zoom >= 1 ? 0.25 : 0.5;

  const pushHistory = () => {
    const current = cloneSnapshot(props);
    setUndoStack((items) => [...items.slice(-39), current]);
    setRedoStack([]);
  };

  const restore = (snapshot: Snapshot) => {
    props.onSubtitlesChange(structuredClone(snapshot.subtitles));
    props.onClipsChange(snapshot.clips.map((clip) => ({ ...clip })));
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((items) => [...items.slice(-39), cloneSnapshot(props)]);
    setUndoStack((items) => items.slice(0, -1));
    restore(previous);
  };

  const redo = () => {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((items) => [...items.slice(-39), cloneSnapshot(props)]);
    setRedoStack((items) => items.slice(0, -1));
    restore(next);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let blob = props.audioBinary || null;
        if (!blob && props.audioUrl) {
          const response = await fetch(props.audioUrl, { cache: 'no-store' });
          if (!response.ok) return;
          blob = await response.blob();
        }
        if (!blob) return;
        const Ctx =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!Ctx) return;
        const context = new Ctx();
        try {
          const decoded = await context.decodeAudioData(
            await blob.arrayBuffer(),
          );
          if (cancelled) return;
          const left = decoded.getChannelData(0);
          const right =
            decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;
          const bins = 320;
          const block = Math.max(1, Math.floor(left.length / bins));
          const peaks = Array.from({ length: bins }, (_, index) => {
            const start = index * block;
            const end = Math.min(left.length, start + block);
            let peak = 0;
            for (
              let i = start;
              i < end;
              i += Math.max(1, Math.floor(block / 90))
            ) {
              peak = Math.max(peak, Math.abs((left[i] + right[i]) * 0.5));
            }
            return peak;
          });
          const max = Math.max(0.001, ...peaks);
          setWaveform(peaks.map((value) => value / max));
        } finally {
          await context.close();
        }
      } catch {
        if (!cancelled) setWaveform([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.audioBinary, props.audioUrl]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const start = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchTap.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: performance.now(),
        };
        pinchActive.current = false;
        return;
      }
      if (event.touches.length !== 2) return;
      pinchActive.current = true;
      touchTap.current = null;
      props.onEditStart?.();
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      touchDistance.current = Math.hypot(dx, dy);
      touchZoom.current = zoomRef.current;
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length === 1 && touchTap.current) {
        const touch = event.touches[0];
        if (
          Math.hypot(
            touch.clientX - touchTap.current.x,
            touch.clientY - touchTap.current.y,
          ) > 8
        ) {
          touchTap.current = null;
        }
        return;
      }
      if (event.touches.length !== 2 || !touchDistance.current) return;
      event.preventDefault();
      pinchActive.current = true;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      const ratio = distance / touchDistance.current;
      setZoom(clamp(touchZoom.current * ratio, MIN_ZOOM, MAX_ZOOM));
    };
    const end = (event: TouchEvent) => {
      if (event.touches.length === 0) {
        touchDistance.current = null;
        if (pinchActive.current) props.onEditEnd?.();
        pinchActive.current = false;
      }
    };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end, { passive: true });
    node.addEventListener('touchcancel', end, { passive: true });
    return () => {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    };
  }, [props.onEditStart, props.onEditEnd]);

  const timeAt = (clientX: number) => {
    const node = scroller.current;
    if (!node) return props.playhead;
    const box = node.getBoundingClientRect();
    return clamp(
      (clientX - box.left + node.scrollLeft) / px,
      0,
      props.duration,
    );
  };

  const snapPoints = useMemo(() => {
    const points = new Set<number>([0, props.duration, props.playhead]);
    props.clips.forEach((clip) => {
      points.add(clip.start);
      points.add(clip.end);
    });
    props.subtitles.forEach((line) => {
      points.add(line.start);
      points.add(line.end);
    });
    return [...points];
  }, [props.clips, props.subtitles, props.playhead, props.duration]);

  const snap = (value: number, extra: number[] = []) => {
    if (!snapping) return clamp(value, 0, props.duration);
    const threshold = Math.max(0.06, 9 / px);
    let best = clamp(Math.round(value / grid) * grid, 0, props.duration);
    let distance = Math.abs(best - value);
    for (const point of [...snapPoints, ...extra]) {
      const nextDistance = Math.abs(point - value);
      if (nextDistance <= threshold && nextDistance < distance) {
        best = point;
        distance = nextDistance;
      }
    }
    setSnapHint(distance <= threshold ? best : null);
    return clamp(best, 0, props.duration);
  };

  const updateTrack = (name: TrackName, patch: Partial<TrackState>) =>
    setTracks((current) => {
      const next = {
        ...current,
        [name]: { ...current[name], ...patch },
      };
      props.onTrackStateChange?.(next);
      return next;
    });

  const splitSelected = (target = selected, at = props.playhead) => {
    if (!target) return;
    if (target.startsWith('sub-')) {
      const index = Number(target.slice(4));
      const line = props.subtitles[index];
      if (!line || at <= line.start + 0.08 || at >= line.end - 0.08) return;
      pushHistory();
      const leftWords = line.words.filter((word) => word.start < at);
      const rightWords = line.words.filter((word) => word.end > at);
      const next = [...props.subtitles];
      next.splice(index, 1,
        { ...line, end: at, words: leftWords },
        { ...line, start: at, words: rightWords },
      );
      props.onSubtitlesChange(next);
      setSelected(`sub-${index + 1}`);
      return;
    }
    const index = props.clips.findIndex((clip) => clip.id === target);
    const clip = props.clips[index];
    if (!clip || at <= clip.start + 0.08 || at >= clip.end - 0.08) return;
    pushHistory();
    const right = { ...clip, id: crypto.randomUUID(), start: at, name: `${clip.name} · 2` };
    const next = [...props.clips];
    next.splice(index, 1, { ...clip, end: at }, right);
    props.onClipsChange(next);
    setSelected(right.id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    pushHistory();
    if (selected.startsWith('sub-')) {
      const index = Number(selected.slice(4));
      props.onSubtitlesChange(props.subtitles.filter((_, i) => i !== index));
    } else {
      props.onClipsChange(props.clips.filter((clip) => clip.id !== selected));
    }
    setSelected(null);
  };

  const copySelected = () => {
    if (!selected) return;
    if (selected.startsWith('sub-')) {
      const value = props.subtitles[Number(selected.slice(4))];
      if (value) clipboard.current = { kind: 'subtitle', value: structuredClone(value) };
    } else {
      const value = props.clips.find((clip) => clip.id === selected);
      if (value) clipboard.current = { kind: 'clip', value: { ...value } };
    }
  };

  const paste = () => {
    const copied = clipboard.current;
    if (!copied) return;
    pushHistory();
    if (copied.kind === 'clip') {
      const source = copied.value as MediaClip;
      const length = source.end - source.start;
      const start = clamp(props.playhead, 0, Math.max(0, props.duration - length));
      const value = { ...source, id: crypto.randomUUID(), start, end: start + length, name: `${source.name} · copy` };
      props.onClipsChange([...props.clips, value]);
      setSelected(value.id);
    } else {
      const source = copied.value as KaraokeLine;
      const length = source.end - source.start;
      const delta = clamp(props.playhead, 0, Math.max(0, props.duration - length)) - source.start;
      const value = { ...structuredClone(source), start: source.start + delta, end: source.end + delta, words: source.words.map((word) => ({ ...word, start: word.start + delta, end: word.end + delta })) };
      props.onSubtitlesChange([...props.subtitles, value].sort((a, b) => a.start - b.start));
    }
  };

  const duplicateSelected = () => {
    copySelected();
    paste();
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input,textarea,select,[contenteditable="true"]')) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && event.key.toLowerCase() === 'c') {
        event.preventDefault(); copySelected();
      } else if (mod && event.key.toLowerCase() === 'v') {
        event.preventDefault(); paste();
      } else if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault(); duplicateSelected();
      } else if (event.key.toLowerCase() === 'b') {
        setTool('razor');
      } else if (event.key.toLowerCase() === 'v') {
        setTool('select');
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault(); splitSelected();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); deleteSelected();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        props.onSeek(clamp(props.playhead + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 0.1), 0, props.duration));
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const wheelTimeline = (event: React.WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setZoom((current) => clamp(current * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM));
    } else if (event.altKey) {
      event.preventDefault();
      setTrackHeight((current) => clamp(current + (event.deltaY > 0 ? -0.1 : 0.1), 0.7, 1.8));
    }
  };

  const isTimelineControl = (target: EventTarget | null) =>
    (target as HTMLElement | null)?.closest(
      '.sd-timeline-clip,.sd-sub-clip,.sd-track-label,.sd-timeline-effect,.sd-timeline-zoom,.sd-timeline-history,.sd-add-media',
    );

  const seekAt = (clientX: number) => {
    props.onEditStart?.();
    props.onSeek(snap(timeAt(clientX)));
  };

  const scrub = (event: React.PointerEvent) => {
    if (isTimelineControl(event.target) || event.pointerType === 'touch')
      return;
    seekAt(event.clientX);
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      props.onSeek(snap(timeAt(e.clientX)));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      setSnapHint(null);
      props.onEditEnd?.();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const touchSeek = (event: React.TouchEvent) => {
    if (event.touches.length || pinchActive.current || !touchTap.current)
      return;
    if (isTimelineControl(event.target)) {
      touchTap.current = null;
      return;
    }
    const tap = touchTap.current;
    touchTap.current = null;
    if (performance.now() - tap.time > 450) return;
    seekAt(tap.x);
    setSnapHint(null);
    props.onEditEnd?.();
  };

  const drag = (
    event: React.PointerEvent,
    kind: 'subtitle' | 'clip',
    index: number,
    edge: 'move' | 'start' | 'end',
  ) => {
    event.stopPropagation();
    props.onEditStart?.();
    pushHistory();
    event.currentTarget.setPointerCapture(event.pointerId);
    const originX = event.clientX;
    const source =
      kind === 'subtitle' ? props.subtitles[index] : props.clips[index];
    const originStart = source.start;
    const originEnd = source.end;

    const move = (e: PointerEvent) => {
      const delta = (e.clientX - originX) / px;
      let start = originStart;
      let end = originEnd;

      if (edge === 'move') {
        const length = originEnd - originStart;
        const rawStart = clamp(originStart + delta, 0, props.duration - length);
        const rawEnd = rawStart + length;
        const snappedStart = snap(rawStart);
        const snappedEnd = snap(rawEnd);
        if (Math.abs(snappedEnd - rawEnd) < Math.abs(snappedStart - rawStart)) {
          end = snappedEnd;
          start = end - length;
        } else {
          start = snappedStart;
          end = start + length;
        }
      } else if (edge === 'start') {
        start = snap(clamp(originStart + delta, 0, end - 0.08));
      } else {
        end = snap(clamp(originEnd + delta, start + 0.08, props.duration));
      }

      if (kind === 'subtitle') {
        const next = props.subtitles.map((line, i) =>
          i === index
            ? {
                ...line,
                start,
                end,
                words: line.words.map((word) => {
                  const ratio =
                    (word.start - originStart) /
                    Math.max(0.01, originEnd - originStart);
                  const endRatio =
                    (word.end - originStart) /
                    Math.max(0.01, originEnd - originStart);
                  return {
                    ...word,
                    start: start + ratio * (end - start),
                    end: start + endRatio * (end - start),
                  };
                }),
              }
            : line,
        );
        props.onSubtitlesChange(next);
      } else {
        props.onClipsChange(
          props.clips.map((clip, i) =>
            i === index ? { ...clip, start, end } : clip,
          ),
        );
      }
    };

    const up = () => {
      setSnapHint(null);
      props.onEditEnd?.();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const addMedia = (files: FileList | null, replaceId?: string) => {
    if (!files?.length) return;
    pushHistory();
    const added = Array.from(files).map((file, index) => {
      const existing = replaceId
        ? props.clips.find((clip) => clip.id === replaceId)
        : null;
      const start =
        existing?.start ??
        snap(Math.min(props.duration - 0.1, props.playhead + index * 5));
      return {
        id: existing?.id || crypto.randomUUID(),
        type: file.type.startsWith('video/')
          ? ('video' as const)
          : ('image' as const),
        url: URL.createObjectURL(file),
        name: file.name,
        start,
        end: existing?.end ?? Math.min(props.duration, start + 5),
      };
    });
    props.onClipsChange(
      replaceId
        ? props.clips.map((clip) => (clip.id === replaceId ? added[0] : clip))
        : [...props.clips, ...added],
    );
    setSelected(added[0].id);
  };

  const ticks = Array.from(
    { length: Math.ceil(props.duration / Math.max(1, 10 / zoom)) + 1 },
    (_, i) => i * Math.max(1, 10 / zoom),
  );

  const toggleTrack = (track: typeof expandedTrack) =>
    setExpandedTrack((current) => (current === track ? 'audio' : track));

  const selectedSubtitleIndex = selected?.startsWith('sub-')
    ? Number(selected.slice(4))
    : -1;

  const shiftSubtitles = (
    index: number,
    requestedDelta: number,
    following: boolean,
  ) => {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= props.subtitles.length
    )
      return;
    const affected = props.subtitles.slice(
      index,
      following ? undefined : index + 1,
    );
    if (!affected.length) return;
    const minStart = Math.min(...affected.map((line) => line.start));
    const maxEnd = Math.max(...affected.map((line) => line.end));
    const delta = clamp(requestedDelta, -minStart, props.duration - maxEnd);
    if (Math.abs(delta) < 0.0001) return;
    pushHistory();
    props.onEditStart?.();
    props.onSubtitlesChange(
      props.subtitles.map((line, lineIndex) => {
        if (lineIndex < index || (!following && lineIndex !== index))
          return line;
        return {
          ...line,
          start: line.start + delta,
          end: line.end + delta,
          words: line.words.map((word) => ({
            ...word,
            start: word.start + delta,
            end: word.end + delta,
          })),
        };
      }),
    );
    props.onEditEnd?.();
  };

  const trackActions = (name: TrackName) => {
    const state = tracks[name];
    return (
      <div className="sd-track-actions" onPointerDown={(event) => event.stopPropagation()}>
        <button onClick={() => updateTrack(name, { hidden: !state.hidden })} title={state.hidden ? 'Hiện track' : 'Ẩn track'}>
          {state.hidden ? <EyeOff /> : <Eye />}
        </button>
        {(name === 'audio' || name === 'visual') && (
          <button onClick={() => updateTrack(name, { muted: !state.muted })} title={state.muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>
            {state.muted ? <VolumeX /> : <Volume2 />}
          </button>
        )}
        <button onClick={() => updateTrack(name, { locked: !state.locked })} title={state.locked ? 'Mở khóa track' : 'Khóa track'}>
          {state.locked ? <Lock /> : <Unlock />}
        </button>
      </div>
    );
  };

  return (
    <section className="sd-edit-timeline">
      <header>
        <div className="sd-timeline-title">
          <b>Creator Timeline</b>
          <span>
            {stamp(props.playhead)} / {stamp(props.duration)}
          </span>
        </div>
        <div className="sd-timeline-tools" role="toolbar" aria-label="Công cụ timeline">
          <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')} title="Chọn / di chuyển (V)"><MousePointer2 /></button>
          <button className={tool === 'razor' ? 'active' : ''} onClick={() => setTool('razor')} title="Dao cắt (B)"><Scissors /></button>
          <button className={snapping ? 'active' : ''} onClick={() => setSnapping((value) => !value)} title="Bật/tắt nam châm"><Magnet /></button>
          <span />
          <button disabled={!selected} onClick={() => splitSelected()} title="Tách tại playhead (S)"><Scissors /></button>
          <button disabled={!selected} onClick={duplicateSelected} title="Nhân đôi (⌘/Ctrl+D)"><Copy /></button>
          <button disabled={!selected} onClick={deleteSelected} title="Xóa (Delete)"><Trash2 /></button>
        </div>
        <div className="sd-timeline-history">
          <button disabled={!undoStack.length} onClick={undo} title="Hoàn tác">
            <Undo2 />
          </button>
          <button disabled={!redoStack.length} onClick={redo} title="Làm lại">
            <Redo2 />
          </button>
        </div>
        <label className="sd-add-media">
          <ImagePlus /> Thêm ảnh/video
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => addMedia(e.target.files)}
          />
        </label>
        <div className="sd-timeline-zoom" aria-label="Timeline zoom">
          <button
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.25))}
            title="Zoom out"
          >
            <Minus />
          </button>
          <span className="sd-zoom-bound">MIN {MIN_ZOOM}×</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.25"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Mức zoom timeline"
          />
          <b>{zoom.toFixed(zoom % 1 === 0 ? 0 : 2)}×</b>
          <span className="sd-zoom-bound">MAX {MAX_ZOOM}×</span>
          <button
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25))}
            title="Zoom in"
          >
            <Plus />
          </button>
          <button onClick={() => setZoom(clamp(scroller.current ? scroller.current.clientWidth / Math.max(900, props.duration * 22) : 1, MIN_ZOOM, MAX_ZOOM))} title="Vừa toàn bộ timeline">
            <Focus />
          </button>
        </div>
      </header>

      {(props.subtitleSyncStatus === 'syncing' ||
        props.subtitleSyncStatus === 'synced') && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '8px 10px',
            margin: '0 0 8px',
            borderRadius: 10,
            border: '1px solid rgba(148,163,184,.12)',
            background:
              props.subtitleSyncStatus === 'synced'
                ? 'rgba(34,197,94,.07)'
                : 'rgba(6,182,212,.07)',
          }}
        >
          <b style={{ fontSize: 11 }}>
            {props.subtitleSyncStatus === 'syncing'
              ? 'AI đang căn subtitle'
              : 'Subtitle đã sync'}
          </b>
          <span style={{ fontSize: 11, opacity: 0.62 }}>
            {props.subtitleSyncMessage}
          </span>
        </div>
      )}

      {selectedSubtitleIndex >= 0 && props.subtitles[selectedSubtitleIndex] && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '8px 10px',
            margin: '0 0 8px',
            borderRadius: 10,
            border: '1px solid rgba(217,70,239,.16)',
            background: 'rgba(217,70,239,.05)',
          }}
        >
          <b style={{ fontSize: 11, marginRight: 4 }}>Chỉnh timing:</b>
          <button
            onClick={() =>
              shiftSubtitles(
                selectedSubtitleIndex,
                props.playhead - props.subtitles[selectedSubtitleIndex].start,
                false,
              )
            }
            style={{ padding: '5px 8px', borderRadius: 8, fontSize: 11 }}
          >
            Đặt đầu câu tại playhead
          </button>
          {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
            <button
              key={delta}
              onClick={() =>
                shiftSubtitles(selectedSubtitleIndex, delta, false)
              }
              style={{ padding: '5px 8px', borderRadius: 8, fontSize: 11 }}
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}s
            </button>
          ))}
          <span
            style={{
              width: 1,
              height: 20,
              background: 'rgba(148,163,184,.18)',
              margin: '0 2px',
            }}
          />
          <button
            onClick={() => shiftSubtitles(selectedSubtitleIndex, -0.1, true)}
            style={{ padding: '5px 8px', borderRadius: 8, fontSize: 11 }}
          >
            Từ đây −0.1s
          </button>
          <button
            onClick={() => shiftSubtitles(selectedSubtitleIndex, 0.1, true)}
            style={{ padding: '5px 8px', borderRadius: 8, fontSize: 11 }}
          >
            Từ đây +0.1s
          </button>
          <button
            onClick={() => shiftSubtitles(selectedSubtitleIndex, -0.5, true)}
            style={{ padding: '5px 8px', borderRadius: 8, fontSize: 11 }}
          >
            Từ đây −0.5s
          </button>
          <button
            onClick={() => shiftSubtitles(selectedSubtitleIndex, 0.5, true)}
            style={{ padding: '5px 8px', borderRadius: 8, fontSize: 11 }}
          >
            Từ đây +0.5s
          </button>
        </div>
      )}

      <div
        className="sd-timeline-scroll"
        ref={scroller}
        onWheel={wheelTimeline}
        onPointerDown={scrub}
        onTouchEnd={touchSeek}
      >
        <div className={`sd-timeline-canvas tool-${tool}`} style={{ width, '--track-scale': trackHeight } as React.CSSProperties}>
          <div className="sd-time-ruler">
            {ticks.map((t) => (
              <i key={t} style={{ left: t * px }}>
                <span>{stamp(t)}</span>
              </i>
            ))}
          </div>

          <div
            className={`sd-track sd-audio-track ${expandedTrack === 'audio' ? 'expanded' : ''} ${tracks.audio.hidden ? 'track-hidden' : ''} ${tracks.audio.locked ? 'track-locked' : ''}`}
          >
            <button
              className="sd-track-label"
              onClick={(e) => {
                e.stopPropagation();
                toggleTrack('audio');
              }}
            >
              <Waves /> Audio <ChevronDown />
            </button>
            {trackActions('audio')}
            <div className="sd-waveform-clip" style={{ left: 0, width }}>
              <div
                className="sd-waveform-bars"
                aria-label="Waveform âm thanh thật"
              >
                {waveform.length
                  ? waveform.map((peak, index) => (
                      <i
                        key={index}
                        style={{ height: `${Math.max(8, peak * 92)}%` }}
                      />
                    ))
                  : Array.from({ length: 80 }, (_, index) => (
                      <i
                        key={index}
                        className="loading"
                        style={{ height: `${22 + ((index * 17) % 52)}%` }}
                      />
                    ))}
              </div>
            </div>
          </div>

          <div
            className={`sd-track sd-video-track ${expandedTrack === 'visual' ? 'expanded' : ''} ${tracks.visual.hidden ? 'track-hidden' : ''} ${tracks.visual.locked ? 'track-locked' : ''}`}
          >
            <button
              className="sd-track-label"
              onClick={(e) => {
                e.stopPropagation();
                toggleTrack('visual');
              }}
            >
              <Video /> Visual <ChevronDown />
            </button>
            {trackActions('visual')}
            {props.clips.map((clip, index) => (
              <div
                key={clip.id}
                className={`sd-timeline-clip ${selected === clip.id ? 'selected' : ''}`}
                style={{
                  left: clip.start * px,
                  width: Math.max(24, (clip.end - clip.start) * px),
                }}
                onPointerDown={(e) => {
                  setSelected(clip.id);
                  if (tool === 'razor') {
                    e.stopPropagation();
                    const at = snap(timeAt(e.clientX));
                    props.onSeek(at);
                    splitSelected(clip.id, at);
                  } else if (!tracks.visual.locked) drag(e, 'clip', index, 'move');
                }}
              >
                <button
                  className="sd-edge left"
                  onPointerDown={(e) => drag(e, 'clip', index, 'start')}
                />
                <span
                  style={
                    clip.type === 'image'
                      ? { backgroundImage: `url(${clip.url})` }
                      : undefined
                  }
                >
                  {clip.type === 'video' && <Video />}
                </span>
                <b>{clip.isDefault ? `Ảnh bìa · ${clip.name}` : clip.name}</b>
                <button
                  className="sd-edge right"
                  onPointerDown={(e) => drag(e, 'clip', index, 'end')}
                />
                {selected === clip.id && (
                  <label className="sd-replace">
                    Thay thế
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => addMedia(e.target.files, clip.id)}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          <div
            className={`sd-track sd-subtitle-track ${expandedTrack === 'subtitle' ? 'expanded' : ''} ${tracks.subtitle.hidden ? 'track-hidden' : ''} ${tracks.subtitle.locked ? 'track-locked' : ''}`}
          >
            <button
              className="sd-track-label"
              onClick={(e) => {
                e.stopPropagation();
                toggleTrack('subtitle');
              }}
            >
              CC Subtitle
              <span className="sd-track-count">{props.subtitles.length}</span>
              <ChevronDown />
            </button>
            {trackActions('subtitle')}
            {!props.subtitles.length && expandedTrack === 'subtitle' && (
              <div className="sd-sub-empty">
                Chưa có cue subtitle được căn thời gian
              </div>
            )}
            {props.subtitles.map((line, index) => (
              <div
                key={`${index}-${line.text}`}
                className={`sd-sub-clip ${selected === `sub-${index}` ? 'selected' : ''}`}
                style={{
                  left: line.start * px,
                  width: Math.max(20, (line.end - line.start) * px),
                }}
                title={`${stamp(line.start)} → ${stamp(line.end)}\n${line.text}`}
                onPointerDown={(e) => {
                  setSelected(`sub-${index}`);
                  if (tool === 'razor') {
                    e.stopPropagation();
                    const at = snap(timeAt(e.clientX));
                    props.onSeek(at);
                    splitSelected(`sub-${index}`, at);
                  } else if (!tracks.subtitle.locked) drag(e, 'subtitle', index, 'move');
                }}
              >
                <button
                  className="sd-edge left"
                  onPointerDown={(e) => drag(e, 'subtitle', index, 'start')}
                />
                <span>{line.text}</span>
                <button
                  className="sd-edge right"
                  onPointerDown={(e) => drag(e, 'subtitle', index, 'end')}
                />
              </div>
            ))}
          </div>

          <div
            className={`sd-track sd-effects-track ${expandedTrack === 'effects' ? 'expanded' : ''} ${tracks.effects.hidden ? 'track-hidden' : ''} ${tracks.effects.locked ? 'track-locked' : ''}`}
          >
            <button
              className="sd-track-label"
              onClick={(e) => {
                e.stopPropagation();
                toggleTrack('effects');
              }}
            >
              <Sparkles /> Effects <ChevronDown />
            </button>
            {trackActions('effects')}
            {(props.effectLabels?.length
              ? props.effectLabels
              : ['Không có effect']
            ).map((effect, index) => (
              <div
                key={`${effect}-${index}`}
                className="sd-timeline-effect"
                style={{
                  left: index * 6,
                  width: Math.max(90, width - index * 12),
                }}
              >
                {effect}
              </div>
            ))}
          </div>

          {snapHint !== null && (
            <div className="sd-snap-guide" style={{ left: snapHint * px }}>
              <span>{stamp(snapHint)}</span>
            </div>
          )}
          <div className="sd-playhead" style={{ left: props.playhead * px }}>
            <i />
            <span>{stamp(props.playhead)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
