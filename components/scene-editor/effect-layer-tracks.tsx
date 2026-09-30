'use client';
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Sparkles } from 'lucide-react';
import type { SceneLayer } from '@/packages/scene-core/src';
import { retimeLayer } from '@/packages/scene-core/src/timeline';
export function EffectLayerTracks({
  layers,
  px,
  gutter,
  durationMs,
  selectedId,
  onSelect,
  onChange,
  disabled,
  groupHidden,
  groupLocked,
  onEditStart,
  onEditEnd,
}: {
  layers: SceneLayer[];
  px: number;
  gutter: number;
  durationMs: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onChange?: (layers: SceneLayer[]) => void;
  disabled?: boolean;
  groupHidden: boolean;
  groupLocked: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}) {
  const [draft, setDraft] = useState<SceneLayer | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  function drag(
    event: React.PointerEvent,
    layer: SceneLayer,
    mode: 'move' | 'start' | 'end',
  ) {
    event.stopPropagation();
    onSelect?.(layer.id);
    if (disabled || groupLocked || layer.locked || !onChange) return;
    event.preventDefault();
    onEditStart?.();
    cleanup.current?.();
    const origin = event.clientX,
      pointerId = event.pointerId;
    let next = layer;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      next = retimeLayer(
        layer,
        ((e.clientX - origin) / px) * 1000,
        mode,
        durationMs,
      );
      setDraft(next);
    };
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      clean();
      setDraft(null);
      if (e.type !== 'pointercancel')
        onChange?.(layers.map((l) => (l.id === layer.id ? next : l)));
      onEditEnd?.();
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
  return (
    <>
      {layers.map((layer) => {
        const l = draft?.id === layer.id ? draft : layer;
        return (
          <div
            key={l.id}
            className={`sd-track sd-scene-effect-track ${!l.visible || groupHidden ? 'track-hidden' : ''} ${l.locked || groupLocked ? 'track-locked' : ''}`}
          >
            <div className="sd-track-header">
              <button
                className="sd-track-label"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(l.id);
                }}
              >
                <Sparkles />
                {l.name}
              </button>
              <div
                className="sd-track-actions"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  disabled={disabled || groupLocked || l.locked}
                  aria-label={`Ẩn/hiện lớp ${l.name}`}
                  onClick={() =>
                    onChange?.(
                      layers.map((x) =>
                        x.id === l.id ? { ...x, visible: !x.visible } : x,
                      ),
                    )
                  }
                >
                  {l.visible ? <Eye /> : <EyeOff />}
                </button>
                <button
                  type="button"
                  disabled={disabled || groupLocked}
                  aria-label={`Khóa lớp ${l.name}`}
                  onClick={() =>
                    onChange?.(
                      layers.map((x) =>
                        x.id === l.id ? { ...x, locked: !x.locked } : x,
                      ),
                    )
                  }
                >
                  {l.locked ? <Lock /> : <Unlock />}
                </button>
              </div>
            </div>
            <div
              className={`sd-timeline-effect sd-scene-effect-clip ${selectedId === l.id ? 'selected' : ''}`}
              style={{
                left: gutter + (l.startMs / 1000) * px,
                width: Math.max(8, ((l.endMs - l.startMs) / 1000) * px),
              }}
              title={`${l.name} · ${(l.startMs / 1000).toFixed(2)}s–${(l.endMs / 1000).toFixed(2)}s`}
              onPointerDown={(e) => drag(e, l, 'move')}
            >
              <button
                type="button"
                className="sd-edge left"
                aria-label={`Cắt đầu lớp ${l.name}`}
                disabled={disabled || groupLocked || l.locked}
                onPointerDown={(e) => drag(e, l, 'start')}
              />
              <button
                type="button"
                className="sd-scene-clip-select"
                aria-label={`Chọn lớp ${l.name}`}
                onClick={() => onSelect?.(l.id)}
              >
                {l.name}
              </button>
              {l.animations.flatMap((track) =>
                track.keyframes
                  .filter(
                    (key) => key.timeMs >= l.startMs && key.timeMs < l.endMs,
                  )
                  .map((key) => (
                    <i
                      key={`${track.property}-${key.timeMs}`}
                      className="sd-scene-keyframe"
                      style={{
                        left: `${((key.timeMs - l.startMs) / (l.endMs - l.startMs)) * 100}%`,
                      }}
                      title={`${track.property} · ${(key.timeMs / 1000).toFixed(2)}s`}
                    />
                  )),
              )}
              <button
                type="button"
                className="sd-edge right"
                aria-label={`Cắt cuối lớp ${l.name}`}
                disabled={disabled || groupLocked || l.locked}
                onPointerDown={(e) => drag(e, l, 'end')}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
