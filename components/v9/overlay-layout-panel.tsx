'use client';
import { Move, RotateCcw } from 'lucide-react';
export type OverlayLayout = {
  wave: { x: number; y: number; scale: number };
  subtitle: { x: number; y: number; scale: number };
  title: { x: number; y: number; scale: number };
  creator: { x: number; y: number; scale: number };
};
export const DEFAULT_OVERLAY_LAYOUT: OverlayLayout = {
  wave: { x: 50, y: 86, scale: 100 },
  subtitle: { x: 50, y: 58, scale: 100 },
  title: { x: 50, y: 67, scale: 100 },
  creator: { x: 50, y: 75, scale: 100 },
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function OverlayLayoutPanel({
  value,
  onChange,
}: {
  value: OverlayLayout;
  onChange: (v: OverlayLayout) => void;
}) {
  const set = (
    key: 'wave' | 'subtitle' | 'title' | 'creator',
    field: 'x' | 'y' | 'scale',
    n: number,
  ) =>
    onChange({
      ...value,
      [key]: {
        ...value[key],
        [field]: field === 'scale' ? clamp(n, 40, 180) : clamp(n, 0, 100),
      },
    });
  return (
    <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-300">
            Bố cục tự do
          </p>
          <b className="text-sm">Kéo sóng & subtitle trực tiếp trên preview</b>
        </div>
        <button
          onClick={() => onChange(DEFAULT_OVERLAY_LAYOUT)}
          className="rounded-lg bg-white/5 px-3 py-2 text-xs"
        >
          <RotateCcw className="mr-1 inline size-3.5" />
          Reset
        </button>
      </div>
      <p className="mt-1 text-[11px] text-white/40">
        <Move className="mr-1 inline size-3" />
        Kéo tới bất kỳ vị trí nào. Có thể tinh chỉnh X/Y và kích thước.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(['wave', 'subtitle', 'title', 'creator'] as const).map((key) => (
          <div key={key} className="rounded-xl bg-black/20 p-3">
            <b className="text-xs">
              {key === 'wave' ? 'Sóng nhạc' : 'Subtitle'}
            </b>
            {(['x', 'y', 'scale'] as const).map((field) => (
              <label
                key={field}
                className="mt-2 grid grid-cols-[54px_1fr_42px] items-center gap-2 text-[10px] text-white/45"
              >
                <span>{field === 'scale' ? 'Size' : field.toUpperCase()}</span>
                <input
                  type="range"
                  min={field === 'scale' ? 40 : 0}
                  max={field === 'scale' ? 180 : 100}
                  value={value[key][field]}
                  onChange={(e) => set(key, field, Number(e.target.value))}
                  className="accent-emerald-300"
                />
                <span className="text-right font-mono">
                  {value[key][field]}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
