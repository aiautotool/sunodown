import type { SceneLayer } from './scene.ts';
export function retimeLayer(
  layer: SceneLayer,
  deltaMs: number,
  mode: 'move' | 'start' | 'end',
  durationMs: number,
): SceneLayer {
  if (
    layer.locked ||
    !Number.isFinite(deltaMs) ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  )
    return layer;
  const result = structuredClone(layer),
    span = layer.endMs - layer.startMs,
    min = Math.min(50, span);
  const clamp = (n: number, a: number, b: number) =>
    Math.max(a, Math.min(b, n));
  if (mode === 'move') {
    result.startMs = clamp(
      layer.startMs + deltaMs,
      0,
      Math.max(0, durationMs - span),
    );
    result.endMs = Math.min(durationMs, result.startMs + span);
    const shift = result.startMs - layer.startMs;
    result.animations = result.animations.map((track) => ({
      ...track,
      keyframes: Array.from(
        new Map(
          track.keyframes
            .map((key) => ({
              ...key,
              timeMs: Math.max(0, key.timeMs + shift),
            }))
            .map((key) => [key.timeMs, key]),
        ).values(),
      ),
    }));
  } else if (mode === 'start')
    result.startMs = clamp(layer.startMs + deltaMs, 0, layer.endMs - min);
  else
    result.endMs = clamp(
      layer.endMs + deltaMs,
      layer.startMs + min,
      durationMs,
    );
  if (mode === 'start' && (layer.type === 'video' || layer.type === 'audio'))
    result.params.trimStartMs = Math.max(
      0,
      Number(layer.params.trimStartMs || 0) + result.startMs - layer.startMs,
    );
  return result;
}
