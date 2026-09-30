import type { SceneDocument, SceneLayer, AnimationTrack } from './scene.ts';
export type TrackRole =
  | 'main-video'
  | 'foreground'
  | 'background'
  | 'atmosphere'
  | 'text'
  | 'subtitle'
  | 'audio';
export type TimelineItem = {
  id: string;
  layerId: string;
  assetId?: string;
  startMs: number;
  endMs: number;
  trimStartMs?: number;
  trimEndMs?: number;
  name: string;
  keyframes: AnimationTrack[];
  cueIndex?: number;
};
export type TimelineTrack = {
  id: string;
  type: 'main-video' | 'overlay' | 'text' | 'karaoke' | 'effect' | 'audio';
  role: TrackRole;
  name: string;
  items: TimelineItem[];
  layerIds: string[];
  locked: boolean;
  hidden: boolean;
  muted: boolean;
};
export type TimelineModel = { durationMs: number; tracks: TimelineTrack[] };
function kind(layer: SceneLayer): TimelineTrack['type'] {
  if (layer.type === 'audio') return 'audio';
  if (layer.type === 'karaoke') return 'karaoke';
  if (layer.type === 'text') return 'text';
  if (layer.type === 'effect' || layer.type === 'adjustment') return 'effect';
  return layer.role === 'main-video' ? 'main-video' : 'overlay';
}
/** Lane placement is a projection. Scene layers remain the only persisted objects. */
export function compileTimeline(scene: SceneDocument): TimelineModel {
  const tracks: TimelineTrack[] = [];
  const add = (layer: SceneLayer, items: TimelineItem[]) => {
    const type = kind(layer),
      role =
        layer.role ??
        (type === 'audio'
          ? 'audio'
          : type === 'karaoke'
            ? 'subtitle'
            : type === 'text'
              ? 'text'
              : type === 'effect'
                ? 'atmosphere'
                : 'foreground');
    // Only compatible, non-overlapping clips share a lane. Parent groups are kept separate.
    const key = `${type}:${role}:${layer.parentId ?? 'root'}`;
    let lane = tracks.find(
      (t) =>
        t.id.startsWith(key + ':') &&
        t.locked === layer.locked &&
        t.hidden === !layer.visible &&
        items.every((item) =>
          t.items.every(
            (existing) =>
              item.endMs <= existing.startMs || item.startMs >= existing.endMs,
          ),
        ),
    );
    if (!lane) {
      lane = {
        id: `${key}:${tracks.filter((t) => t.id.startsWith(key + ':')).length}`,
        type,
        role,
        name:
          type === 'main-video'
            ? 'Main Video'
            : type === 'audio'
              ? 'Audio'
              : type === 'karaoke'
                ? 'Karaoke'
                : layer.name,
        items: [],
        layerIds: [],
        locked: layer.locked,
        hidden: !layer.visible,
        muted: layer.params.muted === true,
      };
      tracks.push(lane);
    }
    lane.items.push(...items);
    lane.layerIds.push(layer.id);
  };
  const candidates = scene.layers
    .filter((l) => l.type !== 'group' && !l.params.timelineHidden)
    .sort((a, b) => b.zIndex - a.zIndex || a.startMs - b.startMs);
  for (const layer of candidates) {
    const item = {
      id: layer.id,
      layerId: layer.id,
      assetId: layer.assetId,
      startMs: layer.startMs,
      endMs: layer.endMs,
      name: layer.name,
      keyframes: layer.animations,
      trimStartMs:
        typeof layer.params.trimStartMs === 'number'
          ? layer.params.trimStartMs
          : undefined,
    };
    const cues =
      layer.type === 'karaoke' && Array.isArray(layer.params.cues)
        ? (layer.params.cues as {
            startMs: number;
            endMs: number;
            text: string;
          }[])
        : null;
    const items = cues
      ? cues.map((cue, i) => ({
          ...item,
          id: `${layer.id}:cue:${i}`,
          name: cue.text,
          startMs: cue.startMs,
          endMs: cue.endMs,
          cueIndex: i,
        }))
      : [item];
    add(layer, items);
  }
  const order = {
    overlay: 0,
    text: 1,
    'main-video': 2,
    karaoke: 3,
    effect: 4,
    audio: 5,
  };
  tracks.sort((a, b) => order[a.type] - order[b.type]);
  for (const track of tracks) track.items.sort((a, b) => a.startMs - b.startMs);
  return { durationMs: scene.canvas.durationMs, tracks };
}
export function rippleDelete(
  scene: SceneDocument,
  layerId: string,
): SceneDocument {
  const target = scene.layers.find((l) => l.id === layerId);
  if (!target || target.locked) return scene;
  const result = structuredClone(scene),
    span = target.endMs - target.startMs;
  result.layers = result.layers
    .filter((l) => l.id !== layerId)
    .map((l) =>
      l.role === target.role &&
      target.role === 'main-video' &&
      !l.locked &&
      l.startMs >= target.endMs
        ? {
            ...l,
            startMs: l.startMs - span,
            endMs: l.endMs - span,
            animations: l.animations.map((t) => ({
              ...t,
              keyframes: t.keyframes.map((k) => ({
                ...k,
                timeMs: k.timeMs - span,
              })),
            })),
          }
        : l,
    );
  result.slots = result.slots.filter((slot) => slot.layerId !== layerId);
  return result;
}
export function splitSceneLayer(
  scene: SceneDocument,
  layerId: string,
  timeMs: number,
  newId: string,
): SceneDocument {
  const layer = scene.layers.find((l) => l.id === layerId);
  if (
    !layer ||
    layer.locked ||
    timeMs <= layer.startMs ||
    timeMs >= layer.endMs
  )
    return scene;
  const result = structuredClone(scene),
    left = result.layers.find((l) => l.id === layerId)!;
  const right = { ...structuredClone(left), id: newId, startMs: timeMs };
  left.endMs = timeMs;
  if (layer.type === 'video' || layer.type === 'audio')
    right.params.trimStartMs =
      Number(layer.params.trimStartMs ?? 0) + timeMs - layer.startMs;
  result.layers.push(right);
  return result;
}
