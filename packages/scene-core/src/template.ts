import type { SceneDocument } from './scene.ts';
import { validateScene } from './serializer.ts';
export type PresetKind =
  | 'scene'
  | 'style'
  | 'layout'
  | 'fx'
  | 'text-karaoke'
  | 'visualizer'
  | 'component';
export type TimingRule =
  | { type: 'full' }
  | { type: 'relative'; start: number; end: number }
  | { type: 'anchors'; startOffsetMs: number; endOffsetMs: number }
  | { type: 'lyrics' };
export type SceneTemplate = {
  schemaVersion: 4;
  id: string;
  name: string;
  kind: PresetKind;
  scene: SceneDocument;
  timing: Record<string, TimingRule>;
};
/** Templates contain bindings, not the previous song's audio or recognized lyrics. */
export function createSceneTemplate(
  scene: SceneDocument,
  id: string,
  name: string,
  kind: PresetKind = 'scene',
): SceneTemplate {
  validateScene(scene);
  const copy = structuredClone(scene),
    timing: Record<string, TimingRule> = {};
  copy.layers = copy.layers.filter((l) => l.type !== 'audio');
  const retained = new Set(copy.layers.map((l) => l.id));
  copy.slots = copy.slots.filter((s) => retained.has(s.layerId));
  for (const layer of copy.layers) {
    if (layer.type === 'karaoke') {
      timing[layer.id] = { type: 'lyrics' };
      layer.params.cues = [];
    } else
      timing[layer.id] =
        layer.startMs === 0 && layer.endMs === scene.canvas.durationMs
          ? { type: 'full' }
          : {
              type: 'relative',
              start: layer.startMs / scene.canvas.durationMs,
              end: layer.endMs / scene.canvas.durationMs,
            };
    if (layer.params.songBound === true) {
      delete layer.assetId;
      layer.params.binding =
        layer.role === 'main-video' ? 'song.background' : 'song.media';
    }
  }
  const referenced = new Set(copy.layers.map((l) => l.assetId).filter(Boolean));
  copy.assets = copy.assets.filter(
    (a) => referenced.has(a.id) && a.type !== 'audio',
  );
  return { schemaVersion: 4, id, name, kind, scene: copy, timing };
}
export function instantiateTemplate(
  template: SceneTemplate,
  durationMs: number,
  cues: { startMs: number; endMs: number; text: string }[] = [],
): SceneDocument {
  if (!Number.isFinite(durationMs) || durationMs <= 0)
    throw new Error('Invalid target duration');
  validateSceneTemplate(template);
  const scene = structuredClone(template.scene),
    oldDuration = scene.canvas.durationMs;
  scene.canvas.durationMs = durationMs;
  for (const layer of scene.layers) {
    const rule = template.timing[layer.id] ?? {
      type: 'relative',
      start: layer.startMs / oldDuration,
      end: layer.endMs / oldDuration,
    };
    if (rule.type === 'relative') {
      layer.startMs = Math.max(
        0,
        Math.min(durationMs, rule.start * durationMs),
      );
      layer.endMs = Math.max(
        layer.startMs,
        Math.min(durationMs, rule.end * durationMs),
      );
    } else if (rule.type === 'anchors') {
      layer.startMs = Math.max(0, rule.startOffsetMs);
      layer.endMs = Math.min(durationMs, durationMs + rule.endOffsetMs);
    } else {
      layer.startMs = 0;
      layer.endMs = durationMs;
      if (rule.type === 'lyrics') layer.params.cues = structuredClone(cues);
    }
    for (const animation of layer.animations)
      for (const key of animation.keyframes)
        key.timeMs = (key.timeMs / oldDuration) * durationMs;
  }
  scene.layers = scene.layers.filter((layer) => layer.endMs > layer.startMs);
  let previousCount = -1;
  while (previousCount !== scene.layers.length) {
    previousCount = scene.layers.length;
    const live = new Set(scene.layers.map((l) => l.id));
    scene.layers = scene.layers.filter(
      (l) => !l.parentId || live.has(l.parentId),
    );
  }
  const ids = new Set(scene.layers.map((l) => l.id));
  scene.slots = scene.slots.filter((slot) => ids.has(slot.layerId));
  validateScene(scene);
  return scene;
}

export function validateSceneTemplate(template: SceneTemplate): void {
  if (
    !template ||
    template.schemaVersion !== 4 ||
    typeof template.id !== 'string' ||
    typeof template.name !== 'string' ||
    ![
      'scene',
      'style',
      'layout',
      'fx',
      'text-karaoke',
      'visualizer',
      'component',
    ].includes(template.kind)
  )
    throw new Error('Invalid scene template');
  validateScene(template.scene);
  if (
    !template.timing ||
    typeof template.timing !== 'object' ||
    Array.isArray(template.timing)
  )
    throw new Error('Invalid template timing');
  const ids = new Set(template.scene.layers.map((l) => l.id));
  for (const [id, rule] of Object.entries(template.timing)) {
    if (!ids.has(id) || !rule || typeof rule !== 'object')
      throw new Error('Unknown timing layer');
    if (rule.type === 'relative') {
      if (
        !Number.isFinite(rule.start) ||
        !Number.isFinite(rule.end) ||
        rule.start < 0 ||
        rule.end > 1 ||
        rule.end <= rule.start
      )
        throw new Error('Invalid relative timing');
    } else if (rule.type === 'anchors') {
      if (
        !Number.isFinite(rule.startOffsetMs) ||
        !Number.isFinite(rule.endOffsetMs) ||
        rule.startOffsetMs < 0 ||
        rule.endOffsetMs > 0
      )
        throw new Error('Invalid anchor timing');
    } else if (rule.type !== 'full' && rule.type !== 'lyrics')
      throw new Error('Unsupported timing rule');
  }
}
