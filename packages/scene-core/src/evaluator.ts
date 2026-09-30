import type { AnimationTrack, SceneDocument, SceneLayer } from './scene.ts';
export type EvaluatedLayer = SceneLayer & {
  worldMatrix: number[];
  worldOpacity: number;
  random: number;
};
export type SceneFrame = {
  timeMs: number;
  frame: number;
  layers: EvaluatedLayer[];
};
function sample(track: AnimationTrack, timeMs: number): number | undefined {
  const keys = track.keyframes;
  if (!keys.length) return undefined;
  if (timeMs <= keys[0].timeMs) return keys[0].value;
  const last = keys[keys.length - 1];
  if (timeMs >= last.timeMs) return last.value;
  const i = keys.findIndex((key) => key.timeMs > timeMs),
    a = keys[i - 1],
    b = keys[i];
  let p = (timeMs - a.timeMs) / (b.timeMs - a.timeMs);
  switch (a.easing) {
    case 'hold':
      p = 0;
      break;
    case 'ease-in':
      p *= p;
      break;
    case 'ease-out':
      p = 1 - (1 - p) ** 2;
      break;
    case 'ease-in-out':
      p = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      break;
  }
  return a.value + (b.value - a.value) * p;
}
function multiply(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
/** Absolute milliseconds remain exact; fps labels the frame without quantizing karaoke. */
export function evaluateSceneFrame(
  scene: SceneDocument,
  timeMs: number,
): SceneFrame {
  if (!Number.isFinite(timeMs) || timeMs < 0)
    throw new Error('Invalid scene time');
  const cache = new Map<string, EvaluatedLayer | null>();
  const byId = new Map(scene.layers.map((layer) => [layer.id, layer]));
  const visiting = new Set<string>();
  function resolve(layer: SceneLayer): EvaluatedLayer | null {
    if (cache.has(layer.id)) return cache.get(layer.id)!;
    if (visiting.has(layer.id)) throw new Error('Cyclic scene group');
    visiting.add(layer.id);
    const parent = layer.parentId ? byId.get(layer.parentId) : undefined;
    const p = parent ? resolve(parent) : undefined;
    if (
      !layer.visible ||
      timeMs < layer.startMs ||
      timeMs >= layer.endMs ||
      (layer.parentId && !p)
    ) {
      visiting.delete(layer.id);
      cache.set(layer.id, null);
      return null;
    }
    const result = structuredClone(layer);
    for (const track of layer.animations) {
      const value = sample(track, timeMs);
      if (value === undefined) continue;
      if (track.property === 'opacity')
        result.opacity = Math.max(0, Math.min(1, value));
      else if (track.property.startsWith('params.'))
        result.params[track.property.slice(7)] = value;
      else
        result.transform[track.property as keyof typeof result.transform] =
          value;
    }
    const t = result.transform,
      angle = (t.rotation * Math.PI) / 180;
    const matrix = [
      Math.cos(angle) * t.scaleX,
      Math.sin(angle) * t.scaleX,
      -Math.sin(angle) * t.scaleY,
      Math.cos(angle) * t.scaleY,
      t.x,
      t.y,
    ];
    const seed = layer.seed ?? 0;
    const hash =
      Math.sin(
        seed * 127.1 + Math.floor((timeMs * scene.canvas.fps) / 1000) * 311.7,
      ) * 43758.5453;
    const evaluated = {
      ...result,
      worldMatrix: p ? multiply(p.worldMatrix, matrix) : matrix,
      worldOpacity: result.opacity * (p?.worldOpacity ?? 1),
      random: hash - Math.floor(hash),
    };
    visiting.delete(layer.id);
    cache.set(layer.id, evaluated);
    return evaluated;
  }
  // Sort siblings, then flatten each group in place; children cannot escape their group.
  function children(parentId?: string): EvaluatedLayer[] {
    return scene.layers
      .filter((l) => l.parentId === parentId)
      .sort((a, b) => a.zIndex - b.zIndex)
      .flatMap((layer) => {
        const evaluated = resolve(layer);
        return evaluated ? [evaluated, ...children(layer.id)] : [];
      });
  }
  return {
    timeMs,
    frame: Math.floor((timeMs * scene.canvas.fps) / 1000),
    layers: children(),
  };
}
export function compileRenderPlan(scene: SceneDocument) {
  return {
    schemaVersion: 4 as const,
    canvas: structuredClone(scene.canvas),
    sources: structuredClone(scene.assets),
    scene: structuredClone(scene),
    operations: [
      'source',
      'transform',
      'mask',
      'effect',
      'blend',
      'composite',
    ] as const,
  };
}
