'use client';
import { useState } from 'react';
import {
  createLayer,
  type SceneDocument,
  type SceneLayer,
} from '@/packages/scene-core/src';
const FX = [
  { id: 'smoke', name: 'Khói' },
  { id: 'fog', name: 'Sương mù' },
  { id: 'rain', name: 'Mưa' },
  { id: 'snow', name: 'Tuyết' },
  { id: 'dust', name: 'Bụi' },
  { id: 'lightleak', name: 'Vệt sáng' },
  { id: 'film', name: 'Hạt phim' },
  { id: 'vignette', name: 'Tối viền' },
];
export function EffectLayerPanel({
  scene,
  onChange,
  timeMs,
  disabled,
  selectedId,
  onSelect,
}: {
  scene: SceneDocument;
  timeMs: number;
  onChange: (layers: SceneLayer[]) => void;
  disabled: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const layers = scene.layers.filter((l) => l.type === 'effect');
  const [localSelected, setLocalSelected] = useState<string>();
  const selected = selectedId ?? localSelected;
  const setSelected = (id: string | undefined) => {
    setLocalSelected(id);
    if (id) onSelect?.(id);
  };
  const [undo, setUndo] = useState<SceneLayer[][]>([]),
    [redo, setRedo] = useState<SceneLayer[][]>([]);
  const layer = layers.find((l) => l.id === selected);
  function commit(next: SceneLayer[]) {
    setUndo((history) => [...history.slice(-49), structuredClone(layers)]);
    setRedo([]);
    onChange(next);
  }
  function update(patch: Partial<SceneLayer>) {
    if (layer && !layer.locked)
      commit(layers.map((l) => (l.id === layer.id ? { ...l, ...patch } : l)));
  }
  function add(id: string) {
    const l = createLayer(
      crypto.randomUUID(),
      'effect',
      scene.canvas.durationMs,
    );
    l.name = FX.find((f) => f.id === id)?.name || id;
    l.effectId = id;
    l.zIndex = Math.max(5, ...layers.map((l) => l.zIndex)) + 1;
    l.seed = layers.length;
    l.transform.width = scene.canvas.width;
    l.transform.height = scene.canvas.height;
    l.params = { density: 1, speed: 1, angle: 0, size: 1 };
    commit([...layers, l]);
    setSelected(l.id);
  }
  return (
    <details
      key={selectedId}
      open={true}
      className="sd-scene-properties"
    >
      <summary className="cursor-pointer text-sm font-semibold">
        {layer ? layer.name : 'Thêm hiệu ứng'}
      </summary>
      <fieldset
        disabled={disabled}
        className="mt-3 space-y-3 disabled:opacity-50"
      >
        <details open={!layer}><summary>{layer ? 'Thêm lớp hiệu ứng khác' : 'Chọn hiệu ứng'}</summary><div className="flex flex-wrap gap-2">
          {FX.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => add(f.id)}
              className="rounded bg-white/10 px-2 py-1 text-xs"
            >
              + {f.name}
            </button>
          ))}
        </div>
        </details>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            disabled={!undo.length}
            onClick={() => {
              setRedo((r) => [...r, structuredClone(layers)]);
              onChange(undo[undo.length - 1]);
              setUndo((u) => u.slice(0, -1));
            }}
          >
            Hoàn tác
          </button>
          <button
            type="button"
            disabled={!redo.length}
            onClick={() => {
              setUndo((u) => [...u, structuredClone(layers)]);
              onChange(redo[redo.length - 1]);
              setRedo((r) => r.slice(0, -1));
            }}
          >
            Làm lại
          </button>
        </div>
        {layer && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2 flex gap-3">
              <button
                type="button"
                disabled={layer.locked || layers[0]?.id === layer.id}
                onClick={() => {
                  const next = structuredClone(layers),
                    i = next.findIndex((l) => l.id === layer.id);
                  if (i > 0 && !next[i - 1].locked) {
                    [next[i], next[i - 1]] = [next[i - 1], next[i]];
                    commit(next.map((l, n) => ({ ...l, zIndex: 6 + n })));
                  }
                }}
              >
                ↓ Đưa xuống
              </button>
              <button
                type="button"
                disabled={layer.locked || layers.at(-1)?.id === layer.id}
                onClick={() => {
                  const next = structuredClone(layers),
                    i = next.findIndex((l) => l.id === layer.id);
                  if (i < next.length - 1 && !next[i + 1].locked) {
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    commit(next.map((l, n) => ({ ...l, zIndex: 6 + n })));
                  }
                }}
              >
                ↑ Đưa lên
              </button>
            </div>
            <label className="col-span-2">
              Tên
              <input
                disabled={layer.locked}
                value={layer.name}
                onChange={(e) => update({ name: e.target.value || 'FX' })}
                className="ml-2 rounded bg-white/10 p-1"
              />
            </label>
            {(['density', 'speed', 'angle', 'size'] as const).map((key) => (
              <label key={key}>
                {
                  {
                    density: 'Mật độ',
                    speed: 'Tốc độ',
                    angle: 'Góc rơi',
                    size: 'Kích thước',
                  }[key]
                }
                <input
                  type="number"
                  disabled={layer.locked}
                  min={key === 'angle' ? -60 : key === 'size' ? 0.5 : 0.2}
                  max={key === 'angle' ? 60 : 3}
                  step="0.1"
                  value={Number(layer.params[key] ?? 1)}
                  onChange={(e) => {
                    const n = e.currentTarget.valueAsNumber;
                    if (Number.isFinite(n))
                      update({
                        params: {
                          ...layer.params,
                          [key]: Math.max(
                            key === 'angle' ? -60 : key === 'size' ? 0.5 : 0.2,
                            Math.min(key === 'angle' ? 60 : 3, n),
                          ),
                        },
                      });
                  }}
                  className="ml-2 w-16 rounded bg-white/10 p-1"
                />
              </label>
            ))}
            <label>
              Độ hiện
              <input
                type="range"
                disabled={layer.locked}
                min="0"
                max="1"
                step=".01"
                value={layer.opacity}
                onChange={(e) => update({ opacity: Number(e.target.value) })}
              />
            </label>
            <label>
              Blend
              <select
                disabled={layer.locked}
                value={layer.blendMode}
                onChange={(e) =>
                  update({
                    blendMode: e.target.value as SceneLayer['blendMode'],
                  })
                }
                className="ml-2 bg-slate-900"
              >
                {['normal', 'screen', 'multiply', 'overlay', 'add'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            {(['startMs', 'endMs'] as const).map((key) => (
              <label key={key}>
                {key === 'startMs' ? 'Bắt đầu (s)' : 'Kết thúc (s)'}
                <input
                  type="number"
                  disabled={layer.locked}
                  min="0"
                  max={scene.canvas.durationMs / 1000}
                  step=".1"
                  value={layer[key] / 1000}
                  onChange={(e) => {
                    const n = e.currentTarget.valueAsNumber * 1000;
                    if (
                      Number.isFinite(n) &&
                      n >= 0 &&
                      n <= scene.canvas.durationMs &&
                      (key === 'startMs' ? n < layer.endMs : n > layer.startMs)
                    )
                      update({ [key]: n });
                  }}
                  className="ml-2 w-20 bg-white/10 p-1"
                />
              </label>
            ))}
            {(['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const).map(
              (key) => (
                <label key={key}>
                  {
                    {
                      x: 'X (px)',
                      y: 'Y (px)',
                      rotation: 'Xoay (°)',
                      scaleX: 'Scale X',
                      scaleY: 'Scale Y',
                    }[key]
                  }
                  <input
                    type="number"
                    disabled={layer.locked}
                    step={key.startsWith('scale') ? '.1' : '1'}
                    value={layer.transform[key]}
                    onChange={(e) => {
                      const n = e.currentTarget.valueAsNumber;
                      if (Number.isFinite(n))
                        update({ transform: { ...layer.transform, [key]: n } });
                    }}
                    className="ml-2 w-20 rounded bg-white/10 p-1"
                  />
                </label>
              ),
            )}
            <button
              type="button"
              disabled={layer.locked}
              onClick={() => {
                const track = layer.animations.find(
                  (a) => a.property === 'opacity',
                );
                const at = Math.max(
                  0,
                  Math.min(scene.canvas.durationMs, timeMs),
                );
                const keyframes = [
                  ...(track?.keyframes.filter((k) => k.timeMs !== at) ?? []),
                  {
                    timeMs: at,
                    value: layer.opacity,
                    easing: 'linear' as const,
                  },
                ].sort((a, b) => a.timeMs - b.timeMs);
                update({
                  animations: [
                    ...layer.animations.filter((a) => a.property !== 'opacity'),
                    { property: 'opacity', keyframes },
                  ],
                });
              }}
            >
              Keyframe độ hiện tại {(timeMs / 1000).toFixed(2)}s
            </button>
            <button
              type="button"
              disabled={layer.locked || !layer.animations.length}
              onClick={() => update({ animations: [] })}
            >
              Xóa keyframes
            </button>
            {layer.animations.map((a) => (
              <p key={a.property} className="col-span-2 text-white/60">
                {a.property}:{' '}
                {a.keyframes
                  .map((k) => `${(k.timeMs / 1000).toFixed(2)}s = ${k.value}`)
                  .join(' · ')}
              </p>
            ))}
            <button
              type="button"
              onClick={() => {
                const copy = structuredClone(layer);
                copy.id = crypto.randomUUID();
                copy.name += ' copy';
                copy.locked = false;
                copy.zIndex = Math.max(...layers.map((l) => l.zIndex)) + 1;
                commit([...layers, copy]);
                setSelected(copy.id);
              }}
            >
              Nhân bản
            </button>
            <button
              type="button"
              disabled={layer.locked}
              onClick={() => {
                commit(layers.filter((l) => l.id !== layer.id));
                setSelected(undefined);
              }}
            >
              Xóa lớp
            </button>
          </div>
        )}
      </fieldset>
    </details>
  );
}
