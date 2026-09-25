import { DEFAULT_WAVE_APPEARANCE } from '@/components/v4/types';
import type { EffectConfig } from '@/components/v8/video-effects';
import type { StudioPresetConfig } from '@/components/presets/studio-presets';
import {
  comparePreviewAndRender,
  visualFingerprint,
  type VisualParityReport,
} from '@/components/presets/preset-regression';

export type StudioRenderModel = {
  visual: StudioPresetConfig & { waveAppearance: typeof DEFAULT_WAVE_APPEARANCE };
  effects: EffectConfig;
  fingerprint: string;
};

/**
 * Canonical visual state consumed by both LivePreview and export renderer.
 * Do not build a second render config in either surface: normalize here first.
 */
export function createStudioRenderModel(config: StudioPresetConfig): StudioRenderModel {
  const visual = {
    template: config.template,
    wave: config.wave,
    waveAppearance: {
      ...DEFAULT_WAVE_APPEARANCE,
      ...(config.waveAppearance || {}),
    },
    motion: config.motion,
    aspect: config.aspect,
    lyrics: config.lyrics,
    effects: [...config.effects],
    layout: structuredClone(config.layout),
    textStyles: structuredClone(config.textStyles),
    subtitleStyle: structuredClone(config.subtitleStyle),
    background: structuredClone(config.background),
  } satisfies StudioPresetConfig & { waveAppearance: typeof DEFAULT_WAVE_APPEARANCE };

  return {
    visual,
    effects: {
      effects: [...visual.effects],
      intensity: 1,
      speed: 1,
      opacity: 0.75,
      wind: 0,
    },
    fingerprint: visualFingerprint(visual),
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
