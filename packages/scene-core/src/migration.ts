import { createLayer, type SceneDocument, type SceneLayer } from './scene.ts';
/** Structural input keeps migration portable without importing UI modules. */
export type LegacyVisual = {
  aspect: string;
  template: string;
  wave: string;
  motion: string;
  lyrics: string;
  layout: Record<string, { x: number; y: number; scale: number }>;
  background: object;
  textStyles: object;
  subtitleStyle: object;
  waveAppearance?: object;
  effects: string[];
  effectSettings?: {
    density: number;
    speed: number;
    angle: number;
    size: number;
  };
};
export function migrateLegacyVisual(
  config: LegacyVisual,
  durationMs = 30000,
): SceneDocument {
  const sizes: Record<string, [number, number]> = {
    '16:9': [1280, 720],
    '9:16': [720, 1280],
    '1:1': [1080, 1080],
    '4:5': [864, 1080],
    '4:3': [960, 720],
  };
  const [width, height] = sizes[config.aspect] ?? sizes['16:9'];
  function layer(
    id: string,
    type: SceneLayer['type'],
    zIndex: number,
    params: Record<string, unknown>,
  ) {
    const l = createLayer(id, type, durationMs),
      pos = config.layout[id];
    l.zIndex = zIndex;
    l.params = structuredClone(params);
    l.transform.width = width;
    l.transform.height = height;
    if (pos)
      Object.assign(l.transform, {
        x: (width * pos.x) / 100,
        y: (height * pos.y) / 100,
        scaleX: pos.scale / 100,
        scaleY: pos.scale / 100,
      });
    return l;
  }
  const text = config.textStyles as Record<string, unknown>;
  const subtitle = layer('subtitle', 'karaoke', 4, {
    style: config.subtitleStyle,
    mode: config.lyrics,
  });
  subtitle.visible = config.lyrics !== 'off';
  return {
    schemaVersion: 4,
    canvas: { width, height, fps: 30, durationMs },
    assets: [],
    layers: [
      layer('background', 'image', 0, { legacyBackground: config.background }),
      layer('template', 'group', 1, {
        legacyTemplate: config.template,
        motion: config.motion,
      }),
      layer('title', 'text', 2, {
        style: text.title ?? {},
        binding: 'song.title',
      }),
      layer('creator', 'text', 3, {
        style: text.creator ?? {},
        binding: 'song.creator',
      }),
      subtitle,
      layer('wave', 'waveform', 5, {
        style: config.wave,
        appearance: config.waveAppearance ?? {},
      }),
      ...config.effects.map((id, i) => ({
        ...layer(`effect-${i}-${id}`, 'effect', 6 + i, {
          ...config.effectSettings,
        }),
        effectId: id,
        seed: 0,
      })),
    ],
    slots: [
      {
        id: 'title',
        label: 'Tên bài hát',
        type: 'text',
        layerId: 'title',
        property: 'params.style.text',
      },
      {
        id: 'background',
        label: 'Ảnh nền',
        type: 'media',
        layerId: 'background',
        property: 'assetId',
      },
    ],
    globals: {
      wind: {
        enabled: false,
        direction: 0,
        strength: 0,
        turbulence: 0,
        gust: 0,
      },
    },
  };
}
