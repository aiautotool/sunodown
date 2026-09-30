import type { SceneDocument } from './scene.ts';
const types = new Set([
  'audio',
  'image',
  'video',
  'text',
  'karaoke',
  'waveform',
  'shape',
  'group',
  'effect',
  'adjustment',
]);
const blends = new Set(['normal', 'screen', 'multiply', 'overlay', 'add']);
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
function fail(message: string): never {
  throw new Error(`Invalid scene: ${message}`);
}
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('expected object');
}
function finite(value: unknown, min = -Infinity): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min)
    fail('invalid number');
}
function string(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.length) fail('missing string');
}
export function validateScene(value: unknown): asserts value is SceneDocument {
  object(value);
  if (value.schemaVersion !== 4) fail('unsupported schema version');
  object(value.canvas);
  for (const key of ['width', 'height', 'fps', 'durationMs'])
    finite(value.canvas[key], Number.EPSILON);
  if (
    (value.canvas.width as number) > 16384 ||
    (value.canvas.height as number) > 16384 ||
    (value.canvas.fps as number) > 240
  )
    fail('canvas limit');
  for (const key of ['assets', 'layers', 'slots'])
    if (!Array.isArray(value[key]) || value[key].length > 1000)
      fail(`${key} limit`);
  const assets = new Set<string>(),
    layers = new Map<string, Record<string, unknown>>();
  for (const asset of value.assets as unknown[]) {
    object(asset);
    string(asset.id);
    string(asset.mime);
    string(asset.source);
    if (
      !['image', 'video', 'audio', 'font'].includes(String(asset.type)) ||
      assets.has(asset.id)
    )
      fail('invalid asset');
    if (/^(javascript|vbscript):/i.test(asset.source))
      fail('unsafe asset source');
    assets.add(asset.id);
  }
  for (const layer of value.layers as unknown[]) {
    object(layer);
    string(layer.id);
    string(layer.name);
    if (
      layers.has(layer.id) ||
      !types.has(String(layer.type)) ||
      !blends.has(String(layer.blendMode))
    )
      fail('invalid layer');
    layers.set(layer.id, layer);
    if (typeof layer.visible !== 'boolean' || typeof layer.locked !== 'boolean')
      fail('layer flags');
    finite(layer.startMs, 0);
    finite(layer.endMs, 0);
    finite(layer.zIndex);
    finite(layer.opacity, 0);
    if (layer.endMs <= layer.startMs || layer.opacity > 1) fail('layer range');
    object(layer.transform);
    for (const key of [
      'x',
      'y',
      'width',
      'height',
      'scaleX',
      'scaleY',
      'rotation',
    ])
      finite(layer.transform[key]);
    if (
      (layer.transform.width as number) <= 0 ||
      (layer.transform.height as number) <= 0
    )
      fail('layer dimensions');
    object(layer.params);
    if (layer.assetId !== undefined) {
      string(layer.assetId);
      if (!assets.has(layer.assetId)) fail('missing asset');
    }
    if (layer.seed !== undefined) finite(layer.seed);
    if (layer.mask !== undefined) {
      object(layer.mask);
      if (!['rectangle', 'ellipse'].includes(String(layer.mask.type)))
        fail('mask type');
      for (const key of ['x', 'y', 'width', 'height']) finite(layer.mask[key]);
      if (
        (layer.mask.width as number) <= 0 ||
        (layer.mask.height as number) <= 0
      )
        fail('mask dimensions');
    }
    if (!Array.isArray(layer.animations) || layer.animations.length > 100)
      fail('animation limit');
    for (const track of layer.animations) {
      object(track);
      string(track.property);
      const path = track.property;
      if (
        ![
          'x',
          'y',
          'width',
          'height',
          'scaleX',
          'scaleY',
          'rotation',
          'opacity',
        ].includes(path) &&
        !/^params\.[a-zA-Z][\w-]*$/.test(path)
      )
        fail('animation property');
      if (forbidden.has(path.slice(7))) fail('unsafe property');
      if (!Array.isArray(track.keyframes) || track.keyframes.length > 10000)
        fail('keyframe limit');
      let previous = -1;
      for (const key of track.keyframes) {
        object(key);
        finite(key.timeMs, 0);
        finite(key.value);
        if (key.timeMs <= previous) fail('keyframes must be strictly ordered');
        if (key.easing !== undefined) {
          string(key.easing);
          if (
            !['linear', 'ease-in', 'ease-out', 'ease-in-out', 'hold'].includes(
              key.easing,
            )
          )
            fail('easing');
        }
        previous = key.timeMs;
      }
    }
  }
  for (const layer of layers.values()) {
    const visited = new Set<string>([String(layer.id)]);
    let id = layer.parentId;
    while (id !== undefined) {
      string(id);
      const parent = layers.get(id);
      if (!parent || parent.type !== 'group' || visited.has(id))
        fail('invalid group hierarchy');
      visited.add(id);
      id = parent.parentId;
    }
  }
  const slots = new Set<string>();
  for (const slot of value.slots as unknown[]) {
    object(slot);
    string(slot.id);
    string(slot.label);
    string(slot.property);
    if (
      slots.has(slot.id) ||
      !layers.has(String(slot.layerId)) ||
      !['media', 'text', 'color'].includes(String(slot.type))
    )
      fail('invalid slot');
    slots.add(slot.id);
  }
  object(value.globals);
  object(value.globals.wind);
  if (typeof value.globals.wind.enabled !== 'boolean') fail('wind flag');
  for (const key of ['direction', 'strength', 'turbulence', 'gust'])
    finite(value.globals.wind[key]);
}
export function serializeScene(scene: SceneDocument): string {
  validateScene(scene);
  return JSON.stringify(scene);
}
export function parseScene(json: string): SceneDocument {
  if (json.length > 16 * 1024 * 1024) fail('document too large');
  const value: unknown = JSON.parse(json);
  validateScene(value);
  return value;
}
