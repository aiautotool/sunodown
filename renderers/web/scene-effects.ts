import { evaluateSceneFrame } from '@/packages/scene-core/src';
import {
  normalizeEffectSettings,
  type EffectConfig,
  type VideoEffect,
} from '@/components/v8/video-effects';

/** Shared Canvas adapter for live preview and frame-by-frame export. */
export function drawSceneEffects(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  input: EffectConfig,
  supportedEffects: Set<string>,
  drawEffect: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    input: EffectConfig,
  ) => void,
) {
  if (!input.scene) return;
  const scene = input.scene;
  const frame = evaluateSceneFrame(scene, Math.max(0, t * 1000));
  for (const layer of frame.layers) {
    if (layer.type !== 'effect' || !supportedEffects.has(layer.effectId ?? ''))
      continue;
    const params = layer.params;
    const settings = normalizeEffectSettings({
      density: Number(params.density ?? input.intensity),
      speed: Number(params.speed ?? input.speed),
      angle: Number(params.angle ?? input.fallAngle ?? 0),
      size: Number(params.size ?? input.particleSize ?? 1),
    });
    ctx.save();
    const m = layer.worldMatrix;
    const rx = w / scene.canvas.width,
      ry = h / scene.canvas.height;
    ctx.transform(
      m[0],
      (m[1] * ry) / rx,
      (m[2] * rx) / ry,
      m[3],
      (m[4] * w) / scene.canvas.width,
      (m[5] * h) / scene.canvas.height,
    );
    if (layer.mask) {
      const mask = layer.mask;
      ctx.beginPath();
      if (mask.type === 'ellipse')
        ctx.ellipse(
          ((mask.x + mask.width / 2) * w) / scene.canvas.width,
          ((mask.y + mask.height / 2) * h) / scene.canvas.height,
          (mask.width * w) / scene.canvas.width / 2,
          (mask.height * h) / scene.canvas.height / 2,
          0,
          0,
          Math.PI * 2,
        );
      else
        ctx.rect(
          (mask.x * w) / scene.canvas.width,
          (mask.y * h) / scene.canvas.height,
          (mask.width * w) / scene.canvas.width,
          (mask.height * h) / scene.canvas.height,
        );
      ctx.clip();
    }
    ctx.globalCompositeOperation = (
      {
        normal: 'source-over',
        screen: 'screen',
        multiply: 'multiply',
        overlay: 'overlay',
        add: 'lighter',
      } as const
    )[layer.blendMode];
    drawEffect(ctx, w, h, t, {
      ...input,
      scene: undefined,
      effects: [layer.effectId as VideoEffect],
      intensity: settings.density,
      speed: settings.speed,
      fallAngle: settings.angle,
      particleSize: settings.size,
      opacity: input.opacity * layer.worldOpacity,
      seed: layer.seed,
    });
    ctx.restore();
  }
}
