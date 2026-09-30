/** Portable document data: no React, DOM, storage or renderer dependencies. */
export type LayerType =
  | 'audio'
  | 'image'
  | 'video'
  | 'text'
  | 'karaoke'
  | 'waveform'
  | 'shape'
  | 'group'
  | 'effect'
  | 'adjustment';
export type Transform = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};
export type AnimationTrack = {
  property: keyof Transform | 'opacity' | `params.${string}`;
  keyframes: {
    timeMs: number;
    value: number;
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';
  }[];
};
export type SceneLayer = {
  id: string;
  type: LayerType;
  name: string;
  parentId?: string;
  role?:
    | 'main-video'
    | 'foreground'
    | 'background'
    | 'atmosphere'
    | 'text'
    | 'subtitle'
    | 'audio';
  visible: boolean;
  locked: boolean;
  zIndex: number;
  startMs: number;
  endMs: number;
  transform: Transform;
  opacity: number;
  blendMode: 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
  assetId?: string;
  effectId?: string;
  seed?: number;
  mask?: {
    type: 'rectangle' | 'ellipse';
    x: number;
    y: number;
    width: number;
    height: number;
  };
  params: Record<string, unknown>;
  animations: AnimationTrack[];
};
export type SceneAsset = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'font';
  mime: string;
  hash?: string;
  source: string;
};
export type TemplateSlot = {
  id: string;
  label: string;
  type: 'media' | 'text' | 'color';
  layerId: string;
  property: string;
};
export type SceneDocument = {
  schemaVersion: 4;
  canvas: { width: number; height: number; fps: number; durationMs: number };
  assets: SceneAsset[];
  layers: SceneLayer[];
  slots: TemplateSlot[];
  globals: {
    wind: {
      enabled: boolean;
      direction: number;
      strength: number;
      turbulence: number;
      gust: number;
    };
  };
};
export function createLayer(
  id: string,
  type: LayerType,
  durationMs: number,
): SceneLayer {
  return {
    id,
    type,
    name: id,
    visible: true,
    locked: false,
    zIndex: 0,
    startMs: 0,
    endMs: durationMs,
    transform: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    opacity: 1,
    blendMode: 'normal',
    params: {},
    animations: [],
  };
}
