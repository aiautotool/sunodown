'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  Magnet,
  Minus,
  Plus,
  Maximize2,
  Minimize2,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react';
import {
  compileTimeline,
  retimeLayer,
  rippleDelete,
  splitSceneLayer,
  type SceneDocument,
  type TimelineItem,
  type TimelineTrack,
} from '@/packages/scene-core/src';
const stamp = (ms: number) =>
  `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(1).padStart(4, '0')}`;
export function SceneTimeline({
  scene,
  playheadMs,
  selectedId,
  onSelect,
  onChange,
  onSeek,
  onEditStart,
  onAddMedia,
  disabled,
  audioBinary,
}: {
  scene: SceneDocument;
  playheadMs: number;
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (scene: SceneDocument) => void;
  onSeek: (ms: number) => void;
  onEditStart: () => void;
  onAddMedia: (files: FileList | null) => void;
  disabled: boolean;
  audioBinary?: Blob | null;
}) {
  const model = useMemo(() => compileTimeline(scene), [scene]);
  const [zoom, setZoom] = useState(1),
    [snap, setSnap] = useState(true),
    [ripple, setRipple] = useState(true),
    [draft, setDraft] = useState<SceneDocument | null>(null);
  const [autoFit, setAutoFit] = useState(true);
  const [mobileWorkspace, setMobileWorkspace] = useState(false);
  const [compactMobile, setCompactMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const sync = () => setCompactMobile(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);
  useEffect(() => {
    if (!compactMobile) setMobileWorkspace(false);
  }, [compactMobile]);
  const gutter = compactMobile ? 52 : 170;
  const [history, setHistory] = useState<SceneDocument[]>([]),
    [future, setFuture] = useState<SceneDocument[]>([]);
  const [peaks, setPeaks] = useState<number[]>([]),
    [context, setContext] = useState<{
      x: number;
      y: number;
      item: TimelineItem;
    } | null>(null);
  const viewport = useRef<HTMLDivElement>(null),
    cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(()=>{
    if(!autoFit || !viewport.current)return;
    const node=viewport.current;
    const observer=new ResizeObserver(()=>setZoom(Math.max(.05, Math.min(8,(node.clientWidth-gutter)/Math.max(600,scene.canvas.durationMs*.022)))));
    observer.observe(node);
    return ()=>observer.disconnect();
  },[autoFit,scene.canvas.durationMs,gutter]);
  useEffect(() => {
    let cancelled = false;
    if (!audioBinary) {
      return;
    }
    let audioContext: AudioContext | undefined;
    void (async () => {
      try {
        audioContext = new AudioContext();
        const audio = await audioContext.decodeAudioData(
          await audioBinary.arrayBuffer(),
        );
        const pcm = audio.getChannelData(0),
          step = Math.max(1, Math.floor(pcm.length / 160));
        const next = Array.from({ length: 160 }, (_, i) => {
          let max = 0;
          for (
            let n = i * step;
            n < Math.min(pcm.length, (i + 1) * step);
            n += Math.max(1, Math.floor(step / 64))
          )
            max = Math.max(max, Math.abs(pcm[n]));
          return max;
        });
        if (!cancelled) setPeaks(next);
      } catch {
        if (!cancelled) setPeaks([]);
      } finally {
        await audioContext?.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioBinary]);
  const pixelsPerMs =
    (Math.max(600, scene.canvas.durationMs * 0.022) * zoom) /
    scene.canvas.durationMs;
  const contentWidth = scene.canvas.durationMs * pixelsPerMs;
  const step =
    [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000, 120000, 300000].find(
      (s) => s * pixelsPerMs >= 70,
    ) ?? 300000;
  const viewScene = draft ?? scene,
    view = useMemo(() => compileTimeline(viewScene), [viewScene]);
  function commit(next: SceneDocument) {
    if (disabled || next === scene) return;
    setHistory((h) => [...h.slice(-49), structuredClone(scene)]);
    setFuture([]);
    onChange(next);
  }
  function seek(clientX: number) {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect || !viewport.current) return;
    onEditStart();
    onSeek(
      Math.max(
        0,
        Math.min(
          scene.canvas.durationMs,
          (clientX - rect.left + viewport.current.scrollLeft - gutter) /
            pixelsPerMs,
        ),
      ),
    );
  }
  function drag(
    event: React.PointerEvent,
    item: TimelineItem,
    mode: 'move' | 'start' | 'end',
  ) {
    event.stopPropagation();
    onSelect(item.layerId);
    if (disabled) return;
    const layer = scene.layers.find((l) => l.id === item.layerId);
    if (!layer || layer.locked || layer.params.timelineReadonly === true)
      return;
    event.preventDefault();
    onEditStart();
    cleanup.current?.();
    const origin = event.clientX,
      pointer = event.pointerId;
    let next = scene;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      let delta = (e.clientX - origin) / pixelsPerMs;
      if (snap) {
        const moving = (mode === 'end' ? item.endMs : item.startMs) + delta;
        const anchors = [
          0,
          scene.canvas.durationMs,
          playheadMs,
          ...model.tracks.flatMap((t) =>
            t.items
              .filter((i) => i.id !== item.id)
              .flatMap((i) => [i.startMs, i.endMs]),
          ),
        ];
        const nearest = anchors.sort(
          (a, b) => Math.abs(a - moving) - Math.abs(b - moving),
        )[0];
        if (Math.abs(nearest - moving) * pixelsPerMs < 8)
          delta = nearest - (mode === 'end' ? item.endMs : item.startMs);
      }
      next = structuredClone(scene);
      if (item.cueIndex !== undefined) {
        const target = next.layers.find((l) => l.id === item.layerId)!,
          cues = target.params.cues as {
            startMs: number;
            endMs: number;
            text: string;
          }[];
        const fake = {
          ...layer,
          startMs: item.startMs,
          endMs: item.endMs,
          animations: [],
        };
        const moved = retimeLayer(fake, delta, mode, scene.canvas.durationMs);
        const original = cues[item.cueIndex] as (typeof cues)[number] & {
          words?: { start: number; end: number; text: string }[];
        };
        const shift = (moved.startMs - item.startMs) / 1000;
        cues[item.cueIndex] = {
          ...original,
          ...(original.words
            ? {
                words: original.words
                  .map((w) => ({
                    ...w,
                    start: Math.max(moved.startMs / 1000, w.start + shift),
                    end: Math.min(moved.endMs / 1000, w.end + shift),
                  }))
                  .filter((w) => w.end > w.start),
              }
            : {}),
          startMs: moved.startMs,
          endMs: moved.endMs,
        };
      } else
        next.layers = next.layers.map((l) =>
          l.id === layer.id
            ? retimeLayer(l, delta, mode, scene.canvas.durationMs)
            : l,
        );
      setDraft(next);
    };
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      clean();
      setDraft(null);
      if (e.type !== 'pointercancel') commit(next);
    };
    const clean = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      cleanup.current = null;
    };
    cleanup.current = clean;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }
  function remove(item?: TimelineItem) {
    const id = item?.layerId ?? selectedId;
    if (!id) return;
    const layer = scene.layers.find((l) => l.id === id);
    if (!layer || layer.locked || layer.params.timelineReadonly === true)
      return;
    if (item?.cueIndex !== undefined) {
      const next = structuredClone(scene),
        target = next.layers.find((l) => l.id === id)!;
      (target.params.cues as unknown[]).splice(item.cueIndex, 1);
      commit(next);
    } else
      commit(
        ripple && layer.role === 'main-video'
          ? rippleDelete(scene, id)
          : {
              ...scene,
              layers: scene.layers.filter((l) => l.id !== id),
              slots: scene.slots.filter((s) => s.layerId !== id),
            },
      );
  }
  function duplicate() {
    const layer = scene.layers.find((l) => l.id === selectedId);
    if (!layer || layer.locked || layer.params.timelineReadonly === true)
      return;
    const copy = structuredClone(layer);
    copy.id = crypto.randomUUID();
    copy.name += ' Copy';
    copy.zIndex = Math.max(...scene.layers.map((l) => l.zIndex)) + 1;
    commit({ ...scene, layers: [...scene.layers, copy] });
    onSelect(copy.id);
  }
  function flags(track: TimelineTrack, flag: 'visible' | 'locked') {
    const next = structuredClone(scene);
    next.layers = next.layers.map((l) =>
      track.layerIds.includes(l.id)
        ? { ...l, [flag]: flag === 'visible' ? !l.visible : !l.locked }
        : l,
    );
    commit(next);
  }
  const selectedEditable = scene.layers.some(
    (l) => l.id === selectedId && l.type !== 'karaoke' && !l.locked && !l.params.timelineReadonly,
  );
  const itemStyle = (item: TimelineItem) => ({
    left: gutter + item.startMs * pixelsPerMs,
    width: Math.max(8, (item.endMs - item.startMs) * pixelsPerMs),
  });
  return (
    <section className={`sd-nle ${mobileWorkspace ? "sd-nle-mobile-workspace" : ""}`} aria-label="Scene Timeline">
      <header className="sd-nle-toolbar">
        <b>Timeline</b>
        {compactMobile && (
          <button
            type="button"
            className="sd-nle-mobile-toggle"
            aria-pressed={mobileWorkspace}
            title={mobileWorkspace ? 'Thu nhỏ timeline' : 'Mở timeline toàn màn hình'}
            onClick={() => {
              setMobileWorkspace((value) => !value);
              setAutoFit(true);
            }}
          >
            {mobileWorkspace ? <Minimize2 /> : <Maximize2 />}
            <span>{mobileWorkspace ? 'Đóng' : 'Mở rộng'}</span>
          </button>
        )}
        <span>
          {stamp(playheadMs)} / {stamp(scene.canvas.durationMs)}
        </span>
        <button
          type="button"
          title="Hoàn tác Scene"
          disabled={disabled || !history.length}
          onClick={() => {
            setFuture((f) => [...f, scene]);
            onChange(history.at(-1)!);
            setHistory((h) => h.slice(0, -1));
          }}
        >
          <Undo2 />
        </button>
        <button
          type="button"
          title="Làm lại Scene"
          disabled={disabled || !future.length}
          onClick={() => {
            setHistory((h) => [...h, scene]);
            onChange(future.at(-1)!);
            setFuture((f) => f.slice(0, -1));
          }}
        >
          <Redo2 />
        </button>
        {selectedEditable && <div className="sd-nle-edit-selection">
        <button
          type="button"
          title="Tách lớp tại playhead"
          disabled={disabled || !selectedEditable}
          onClick={() =>
            commit(
              splitSceneLayer(
                scene,
                selectedId!,
                playheadMs,
                crypto.randomUUID(),
              ),
            )
          }
        >
          <Scissors />
        </button>
        <button
          type="button"
          title="Nhân bản lớp"
          disabled={disabled || !selectedEditable}
          onClick={duplicate}
        >
          <Copy />
        </button>
        <button
          type="button"
          title="Xóa lớp"
          disabled={disabled || !selectedEditable}
          onClick={() => remove()}
        >
          <Trash2 />
        </button>
        </div>}
        <details className="sd-nle-settings"><summary>⋯</summary><div>
        <button
          type="button"
          title="Magnetic snap"
          aria-pressed={snap}
          onClick={() => setSnap((s) => !s)}
        >
          <Magnet />
        </button>
        <button
          type="button"
          title="Ripple delete main track"
          aria-pressed={ripple}
          onClick={() => setRipple((r) => !r)}
        >
          Ripple
        </button>
        </div></details>
        <label className="sd-nle-add">
          <ImagePlus />
          Media
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            disabled={disabled}
            onChange={(e) => onAddMedia(e.target.files)}
          />
        </label>
        <div className="sd-nle-zoom">
          <button type="button" title="Vừa toàn bộ bài vào timeline" onClick={()=>setAutoFit(true)}>Vừa khung</button>
          <button
            type="button"
            title="Thu nhỏ timeline"
            onClick={() => {setAutoFit(false);setZoom((z) => Math.max(0.05, z / 1.25));}}
          >
            <Minus />
          </button>
          <span>{zoom.toFixed(2)}×</span>
          <button
            type="button"
            title="Phóng lớn timeline"
            onClick={() => {setAutoFit(false);setZoom((z) => Math.min(8, z * 1.25));}}
          >
            <Plus />
          </button>
        </div>
      </header>
      <div
        className="sd-nle-scroll"
        ref={viewport}
        onPointerDown={(e) => {
          if (
            !(e.target as HTMLElement).closest(
              'button,.sd-nle-item,.sd-nle-track-header',
            )
          )
            seek(e.clientX);
        }}
      >
        <div className="sd-nle-canvas" style={{ width: gutter + contentWidth }}>
          <div className="sd-nle-ruler">
            <div className="sd-nle-corner">{compactMobile ? "☰" : "Lớp"}</div>
            {Array.from(
              { length: Math.floor(scene.canvas.durationMs / step) + 1 },
              (_, i) => (
                <span key={i} style={{ left: gutter + i * step * pixelsPerMs }}>
                  {stamp(i * step)}
                </span>
              ),
            )}
          </div>
          {view.tracks.map((track) => (
            <div
              className={`sd-nle-track track-${track.type} ${track.hidden ? 'hidden-track' : ''}`}
              key={track.id}
            >
              <div className="sd-nle-track-header">
                <span title={track.name}>{track.name}</span>
                <button
                  type="button"
                  disabled={
                    disabled ||
                    track.locked ||
                    track.layerIds.some(
                      (id) =>
                        scene.layers.find((l) => l.id === id)?.type !==
                        'effect',
                    )
                  }
                  title={`Ẩn/hiện ${track.name}`}
                  onClick={() => flags(track, 'visible')}
                >
                  {track.hidden ? <EyeOff /> : <Eye />}
                </button>
                <button
                  type="button"
                  disabled={
                    disabled ||
                    track.layerIds.some(
                      (id) =>
                        scene.layers.find((l) => l.id === id)?.type !==
                        'effect',
                    )
                  }
                  title={`Khóa ${track.name}`}
                  onClick={() => flags(track, 'locked')}
                >
                  {track.locked ? <Lock /> : <Unlock />}
                </button>
              </div>
              {track.items.map((item) => {
                const asset = scene.assets.find((a) => a.id === item.assetId);
                return (
                  <div
                    className={`sd-nle-item kind-${track.type} ${selectedId === item.layerId ? 'selected' : ''} ${track.locked ? 'locked' : ''}`}
                    key={item.id}
                    style={itemStyle(item)}
                    onPointerDown={(e) => drag(e, item, 'move')}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onSelect(item.layerId);
                      setContext({ x: e.clientX, y: e.clientY, item });
                    }}
                  >
                    <button
                      type="button"
                      className="sd-nle-trim start"
                      aria-label={`Cắt đầu ${item.name}`}
                      title={`Cắt đầu ${item.name}`}
                      disabled={
                        disabled ||
                        track.locked ||
                        track.layerIds.some(
                          (id) =>
                            scene.layers.find((l) => l.id === id)?.params
                              .timelineReadonly,
                        )
                      }
                      onPointerDown={(e) => drag(e, item, 'start')}
                    />
                    {asset?.type === 'image' && (
                      <div
                        className="sd-nle-thumbnails"
                        style={{ backgroundImage: `url(${asset.source})` }}
                      />
                    )}
                    {track.type === 'audio' && (
                      <div
                        className="sd-nle-waveform"
                        aria-label="Waveform audio"
                      >
                        {peaks.map((p, i) => (
                          <i
                            key={i}
                            style={{ height: `${Math.max(6, p * 100)}%` }}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="sd-nle-select"
                      aria-label={`Chọn ${item.name}`}
                      onClick={() => onSelect(item.layerId)}
                    >
                      {item.name}
                    </button>
                    {item.keyframes.flatMap((animation) =>
                      animation.keyframes
                        .filter(
                          (k) =>
                            k.timeMs >= item.startMs && k.timeMs < item.endMs,
                        )
                        .map((key) => (
                          <i
                            className="sd-nle-diamond"
                            key={`${animation.property}:${key.timeMs}`}
                            style={{
                              left: (key.timeMs - item.startMs) * pixelsPerMs,
                            }}
                          />
                        )),
                    )}
                    <button
                      type="button"
                      className="sd-nle-trim end"
                      aria-label={`Cắt cuối ${item.name}`}
                      title={`Cắt cuối ${item.name}`}
                      disabled={
                        disabled ||
                        track.locked ||
                        track.layerIds.some(
                          (id) =>
                            scene.layers.find((l) => l.id === id)?.params
                              .timelineReadonly,
                        )
                      }
                      onPointerDown={(e) => drag(e, item, 'end')}
                    />
                  </div>
                );
              })}
            </div>
          ))}
          <div
            className="sd-nle-playhead"
            style={{ left: gutter + playheadMs * pixelsPerMs }}
          >
            <i />
          </div>
        </div>
      </div>
      {context && (
        <div
          className="sd-nle-context"
          style={{ left: context.x, top: context.y }}
        >
          <button
            type="button"
            onClick={() => {
              onSeek(context.item.startMs);
              setContext(null);
            }}
          >
            Đến đầu clip
          </button>
          <button
            type="button"
            onClick={() => {
              remove(context.item);
              setContext(null);
            }}
          >
            Xóa clip
          </button>
          <button type="button" onClick={() => setContext(null)}>
            Đóng
          </button>
        </div>
      )}
    </section>
  );
}
