import {
  migrateLegacyVisual,
  compileRenderPlan,
  serializeScene,
  type SceneDocument,
  type SceneLayer,
} from '@/packages/scene-core/src';
import { DEFAULT_WAVE_APPEARANCE } from '@/components/v4/types';
import type { EffectConfig, VideoEffect } from '@/components/v8/video-effects';
import { type StudioPresetConfig } from '@/components/presets/studio-presets';
import {
  comparePreviewAndRender,
  normalizeVisualSnapshot,
  visualFingerprint,
  type VisualParityReport,
} from '@/components/presets/preset-regression';

export type StudioRenderModel = {
  visual: StudioPresetConfig & {
    waveAppearance: typeof DEFAULT_WAVE_APPEARANCE;
  };
  effects: EffectConfig;
  scene: SceneDocument;
  renderPlan: ReturnType<typeof compileRenderPlan>;
  sceneFingerprint: string;
  fingerprint: string;
};

/**
 * Canonical visual state consumed by both LivePreview and export renderer.
 * Do not build a second render config in either surface: normalize here first.
 */
export function createStudioRenderModel(
  config: StudioPresetConfig,
  durationMs = 30000,
  effectLayers?: SceneLayer[],
): StudioRenderModel {
  const normalized = normalizeVisualSnapshot(config);
  const visual = {
    ...normalized,
    waveAppearance: normalized.waveAppearance!,
  } satisfies StudioPresetConfig & {
    waveAppearance: typeof DEFAULT_WAVE_APPEARANCE;
  };

  const scene = migrateLegacyVisual(visual, Math.max(1, durationMs));
  if (effectLayers)
    scene.layers = [
      ...scene.layers.filter((l) => l.type !== 'effect'),
      ...structuredClone(effectLayers),
    ];
  return {
    visual,
    scene,
    renderPlan: compileRenderPlan(scene),
    sceneFingerprint: sceneHash(scene),
    effects: {
      effects: scene.layers
        .filter((l) => l.type === 'effect')
        .map((l) => l.effectId as VideoEffect),
      intensity: visual.effectSettings!.density,
      speed: visual.effectSettings!.speed,
      fallAngle: visual.effectSettings!.angle,
      particleSize: visual.effectSettings!.size,
      opacity: 0.75,
      wind: 0,
      scene,
    },
    fingerprint: effectLayers ? sceneHash(scene) : visualFingerprint(visual),
  };
}

export function assertStudioRenderParity(
  preview: StudioPresetConfig,
  render: StudioPresetConfig,
): VisualParityReport {
  const report = comparePreviewAndRender(preview, render);
  if (!report.ok) {
    throw new Error(
      `Visual sync failed [${report.fingerprint} → ${report.renderFingerprint}]: ${report.issues.join(', ')}`,
    );
  }
  return report;
}

function sceneHash(scene: SceneDocument): string {
  const json = serializeScene(scene);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i++)
    hash = Math.imul(hash ^ json.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
